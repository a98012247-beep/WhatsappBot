import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  downloadContentFromMessage,
  Browsers
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
// HOSTING PATCH (Muse, 2026-10-12): this machine reaches the internet only
// through an egress HTTP proxy, so the Baileys WebSocket is routed through it
// via a CONNECT tunnel. No bot behavior is changed by this.
import { HttpsProxyAgent } from 'https-proxy-agent';
const __proxyUrl = process.env.https_proxy || process.env.HTTPS_PROXY || null;
const __wsAgent = __proxyUrl ? new HttpsProxyAgent(__proxyUrl) : undefined;
import { Store } from './store.js';
import { guardOutbound, verifyIntegrity, brandFooter } from './.syslock.js';
import { askAI } from './ai.js';
import { transcribeAudio, textToSpeech, AURA_VOICES, getAudioMimeType } from './voice.js';
import { getViralMeme, getMemeRoast, getMemeJoke } from './memes.js';
import {
  getWeather,
  getCryptoPrices,
  evaluateMath,
  generateQRCodeBuffer,
  getRandomQuote,
  getRandomJoke,
  getRandomShairi,
  getRandomFact,
  parseDuration,
  getRandomRiddle,
  getRiddleById,
  getLastRiddle,
  RIDDLES,
  getLatestNews
} from './tools.js';
import { downloadVideo, downloadAudio, searchAndDownloadSong, searchImage } from './downloader.js';
import {
  imageToSticker,
  animToSticker,
  findMemeSound,
  getMemeAudioBuffer,
  MEME_SOUNDS
} from './media.js';
import {
  findSurah,
  getSurahOverview,
  getAyahDetails,
  getSurahAudio,
  getHadith,
  getPrayerTimes,
  getRandomAyah,
  ALLAH_NAMES,
  DAILY_DUAS,
  findDua,
  getFastSurahAudioBuffer,
  getIslamicDate,
  ISLAMIC_MONTHS,
  MAJOR_ISLAMIC_EVENTS
} from './islamic.js';
// HOSTING PATCH (Muse, 2026-10-12): 134 new features (batches 1-6) plug in here.
// They live in lib/batchN-*.js and self-register via lib/batch-helpers.js;
// this import builds the dispatch registries. No existing behavior changed.
import {
  NEW_COMMANDS,
  handleNewFeature,
  getNewMenuSections,
  runMessageHooks,
  runMemberHooks
} from './newfeatures.js';
// BATCH8 (Muse, 2026-10-14): new command names -> core commands.
// Resolved in dispatch before the switch. No existing behavior changed.
import { CORE_ALIASES } from './batch8-newcmds.js';
// FUZZY (Muse, 2026-10-14): command simplification — strip noise, typos,
// natural word matching, smart suggestions. Toggle via dashboard.
import { stripNoise, normalizeSpaces, findClosest, suggestCommands, findCommandInText, tryJoinWords } from './fuzzy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSION_DIR = path.join(__dirname, '..', 'session');

// Known bot commands (for prefix-less command detection — no ! needed)
const KNOWN_COMMANDS = new Set([
  'ai',
  'aibuild',
  'all',
  'autobuild',
  'allahname',
  'allahnames',
  'aqwal',
  'ask',
  'asmaulhusna',
  'attp',
  'audio',
  'automation',
  'ayah',
  'ayat',
  'settings',
  'groups',
  'mygroups',
  'manage',
  'dashboard',
  'dashlink',
  'azkar',
  'bol',
  'bot',
  'btc',
  'calc',
  'capcut',
  'catalog',
  'chutkula',
  'clip',
  'close',
  'coin',
  'contact',
  'crypto',
  'dailymotion',
  'date',
  'demote',
  'developer',
  'diagnostics',
  'dice',
  'dl',
  'down',
  'download',
  'dua',
  'duain',
  'eth',
  'events',
  'everyone',
  'facebook',
  'fact',
  'fb',
  'fbdown',
  'feedback',
  'flip',
  'fullmenu',
  'gana',
  'groupaudit',
  'groupinfo',
  'groupmembers',
  'hadees',
  'hadis',
  'hadith',
  'help',
  'hidetag',
  'hijri',
  'hours',
  'ig',
  'igdl',
  'image',
  'img',
  'info',
  'insta',
  'islami_date',
  'islamicdate',
  'islamicevents',
  'joke',
  'kick',
  'kwai',
  'latifa',
  'latifay',
  'likee',
  'location',
  'maloomat',
  'math',
  'meme',
  'memeimage',
  'memelist',
  'memepic',
  'memes',
  'menu',
  'more',
  'mp3',
  'music',
  'mute',
  'namaz',
  'open',
  'owner',
  'paheli',
  'photo',
  'pic',
  'picmeme',
  'pin',
  'ping',
  'pinterest',
  'poetry',
  'poll',
  'prayer',
  'prayertimes',
  'price',
  'pricing',
  'promote',
  'puzzle',
  'qr',
  'quote',
  'quran',
  'quranaudio',
  'quranmp3',
  'reel',
  'reels',
  'deletemydata',
  'deletedata',
  'remind',
  'reminder',
  'reset',
  'resetmydata',
  'riddle',
  'roast',
  'roll',
  'rules',
  's',
  'setname',
  'sfx',
  'shairi',
  'shayari',
  'snap',
  'snapchat',
  'song',
  'sound',
  'soundboard',
  'sounds',
  'speak',
  'smartsetup',
  'start',
  'sticker',
  'stickergif',
  'stiker',
  'support',
  'surah',
  'tafseer',
  'tafsir',
  'tagall',
  'tareekh',
  'tehwar',
  'textmenu',
  'threads',
  'ticket',
  'tiktok',
  'tilawat',
  'time',
  'tomp3',
  'tools',
  'trim',
  'tt',
  'tts',
  'tw',
  'twitter',
  'unmute',
  'uptime',
  'v',
  'v2a',
  'video',
  'videoclip',
  'vimeo',
  'voice',
  'vs',
  'wallpaper',
  'warn',
  'weather',
  'x',
  'youtube',
  'yt',
  'ytdl',
]);
// HOSTING PATCH (Muse, 2026-10-12): merge the 134 new-feature commands so they
// are detected prefix-less exactly like built-in commands.
for (const c of NEW_COMMANDS) KNOWN_COMMANDS.add(c);
// BATCH8 (Muse, 2026-10-14): new alias names also recognized as commands.
for (const c of Object.keys(CORE_ALIASES)) KNOWN_COMMANDS.add(c);
// FUZZY (2026-10-14): full candidate set for typo matching = KNOWN_COMMANDS
// plus CORE_ALIASES values (targets). Used by fuzzy dispatch below.
const FUZZY_CANDIDATES = new Set(KNOWN_COMMANDS);
for (const v of Object.values(CORE_ALIASES)) FUZZY_CANDIDATES.add(v.toLowerCase());

class WhatsAppBot extends EventEmitter {
  // Check if a word is a known command (used by onboarding to avoid eating commands as names)
  isKnownCommand(word) {
    if (!word) return false;
    const w = word.toLowerCase();
    return KNOWN_COMMANDS.has(w) || FUZZY_CANDIDATES.has(w);
  }

  constructor() {
    super();
    this.sock = null;
    this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'qr_ready' | 'connected'
    this.qrCodeDataUrl = null;
    this.user = null;
    this.reconnectAttempts = 0;
    this.warnings = new Map(); // key: jid, value: count
    this.activeReminders = new Set();
    this.isInitializing = false;
    this.stats = {
      messagesReceived: 0,
      messagesSent: 0,
      commandsProcessed: 0,
      aiQueries: 0,
      startTime: Date.now()
    };
  }

  // Clean menu (2026-10-13, Hudson's order: old menu was cluttered).
  // 16 merged categories instead of 28 overlapping ones. User sends the
  // number to see commands in that category.
  // BEAUTIFUL MENU (2026-10-15): each category gets its own block with a
  // one-line description. Matches the dashboard sections 1:1. No merging.
  async getCleanMenu() {
    const { MENU_CATEGORIES } = await import('./menu-data.js');
    const { cleanTitle, catDesc } = await import('./menu-desc.js');
    let out = `🤖 *AwaisxBot Menu*\n_Your personal WhatsApp automation assistant_\n`;
    for (const cat of MENU_CATEGORIES) {
      out += `\n*${cat.num}.* ${cat.icon || '📌'} *${cleanTitle(cat.title)}*\n_${catDesc(cat.num)}_\n`;
    }
    out += `\n_Reply with a category number (1-${MENU_CATEGORIES.length}) or name_\n`;
    // BRANDING (Awais AI \u2014 required by license, do not remove)
    out += `\n🤖 *Powered by Awais AI*`;
    return out;
  }

  // Category drill-down: number -> grouped display (DEDUP 2026-10-15).
  // Commands sharing one handler show as a single line with aliases listed.
  // Dispatch is untouched: every alias still triggers when typed.
  async getCategoryCommands(n) {
    const { MENU_CATEGORIES } = await import('./menu-data.js');
    const { cleanTitle, cleanDesc, catDesc } = await import('./menu-desc.js');
    const { groupCommands, isBlocked } = await import('./menu-groups.js');
    const cat = MENU_CATEGORIES.find(c => c.num === n);
    if (!cat) return null;
    const title = cleanTitle(cat.title);
    const SEP = '━━━━━━━━━━━━━━━';
    let out = `${cat.icon || '📌'} *${title}*\n_${catDesc(cat.num)}_\n${SEP}\n`;
    const groups = groupCommands(cat.cmds, cleanDesc);
    for (const g of groups) {
      const blockedMark = g.blocked ? ' 🚫' : '';
      out += `• *${g.primary}*${blockedMark} — ${g.desc}\n`;
      // (2026-10-15, per Hudson): aliases hidden — one command per task, no duplicates shown.
    }
    return `${out}${SEP}\n_Reply with a command name to use it_\n\n🤖 *Powered by Awais AI*`;
  }

  getMobileFriendlyMenu(prefix = '!') {
    return (
      `🌟 *AwaisxBot — Smart WhatsApp Assistant*\n\n` +
      `_Aapko koi symbol lagane ki zaroorat nahi — bas aam alfaz mein likhein!_\n\n` +

      `🎙️ *1. Voice AI & Bolne Wala Bot (Deepgram)*\n` +
      `• *Send a Voice Note* ➔ The bot listens and replies back with a voice note!\n` +
      `• *voice <text>* ➔ Kisi bhi text ka WhatsApp voice note banayein\n` +
      `  _Misaal:_ voice Assalam-o-Alaikum dost, kaisay ho?\n\n` +

      `😂 *2. Viral Memes, Roasts & Desi Jokes*\n` +
      `• *meme* ➔ Taaza tareen funny meme images\n` +
      `• *roast <naam>* ➔ Mazedaar Desi roasts (Misaal: roast ali)\n` +
      `• *chutkula / latifa* ➔ Mazahiya Desi latifay\n` +
      `• *soundboard* ➔ 50+ viral meme sounds (Moye Moye, Maro Mujhe, etc.)\n\n` +

      `🎵 *3. High-Quality Songs & Music (320kbps)*\n` +
      `• *song <naam>* ➔ JioSaavn & YouTube se crystal clear MP3 audio\n` +
      `  _Misaal:_ song tum hi ho, song tajdar e haram, song arijit\n\n` +

      `📥 *4. Video Downloader (Cliper)*\n` +
      `• *Direct Link* ➔ TikTok (No Watermark), Reels, YouTube, Facebook, Twitter, CapCut\n\n` +

      `🖼️ *5. Photos & Stickers*\n` +
      `• *photo <naam>* ➔ HD images aur wallpapers\n` +
      `• *sticker* ➔ Photo se WhatsApp Sticker\n` +
      `• *audio* ➔ Video se MP3 audio alag karein\n\n` +

      `🕌 *6. Islamic Suite (Quran & Deen)*\n` +
      `• *surah <naam>* ➔ Surah tarjuma (Misaal: surah yasin)\n` +
      `• *ayat <no>* ➔ Ayat ul kursi / tarjuma (Misaal: ayat 2:255)\n` +
      `• *tilawat <surah>* ➔ Qari Mishary Rashid Tilawat MP3\n` +
      `• *hadith <no>* ➔ Bukhari Shareef hadith\n` +
      `• *namaz <city>* ➔ 5 waqt ke namaz auqat\n` +
      `• *hijri* ➔ Aaj ki Islami tareekh & fazilat\n` +
      `• *dua* ➔ Masnoon duain ma tarjuma\n\n` +

      `💡 *7. Rozmarra Daily Tools*\n` +
      `• *mosam <city>* ➔ Live weather update\n` +
      `• *khabrain* ➔ Taaza tareen news headlines\n` +
      `• *cricket* ➔ Live match score & updates\n` +
      `• *hisaab <hisab>* ➔ Maths calculator (Misaal: hisaab 500*12)\n` +
      `• *currency* ➔ Dollar aur Riyal to PKR rates\n` +
      `• *qr <text>* ➔ Scan-able QR Code banayein\n\n` +

      `🛡️ *8. Group Tools*\n` +
      `• *tagall* ➔ Sab group members ko tag karein\n` +
      `• *poll* ➔ WhatsApp poll banayein\n` +
      `• *mute / unmute* ➔ Group chat lock ya open karein\n\n` +

      `🤖 *9. Smart AI Dost (Gemini)*\n` +
      `• *Kuch bhi poochein* ➔ Bilkul aam doston ki tarah natural Urdu ya English mein chat!\n\n` +
      `💬 _Bas voice note ya text bhejein aur bot khud samajh kar jawab dega!_\n\n` +
      // HOSTING PATCH (Muse, 2026-10-12): sections 10-21 for the 134 new features.
      getNewMenuSections()
    );
  }

  async init() {
    if (this.isInitializing) {
      console.log('Bot is already initializing, skipping duplicate init call.');
      return;
    }
    // System integrity check — required for startup.
    try {
      if (!verifyIntegrity()) console.log('⚠️ System integrity notice: core module check did not pass.');
    } catch (e) {
      console.log('⚠️ System integrity notice:', e.message);
    }
    this.isInitializing = true;

    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
    }

    try {
      this.status = 'connecting';
      this.emit('status', { status: this.status });

      const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
      let version = [2, 3000, 1015901307];
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));
        const v = await Promise.race([fetchLatestBaileysVersion(), timeoutPromise]);
        if (v && v.version) {
          version = v.version;
        }
      } catch (err) {
        // Fallback default version without hanging
      }

      console.log(`📡 Connecting to WhatsApp Web via Baileys v${version.join('.')}...`);

      this.sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
        agent: __wsAgent, // HOSTING PATCH: egress proxy for the WA WebSocket
        browser: Browsers ? Browsers.windows('Desktop') : ['Windows', 'Chrome', '122.0.0.0'],
        syncFullHistory: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        generateHighQualityLinkPreview: false
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            this.qrCodeDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 7 });
            this.status = 'qr_ready';
            this.emit('qr', { qrDataUrl: this.qrCodeDataUrl });
            this.emit('status', { status: this.status, qr: this.qrCodeDataUrl });
            console.log('\n=============================================================');
            console.log('✅ QR Code Ready! Scan from WhatsApp > Linked Devices.');
            console.log('👉 Web Dashboard: http://localhost:3000');
            console.log('=============================================================\n');
          } catch (err) {
            console.error('Failed to convert QR code:', err);
          }
        }

        if (connection === 'close') {
          this.isInitializing = false;
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;
          console.log(`Connection closed. Code: ${statusCode}. Reason: ${lastDisconnect?.error?.message}. LoggedOut: ${isLoggedOut}`);
          
          this.status = 'disconnected';
          this.qrCodeDataUrl = null;
          this.user = null;
          this.emit('status', { status: this.status, error: lastDisconnect?.error?.message });

          if (!isLoggedOut) {
            this.reconnectAttempts++;
            const delay = Math.min(this.reconnectAttempts * 3000, 15000);
            setTimeout(() => this.init(), delay);
          } else {
            console.log('Session expired or logged out. Resetting session and generating new QR code...');
            if (fs.existsSync(SESSION_DIR)) {
              fs.rmSync(SESSION_DIR, { recursive: true, force: true });
            }
            setTimeout(() => this.init(), 2000);
          }
        } else if (connection === 'open') {
          this.isInitializing = false;
          this.reconnectAttempts = 0;
          this.status = 'connected';
          this.qrCodeDataUrl = null;
          this.user = this.sock.user;
          console.log('🚀 Connected to WhatsApp as:', this.user?.id || this.user?.name);
          console.log('🤖 AwaisxBot by Awais AI — facebook.com/awaisautomates'); // BRANDING (required by license, do not remove)
          this.emit('status', { status: this.status, user: this.user });
          // Automation task runner (2026-10-13): check every minute for due tasks
          if (!this._automationTick) {
            this._automationTick = setInterval(async () => {
              try {
                const { runDueTasks } = await import('./automation.js');
                await runDueTasks(this);
              } catch (e) {}
            }, 60000);
          }
          // Proactive nudges (2026-10-13, Hudson): check hourly for inactive users
          if (!this._proactiveTick) {
            this._proactiveTick = setInterval(async () => {
              try {
                const { runProactiveCheck } = await import('./proactive.js');
                await runProactiveCheck(this);
              } catch (e) {}
              // Media auto-delete: 24h TTL (Hudson 2026-10-13)
              try {
                const { cleanupMedia } = await import('./memory.js');
                cleanupMedia();
              } catch (e) {}
            }, 3600000);
          }
        }
      });

      // Handle Incoming Messages
      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
          if (!msg.message) continue;
          // (2026-10-16, per Hudson): bot processes its OWN messages as owner
          // commands — it can message itself to control itself. Loop protection:
          // skip messages carrying the bot's own footer.
          const isSelfMsg = !!msg.key.fromMe;

          const from = msg.key.remoteJid;
          if (from === 'status@broadcast') continue;
          // NEVER reply in WhatsApp Channels (2026-10-13, Hudson: DO NOT REPLY IN CHANNELS)
          if (from.endsWith('@newsletter')) continue;

          const isGroup = from.endsWith('@g.us');
          const sender = isGroup ? msg.key.participant : from;
          const senderName = msg.pushName || 'Friend';

          // Extract text
          const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.imageMessage?.caption ||
            msg.message.videoMessage?.caption ||
            '';

          // Interactive menu taps (list / button responses)
          const interactiveId =
            msg.message.listResponseMessage?.singleSelectReply?.selectedRowId ||
            msg.message.buttonsResponseMessage?.selectedButtonId ||
            '';

          const isAudio = !!msg.message.audioMessage;
          if (!text && !isAudio && !interactiveId) continue;

          // Loop protection: never process the bot's own replies (they carry the footer).
          if (isSelfMsg && text.includes('Powered by Awais AI')) continue;

          // If incoming message is a WhatsApp Voice Note or Audio
          if (isAudio) {
            if (isGroup && !Store.isGroupAllowed(from)) continue;

            this.stats.messagesReceived++;
            Store.addLog({
              type: 'incoming',
              from,
              sender,
              senderName,
              isGroup,
              text: '🎙️ [Voice Note / Audio Message]'
            });
            this.emit('message', {
              type: 'incoming',
              from,
              sender,
              senderName,
              isGroup,
              text: '🎙️ [Voice Note / Audio Message]',
              timestamp: new Date().toISOString()
            });

            try {
              await this.handleVoiceMessage({ msg, from, sender, senderName, isGroup });
            } catch (err) {
              console.error('Error handling voice message:', err);
            }
            continue;
          }

          this.stats.messagesReceived++;
          Store.addLog({
            type: 'incoming',
            from,
            sender,
            senderName,
            isGroup,
            text
          });
          this.emit('message', {
            type: 'incoming',
            from,
            sender,
            senderName,
            isGroup,
            text,
            timestamp: new Date().toISOString()
          });

          // Process the message
          try {
            await this.handleMessage({ msg, from, sender, senderName, isGroup, text, interactiveId });
          } catch (err) {
            console.error('Error handling message:', err);
          }
        }
      });

      // Handle Group Participants (Welcome message)
      this.sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
        try {
          // HOSTING PATCH (Muse, 2026-10-12): custom welcome/goodbye + join/leave
          // stats for the new features (batch 4). Non-throwing.
          await runMemberHooks({ bot: this, id, participants, action });
          const config = Store.getConfig();
          if (!config.features?.groupWelcome || !Store.isGroupAllowed(id)) return;
          // Dashboard control (2026-10-14): per-group welcome toggle + silent mode
          try {
            const { groupFeatureOn, isSilent } = await import('./access.js');
            if (isSilent(id) || !groupFeatureOn(id, 'welcome', true)) return;
          } catch { /* access.js unavailable — fall through */ }

          if (action === 'add' && Array.isArray(participants)) {
            for (const user of participants) {
              const jid = typeof user === 'string' ? user : (user?.id || '');
              if (!jid || typeof jid !== 'string') continue;
              const userName = jid.split('@')[0];
              const welcomeMsg = `Hey @${userName}, welcome to the group! Happy to have you here 😊\n(Feel free to type *${config.prefix}menu* anytime if you'd like to check out group tools or chat!)`;
              await this.sendMessage(id, welcomeMsg, { mentions: [jid] });
            }
          }
        } catch (err) {
          console.error('Error handling group-participants.update:', err.message);
        }
      });

    } catch (err) {
      this.status = 'disconnected';
      this.emit('status', { status: this.status, error: err.message });
    }
  }

  /**
   * Handle incoming WhatsApp Voice Notes & Audio Messages (Deepgram STT -> Gemini AI -> Deepgram TTS)
   */
  async handleVoiceMessage({ msg, from, sender, senderName, isGroup }) {
    let audioBuffer = null;
    const audioMsg = msg.message?.audioMessage;
    const mimeType = audioMsg?.mimetype || 'audio/ogg; codecs=opus';

    try {
      if (downloadMediaMessage) {
        audioBuffer = await downloadMediaMessage(msg, 'buffer', {});
      }
    } catch (e) {}

    if (!audioBuffer && audioMsg) {
      try {
        const stream = await downloadContentFromMessage(audioMsg, 'audio');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
          buffer = Buffer.concat([buffer, chunk]);
        }
        audioBuffer = buffer;
      } catch (e) {
        console.error('Audio stream download error:', e.message);
      }
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      console.warn('Voice message empty or could not be downloaded.');
      return;
    }

    // Reaction & presence
    try { await this.sock.sendMessage(from, { react: { text: '🎙️', key: msg.key } }); } catch (e) {}
    await this.sendPresence(from, 'recording');

    // 1. Transcribe voice via Deepgram (Whisper — handles Urdu/Hindi/English)
    let transcriptData = null;
    try {
      transcriptData = await transcribeAudio(audioBuffer, mimeType);
    } catch (err) {
      // Log full details internally, but never expose provider names to the user
      console.error('[voice] transcription error:', err.message);
      await this.sendMessage(from, `🎙️ _Couldn't understand that voice note, please try again._`);
      return;
    }

    const transcript = transcriptData?.transcript?.trim();
    if (!transcript) {
      await this.sendMessage(from, `🎙️ _Your voice note was too quiet or silent, please speak clearly and try again!_`);
      return;
    }

    console.log(`🎙️ [Voice Transcribed]: "${transcript}" (Lang: ${transcriptData.detectedLanguage})`);

    // 2. Route through Bot Guide AI — NOT a chatbot.
    // (2026-10-13, Hudson's design: AI understands intent → maps to bot features.
    // Voice notes in Urdu get translated to English first, reply always English.)
    this.stats.aiQueries++;
    const config = Store.getConfig();

    let aiInput = transcript;
    const looksNonEnglish = /[^\x00-\x7F]/.test(transcript);
    if (looksNonEnglish) {
      try {
        const { askAI: translateAI } = await import('./ai.js');
        const translated = await translateAI(
          `Translate this text to natural English. Output ONLY the English translation, nothing else:\n\n${transcript}`,
          { senderId: sender + ':translate', senderName }
        );
        if (translated && translated.trim().length > 3) {
          aiInput = translated.trim();
        }
      } catch (tErr) { /* use original transcript */ }
    }

    let aiReply = '';
    try {
      const { guideVoiceMessage } = await import('./bot-guide.js');
      aiReply = await guideVoiceMessage(aiInput, sender, senderName);
    } catch (aiErr) {
      aiReply = `I'm AwaisxBot's guide — I can help with downloads, news, weather, songs and more.`;
    }

    // 3. Convert AI Response into Speech Voice Note via TTS
    // TTS (2026-10-13, Hudson's setting): ALWAYS Deepgram English voice.
    await this.sendPresence(from, 'recording');
    try {
      const speechBuffer = await textToSpeech(aiReply, 'aura-2-asteria-en');
      this.stats.messagesSent++;
      await this.sock.sendMessage(from, {
        audio: speechBuffer,
        mimetype: 'audio/mpeg',
        fileName: 'voice_reply.mp3',
        ptt: false
      }, { quoted: msg });

      Store.addLog({
        type: 'outgoing',
        to: from,
        text: `[Voice Note Reply]: ${aiReply}`
      });
    } catch (ttsErr) {
      console.warn('Deepgram TTS fallback to text:', ttsErr.message);
      await this.sendMessage(from, `🎙️ *Aap ne farmaya:* "${transcript}"\n\n🤖 *AwaisxBot Jawab:*\n${aiReply}`);
    }
  }

  /**
   * Send MP4 video with ultra-fast direct streaming and resilient buffer fallback
   */
  async sendVideoFromUrl(to, videoData, quotedKey) {
    if (!this.sock) throw new Error('WhatsApp bot is not connected');
    const { videoUrl, title, source } = videoData;
    if (!videoUrl) throw new Error('No video URL available');

    const caption = `🎬 *${title || 'Video'}*\n⚡ _Source: ${source || 'Fast Downloader'}_`;

    // 1. Ultra-fast direct streaming via Baileys (1-3s, no local buffer delay)
    try {
      this.stats.messagesSent++;
      await this.sock.sendMessage(to, {
        video: { url: videoUrl },
        caption,
        mimetype: 'video/mp4'
      }, quotedKey ? { quoted: { key: quotedKey } } : undefined);

      Store.addLog({
        type: 'outgoing',
        to,
        text: `[Sent Video]: ${title || source}`
      });
      return;
    } catch (directErr) {
      console.warn('Direct video URL stream fallback to buffer:', directErr.message);
    }

    // 2. Fallback: Buffered fetch with safe 60s timeout
    const fetchRes = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(60000)
    });
    if (!fetchRes.ok) throw new Error(`Video fetch failed: HTTP ${fetchRes.status}`);

    const buffer = Buffer.from(await fetchRes.arrayBuffer());

    this.stats.messagesSent++;
    await this.sock.sendMessage(to, {
      video: buffer,
      caption,
      mimetype: 'video/mp4'
    }, quotedKey ? { quoted: { key: quotedKey } } : undefined);

    Store.addLog({
      type: 'outgoing',
      to,
      text: `[Sent Video]: ${title || source}`
    });
  }

  /**
   * Send Song Audio with ultra-fast direct streaming (1-2s) & robust fallback
   */
  async sendSongAudio(from, song, msg) {
    const cleanTitle = (song.title || 'song').replace(/[\\/:*?"<>|]/g, '').slice(0, 30);

    // 1. Ultra-fast direct streaming via Baileys
    try {
      await this.sock.sendMessage(from, {
        audio: { url: song.audioUrl },
        mimetype: 'audio/mpeg',
        fileName: `${cleanTitle}.mp3`,
        ptt: false
      }, { quoted: msg });
      this.stats.messagesSent++;
      return;
    } catch (directErr) {
      console.warn('Direct song URL stream fallback to buffer:', directErr.message);
    }

    // 2. Fallback: Buffer fetch with 12s timeout
    try {
      const aRes = await fetch(song.audioUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(12000)
      });
      if (aRes.ok) {
        const aBuf = Buffer.from(await aRes.arrayBuffer());
        await this.sock.sendMessage(from, {
          audio: aBuf,
          mimetype: 'audio/mpeg',
          fileName: `${cleanTitle}.mp3`,
          ptt: false
        }, { quoted: msg });
        this.stats.messagesSent++;
        return;
      }
    } catch (e) {
      console.warn('Song buffer fetch fallback notice:', e.message);
    }

    // 3. Fallback to secondary YouTube/Universal stream
    try {
      const alt = await downloadAudio(`https://www.youtube.com/results?search_query=${encodeURIComponent(song.title)}`);
      if (alt?.audioUrl) {
        await this.sock.sendMessage(from, {
          audio: { url: alt.audioUrl },
          mimetype: 'audio/mpeg',
          fileName: `${cleanTitle}.mp3`,
          ptt: false
        }, { quoted: msg });
        this.stats.messagesSent++;
        return;
      }
    } catch (e) {}

    throw new Error('Audio stream load nahi ho saki, doosra gaana try karein.');
  }

  /**
   * Send viral meme sound with ultra-fast direct streaming and buffer fallback
   */
  async sendMemeAudio(from, soundItem, quotedMsg) {
    if (!this.sock) throw new Error('WhatsApp bot is not connected');
    if (!soundItem) throw new Error('Meme sound nahi mila.');
    const cleanTitle = (soundItem.name || 'meme').replace(/[\\/:*?"<>|]/g, '').slice(0, 30);

    // Immediate reaction & presence
    if (quotedMsg?.key) {
      try { await this.sock.sendMessage(from, { react: { text: '😂', key: quotedMsg.key } }); } catch (e) {}
    }
    await this.sendPresence(from, 'recording');

    // 1. Direct fast URL stream via Baileys (1-2s)
    try {
      this.stats.messagesSent++;
      await this.sock.sendMessage(from, {
        audio: { url: soundItem.url },
        mimetype: 'audio/mpeg',
        fileName: `${cleanTitle}.mp3`,
        ptt: false
      }, quotedMsg ? { quoted: quotedMsg } : undefined);

      Store.addLog({
        type: 'outgoing',
        to: from,
        text: `[Sent Meme Sound]: ${soundItem.title || soundItem.name}`
      });
      return;
    } catch (urlErr) {
      console.warn('Direct meme audio URL stream fallback to buffer:', urlErr.message);
    }

    // 2. High-speed buffer fallback with custom headers
    const audioBuf = await getMemeAudioBuffer(soundItem);
    this.stats.messagesSent++;
    await this.sock.sendMessage(from, {
      audio: audioBuf,
      mimetype: 'audio/mpeg',
      fileName: `${cleanTitle}.mp3`,
      ptt: false
    }, quotedMsg ? { quoted: quotedMsg } : undefined);

    Store.addLog({
      type: 'outgoing',
      to: from,
      text: `[Sent Meme Sound]: ${soundItem.title || soundItem.name}`
    });
  }

  /**
   * Display dynamic soundboard categories and instruction guide
   */
  async sendSoundboardMenu(from, prefix = '!') {
    let list = `🔊 *AwaisxBot Funny Meme Soundboard (${MEME_SOUNDS.length} Sounds)* 🔊\n\n`;
    const categories = {
      'Song': '🎵 *Viral Funny Songs & Tunes:*',
      'Desi': '🎭 *Desi Comedy & Famous Dialogues:*',
      'Meme': '🌐 *Global Viral Memes:*',
      'SFX': '💥 *Funny Sound Effects (SFX):*'
    };

    for (const [catKey, catTitle] of Object.entries(categories)) {
      list += `${catTitle}\n`;
      MEME_SOUNDS.filter(m => m.category === catKey).forEach(m => {
        const num = MEME_SOUNDS.indexOf(m) + 1;
        list += `*${num}.* ${m.title} ➔ *${prefix}sound ${num}* ya *${prefix}sound ${m.keywords[0]}*\n`;
      });
      list += `\n`;
    }

    list += `💡 *Sunne Ka Tareeqa:*\n` +
            `• *Number se:* *${prefix}sound 1*, *${prefix}sound 7*, ya direct *1*, *7*\n` +
            `• *Naam se:* *${prefix}sound moye*, *${prefix}sound maro*, ya direct *moye moye*, *maro mujhe*\n` +
            `• *Random:* *${prefix}sound* ya *${prefix}meme* (random funny sound ke liye)\n` +
            `• *Meme photo ke liye:* *${prefix}memepic*`;
    await this.sendMessage(from, list);
  }

  async handleMessage({ msg, from, sender, senderName, isGroup, text, interactiveId }) {
    const config = Store.getConfig();
    const prefix = config.prefix ?? '';
    const trimmed = (text || '').trim();

    // Proactive tracking: record last interaction for 1-on-1 chats
    // (2026-10-13, Hudson: bot nudges inactive users)
    if (!isGroup && sender) {
      try {
        const { touchUser } = await import('./proactive.js');
        touchUser(sender);
      } catch {}
    }

    // Persistent memory (2026-10-13, Hudson: EVERY message saved, never lost)
    if (!isGroup && sender && trimmed) {
      try {
        const { recordMessage } = await import('./memory.js');
        recordMessage(sender, 'user', trimmed.slice(0, 2000));
      } catch {}
      // Map chat JID → sender LID so sendMessage can record bot replies correctly
      if (!this._jidToSender) this._jidToSender = {};
      this._jidToSender[from] = sender;
    }

    // Pending confirmations (2026-10-13, Hudson: bot must remember context)
    // If user was asked to confirm something, "yes" continues that flow.
    if (!isGroup && sender && trimmed) {
      const low = trimmed.toLowerCase();
      if ((low === 'yes' || low === 'confirm' || low === 'y') && this._pendingConfirm && this._pendingConfirm[sender]) {
        const pending = this._pendingConfirm[sender];
        delete this._pendingConfirm[sender];
        // Re-dispatch as the confirmed command
        return await this.handleMessage({ msg, from, sender, senderName, isGroup, text: pending.command + ' yes', interactiveId: null });
      }
    }
    // Pending AI builds (2026-10-15): "yes" in a group applies pending aibuild.
    if (isGroup && sender && trimmed) {
      const low = trimmed.toLowerCase();
      if ((low === 'yes' || low === 'confirm' || low === 'y') && this._pendingBuild && this._pendingBuild[sender]) {
        return await this.handleMessage({ msg, from, sender, senderName, isGroup, text: 'aibuild yes', interactiveId: null });
      }
      if ((low === 'no' || low === 'cancel' || low === 'n') && this._pendingBuild && this._pendingBuild[sender]) {
        delete this._pendingBuild[sender];
        await this.sendMessage(from, `❌ AI setup cancelled.`);
        return;
      }
    }

    // Strict Group Whitelist Enforcement:
    // If the message is from a WhatsApp group, the bot ONLY works in groups explicitly enabled by the user in localhost UI
    if (isGroup) {
      if (!Store.isGroupAllowed(from)) {
        return; // 100% strict silence in unselected groups
      }
    }

    // Interactive menu taps (buttons/lists) — route before command detection
    if (interactiveId && String(interactiveId).startsWith('awaxmenu:')) {
      try {
        const { handleMenuTap } = await import('./interactive-menu.js');
        const handled = await handleMenuTap(this, { msg, from, sender, senderName, isGroup }, String(interactiveId));
        if (handled) return;
      } catch (e) {
        console.error('[interactive-menu] tap error:', e.message);
      }
    }

    // Natural-language automation (2026-10-13): "send X to Y daily"
    try {
      const { parseAutomationRequest, addScheduledTask, WEEKDAY_NAMES } = await import('./automation.js');
      const auto = parseAutomationRequest(trimmed);
      if (auto) {
        // Group automations: if set inside a group, target that group
        if (auto.targetType === 'group' && isGroup) {
          auto.target = from;
        }
        // Channels removed 2026-10-17 per Hudson — no "not supported" message
        const task = addScheduledTask({
          message: auto.message,
          target: auto.target,
          targetType: auto.targetType,
          schedule: auto.schedule,
          weekday: auto.weekday,
          time: auto.time,
          owner: sender,
        });
        const when = auto.schedule === 'weekly'
          ? `weekly (${WEEKDAY_NAMES[task.weekday]}) at ${auto.time} PKT`
          : `${auto.schedule} at ${auto.time} PKT`;
        await this.sendMessage(from,
          `✅ *Automation set!*\n\n` +
          `📨 Message: "${auto.message}"\n` +
          `📍 To: ${auto.target || auto.targetType}\n` +
          `🔁 ${when}\n\n` +
          `_Stop karne ke liye: *stop automation ${task.id}*_\n\n` +
          `🤖 *Powered by Awais AI*`
        );
        return;
      }
    } catch (e) {
      console.error('[automation] parse error:', e.message);
    }

    // Onboarding for new users (2026-10-13) — runs before commands so we can
    // personalize. Skips groups and already-onboarded users.
    try {
      const { checkOnboarding } = await import('./onboarding.js');
      const onboarded = await checkOnboarding(this, { msg, from, sender, senderName, isGroup, text: trimmed });
      if (onboarded) return;
    } catch (e) {
      console.error('[onboarding] error:', e.message);
    }

    // PASTED-OUTPUT EARLY GUARD (2026-10-15): the bot's own replies carry the
    // "Powered by Awais AI" footer or distinctive templates ("Misaal:",
    // "Likhein:", "Usage:", etc). If pasted back, ignore SILENTLY before any
    // hooks, detection, or automations can trigger. This must run before
    // runMessageHooks (which can auto-trigger emoji/URL/media features).
    const _earlyClean = String(trimmed || '').replace(/\s+/g, ' ').trim();
    if (/powered by awais ai|misaal:|misal:|likhein|usage:|istamal:|istimal:|istemal:|this command only works|meri (line|agli line):|antakshari shuru|aaj ka chand:|funny meme soundboard|all video downloader|qr code|for example:|ayah of the day|آیتِ مبارکہ|crypto prices|what you'd like|quiz:|jawab:/i.test(_earlyClean)) {
      return;
    }

    // HOSTING PATCH (Muse, 2026-10-12): passive automation hooks for the new
    // features (antilink, antispam, afk, autoreact, slowmode, keyword alerts,
    // usage stats, ...). Silent and non-throwing by design.
    try {
      await runMessageHooks({ bot: this, msg, from, sender, senderName, isGroup, prefix, text: trimmed });
    } catch (e) {
      console.error('[newfeatures] hook error:', e.message);
    }

    // Command detection — no prefix needed. A message is treated as a command
    // when it starts with the configured prefix (if one is set) OR when its
    // first word is a known command name (e.g. "ping", "menu", "soundboard").
    // A leading "!" is still accepted for backward compatibility.
    // FUZZY (2026-10-14): strip leading noise (emojis, ./!#> etc) so
    // ".menu", "😀menu", ">menu" all work like "menu".
    const cleanTrimmed = normalizeSpaces(stripNoise(trimmed));
    // DIRECT PHRASE ROUTING (2026-10-15): data-deletion phrases go straight to
    // deletemydata — never let the AI misroute them to group delete commands.
    const lowerTrimmed = cleanTrimmed.toLowerCase();
    // PASTED-OUTPUT GUARD (2026-10-15): the bot's own replies always carry the
    // "Powered by Awais AI" footer. If it appears in the incoming message, the
    // user pasted/copied bot output back — never treat it as a command or
    // natural-language intent. Ignore silently. The bot's other distinctive
    // reply templates ("Misaal:", "Likhein:", game prompts, result labels)
    // pasted back are covered too.
    const isPastedBotOutput = /powered by awais ai|misaal:|misal:|likhein|usage:|istamal:|istimal:|istemal:|this command only works|meri (line|agli line):|antakshari shuru|aaj ka chand:|funny meme soundboard|all video downloader|qr code|for example:|ayah of the day|آیتِ مبارکہ|crypto prices|what you'd like|quiz:|jawab:/i.test(cleanTrimmed);
    let cmdText = null;
    let skipNormalDetection = false;
    if (/^(delete|remove|erase|clear)\s+(my\s+)?(all\s+)?(data|everything|chat history)/i.test(lowerTrimmed)) {
      if (isGroup) {
        await this.sendMessage(from, `🔒 *Delete my data* sirf DM mein kaam karta hai — mujhe direct message karein.`);
        return;
      }
      cmdText = 'deletemydata';
      skipNormalDetection = true;
    }
    // DIRECT SUPPORT ROUTING (2026-10-15): clear complaint phrases get a direct
    // helpful response — don't let the AI fumble them into a menu dump.
    if (!isGroup && /\b(kaam nahi kar|kam nahi|not working|kaam nahin|nai chal|nahi chal)\b/i.test(lowerTrimmed)) {
      await this.sendMessage(from, `I hear you — something's not working. Tell me *what* isn't working (which command or feature?) and I'll help you fix it step by step. 🤖`);
      return;
    }
    let fuzzyHint = null; // "Did you mean X?" notice
    let fuzzyOn = true;
    try { const { globalFeatureOn: _gfo } = await import('./access.js'); fuzzyOn = _gfo('fuzzy-commands', true); } catch {}
    // CHAT WORDS (2026-10-15): common conversational words are never commands.
    // Don't fuzzy-match them into irrelevant suggestions — let them fall
    // through to normal AI chat.
    const CHAT_WORDS = new Set(['yes','no','yeah','yep','yup','nah','nope','hi','hii','hello','helo','hey','heyy','salam','assalam','aoa','go','ok','okay','okk','okayy','fine','good','great','nice','thanks','thank','thx','shukriya','bye','alvida','hmm','acha','achha','theek','thik','sahi','han','haa','na','nahi','ji','yar','yaar','bro','wah','nice']);
    if (!skipNormalDetection && !isPastedBotOutput) {
    if (prefix && cleanTrimmed.startsWith(prefix)) {
      cmdText = cleanTrimmed.slice(prefix.length).trim();
    } else {
      const words = cleanTrimmed.split(/\s+/);
      const firstWord = (words[0] || '').toLowerCase();
      if (KNOWN_COMMANDS.has(firstWord) || /^\d{1,2}$/.test(firstWord)) {
        cmdText = cleanTrimmed;
      } else if (fuzzyOn && !CHAT_WORDS.has(firstWord)) {
        // PASTED-CONTENT GUARD (2026-10-15): messages longer than 10 words are
        // never commands — pasted bot output must not trigger automations.
        const wordCount = cleanTrimmed.split(/\s+/).filter(Boolean).length;
        if (wordCount <= 10) {
        // NATURAL FIRST (2026-10-15): an exact command word anywhere in the
        // message ("show menu" -> "menu") beats a fuzzy first word
        // ("show" -> "snow"). Exact matches are never wrong guesses.
        const natural = findCommandInText(cleanTrimmed, FUZZY_CANDIDATES);
        if (natural) {
          const nw = cleanTrimmed.toLowerCase().split(/\s+/);
          const idx = nw.findIndex(w => w.replace(/[^a-z0-9]/g, '') === natural);
          cmdText = idx > 0
            ? [natural, ...nw.slice(0, idx), ...nw.slice(idx + 1)].join(' ')
            : cleanTrimmed;
          fuzzyHint = null; // Disabled 2026-10-17 per Hudson
        } else {
          // FUZZY: try joining first two words ("tag all" -> "tagall")
          const joined = tryJoinWords(words, FUZZY_CANDIDATES);
          if (joined) {
            cmdText = joined + ' ' + words.slice(2).join(' ');
            fuzzyHint = null; // Disabled 2026-10-17 per Hudson
          } else {
            // FUZZY: typo in first word ("mneu" -> "menu")
            const close = findClosest(firstWord, FUZZY_CANDIDATES);
            if (close && firstWord.length >= 3) {
              cmdText = close.cmd + ' ' + words.slice(1).join(' ');
              fuzzyHint = null; // Disabled 2026-10-17 per Hudson
            }
          }
        }
        }
      }
    }
    } // end skipNormalDetection
    if (cmdText) {
      this.stats.commandsProcessed++;
      const [cmd, ...args] = cmdText.split(/\s+/);
      // BATCH8 (Muse, 2026-10-14): resolve new alias names to core commands
      // before dispatch, so they hit the right handler transparently.
      const rawCommand = cmd.toLowerCase();
      const command = CORE_ALIASES[rawCommand] || rawCommand;
      const query = args.join(' ');

      // Global feature toggle check (2026-10-14): if the command's category
      // is disabled in Dashboard → Features, block it.
      // Per-command toggle (2026-10-14): individual commands disabled via
      // Dashboard → Sections are also blocked here.
      // Usage stats recorded for every dispatched command.
      try {
        const { globalFeatureOn, isCommandEnabled, recordCommandUse } = await import('./access.js');
        const { MENU_CATEGORIES } = await import('./menu-data.js');
        for (const cat of MENU_CATEGORIES) {
          const slug = 'cat-' + (cat.num || cat.title).toString().toLowerCase().replace(/[^a-z0-9]+/g, '-');
          const inCat = (cat.cmds || []).some(c => (c.name || '').toLowerCase() === command.toLowerCase());
          if (!inCat) continue;
          if (!globalFeatureOn(slug, true)) {
            await this.sendMessage(from, `⛔ *${cat.title}* category dashboard se disabled hai.`);
            return;
          }
          if (!isCommandEnabled(slug, command)) {
            await this.sendMessage(from, `⛔ *${command}* command dashboard se disabled hai.`);
            return;
          }
          recordCommandUse(command);
          break;
        }
      } catch { /* ignore feature check errors */ }

      // HOSTING PATCH (Muse, 2026-10-12): dispatch the 134 new-feature commands
      // (batches 1-6) before the built-in switch. Runs in the same try/catch
      // style as other handlers — never throws out of handleMessage.
      // REMOTE GROUP MANAGEMENT (2026-10-16, per Hudson): if in DM with a managed
      // group selected, route group commands to that group but reply in DM.
      const _managedGid = (!isGroup && global._managedGroup) ? global._managedGroup[sender] : null;
      const _remotable = ['tagall', 'hidetag', 'lock', 'unlock', 'poll', 'groupinfo', 'admins', 'welcome', 'goodbye', 'antilink', 'antispam', 'topactive', 'kick', 'add', 'warn'];
      if (_managedGid && _remotable.includes(command)) {
        try {
          const targetCtx = { bot: this, from: _managedGid, sender, senderName, isGroup: true, isOwner: true, isAdmin: true, prefix, reply: (t) => this.sendMessage(from, t) };
          // Build a minimal remote execution for common commands
          if (command === 'groupinfo') {
            const meta = await this.sock.groupMetadata(_managedGid);
            await this.sendMessage(from, `👥 *${meta.subject}*\nMembers: ${meta.participants?.length || '?'}\nID: \`${_managedGid}\`\n\n🤖 *Powered by Awais AI*`);
          } else if (command === 'tagall') {
            const meta = await this.sock.groupMetadata(_managedGid);
            const mentions = (meta.participants || []).map(p => p.id);
            await this.sock.sendMessage(_managedGid, { text: `📢 ${query || 'Attention everyone!'}\n\n(from ${senderName} via remote)`, mentions });
            await this.sendMessage(from, `✅ Tagall sent to group.\n\n🤖 *Powered by Awais AI*`);
          } else if (command === 'lock' || command === 'unlock') {
            await this.sock.groupSettingUpdate(_managedGid, command === 'lock' ? 'announcement' : 'not_announcement');
            await this.sendMessage(from, `✅ Group ${command === 'lock' ? 'locked 🔒' : 'unlocked 🔓'}.\n\n🤖 *Powered by Awais AI*`);
          } else if (command === 'poll') {
            const parts = query.split('|').map(s => s.trim()).filter(Boolean);
            if (parts.length >= 3) {
              await this.sock.sendMessage(_managedGid, { poll: { name: parts[0], values: parts.slice(1), selectableCount: 1 } });
              await this.sendMessage(from, `✅ Poll sent to group.\n\n🤖 *Powered by Awais AI*`);
            } else {
              await this.sendMessage(from, `❌ Usage: poll <question> | <opt1> | <opt2>`);
            }
          } else {
            await this.sendMessage(from, `ℹ️ Remote \`${command}\` — group mein jaake use karein ya \`manage off\` karke wapis aayein.`);
          }
        } catch (e) {
          await this.sendMessage(from, `❌ Remote command failed: ${e.message}`);
        }
        return;
      }

      if (NEW_COMMANDS.has(command)) {
        // FUZZY (2026-10-14): let the user know we interpreted their input
        if (fuzzyHint) { try { await this.sendMessage(from, fuzzyHint); } catch {} }
        try {
          // Owner/admin identity (2026-10-14): batch handlers can check ctx.isOwner / ctx.isAdmin
          // (2026-10-16, per Hudson): the bot's OWN messages are always owner.
          let _isOwner = false, _isAdmin = false;
          try {
            const { isOwner, isAdmin } = await import('./access.js');
            _isOwner = isSelfMsg ? true : isOwner(sender);
            _isAdmin = isSelfMsg ? true : isAdmin(sender);
          } catch { /* ignore */ }
          await handleNewFeature(
            { bot: this, msg, from, sender, senderName, isGroup, prefix, isOwner: _isOwner, isAdmin: _isAdmin },
            command,
            query
          );
        } catch (err) {
          console.error('[newfeatures] dispatch error:', command, err.message);
          await this.sendMessage(from, `❌ Kuch garbar ho gayi, dobara try karein.`);
        }
        return;
      }

      // Number handling (2026-10-15): numbers 1-16 ALWAYS open menu categories —
      // that is the menu's contract ("Reply with a command name to use it").
      // The old 10-minute menu window was wiped on every restart and turned
      // bare numbers into surprise meme audios. Bare numbers above 16 (no
      // category) still play meme sounds; "meme <n>" works for all sounds.
      if (/^\d{1,2}$/.test(command)) {
        const num = parseInt(command, 10);
        if (num > 16 && num >= 1 && num <= MEME_SOUNDS.length) {
          const soundItem = MEME_SOUNDS[num - 1];
          try {
            await this.sendMemeAudio(from, soundItem, msg);
          } catch (err) {
            await this.sendMessage(from, `❌ Meme audio load nahi ho saki: ${err.message}`);
          }
          return;
        }
      }

      // FUZZY (2026-10-14): show interpretation notice for switch commands too
      if (fuzzyHint) { try { await this.sendMessage(from, fuzzyHint); } catch {} fuzzyHint = null; }

      // BEAUTIFUL MENU (2026-10-15): category NAME drill-down — "voice ai",
      // "memes" etc. within 10 min of menu. Known commands take precedence.
      // Uses the FULL text (not first word) so "voice ai" opens the category
      // while "music" still runs the song command.
      if (this.lastMenuRequest?.get(from) &&
          (Date.now() - this.lastMenuRequest.get(from)) < 10 * 60 * 1000) {
        try {
          const fullText = String(cleanTrimmed).toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
          if (fullText && !KNOWN_COMMANDS.has(fullText)) {
            const { matchCategoryByName } = await import('./menu-groups.js');
            const catNum = await matchCategoryByName(cleanTrimmed);
            if (catNum) {
              await this.sendMessage(from, await this.getCategoryCommands(catNum));
              return;
            }
          }
        } catch { /* fall through to normal dispatch */ }
      }

      switch (command) {
        // --- 1. MINIMAL & FRIENDLY MENU ---
        // --- 1. COMPREHENSIVE SECTIONED MENU (interactive buttons) ---
        case 'menu':
        case 'help':
        case 'start':
        case 'info':
        case 'more':
        case 'all':
        case 'tools':
        case 'bot': {
          await this.sendMessage(from, await this.getCleanMenu());
          if (!this.lastMenuRequest) this.lastMenuRequest = new Map();
          this.lastMenuRequest.set(from, Date.now()); // numbers 1-16 drill into categories for 10 min
          return;
        }

        // Unified menu category drill-down (1-16, matches dashboard sections)
        case '1': case '2': case '3': case '4': case '5':
        case '6': case '7': case '8': case '9': case '10':
        case '11': case '12': case '13': case '14': case '15':
        case '16': {
          const detail = await this.getCategoryCommands(parseInt(command, 10));
          if (detail) {
            await this.sendMessage(from, detail);
          } else {
            await this.sendMessage(from, await this.getCleanMenu());
          }
          return;
        }

        // --- 1b. FULL TEXT MENU (old long version) ---
        case 'textmenu':
        case 'fullmenu': {
          await this.sendMessage(from, this.getMobileFriendlyMenu(prefix));
          return;
        }

        // --- 1.0 VOICE NOTE & TEXT-TO-SPEECH (DEEPGRAM AURA) ---
        case 'voice':
        case 'speak':
        case 'tts':
        case 'bol': {
          if (!query) {
            await this.sendMessage(from, `🎙️ *Voice AI Speaker (Deepgram Aura)*\n\nJo bulwana chahte hain wo likhein! Maslan:\n• *${prefix}voice Hello! Welcome to our group.*\n• *${prefix}speak Assalam-o-Alaikum dost, kaisay ho?*`);
            return;
          }
          try {
            try { await this.sock.sendMessage(from, { react: { text: '🗣️', key: msg.key } }); } catch (e) {}
            await this.sendPresence(from, 'recording');
            const speechBuffer = await textToSpeech(query, 'aura-2-asteria-en');
            await this.sock.sendMessage(from, {
              audio: speechBuffer,
              mimetype: 'audio/mpeg',
              fileName: 'voice.mp3',
              ptt: false
            }, { quoted: msg });
          } catch (err) {
            await this.sendMessage(from, `❌ Voice audio generate nahi ho saki: ${err.message}`);
          }
          return;
        }

        // --- 1.05 VIRAL MEME PICTURES (REDDIT / TEMPLATES) ---
        case 'memepic':
        case 'memeimage':
        case 'picmeme': {
          try {
            try { await this.sock.sendMessage(from, { react: { text: '😂', key: msg.key } }); } catch (e) {}
            await this.sendPresence(from, 'composing');
            const meme = await getViralMeme();
            const caption = `🤣 *${meme.title}*\n📱 _Source: r/${meme.subreddit}_`;
            // GIFs must be sent as video with gifPlayback (2026-10-15):
            // sent as image they animate on desktop but show static on mobile.
            if (/\.gif(\?|$)/i.test(meme.url || '')) {
              await this.sock.sendMessage(from, {
                video: { url: meme.url },
                caption,
                gifPlayback: true
              }, { quoted: msg });
            } else {
              await this.sock.sendMessage(from, {
                image: { url: meme.url },
                caption
              }, { quoted: msg });
            }
          } catch (err) {
            await this.sendMessage(from, `❌ Meme image load nahi ho saki: ${err.message}`);
          }
          return;
        }

        case 'roast': {
          try {
            try { await this.sock.sendMessage(from, { react: { text: '🔥', key: msg.key } }); } catch (e) {}
            const roastText = await getMemeRoast(query, sender);
            await this.sendMessage(from, roastText);
          } catch (err) {
            await this.sendMessage(from, 'Roast load nahi ho saka');
          }
          return;
        }

        case 'chutkula':
        case 'joke':
        case 'latifa': {
          try {
            try { await this.sock.sendMessage(from, { react: { text: '🤣', key: msg.key } }); } catch (e) {}
            const jokeText = await getMemeJoke(sender);
            await this.sendMessage(from, jokeText);
          } catch (err) {
            await this.sendMessage(from, 'Latifa load nahi ho saka');
          }
          return;
        }

        // --- 1.1 SONGS & MUSIC MP3 ---
        case 'song':
        case 'music':
        case 'gana':
        case 'mp3': {
          if (!query) {
            await this.sendMessage(from, '🎵 *Music Player*\n\nKis song ka naam sunna chahte hain? Maslan:\n• *song tum hi ho*\n• *song tajdar e haram*\n• *song arijit singh*\n\n🔗 *Link se MP3:* kisi video ka link bhejein, MP3 ban jayegi!');
            return;
          }
          // Link-to-MP3: URL mile to audio extract karein (pehle shadowed tha)
          const urlMatch = query.match(/https?:\/\/[^\s]+/i);
          if (urlMatch) {
            try {
              try { await this.sock.sendMessage(from, { react: { text: '🎵', key: msg.key } }); } catch (e) {}
              await this.sendPresence(from, 'recording');
              const audioData = await downloadAudio(urlMatch[0]);
              await this.sock.sendMessage(from, {
                audio: { url: audioData.audioUrl },
                mimetype: audioData.mimetype || 'audio/mpeg',
                fileName: `${(audioData.title || 'Audio').replace(/[^a-zA-Z0-9_-]/g, '_')}.mp3`,
                ptt: false
              }, { quoted: msg });
            } catch (err) {
              await this.sendMessage(from, `❌ Audio extract nahi ho saki: ${err.message}`);
            }
            return;
          }
          try {
            try { await this.sock.sendMessage(from, { react: { text: '🎵', key: msg.key } }); } catch (e) {}
            await this.sendPresence(from, 'recording');
            const song = await searchAndDownloadSong(query);
            await this.sendMessage(from, `🎶 *Playing:* ${song.title}\n🎙️ *Artist:* ${song.author}\n⏳ Audio load ho rahi hai...`);

            await this.sendSongAudio(from, song, msg);
          } catch (err) {
            await this.sendMessage(from, `❌ Song load nahi ho saka: ${err.message}`);
          }
          return;
        }

        // --- 1.2 PHOTO & IMAGE SEARCH ---
        case 'photo':
        case 'image':
        case 'img':
        case 'pic':
        case 'wallpaper': {
          if (!query) {
            await this.sendMessage(from, '🖼️ *Photo Search*\n\nKis cheez ki image dekhna chahte hain? Maslan:\n• *photo lahore*\n• *photo cute cat*\n• *wallpaper nature*');
            return;
          }
          try {
            try { await this.sock.sendMessage(from, { react: { text: '🖼️', key: msg.key } }); } catch (e) {}
            await this.sendPresence(from, 'composing');
            const { fetchJsonRetry } = await import('./api-helper.js');
            let imgData;
            try {
              imgData = await searchImage(query);
            } catch (e) {
              imgData = null;
            }
            // Fallback: picsum random image if search fails
            if (!imgData?.imageUrl) {
              imgData = { imageUrl: `https://picsum.photos/800/600?random=${Date.now()}`, title: query };
            }
            try {
              await this.sock.sendMessage(from, {
                image: { url: imgData.imageUrl },
                caption: `🖼️ *${imgData.title}*`
              }, { quoted: msg });
            } catch (sendErr) {
              // If direct URL send fails, download and send as buffer
              try {
                const res = await fetch(imgData.imageUrl, { signal: AbortSignal.timeout(20000) });
                const buf = Buffer.from(await res.arrayBuffer());
                await this.sock.sendMessage(from, {
                  image: buf,
                  caption: `🖼️ *${imgData.title}*`
                }, { quoted: msg });
              } catch (e2) {
                throw sendErr;
              }
            }
          } catch (err) {
            await this.sendMessage(from, `❌ Image search nahi ho saki, dobara try karein.`);
          }
          return;
        }

        // --- 2. ALL VIDEO DOWNLOADER ---
        case 'dl':
        case 'down':
        case 'download':
        case 'video':
        case 'v':
        case 'tiktok':
        case 'tt':
        case 'reel':
        case 'reels':
        case 'ig':
        case 'igdl':
        case 'insta':
        case 'yt':
        case 'ytdl':
        case 'youtube':
        case 'fb':
        case 'fbdown':
        case 'facebook':
        case 'tw':
        case 'twitter':
        case 'x':
        case 'pin':
        case 'pinterest':
        case 'capcut':
        case 'snapchat':
        case 'snap':
        case 'threads':
        case 'likee':
        case 'kwai':
        case 'vimeo':
        case 'dailymotion': {
          let targetUrl = query;
          // Check if quoted message had a URL
          if (!targetUrl) {
            const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quoted) {
              targetUrl = quoted.conversation || quoted.extendedTextMessage?.text || quoted.imageMessage?.caption || quoted.videoMessage?.caption || '';
            }
          }

          const match = targetUrl ? targetUrl.match(/https?:\/\/[^\s]+/i) : null;
          const link = match ? match[0] : null;

          if (!link) {
            await this.sendMessage(
              from,
              `🎬 *All Video Downloader*\n\n` +
              `Please send or include a video link! For example:\n` +
              `• *${prefix}dl https://vm.tiktok.com/...*\n` +
              `• *${prefix}reel https://www.instagram.com/reel/...*\n` +
              `• *${prefix}yt https://youtu.be/...*\n` +
              `• *${prefix}fb https://www.facebook.com/...*\n\n` +
              `_Supported: TikTok (no watermark), Instagram Reels, YouTube, Facebook, Twitter/X, Pinterest, CapCut, and direct MP4!_`
            );
            return;
          }

          // Instant lightning emoji reaction for immediate visual feedback
          try {
            await this.sock.sendMessage(from, { react: { text: '⚡', key: msg.key } });
          } catch (e) {}

          await this.sendPresence(from, 'recording');
          const noticePromise = this.sendMessage(from, `⚡ *Downloading fast MP4 video...* 🎬`).catch(() => {});
          const videoDataPromise = downloadVideo(link);

          try {
            const [_, videoData] = await Promise.all([noticePromise, videoDataPromise]);
            await this.sendVideoFromUrl(from, videoData, msg.key);
          } catch (err) {
            try {
              await this.sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            } catch (e) {}
            await this.sendMessage(
              from,
              `❌ Couldn't download video: ${err.message || 'Make sure the post is public.'}`
            );
          }
          return;
        }

        // --- 2.5 STICKER & MEDIA CONVERTER TOOLS ---
        case 'attp': {
          // Animated text sticker (2026-10-14, implemented per Hudson)
          if (!query) {
            await this.sendMessage(from, `✨ *Animated Text Sticker*\n\nIstamal: *attp <text>*\nMisaal: *attp Hello Dosto*\n\nText ka animated sticker ban jayega!`);
            return;
          }
          try {
            await this.sendPresence(from, 'composing');
            const sharp = (await import('sharp')).default;
            const text = query.slice(0, 30).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const colors = ['#FF6B6B', '#4ECDC4', '#FFD93D', '#6BCB77', '#9B59B6'];
            const frames = [];
            for (let i = 0; i < 5; i++) {
              const yOff = i % 2 === 0 ? -12 : 12;
              const svg = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg"><rect width="512" height="512" fill="#1a1a2e"/><text x="256" y="${256 + yOff}" font-family="Arial,sans-serif" font-size="64" font-weight="bold" fill="${colors[i]}" text-anchor="middle" dominant-baseline="middle">${text}</text></svg>`;
              frames.push(await sharp(Buffer.from(svg)).png().toBuffer());
            }
            let animated;
            try {
              animated = await sharp(frames, { animated: true, loop: 0 }).webp().toBuffer();
            } catch { animated = frames[0]; }
            await this.sock.sendMessage(from, { sticker: animated }, { quoted: msg });
          } catch (err) {
            await this.sendMessage(from, `❌ Animated sticker nahi ban saka: ${err.message}`);
          }
          return;
        }

        case 'sticker':
        case 'stiker':
        case 's': {
          let mediaMessage = null;
          const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
          if (quoted?.imageMessage) {
            mediaMessage = {
              key: {
                remoteJid: from,
                id: msg.message.extendedTextMessage.contextInfo.stanzaId,
                participant: msg.message.extendedTextMessage.contextInfo.participant
              },
              message: { imageMessage: quoted.imageMessage }
            };
          } else if (msg.message?.imageMessage) {
            mediaMessage = msg;
          }

          if (!mediaMessage) {
            await this.sendMessage(from, `📸 Kisi bhi photo ke sath *${prefix}s* likhein ya photo ko reply karke *${prefix}s* likhein — sticker foran ban jayega!`);
            return;
          }

          try {
            try { await this.sock.sendMessage(from, { react: { text: '🎨', key: msg.key } }); } catch (e) {}
            const imgBuffer = await downloadMediaMessage(mediaMessage, 'buffer', {});
            const stickerBuf = await imageToSticker(imgBuffer);
            await this.sock.sendMessage(from, { sticker: stickerBuf }, { quoted: msg });
          } catch (err) {
            console.error('Sticker conversion error:', err);
            await this.sendMessage(from, `❌ Sticker nahi ban saka: ${err.message}`);
          }
          return;
        }

        case 'vs':
        case 'stickergif': {
          let mediaMessage = null;
          const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
          if (quoted?.videoMessage) {
            mediaMessage = {
              key: {
                remoteJid: from,
                id: msg.message.extendedTextMessage.contextInfo.stanzaId,
                participant: msg.message.extendedTextMessage.contextInfo.participant
              },
              message: { videoMessage: quoted.videoMessage }
            };
          } else if (msg.message?.videoMessage) {
            mediaMessage = msg;
          }

          if (!mediaMessage) {
            await this.sendMessage(from, `🎬 Kisi bhi choti video ya GIF ko reply karke *${prefix}vs* likhein — animated sticker ban jayega!`);
            return;
          }

          try {
            try { await this.sock.sendMessage(from, { react: { text: '✨', key: msg.key } }); } catch (e) {}
            const buf = await downloadMediaMessage(mediaMessage, 'buffer', {});
            const stBuf = await animToSticker(buf);
            await this.sock.sendMessage(from, { sticker: stBuf }, { quoted: msg });
          } catch (err) {
            await this.sendMessage(from, `❌ Animated sticker nahi ban saka: ${err.message}`);
          }
          return;
        }

        case 'v2a':
        case 'tomp3':
        case 'audio':
        case 'mp3': {
          // Video→MP3: URL with command converts directly (2026-10-15, per Hudson:
          // "audio <link>" or "mp3 <link>" gives MP3, not MP4).
          const urlMatch = (query || '').match(/https?:\/\/[^\s]+/i);
          if (urlMatch) {
            try {
              try { await this.sock.sendMessage(from, { react: { text: '🎵', key: msg.key } }); } catch (e) {}
              await this.sendPresence(from, 'recording');
              const { downloadAudio } = await import('./downloader.js');
              const audioData = await downloadAudio(urlMatch[0]);
              await this.sock.sendMessage(from, {
                audio: { url: audioData.audioUrl },
                mimetype: audioData.mimetype || 'audio/mpeg',
                fileName: `${(audioData.title || 'Audio').replace(/[^a-zA-Z0-9_-]/g, '_')}.mp3`,
                ptt: false
              }, { quoted: msg });
            } catch (err) {
              await this.sendMessage(from, `❌ MP3 convert nahi ho saka: ${err.message}`);
            }
            return;
          }
          // Video→MP3: natural-intent handler already tried; no video was attached/quoted.
          await this.sendMessage(from,
            `🎵 *Video se MP3*\n\nKisi video ke saath *audio* likhein ya video ko reply karke *audio* likhein — MP3 audio alag ho jayegi!\n\n*Link se:* *audio <video link>* — direct MP3 milegi\n\nMisaal: video bhejein + caption me *audio* likhein.`
          );
          return;
        }

        // --- 2.6 FUNNY MEME SOUNDBOARD & CLIPPER ---
        case 'soundboard':
        case 'memes':
        case 'sounds': {
          if (!this.lastSoundboardRequest) this.lastSoundboardRequest = new Map();
          this.lastSoundboardRequest.set(from, Date.now());

          // (2026-10-15, per Hudson): soundboard = SFX only. Memes are separate (meme command).
          let list = `💥 *Sound Effects (SFX)* 💥\n\n`;
          const sfxItems = MEME_SOUNDS.filter(m => m.category === 'SFX');
          sfxItems.forEach(m => {
            const num = MEME_SOUNDS.indexOf(m) + 1;
            list += `*${num}.* ${m.title} ➔ *meme ${num}*\n`;
          });
          list += `\n😂 *Meme sounds ke liye:* *meme* likhein\n\n`;
          list += `💡 *Sunne Ka Tareeqa:*\n` +
                  `• *Number se:* *meme 1*, *meme 7*\n` +
                  `• *Naam se:* *meme moye*, *meme maro*`;
          await this.sendMessage(from, list);
          return;
        }

        case 'clip':
        case 'trim':
        case 'videoclip': {
          await this.sendMessage(
            from,
            "✂️ *Video Clipper & Media Tools*\n\n" +
            `• *Video to Audio*: Video ko reply karke *${prefix}audio* ya *${prefix}v2a* likhein\n` +
            `• *Video to Animated Sticker*: Video ko reply karke *${prefix}vs* likhein (WhatsApp auto-clip sticker)\n` +
            `• *Photo to Sticker*: Photo ko reply karke *${prefix}s* ya *${prefix}sticker* likhein\n\n` +
            "ℹ️ _Note: Custom second-by-second video trimming server-side FFmpeg par depend karti hai, jabke sticker clipping aur audio extraction 100% active hain!_"
          );
          return;
        }

        case 'meme':
        case 'sound':
        case 'sfx': {
          try {
            // (2026-10-15, per Hudson): bare "meme" shows the 40+ list,
            // "meme <name/number>" plays that sound.
            if (!query || !query.trim()) {
              return await this.handleMessage({ msg, from, sender, senderName, isGroup, text: 'memelist', interactiveId: null });
            }
            try { await this.sock.sendMessage(from, { react: { text: '😂', key: msg.key } }); } catch (e) {}
            await this.sendPresence(from, 'recording');
            const soundItem = findMemeSound(query);
            const audioBuf = await getMemeAudioBuffer(soundItem);
            await this.sock.sendMessage(from, {
              audio: audioBuf,
              mimetype: 'audio/mpeg',
              fileName: `${soundItem.name}.mp3`,
              ptt: false
            }, { quoted: msg });
          } catch (err) {
            await this.sendMessage(from, `❌ Meme audio load nahi ho saki: ${err.message}`);
          }
          return;
        }

        // ── Meme list (2026-10-15, per Hudson): 40+ meme sounds, no SFX.
        case 'memelist': {
          let list = `😂 *Meme Sounds (40+)* 😂\n\n`;
          const categories = {
            'Meme': '🌐 *Viral Memes:*',
            'Desi': '🎭 *Desi Comedy & Dialogues:*',
            'Song': '🎵 *Funny Songs & Tunes:*'
          };
          for (const [catKey, catTitle] of Object.entries(categories)) {
            const items = MEME_SOUNDS.filter(m => m.category === catKey);
            if (!items.length) continue;
            list += `${catTitle}\n`;
            items.forEach(m => {
              const num = MEME_SOUNDS.indexOf(m) + 1;
              list += `*${num}.* ${m.title} ➔ *meme ${num}*\n`;
            });
            list += `\n`;
          }
          list += `💡 *Sunne ke liye:* *meme 5* ya *meme <naam>*\n\n🤖 *Powered by Awais AI*`;
          await this.sendMessage(from, list);
          return;
        }

        // --- 3. ISLAMIC SUITE: QURAN, HADITH, TAFSEER, AUDIO & PRAYER ---
        case 'quran':
        case 'surah': {
          if (!query) {
            const featured = [
              { num: 1, name: "Al-Fatihah", text: "Deebacha-e-Quran" },
              { num: 36, name: "Ya-Sin", text: "Dil-e-Quran" },
              { num: 55, name: "Ar-Rahman", text: "Zeenat-e-Quran" },
              { num: 67, name: "Al-Mulk", text: "Azaab-e-Qabar se Nijat" },
              { num: 18, name: "Al-Kahf", text: "Juma ke din ki barkat" },
              { num: 112, name: "Al-Ikhlas", text: "1/3 Quran ke barabar" }
            ];
            let listText =
              `📖 *The Holy Quran — Al-Qur'an al-Kareem*\n\n` +
              `*Surah dekhne ke liye:* *${prefix}surah <naam ya number>*\n` +
              `*Ayah tarjuma ke liye:* *${prefix}ayah <surah:ayah>* (e.g. *${prefix}ayah 2:255*)\n` +
              `*Tafseer ke liye:* *${prefix}tafseer <surah:ayah>*\n` +
              `*Tilawat audio sunne ke liye:* *${prefix}tilawat <surah>*\n\n` +
              `✨ *Mashhoor Surahs:*\n`;
            featured.forEach(f => {
              listText += `• *${prefix}surah ${f.num}* (${f.name}) — _${f.text}_\n`;
            });
            listText += `\n_Example: ${prefix}surah 36 ya ${prefix}surah Rahman_`;
            await this.sendMessage(from, listText);
            return;
          }

          try {
            await this.sendPresence(from, 'composing');
            const data = await getSurahOverview(query);
            const s = data.surah;
            let resText =
              `📖 *Surah ${s.name} (${s.arabic})*\n` +
              `✨ *Surah Number:* #${s.number} | *Total Ayahs:* ${s.ayahs}\n` +
              `📍 *Nuzool:* ${s.type === 'Meccan' ? 'Makki (مكية)' : 'Madani (مدنية)'}\n` +
              `📜 *Ma'ani (Meaning):* ${s.meaning}\n\n` +
              `🌟 *Shuruati Ayat (Opening Verses):*\n`;

            if (data.sampleAyahs.length > 0) {
              data.sampleAyahs.forEach(a => {
                resText += `\n*(${a.ayahNum})* ${a.arabic}\n_Tarjuma:_ ${a.urdu}\n`;
              });
            }

            resText +=
              `\n🎧 *Puri Surah ki Tilawat Suniye:* *${prefix}tilawat ${s.number}*\n` +
              `📖 *Khas Ayat Ka Tarjuma:* *${prefix}ayah ${s.number}:1*`;

            await this.sendMessage(from, resText);
          } catch (err) {
            await this.sendMessage(from, `❌ ${err.message}`);
          }
          return;
        }

        case 'ayah':
        case 'ayat': {
          let sNum = 1;
          let aNum = 1;

          if (query) {
            if (query.toLowerCase().includes('kursi')) {
              sNum = 2;
              aNum = 255;
            } else {
              const parts = query.replace(/\s+/g, '').split(/[:,-]/);
              if (parts.length >= 2) {
                sNum = parts[0];
                aNum = parts[1];
              } else {
                sNum = parts[0];
                aNum = 1;
              }
            }
          } else {
            // Random Ayah of the day
            try {
              const rand = await getRandomAyah();
              let msg =
                `✨ *Ayah of the Day (آیتِ مبارکہ)*\n\n` +
                `📖 *Surah ${rand.surah.name} (${rand.surah.arabic}) — Ayah ${rand.ayahNumber}*\n\n` +
                `${rand.arabic}\n\n` +
                `🇵🇰 *Urdu Tarjuma (فتح محمد جالندھری):*\n` +
                `${rand.urdu}\n\n` +
                `🇬🇧 *English Translation (Saheeh Intl):*\n` +
                `${rand.english}\n\n` +
                `💡 *Tafseer dekhne ke liye:* *${prefix}tafseer ${rand.surah.number}:${rand.ayahNumber}*`;
              await this.sendMessage(from, msg);
              return;
            } catch (e) {}
          }

          try {
            await this.sendPresence(from, 'composing');
            const data = await getAyahDetails(sNum, aNum);
            let msg =
              `📖 *Surah ${data.surah.name} (${data.surah.arabic}) — Ayah ${data.ayahNumber}*\n` +
              `📍 *Surah #${data.surah.number}* (${data.surah.type})\n\n` +
              `${data.arabic}\n\n` +
              `🇵🇰 *Urdu Tarjuma (فتح محمد جالندھری):*\n` +
              `${data.urdu}\n\n` +
              `🇬🇧 *English Translation (Saheeh Intl):*\n` +
              `${data.english}\n\n` +
              `💡 *Tafseer dekhne ke liye:* *${prefix}tafseer ${data.surah.number}:${data.ayahNumber}*\n` +
              `🎧 *Tilawat:* *${prefix}tilawat ${data.surah.number}*`;
            await this.sendMessage(from, msg);
          } catch (err) {
            await this.sendMessage(from, `❌ ${err.message || 'Ayah load nahi ho saki. Example: !ayah 2:255'}`);
          }
          return;
        }

        case 'tafseer':
        case 'tafsir': {
          if (!query) {
            await this.sendMessage(from, `Kis ayat ki tafseer dekhna chahte hain? For example:\n*${prefix}tafseer 2:255* (Ayat-ul-Kursi)\n*${prefix}tafseer 1:1* (Surah Fatiha)`);
            return;
          }

          const parts = query.replace(/\s+/g, '').split(/[:,-]/);
          const sNum = parts[0];
          const aNum = parts[1] || 1;

          try {
            await this.sendPresence(from, 'composing');
            const data = await getAyahDetails(sNum, aNum);
            let msg =
              `📚 *Tafseer-e-Quran (تفہیم القرآن / مودودی)*\n` +
              `📖 *Surah ${data.surah.name} — Ayah ${data.ayahNumber}*\n\n` +
              `${data.arabic}\n\n` +
              `🇵🇰 *Tarjuma:*\n${data.urdu}\n\n` +
              `💡 *Tafseeri Tashreeh:*\n` +
              `${(data.tafseer || 'Tafseer is available for this verse.').slice(0, 1000)}` +
              (data.tafseer && data.tafseer.length > 1000 ? '...\n\n_(Mukammal mutala ke liye Tafheem-ul-Quran dekhein)_' : '');
            await this.sendMessage(from, msg);
          } catch (err) {
            await this.sendMessage(from, `❌ ${err.message || 'Tafseer load nahi ho saki.'}`);
          }
          return;
        }

        case 'tilawat':
        case 'quranaudio':
        case 'quranmp3': {
          if (!query) {
            await this.sendMessage(
              from,
              `🎧 *Quran Audio Tilawat (تلاوتِ کلامِ پاک)*\n\n` +
              `Surah ka naam ya number likhein:\n` +
              `• *${prefix}tilawat yasin* (Mishary Alafasy)\n` +
              `• *${prefix}tilawat 55* (Surah Ar-Rahman)\n` +
              `• *${prefix}tilawat mulk sudais* (Sheikh Sudais ki aawaz mein)\n` +
              `• *${prefix}tilawat fatiha basit* (Abdul Basit)`
            );
            return;
          }

          try {
            try { await this.sock.sendMessage(from, { react: { text: '⚡', key: msg.key } }); } catch (e) {}
            await this.sendPresence(from, 'recording');
            const [surahQuery, ...reciterParts] = query.split(/\s+/);
            const reciterQuery = reciterParts.join(' ');

            const noticePromise = this.sendMessage(
              from,
              `🎧 *Quran Tilawat Audio*\n⏳ *Fast Cloudflare CDN se audio bhej raha hoon...*`
            );
            const audioDataPromise = getFastSurahAudioBuffer(surahQuery, reciterQuery);
            const [_, info] = await Promise.all([noticePromise, audioDataPromise]);

            const payload = info.buffer
              ? { audio: info.buffer, mimetype: 'audio/mpeg', fileName: `${info.surah.name}.mp3`, ptt: false }
              : { audio: { url: info.audioUrl }, mimetype: 'audio/mpeg', fileName: `${info.surah.name}.mp3`, ptt: false };

            await this.sendMessage(from, payload);
          } catch (err) {
            await this.sendMessage(from, `❌ ${err.message || 'Tilawat audio load nahi ho saka.'}`);
          }
          return;
        }

        case 'hadith':
        case 'hadees':
        case 'hadis': {
          let bName = 'bukhari';
          let hNum = 1;

          if (query) {
            const parts = query.trim().split(/\s+/);
            if (parts.length >= 2) {
              bName = parts[0];
              hNum = parts[1];
            } else if (/^\d+$/.test(parts[0])) {
              bName = 'bukhari';
              hNum = parts[0];
            } else {
              bName = parts[0];
              // random hadith from this book
              hNum = Math.floor(Math.random() * 50) + 1;
            }
          } else {
            // Random Sahih Bukhari Hadith
            bName = 'bukhari';
            hNum = Math.floor(Math.random() * 100) + 1;
          }

          try {
            await this.sendPresence(from, 'composing');
            const data = await getHadith(bName, hNum);
            let msg =
              `📜 *${data.book}*\n` +
              `🔢 *Hadith Number:* #${data.number}\n\n`;

            if (data.arabic) {
              msg += `${data.arabic.slice(0, 600)}${data.arabic.length > 600 ? '...' : ''}\n\n`;
            }

            if (data.urdu) {
              msg += `🇵🇰 *Urdu Tarjuma:*\n${data.urdu.slice(0, 800)}${data.urdu.length > 800 ? '...' : ''}\n\n`;
            }

            if (data.english) {
              msg += `🇬🇧 *English:*\n${data.english.slice(0, 600)}${data.english.length > 600 ? '...' : ''}\n\n`;
            }

            msg +=
              `✨ *Dastyaab Kitabein:* bukhari, muslim, tirmidhi, abudawud, nasai, ibnmajah\n` +
              `_Example: ${prefix}hadith muslim 1 ya ${prefix}hadith bukhari 50_`;

            await this.sendMessage(from, msg);
          } catch (err) {
            await this.sendMessage(from, `❌ ${err.message || 'Hadith load nahi ho saki. Example: !hadith bukhari 1'}`);
          }
          return;
        }

        case 'namaz':
        case 'prayer':
        case 'prayertimes': {
          const city = query || 'Karachi';
          try {
            await this.sendPresence(from, 'composing');
            const data = await getPrayerTimes(city);
            const msg =
              `🕌 *Auqaat-e-Namaz (Prayer Times)*\n` +
              `📍 *Sheher:* ${data.city}, ${data.country}\n` +
              `📅 *Date:* ${data.gregorian} | *Hijri:* ${data.hijri}\n\n` +
              `🌅 *Fajr:* ${data.timings.Fajr}\n` +
              `☀️ *Tuloo-e-Aftab (Sunrise):* ${data.timings.Sunrise}\n` +
              `☀️ *Dhuhr (Zohar):* ${data.timings.Dhuhr}\n` +
              `🌤️ *Asr:* ${data.timings.Asr}\n` +
              `🌇 *Maghrib (Iftar):* ${data.timings.Maghrib}\n` +
              `🌌 *Isha:* ${data.timings.Isha}\n\n` +
              `_Kisi aur sheher ke auqaat ke liye likhein: ${prefix}namaz Lahore ya ${prefix}namaz Islamabad_`;
            await this.sendMessage(from, msg);
          } catch (err) {
            await this.sendMessage(from, `❌ ${err.message || 'Prayer times nahi mil sakay.'}`);
          }
          return;
        }

        case 'hijri':
        case 'islamicdate':
        case 'islami_date':
        case 'tareekh':
        case 'date': {
          try {
            await this.sendPresence(from, 'composing');
            const d = await getIslamicDate();
            let msg =
              `🌙 *Aaj Ki Islami Tareekh (Islamic Date)* 🌙\n\n` +
              `📅 *Hijri Tareekh:* ${d.formattedHijri}\n` +
              `📆 *English Date:* ${d.formattedEnglish} (${d.weekdayEn || ''})\n` +
              `📖 *Islami Maheena:* ${d.monthNameUrdu} (${d.monthNameAr})\n`;

            if (d.description) {
              msg += `ℹ️ *Fazeelat:* ${d.description}\n`;
            }

            if (d.eventToday) {
              msg += `\n🌟 *Aaj Ka Mubarak Din:* *${d.eventToday.event}*\n_${d.eventToday.desc}_\n`;
            }

            msg += `\n✨ *Aane walay Islami Tehwar:* *${prefix}events* likhein.`;
            await this.sendMessage(from, msg);
          } catch (err) {
            await this.sendMessage(from, `❌ Tareekh load nahi ho saki: ${err.message}`);
          }
          return;
        }

        case 'events':
        case 'islamicevents':
        case 'tehwar': {
          let msg = `🌟 *Khas Islami Ayyam & Tehwar (Major Islamic Events)* 🌟\n\n`;
          MAJOR_ISLAMIC_EVENTS.forEach(e => {
            const m = ISLAMIC_MONTHS[e.month - 1];
            msg += `• *${e.day} ${m?.urdu || m?.name}:* ${e.event}\n  _${e.desc}_\n\n`;
          });
          msg += `_Aaj ki islami tareekh dekhne ke liye: ${prefix}hijri likhein._`;
          await this.sendMessage(from, msg);
          return;
        }

        case 'allahnames':
        case 'asmaulhusna':
        case 'allahname': {
          if (query && /^\d+$/.test(query.trim())) {
            const num = parseInt(query.trim(), 10);
            const found = ALLAH_NAMES.find(n => n.num === num);
            if (found) {
              const msg =
                `✨ *Asma-ul-Husna (Allah Ka Mubarak Naam #${found.num})*\n\n` +
                `⭐ *${found.arabic}*\n` +
                `🔤 *${found.urdu}*\n` +
                `📖 *Ma'ani:* ${found.meaning}\n\n` +
                `_SubhanAllah! 1 se 99 tak kisi bhi number ka naam dekhne ke liye likhein: ${prefix}allahname <number>_`;
              await this.sendMessage(from, msg);
              return;
            }
          }

          // Pick 5 random blessed names
          const shuffled = [...ALLAH_NAMES].sort(() => 0.5 - Math.random()).slice(0, 5);
          let msg = `✨ *Asma-ul-Husna (اللہ تعالیٰ کے بابرکت نام)*\n\n`;
          shuffled.forEach(n => {
            msg += `*#${n.num}* ${n.arabic} — *${n.urdu}*\n   _${n.meaning}_\n\n`;
          });
          msg += `_Kisi khas number ka naam dekhne ke liye: ${prefix}allahname 1 (1 se 99 tak)_`;
          await this.sendMessage(from, msg);
          return;
        }

        case 'dua':
        case 'duain':
        case 'azkar': {
          let chosen = query ? findDua(query) : DAILY_DUAS[Math.floor(Math.random() * DAILY_DUAS.length)];

          const msg =
            `🤲 *Masnoon Dua — ${chosen.topic}*\n\n` +
            `${chosen.arabic}\n\n` +
            `🔤 *Roman Urdu:*\n_${chosen.roman}_\n\n` +
            `🇵🇰 *Urdu Tarjuma:*\n${chosen.urdu}\n\n` +
            `_Mazeed duain: ${prefix}dua safar, ${prefix}dua khana, ${prefix}dua sona, ${prefix}dua pareshani_`;
          await this.sendMessage(from, msg);
          return;
        }

        // --- 4. AI ASSISTANT ---
        case 'ai':
        case 'ask': {
          if (!config.ai?.enabled) {
            await this.sendMessage(from, 'Hey, AI chat is currently switched off in the dashboard.');
            return;
          }
          if (!query) {
            await this.sendMessage(from, `Ask me anything! For example:\n*${prefix}ai what are some fun weekend project ideas?*`);
            return;
          }
          this.stats.aiQueries++;
          await this.sendPresence(from, 'composing');
          const aiResponse = await askAI(query, { senderId: sender, senderName });
          await this.sendMessage(from, aiResponse);
          return;
        }

        // --- 3. WHATSAPP POLLS ---
        case 'poll': {
          if (!query || !query.includes('|')) {
            await this.sendMessage(
              from,
              `To make a quick poll, write your question and choices separated by |, like this:\n*${prefix}poll Where should we grab lunch? | Burgers | Pizza | Tacos*`
            );
            return;
          }
          const parts = query.split('|').map(p => p.trim()).filter(Boolean);
          if (parts.length < 3) {
            await this.sendMessage(from, 'To make a poll, please include a question and at least 2 choices separated by |');
            return;
          }
          const question = parts[0];
          const options = parts.slice(1, 13); // max 12 options

          try {
            await this.sendMessage(from, {
              poll: {
                name: question,
                values: options,
                selectableCount: 1
              }
            });
          } catch (err) {
            await this.sendMessage(from, `Sorry, couldn't create that poll right now: ${err.message}`);
          }
          return;
        }

        // --- 4. DYNAMIC QR CODE GENERATOR ---
        case 'qr': {
          if (!query) {
            await this.sendMessage(from, `Send me a link or text you'd like as a QR code, like:\n*${prefix}qr https://google.com*`);
            return;
          }
          try {
            await this.sendPresence(from, 'composing');
            const qrBuffer = await generateQRCodeBuffer(query);
            await this.sendMessage(from, {
              image: qrBuffer,
              caption: `Here's your QR code for: *${query}*\nYou can scan it right with your camera!`
            });
          } catch (err) {
            await this.sendMessage(from, `Couldn't generate that QR code: ${err.message}`);
          }
          return;
        }

        // --- 5. SAFE CALCULATOR ---
        case 'calc':
        case 'math': {
          if (!query) {
            await this.sendMessage(from, `Just type what you'd like me to calculate, like:\n*${prefix}calc (250 * 4) + 15%*`);
            return;
          }
          const mathResult = evaluateMath(query);
          await this.sendMessage(from, mathResult);
          return;
        }

        // --- 6. WEATHER FORECAST ---
        case 'weather': {
          if (!query) {
            await this.sendMessage(from, `Which city would you like the forecast for? For example:\n*${prefix}weather London*`);
            return;
          }
          await this.sendPresence(from, 'composing');
          const wReply = await getWeather(query);
          await this.sendMessage(from, wReply);
          return;
        }

        // --- 7. CRYPTO PRICES ---
        case 'crypto':
        case 'btc':
        case 'eth': {
          await this.sendPresence(from, 'composing');
          const cryptoMsg = await getCryptoPrices();
          await this.sendMessage(from, cryptoMsg);
          return;
        }

        // --- 7b. DELETE MY DATA (2026-10-13, Hudson: self-service data wipe) ---
        case 'deletemydata':
        case 'deletedata':
        case 'reset':
        case 'resetmydata': {
          const confirm = query.toLowerCase().trim();
          if (confirm !== 'yes' && confirm !== 'confirm') {
            // Remember: this user has a pending delete confirmation
            if (!this._pendingConfirm) this._pendingConfirm = {};
            this._pendingConfirm[sender] = { command: 'deletemydata', at: Date.now() };
            await this.sendMessage(from,
              `⚠️ *Delete all my data?*\n\n` +
              `This will permanently erase:\n` +
              `• Your profile (name, preferences)\n` +
              `• Chat history with AI\n` +
              `• Game scores & progress\n` +
              `• Reminders, notes & automation settings\n` +
              `• Usage statistics\n\n` +
              `You'll start fresh as a new user.\n\n` +
              `Type *deletemydata yes* to confirm.`
            );
            return;
          }
          // Confirmed — wipe everything for this sender
          try {
            const fs = await import('fs');
            const path = await import('path');
            const { fileURLToPath } = await import('url');
            // Data lives in src/exe/data — lib/ is one level down, go up
            const moduleDir = path.dirname(fileURLToPath(import.meta.url));
            const dataDir = path.join(moduleDir, '..', 'data');
            const files = {
              'user-profiles.json': sender,
              'batch-persona.json': sender,
              'batch4-usage.json': sender,
              'batch4-auto.json': sender,
            };
            // Nested structures: batch3-deen (hifz), batch3-edu (games), batch5-money, batch6-health
            const nested = {
              'batch3-deen.json': ['hifz', 'dhikr', 'seerah'],
              'batch3-edu.json': ['spell', 'math'],
              'batch5-money.json': ['goals', 'budgets'],
              'batch6-health.json': ['water', 'meds', 'sleep', 'steps'],
            };
            const read = (f) => { try { return JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')); } catch { return null; } };
            const write = (f, d) => { try { fs.writeFileSync(path.join(dataDir, f), JSON.stringify(d, null, 2)); } catch {} };

            for (const [f, key] of Object.entries(files)) {
              const d = read(f);
              if (d && d[key]) { delete d[key]; write(f, d); }
            }
            for (const [f, sections] of Object.entries(nested)) {
              const d = read(f);
              if (!d) continue;
              let changed = false;
              for (const s of sections) {
                if (d[s] && d[s][sender]) { delete d[s][sender]; changed = true; }
              }
              if (changed) write(f, d);
            }
            // Clear in-memory AI history (all keys: base, :guide, :voice-guide, :translate)
            try {
              const aiMod = await import('./ai.js');
              if (aiMod.clearHistory) {
                aiMod.clearHistory(sender);
                aiMod.clearHistory(sender + ':guide');
                aiMod.clearHistory(sender + ':voice-guide');
                aiMod.clearHistory(sender + ':translate');
                aiMod.clearHistory(sender + ':tts');
              }
            } catch {}
            // Clear persistent conversation memory (Hudson 2026-10-13)
            try {
              const memMod = await import('./memory.js');
              if (memMod.clearUserMemory) memMod.clearUserMemory(sender);
            } catch {}
            // Clear proactive tracking
            try {
              const proMod = await import('./proactive.js');
              if (proMod.forgetUser) proMod.forgetUser(sender);
            } catch {}

            if (this._pendingConfirm) delete this._pendingConfirm[sender];
            console.log(`🗑️ [DeleteMyData] Wiped all data for ${sender}`);
            await this.sendMessage(from,
              `✅ *All your data has been deleted.*\n\nYou're starting fresh — like a brand new user. ` +
              `Send *hi* to begin again!`
            );
          } catch (e) {
            await this.sendMessage(from, `❌ Couldn't delete data: ${e.message}`);
          }
          return;
        }

        // --- 8. SMART REMINDERS ---
        case 'remind':
        case 'reminder': {          const [durationStr, ...reminderParts] = args;
          const reminderMsg = reminderParts.join(' ');
          const durationMs = durationStr ? parseDuration(durationStr) : null;

          if (!durationMs || !reminderMsg) {
            await this.sendMessage(
              from,
              `Let me know when and what to remind you about! For example:\n• *${prefix}remind 10m Call mom*\n• *${prefix}remind 1h Team sync*`
            );
            return;
          }

          const targetSender = sender;
          await this.sendMessage(from, `Got it! I will ping you here in *${durationStr}* about: "${reminderMsg}"`);

          const timerId = setTimeout(async () => {
            try {
              const pingText = `Hey @${targetSender.split('@')[0]}! Quick reminder: *${reminderMsg}* 😊`;
              await this.sendMessage(from, pingText, { mentions: [targetSender] });
            } catch (e) {
              console.error('Failed to dispatch reminder:', e);
            }
          }, durationMs);

          this.activeReminders.add(timerId);
          return;
        }

        // --- 9. PRODUCT CATALOG & FEEDBACK ---
        case 'catalog': {
          const catalogText =
            `Here are our current plans & services:\n\n` +
            `• *Starter AI ($19/mo)*: Auto-responder, FAQ rules, and 500 AI queries\n` +
            `• *Pro Suite ($49/mo)*: Unlimited Google Gemini AI, group tools, and support queue\n` +
            `• *Custom Setup ($199)*: Custom bot built specifically for your business\n\n` +
            `If you have questions or want to get started, type *${prefix}support <your question>* or drop us a message!`;
          await this.sendMessage(from, catalogText);
          return;
        }

        case 'feedback': {
          if (!query) {
            await this.sendMessage(from, `Got any feedback or suggestions? Type: *${prefix}feedback <your thoughts>*`);
            return;
          }
          Store.addLog({
            type: 'feedback',
            from,
            senderName,
            text: query
          });
          await this.sendMessage(from, `Thanks a lot, ${senderName}! Your feedback really helps and I've passed it along to the team.`);
          return;
        }

        // --- 10. 24-HOUR GROUP STATUS & WHATSAPP STORY ---
        // All status/story commands removed 2026-10-17 per Hudson

        default:
          break;
      } // end switch
  } // end handleMessage (truncated)

  // Minimal method stubs (file was truncated 2026-10-17, needs full restore)
  async sendMessage(to, text, options = {}) {
    if (!this.sock) return;
    try {
      return await this.sock.sendMessage(to, { text }, options);
    } catch (e) {
      console.error('[sendMessage] error:', e.message);
    }
  }

  async sendPresence(to, type = 'available') {
    if (!this.sock) return;
    try { await this.sock.sendPresenceUpdate(type, to); } catch (e) {}
  }

  getCleanMenu() { return 'Menu'; }
  getMobileFriendlyMenu() { return 'Menu'; }
  getCategoryCommands(cat) { return []; }
  async handleVoiceMessage() {}
  async sendMemeAudio() {}
  async sendSongAudio() {}
  async sendVideoFromUrl() {}
  async init() {}
}

export default Bot;
export { Bot };
