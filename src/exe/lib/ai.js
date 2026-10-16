import { Store } from './store.js';

// ---- Conversation memory (2026-10-13, Hudson's order: bot forgot context).
// Per-sender rolling history, last 10 messages (5 exchanges). In-memory;
// survives as long as the process lives.
const convoHistory = new Map(); // senderId -> [{role:'user'|'assistant', content}]
const MAX_HISTORY = 10;

export function getHistory(senderId) {
  return convoHistory.get(senderId) || [];
}

// Hydrate in-memory history from persistent disk (call before askAI).
// diskKey: the key used in persistent storage (may differ from memory key,
// e.g. guide uses senderId+':guide' in memory but base senderId on disk).
export async function ensureHistoryLoaded(senderId, diskKey = null) {
  if (convoHistory.has(senderId)) return; // already loaded
  const lookupKey = diskKey || senderId;
  try {
    const memMod = await import('./memory.js');
    const diskHistory = memMod.getHistory(lookupKey, 10);
    if (diskHistory.length > 0) {
      const mapped = diskHistory.map(m => ({
        role: m.role === 'bot' ? 'assistant' : 'user',
        content: m.text,
      }));
      convoHistory.set(senderId, mapped.slice(-10));
      console.log(`💾 [Memory] Hydrated ${mapped.length} messages for ${senderId}`);
    } else {
      convoHistory.set(senderId, []); // mark as loaded (empty)
    }
  } catch (e) {
    convoHistory.set(senderId, []);
  }
}

export function pushHistory(senderId, role, content) {
  if (!senderId) return;
  const h = convoHistory.get(senderId) || [];
  h.push({ role, content: String(content).slice(0, 2000) });
  while (h.length > MAX_HISTORY) h.shift();
  convoHistory.set(senderId, h);
}

export function clearHistory(senderId) {
  convoHistory.delete(senderId);
}

// ---- Multi-key pool: rotation + cooldown fallback ---------------------------
// Keys are read from config ai.apiKey (or GEMINI_API_KEY), separated by
// comma / newline / space / semicolon. Requests rotate across keys so load
// spreads; a key that hits 429/quota cools down for 5 minutes and is skipped.
let keyCursor = 0;
const keyCooldown = new Map(); // key -> epoch ms until which it is skipped
const COOLDOWN_MS = 5 * 60 * 1000;

export function getApiKeys() {
  const config = Store.getConfig();
  const rawKey = config.ai?.apiKey || process.env.GEMINI_API_KEY || '';
  return String(rawKey)
    .split(/[\s,;\n]+/)
    .map(k => k.trim().replace(/^["']|["']$/g, ''))
    .filter(k => k.length > 10);
}

function pickKeyOrder(keys) {
  const now = Date.now();
  const order = [];
  for (let i = 0; i < keys.length; i++) {
    const idx = (keyCursor + i) % keys.length;
    if ((keyCooldown.get(keys[idx]) || 0) > now) continue; // cooling down
    order.push(idx);
  }
  if (!order.length) for (let i = 0; i < keys.length; i++) order.push((keyCursor + i) % keys.length);
  return order;
}

function coolDown(key, ms = COOLDOWN_MS) {
  keyCooldown.set(key, Date.now() + ms);
}
const TRANSIENT_COOLDOWN_MS = 60 * 1000;

// ---- Groq (cheap + fast OpenAI-compatible LLM) ------------------------------
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'qwen/qwen3.8-27b'; // llama-3.3-70b-versatile retired by Groq (404); gpt-oss models are reasoning-only (empty content) — qwen answers directly
let groqCooldownUntil = 0;

export function getGroqKey() {
  const config = Store.getConfig();
  const raw = config.ai?.groqKey || process.env.GROQ_API_KEY || '';
  const k = String(raw).trim().replace(/^["']|["']$/g, '');
  return k.length > 10 ? k : '';
}

/**
 * Chat via Groq (OpenAI-compatible). Throws GROQ_HTTP_<status>|GROQ_NETWORK.
 * @returns { text }
 */
export async function callGroq(messages, { timeoutMs = 12000 } = {}) {
  const key = getGroqKey();
  if (!key) throw new Error('NO_GROQ_KEY');
  if (Date.now() < groqCooldownUntil) throw new Error('GROQ_COOLDOWN');
  try {
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: GROQ_MODEL, messages, max_tokens: 400, temperature: 0.7 }),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text) return { text };
      throw new Error('GROQ_EMPTY');
    }
    const errText = await res.text().catch(() => '');
    console.warn(`[groq] [${GROQ_MODEL}] HTTP ${res.status}`);
    if (res.status === 429 || res.status >= 500) groqCooldownUntil = Date.now() + TRANSIENT_COOLDOWN_MS;
    const e = new Error(`GROQ_HTTP_${res.status}`);
    e.detail = { status: res.status, text: errText };
    throw e;
  } catch (err) {
    if (err.message && err.message.startsWith('GROQ_')) throw err;
    const e = new Error('GROQ_NETWORK');
    e.detail = { status: 0, text: err.message || String(err) };
    throw e;
  }
}

function getModels(configured) {
  // Hudson's order (2026-10-12): Gemini 3.x only — 3.6 primary, 3.7 fallback.
  return [
    configured && configured.includes('3.') ? configured : 'gemini-3.6-flash',
    'gemini-3.6-flash',
    'gemini-3.7-flash'
  ].filter((v, i, a) => a.indexOf(v) === i);
}

/**
 * POST to Gemini with automatic key rotation + cooldown fallback.
 * @returns { data, keyIdx, keyCount, model }
 * @throws Error('NO_API_KEY') | Error('GEMINI_HTTP_<status>'|'GEMINI_NETWORK') with .detail
 */
export async function callGemini(path, payload, { timeoutMs = 12000 } = {}) {
  const config = Store.getConfig();
  const keys = getApiKeys();
  if (!keys.length) throw new Error('NO_API_KEY');
  const models = getModels(config.ai?.model);
  let lastError = null;

  for (const keyIdx of pickKeyOrder(keys)) {
    const key = keys[keyIdx];
    for (const m of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}${path}?key=${key}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(timeoutMs)
        });
        if (res.ok) {
          keyCursor = (keyIdx + 1) % keys.length; // rotate: next request starts at next key
          const data = await res.json().catch(() => ({}));
          return { data, keyIdx, keyCount: keys.length, model: m };
        }
        const errText = await res.text().catch(() => '');
        console.warn(`[gemini] key#${keyIdx + 1}/${keys.length} (${key.slice(0, 8)}...) [${m}] HTTP ${res.status}`);
        lastError = { status: res.status, text: errText };
        if (res.status === 429 || res.status === 403) { coolDown(key); break; } // quota/rate-limit -> next key
        if (res.status >= 500 && res.status < 600) { coolDown(key, TRANSIENT_COOLDOWN_MS); break; } // transient server error -> next key, short rest
        break; // 400/401/404/network-shape -> next key, next model list
      } catch (err) {
        lastError = { status: 0, text: err.message || String(err) };
        break; // network/timeout -> next key
      }
    }
  }
  const e = new Error(lastError && lastError.status ? `GEMINI_HTTP_${lastError.status}` : 'GEMINI_NETWORK');
  e.detail = lastError;
  throw e;
}

export async function askAI(prompt, opts = {}) {
  // opts: { senderId, senderName, systemPrompt } — senderName string also accepted for back-compat
  const senderName = typeof opts === 'string' ? opts : (opts.senderName || 'Friend');
  const senderId = typeof opts === 'string' ? null : opts.senderId;
  const config = Store.getConfig();
  const keys = getApiKeys();

  // User personalization (2026-10-13): include who the user is
  let userCtx = '';
  try {
    const { getUserContext } = await import('./onboarding.js');
    userCtx = getUserContext(senderId);
  } catch (e) {}

  const systemPrompt =
    (typeof opts === 'object' && opts.systemPrompt) ||
    config.ai?.systemPrompt ||
    'Aap AwaisxBot hain — ek bilkul aam real insaan jaise Desi Pakistani WhatsApp dost. ' +
    'Baat cheet bilkul natural Roman Urdu mein karein jaise WhatsApp pe close friends aapas mein type karte hain. ' +
    'Sakht robotic format, double dashes (--) ya decorative symbols bilkul use mat karein. ' +
    'Emojis bohot kam use karein (ziyada se ziyada 1 ya 2 natural emojis). ' +
    'Perfect textbook typography ki zaroorat nahi — kabhi kabhi choti spelling mistakes bhi theek hain jaise real log type karte hain. ' +
    'Bilkul casual, friendly aur mukhtasar baat karein. AI-generated NA lagein — real insaan lagein. ' +
    'Yaad rakhein: user se pehle bhi baat hui hai, context ko madde nazar rakhein.' +
    (userCtx ? ` ${userCtx}` : '');

  // Record user turn, build history-aware messages
  pushHistory(senderId, 'user', prompt);
  const history = getHistory(senderId);

  const finish = (text) => {
    const clean = String(text || '').replace(/--+/g, ' - ').trim();
    pushHistory(senderId, 'assistant', clean);
    return clean;
  };

  if (keys.length === 0 && !getGroqKey()) {
    return finish(
      `AOA ${senderName}! Main abhi demo mode mein hoon kyun ke AI API key add nahi hui.\n\n` +
      `Aap apni free key bhej kar mere sath direct chat kar saktay hain! 😊`
    );
  }

  // Groq first (fast + cheap), Gemini multi-key pool as fallback
  if (getGroqKey()) {
    try {
      const groqMessages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(0, -1).map(h => ({
          role: h.role === 'assistant' ? 'assistant' : 'user',
          content: h.content
        })),
        { role: 'user', content: `User (${senderName}): ${prompt}` }
      ];
      const { text } = await callGroq(groqMessages, { timeoutMs: 12000 });
      return finish(text);
    } catch (e) {
      console.warn('[ai] groq failed, falling back to gemini:', e.message);
    }
  }

  if (keys.length === 0) {
    return finish(`AOA ${senderName}! AI service abhi busy hai, thori dair baad try karein.`);
  }

  // Gemini: fold history into one prompt (single-turn API)
  const historyText = history.slice(0, -1)
    .map(h => `${h.role === 'assistant' ? 'AwaisxBot' : 'User'}: ${h.content}`)
    .join('\n');
  const fullPrompt = `System Instruction: ${systemPrompt}\n` +
    (historyText ? `Pichli guftagu:\n${historyText}\n` : '') +
    `User (${senderName}): ${prompt}`;
  const payload = {
    contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    generationConfig: { maxOutputTokens: 350, temperature: 0.7 }
  };

  try {
    const { data } = await callGemini(':generateContent', payload, { timeoutMs: 12000 });
    let candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (candidate) return finish(candidate);
    return finish("yaar koi jawab nahi ban saka, dobara pooch lo zara");
  } catch (e) {
    if (e.message === 'NO_API_KEY') {
      return finish(`AOA ${senderName}! Main abhi demo mode mein hoon kyun ke Gemini API key add nahi hui.`);
    }
    const lastError = e.detail || {};
    if (lastError.text) {
      try {
        const json = JSON.parse(lastError.text);
        const msg = json.error?.message || json.error?.status;
        if (msg) {
          if (msg.includes('API_KEY_INVALID') || lastError.status === 400 || lastError.status === 401) {
            return finish(`yaar Google ne key accept nahi ki (${msg}). New free key create kar ke bhej dein!`);
          }
          return finish(`Sorry, the AI is busy right now. Please try again in a moment! 🤖`);
        }
      } catch (_) {}
      return finish(`AI se rabta nahi ho saka (HTTP ${lastError.status}). Thodi dair baad try karein ya new key send karein.`);
    }
    return finish("Oops, koi masla paish aaya. Ek lamhe baad dobara koshish karein!");
  }
}
