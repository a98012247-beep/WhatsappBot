/**
 * AwaisxBot Support Assistant
 * (2026-10-14, Hudson's order: when users ask about bugs/issues with the bot itself,
 * the bot must understand the problem and explain the solution — never just say
 * "give me a command".)
 *
 * Used by lib/bot-guide.js for both text and voice messages.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIT_PATH = path.join(__dirname, '..', 'data', 'command-audit.json');

let auditCache = null;
function getAudit() {
  if (auditCache) return auditCache;
  try {
    auditCache = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));
  } catch (e) {
    auditCache = {};
  }
  return auditCache;
}

// ---------------------------------------------------------------------------
// 1. Support-intent detection (English + Roman Urdu)
// ---------------------------------------------------------------------------
const SUPPORT_PATTERNS = [
  /\bnot working\b/i, /\bdoesn'?t work\b/i, /\bisn'?t working\b/i,
  /\bwon'?t work\b/i, /\bnot responding\b/i, /\bno response\b/i,
  /\bkaam nahi kar\b/i, /\bkaam nhi\b/i, /\bchal nahi\b/i, /\bkaam nahin\b/i,
  /\bbug\b/i, /\berror\b/i, /\bissue\b/i, /\bproblem\b/i, /\bmasla\b/i,
  /\bkyun nahi\b/i, /\bkyon nahi\b/i, /\bkyu nhi\b/i, /\bkyun\b/i,
  /\bfix\b/i, /\bbroken\b/i, /\bkharaab\b/i, /\btuta\b/i,
  /\bcommand nahi\b/i, /\bsamajh nahi\b/i,
  /\bwhy (is|does|did|can'?t|won'?t|couldn'?t).*(not|n'?t)\b/i,
  /\bhow (do|can|to) (i )?(use|enable|disable|setup|set up|fix|make|turn)\b/i,
  /\bkaise (use|chal|kar|theek|enable|band|on|off|set|karo|karon|karun)\b/i,
  /\bn(ah)?i ho rah[ai]\b/i, /\bn(ah)?i howa\b/i, /\bn(ah)?i howi\b/i,
  /\bdashboard\b/i, /\bsetting\b/i, /\btoggle\b/i,
  /\bstopped working\b/i, /\bpehle kaam\b/i, /\bpehle chal\b/i,
  /\bwrong\b/i, /\bfailed\b/i, /\bgalat\b/i,
  /\btry kiya\b/i, /\btried\b/i,
  /\bkya karun\b/i, /\bwhat should i do\b/i, /\bwhat do i do\b/i,
  /\bhelp\b/i,
];

export function detectSupportIntent(text) {
  const t = String(text || '');
  for (const p of SUPPORT_PATTERNS) {
    if (p.test(t)) return { isSupport: true, matched: p.source };
  }
  return { isSupport: false, matched: null };
}

// ---------------------------------------------------------------------------
// 2. Find which command(s) the user is asking about
// ---------------------------------------------------------------------------
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

// Minimal stop words for the EXACT pass (pure grammar words)
const GRAMMAR_WORDS = new Set([
  'the','and','for','are','but','not','you','all','can','had','her','was','one','our',
  'out','has','have','this','that','with','from','what','when','where','why','how',
  'niche','nahi','nahin','kaam','kar','karo','karun','kya','hai','mein','me','ne',
  'ko','ka','ki','ke','se','pe','par','aur','ya','toh','bhi','ab','ye','wo','woh',
  'mera','meri','tum','aap','please','pls','bhai','yaar','raha','rahi','rahe','ho',
  'gaya','gayi','hoga','hogi','chahiye','wala','wali','wale','karoonga','there',
  'here','your','yours','my','mine','his','her','its','our','their','isnt','dont',
  'cant','wont','doesnt','didnt','isn','don','can','will','just','like','get','got',
]);

// Extra common support-context words — skipped only in the FUZZY pass
// (so "video"/"download" still exact-match as commands, but "kaise"/"firing"
// never fuzzy-match to "praise"/"ring")
const FUZZY_SKIP = new Set([
  'bot','command','commands','dashboard','owner','admin','automation','automations',
  'feature','features','setting','settings','toggle','group','groups','chat','chats',
  'message','messages','video','videos','download','downloads','downloading',
  'kaise','kaisa','kese','firing','fired','stopped','yesterday','today','now',
  'still','again','always','never','ever','much','many','some','thing','things',
  'then','than','too','very','also','even','only','else','after','before','during',
  'while','because','since','until','though','whether','every','other','another',
  'such','same','first','last','next','more','most','less','least','little',
  'good','bad','right','wrong','true','false','yes','sure','maybe','well','back',
  'down','off','do','does','did','done','doing','been','being','having','would',
  'could','should','might','must','shall','make','made','take','took','give','gave',
  'say','said','tell','told','ask','asked','know','think','feel','felt','want',
  'wanted','need','needed','try','tried','use','used','using','help','helped','fix',
  'fixed','fixing','work','worked','working','works','start','started','stop',
  'open','opened','close','closed','send','sent','sending','receive','received',
  'show','showed','find','found','look','looked','check','checked','change','changed',
  'set','put','add','added','adding','remove','removed','delete','deleted','create',
  'created','update','updated','enable','enabled','disable','disabled','turn','turned',
]);

export function findMentionedCommands(text) {
  const audit = getAudit();
  const names = Object.keys(audit);
  if (!names.length) return [];
  const clean = s => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const words = clean(text).split(/\s+/).filter(w => w.length >= 3 && !GRAMMAR_WORDS.has(w));
  const found = [];
  // Exact pass — broad: any real command word matches
  for (const w of words) {
    for (const name of names) {
      if (name.toLowerCase() === w) { found.push(name); break; }
    }
  }
  // Fuzzy pass for near-misses — strict: skip common words, tight thresholds
  if (!found.length) {
    for (const w of words) {
      if (w.length < 4 || FUZZY_SKIP.has(w)) continue;
      const maxD = w.length <= 4 ? 1 : 2;
      let best = null, bestD = maxD + 1;
      for (const name of names) {
        const nl = name.toLowerCase();
        if (Math.abs(nl.length - w.length) > maxD) continue;
        const d = levenshtein(w, nl);
        if (d < bestD && d <= maxD) { bestD = d; best = name; }
      }
      if (best) { found.push(best); break; }
    }
  }
  return [...new Set(found)].slice(0, 3);
}

// ---------------------------------------------------------------------------
// 3. Support knowledge base — known issues and fixes
// ---------------------------------------------------------------------------
const KNOWN_ISSUES = [
  {
    match: ['insta', 'instagram', 'reel', 'tiktok', 'tik', 'fb', 'fbdl', 'spotify', 'sp', 'capcutdl'],
    fact: 'These downloaders are currently BLOCKED: Instagram/TikTok/Facebook aggressively block scrapers and the third-party APIs are dead. This cannot be fixed with code — it needs a new API provider. Be honest about this.'
  },
  {
    match: ['dashboard', 'toggle', 'setting', 'feature'],
    fact: 'If a dashboard toggle seems not to work: (1) hard refresh the browser (cached old version), (2) the toggle must be saved — it writes to data files, (3) the bot checks toggles live, no restart needed.'
  },
  {
    match: ['automation', 'scheduled', 'reminder', 'rmsgs', 'recurring'],
    fact: 'If an automation is not firing: (1) check it is enabled (toggle ON), (2) check a real group/chat target is selected (not blank), (3) check the schedule time/format, (4) disabled tasks are skipped by the scheduler.'
  },
  {
    match: ['owner', 'admin', 'access'],
    fact: 'The owner is set with the "setowner" chat command. Chat and dashboard now share one owner file, so both stay in sync.'
  },
  {
    match: ['group', 'member', 'promote', 'remove', 'kick'],
    fact: 'Group management commands (kick, promote, demote, remove) only work in groups where the bot is an admin. Group-only commands do not work in DMs.'
  },
  {
    match: ['voice', 'audio', 'transcribe'],
    fact: 'If a voice note is not understood: speak clearly, keep it under 1 minute, check internet. Transcription failures show a generic message; technical details are in server logs.'
  },
  {
    match: ['menu'],
    fact: 'The menu has 28 categories (same as the dashboard). Use "menu 1", "menu 2" etc. to page through. Commands also work with typos — the bot auto-corrects small mistakes.'
  },
  {
    match: ['ai', 'chat', 'ask'],
    fact: 'AI chat needs an API key configured. If AI says it is in demo mode, the owner must add the key in the dashboard AI section.'
  },
];

export function getSupportContext(text) {
  const audit = getAudit();
  const mentioned = findMentionedCommands(text);
  let ctx = '\n\nSUPPORT MODE FACTS (use these, do not invent):\n';

  if (mentioned.length) {
    for (const cmd of mentioned) {
      const a = audit[cmd];
      if (!a) continue;
      const blocked = /BLOCKED/i.test(a.notes || '');
      ctx += `- Command "${cmd}" (category: ${a.category || 'unknown'}): ` +
        (blocked ? `BLOCKED — ${a.notes}. ` : `status: ${a.status}. `) +
        (a.duplicateOf ? `Alias of "${a.duplicateOf}". ` : '') +
        (a.desc ? `What it does: ${a.desc}. ` : '') + '\n';
    }
  } else {
    ctx += '- No specific command identified in the message.\n';
  }

  const lower = String(text || '').toLowerCase();
  for (const issue of KNOWN_ISSUES) {
    if (issue.match.some(k => lower.includes(k) || mentioned.includes(k))) {
      ctx += `- KNOWN ISSUE: ${issue.fact}\n`;
    }
  }

  ctx +=
    '- General troubleshooting steps: (1) check the command spelling (bot auto-corrects small typos), ' +
    '(2) check the command is not disabled in the dashboard Sections tab, ' +
    '(3) check scope: group-only commands need a group, owner-only commands need the owner, ' +
    '(4) for dashboard issues: hard refresh the browser.\n';

  return ctx;
}

// ---------------------------------------------------------------------------
// 4. Support-mode system prompt additions
// ---------------------------------------------------------------------------
export const SUPPORT_PROMPT_ADDITION = `
SUPPORT MODE — the user is asking about a PROBLEM with the bot itself (a bug, something not working, a dashboard issue, or how to fix something).

RULES FOR SUPPORT MODE (override normal routing):
- NEVER output {"action":"execute"} — do not blindly run the command they mention. DIAGNOSE first.
- NEVER output {"action":"redirect"} with a bare "give me a command" message. ALWAYS try to help.
- ALWAYS output {"action":"guide"} with a helpful reply that:
  1. Acknowledges the problem in one line ("I understand — let's fix this.")
  2. Gives the most likely cause, using the SUPPORT MODE FACTS above
  3. Gives 2-4 numbered, simple fix steps the user can actually do
  4. If it is a blocked feature (Instagram etc.), say so honestly: "This feature is currently not working because Instagram blocks all downloaders. I can't fix it from here — it needs a new API."
  5. If it is a dashboard issue, say exactly where to click (e.g. "open the dashboard, go to the Sections tab, find the command, turn its toggle on")
- ALWAYS reply in English. Simple words. Numbered steps. No jargon.
- Keep it under 6 sentences but make every sentence useful.
- If you genuinely cannot identify the issue, ask ONE clarifying question (e.g. "Which command exactly were you trying to use?") — do not ask more than one question.
`;

export const SUPPORT_VOICE_ADDITION = `
SUPPORT MODE — the user reported a PROBLEM with the bot (bug, something not working).
- Acknowledge briefly, give the most likely cause from the facts, then 2-3 simple spoken fix steps.
- If the feature is blocked (Instagram/TikTok downloaders), say so honestly and briefly.
- ALWAYS English, 3-4 sentences max, this will be spoken aloud. Sound like a helpful friend.
`;
