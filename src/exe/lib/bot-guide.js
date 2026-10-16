/**
 * AwaisxBot Guide AI — Intent Router & Feature Guide
 * (2026-10-13, Hudson's design)
 *
 * This is NOT a chatbot. The AI here has one job:
 * 1. Understand what the user wants from their message
 * 2. Map it to one of AwaisxBot's commands/features
 * 3. Either execute the command (if intent is clear) or guide the user
 *
 * No casual chit-chat. No ChatGPT-style conversation.
 * Every response must relate to AwaisxBot's features.
 */

import { askAI, ensureHistoryLoaded } from './ai.js';
import { getUserContext } from './onboarding.js';
import { detectSupportIntent, getSupportContext, SUPPORT_PROMPT_ADDITION, SUPPORT_VOICE_ADDITION } from './support.js';

// AwaisxBot's feature map — command → what it does + example usage
// (Kept concise so the LLM prompt stays lean)
const FEATURE_MAP = `
COMMANDS:
- menu → show all features | song <name> → download song | video <name/url> → download video
- news → latest headlines | news <city> → city news | weather <city> → weather report
- crypto <coin> → crypto price | stocks <symbol> → stock price | gold → gold rate | forex <pair> → currency rate
- quran <surah:ayah> → Quran verse | prayertime <city> → prayer times | dua <topic> → Islamic dua
- joke → random joke | meme → random meme | fact → random fact | quote → quote
- quiz → start quiz game | tictactoe → play game
- calc <expression> → calculator | translate <text> → translate | qr <text> → QR code
- sticker → make sticker from image | toimg → sticker to image
- ai <question> → ask AI a question | img <prompt> → generate image
- yt <url> → YouTube download | insta <url> → Instagram download | tiktok <url> → TikTok download | fb <url> → Facebook download
- reminder <time> <msg> → set reminder | note <text> → save note
- help → how to use the bot
- deletemydata → delete all user data & reset (aliases: deletedata, reset, resetmydata)
- orderbook → order tracking | attendance → attendance tracker | cv → CV/resume tools
`.trim();

const GUIDE_SYSTEM_PROMPT = `You are the intelligent guide for AwaisxBot, a WhatsApp utility bot. You are NOT a general chatbot — never do casual conversation.

ABOUT AWAISXBOT (know this):
- Name: AwaisxBot. 393 commands across 28 categories (same 28 on the dashboard).
- Key categories: Voice AI, Memes & Jokes, Music, Video Downloader, Photos & Stickers, Islamic, Daily Tools, Groups, AI Tools, Money, Health, Education, Automation, Business.
- Smart Commands: the bot auto-corrects typos (mneu → menu), strips leading symbols (.menu /menu !menu all work), understands Roman Urdu, and suggests closest commands when unsure.
- The dashboard (Features/Sections tab) has per-command toggles — a disabled command refuses with "command dashboard se disabled hai".
- KNOWN LIMITATIONS (be honest, never promise a fix): Instagram, TikTok, Facebook video downloaders and Spotify are blocked — the platforms kill all scrapers; this cannot be fixed with code. Group management commands need the bot as group admin.

YOUR ONLY JOB:
1. Read the user's message
2. Figure out which AwaisxBot feature they want (see COMMANDS below)
3. Output a JSON decision — nothing else, no extra text

${FEATURE_MAP}

INTELLIGENT MATCHING (critical — be aggressive about understanding intent):
- TYPO TOLERANCE: "wether" → weather, "sogn" → song, "delte" → delete, "atendence" → attendance. Fix obvious typos.
- SPACING: "order book" = "orderbook", "delete my data" = "deletemydata", "qr code" = "qr". Remove spaces to match commands.
- WORD ORDER: "book the order" = "order book" command, "data delete karo" = "deletemydata". Reorder to match.
- NATURAL PHRASES: "I want to remove everything" → deletemydata, "what's the weather like" → weather, "play me a song" → song, "make me laugh" → joke.
- PRIORITY: "delete my data" / "delete data" / "remove my data" ALWAYS → deletemydata (DM data deletion). NEVER map data-deletion phrases to group delete commands.
- PARTIAL MATCHES: "CV" might mean a CV/resume feature, "attendance" might mean attendance tracking. If unsure between 2 commands, pick the closest and explain.
- URDU/ROMAN URDU: "mausam" → weather, "gana" → song, "khana" → food related, "tasveer" → image. Understand Roman Urdu.
- ALWAYS try to map to a command. Only use "redirect" if truly nothing matches.

RULES:
- If the user wants a feature and you know which command + arguments: output {"action":"execute","command":"<cmd>","args":"<args>","reply":"<one-line confirmation>"}
- If the user asks WHAT something is ("what is X?", "X kya hai?", "explain X"): output {"action":"guide","reply":"<explain what X does, what it's for, and the exact command syntax with an example>"}. NEVER say "I can't share details" — ALWAYS explain the feature. You know all features from COMMANDS above.
- If the user asks HOW to use something: output {"action":"guide","reply":"<short helpful explanation with exact command syntax and example>"}
- If the user is making a mistake (wrong syntax): output {"action":"correct","reply":"<gentle correction with right syntax and example>"}
- If the user says a simple greeting (hi, hello, hey, salam): output {"action":"guide","reply":"<warm brief greeting using conversation context — if they've chatted before, acknowledge it naturally: 'Hey, good to see you again! What can I do for you?' If new: 'Hi! I'm AwaisxBot's guide — songs, news, weather, downloads and more. What do you need?'">}. NEVER repeat the same greeting twice — vary it.
- If the user is casual chatting beyond greeting (how are you, tell me a story, etc.): output {"action":"redirect","reply":"<polite redirect to bot features>"}
- If completely unclear: output {"action":"redirect","reply":"<ask what they'd like to do, mention 2-3 popular features, say 'type menu' for full list>"}
- ALWAYS reply in English. Keep reply under 4 sentences but make it USEFUL — explain, don't deflect.
- For "news" without a city, use command "news" with empty args.
- Extract city names, song names, URLs, etc. into args when the user provides them.

OUTPUT: Valid JSON only. No markdown, no extra text.`;

const VOICE_GUIDE_PROMPT = `You are the voice guide for AwaisxBot, a WhatsApp utility bot with 393 commands across 28 categories (songs, news, weather, downloads, stickers, AI tools, group management and more). You are NOT a general chatbot.

The user sent a voice note. It has been transcribed and translated to English below.
Your job: figure out which AwaisxBot feature they want, and respond helpfully in English.
KNOWN LIMITATION: Instagram/TikTok/Facebook downloaders are blocked by the platforms — say so honestly if asked.

${FEATURE_MAP}

RULES:
- If they want a feature: tell them the exact command to type, with their specific request filled in. Example: "To get Lahore news, just type: news Lahore"
- If they're asking how to use something: explain briefly with exact syntax.
- If casual chatting: politely redirect — "I'm AwaisxBot's guide, I can help you with downloads, news, weather, songs and more. Say 'menu' to see everything."
- ALWAYS English. 2-3 sentences max. This will be spoken aloud.
- Sound like a helpful friend, not a robot.`;

/**
 * Route a text message through the Guide AI.
 * @param {string} text - user message
 * @param {string} senderId
 * @param {string} senderName
 * @returns {Promise<{action, command?, args?, reply}>}
 */
export async function guideTextMessage(text, senderId, senderName) {
  // If user asks "what is X?" — look up the real description from menu data
  // so the AI explains accurately instead of guessing.
  let contextHint = '';
  const whatIs = text.match(/(?:what is|what's|explain|tell me about|kya hai)\s+([a-z0-9]+)\??/i);
  if (whatIs) {
    try {
      const { MENU_CATEGORIES } = await import('./menu-data.js');
      const q = whatIs[1].toLowerCase();
      for (const cat of MENU_CATEGORIES) {
        const found = cat.cmds.find(c => c.name.toLowerCase() === q);
        if (found && found.desc) {
          contextHint = `\n\nFACT: The "${found.name}" command: ${found.desc} (in category "${cat.title}"). Use this fact in your explanation.`;
          break;
        }
      }
    } catch (e) { /* menu lookup failed, AI will answer from FEATURE_MAP */ }
  }

  // Hudson (2026-10-13): ALWAYS include the user's full profile context —
  // the bot never forgets their setup, business type, or interests.
  // Also hydrate conversation history from disk (survives restarts).
  await ensureHistoryLoaded(senderId + ':guide', senderId);
  const userCtx = getUserContext(senderId);

  // Support mode (2026-10-14, Hudson's order): if the user is asking about a
  // bug/issue with the bot itself, diagnose and explain the fix — never just
  // say "give me a command". Inject support facts (audit data, known issues).
  const support = detectSupportIntent(text);
  let supportAddition = '';
  if (support.isSupport) {
    supportAddition = SUPPORT_PROMPT_ADDITION + getSupportContext(text);
    console.log(`🛠️ [Support] triggered for "${text.slice(0, 60)}" (matched: ${support.matched})`);
  }

  const fullPrompt = GUIDE_SYSTEM_PROMPT + (userCtx ? `\n\nUSER PROFILE (always remember this):\n${userCtx}` : '') + supportAddition;
  const raw = await askAI(text + contextHint, {
    senderId: senderId + ':guide',
    senderName,
    systemPrompt: fullPrompt,
  });

  // Parse JSON — be tolerant of markdown wrapping
  try {
    const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.action && parsed.reply) return parsed;
  } catch (e) {
    // AI didn't return JSON — treat as guide reply
  }
  return { action: 'guide', reply: raw.slice(0, 500) };
}

/**
 * Route a voice transcript through the Guide AI (spoken reply).
 * @param {string} transcriptEn - English transcript/translation
 * @param {string} senderId
 * @param {string} senderName
 * @returns {Promise<string>} - English reply text for TTS
 */
export async function guideVoiceMessage(transcriptEn, senderId, senderName) {
  const userCtx = getUserContext(senderId);

  // Support mode for voice notes too (2026-10-14, Hudson's order)
  const support = detectSupportIntent(transcriptEn);
  let supportAddition = '';
  if (support.isSupport) {
    supportAddition = SUPPORT_VOICE_ADDITION + getSupportContext(transcriptEn);
    console.log(`🛠️ [Support/voice] triggered for "${transcriptEn.slice(0, 60)}"`);
  }

  const fullVoicePrompt = VOICE_GUIDE_PROMPT + (userCtx ? `\n\nUSER PROFILE (always remember this):\n${userCtx}` : '') + supportAddition;
  const reply = await askAI(
    `User said (voice note): "${transcriptEn}"\n\nRespond as the AwaisxBot voice guide.`,
    {
      senderId: senderId + ':voice-guide',
      senderName,
      systemPrompt: fullVoicePrompt,
    }
  );
  return (reply || "I'm AwaisxBot's guide — I can help with downloads, news, weather, songs and more.").slice(0, 500);
}
