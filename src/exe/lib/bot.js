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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSION_DIR = path.join(__dirname, '..', 'session');

// Known bot commands (for prefix-less command detection — no ! needed)
const KNOWN_COMMANDS = new Set([
  'ai',
  'all',
  'allahname',
  'allahnames',
  'aqwal',
  'ask',
  'asmaulhusna',
  'audio',
  'addadmin',
  'admins',
  'ayah',
  'ayat',
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
  'remind',
  'reminder',
  'riddle',
  'roast',
  'roll',
  'rules',
  's',
  'setname',
  'setowner',
  'removeadmin',
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

class WhatsAppBot extends EventEmitter {
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
  // 15 merged categories instead of 28 overlapping ones. User sends the
  // number to see commands in that category.
  getCleanMenu() {
    const cats = [
      ['🎙️', 'Voice AI', 'Voice notes, text-to-speech, voice-to-text'],
      ['😂', 'Fun & Memes', 'Memes, roasts, jokes, games, soundboard'],
      ['🎵', 'Music', 'Songs, MP3 download'],
      ['📥', 'Downloaders', 'TikTok, Reels, YouTube, Facebook, Twitter'],
      ['🖼️', 'Photos & Stickers', 'HD photos, stickers, photo edit'],
      ['🕌', 'Islamic', 'Quran, Hadith, Namaz times, Duas'],
      ['💡', 'Daily Tools', 'Weather, news, cricket, calculator, QR'],
      ['🛡️', 'Groups', 'Tag all, polls, admin tools'],
      ['🤖', 'AI Tools', 'Chat, image gen, summarize, grammar'],
      ['💰', 'Money', 'Currency, gold rates, finance'],
      ['🏃', 'Health', 'BMI, health tips'],
      ['📚', 'Education', 'Dictionary, quizzes, learning'],
      ['⚙️', 'Automation', 'Auto-reply, scheduled messages'],
      ['💼', 'Business', 'Business tools'],
      ['🧰', 'More', 'Extra utilities'],
    ];
    let out = `🌟 *AwaxBot Menu*\n\n`;
    cats.forEach(([icon, title, desc], i) => {
      out += `${icon} *${i + 1}. ${title}*\n_${desc}_\n\n`;
    });
    out += `👉 _Kisi category ka number bhejein (masalan *3*)_`;
    // BRANDING (Awais AI — required by license, do not remove)
    out += `\n\n🤖 *Powered by Awais AI*`;
    return out;
  }

  // Maps clean menu number -> raw category nums in menu-data.js
  getCleanCategoryMap() {
    return {
      1: [1], 2: [2, 11, 27], 3: [3], 4: [4, 12], 5: [5],
      6: [6, 14, 23], 7: [7, 13, 21], 8: [8, 16, 24],
      9: [9, 10, 22], 10: [19], 11: [20], 12: [15],
      13: [17], 14: [18, 26], 15: [25, 28],
    };
  }

  async getCategoryCommands(n) {
    const map = this.getCleanCategoryMap();
    const rawNums = map[n];
    if (!rawNums) return null;
    const { MENU_CATEGORIES } = await import('./menu-data.js');
    let out = '';
    const seen = new Set();
    for (const rn of rawNums) {
      const cat = MENU_CATEGORIES.find(c => c.num === rn);
      if (!cat) continue;
      if (rawNums.length > 1) out += `\n*${cat.icon} ${cat.title}*\n`;
      for (const c of cat.cmds) {
        if (!c || !c.primary || seen.has(c.name)) continue;
        seen.add(c.name);
        out += `• *${c.name}*${c.desc ? ` — ${c.desc}` : ''}\n`;
      }
    }
    const titles = { 1: 'Voice AI', 2: 'Fun & Memes', 3: 'Music', 4: 'Downloaders', 5: 'Photos & Stickers', 6: 'Islamic', 7: 'Daily Tools', 8: 'Groups', 9: 'AI Tools', 10: 'Money', 11: 'Health', 12: 'Education', 13: 'Automation', 14: 'Business', 15: 'More' };
    return `*${titles[n]}*\n${out}\n👉 _Wapas jane ke liye *menu* likhein_`;
  }

  getMobileFriendlyMenu(prefix = '!') {
    return (
      `🌟 *AwaxBot — Smart WhatsApp Assistant*\n\n` +
      `_Aapko koi symbol lagane ki zaroorat nahi — bas aam alfaz mein likhein!_\n\n` +

      `🎙️ *1. Voice AI & Bolne Wala Bot (Deepgram)*\n` +
      `• *Voice Note Bhejein* ➔ Bot aapki aawaz sun kar voice note mein hi bol kar jawab dega!\n` +
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
          console.log('🤖 AwaxBot by Awais AI — facebook.com/awaisautomates'); // BRANDING (required by license, do not remove)

          // Auto-set owner: whoever links the WhatsApp becomes the owner (2026-10-17 per Hudson)
          try {
            const { getOwnerConfig, setOwner, normalizeNumber } = await import('./access.js');
            const cfg = getOwnerConfig();
            if (!cfg.owner && this.user?.id) {
              const linkedNum = normalizeNumber(this.user.id);
              if (linkedNum) {
                setOwner(linkedNum);
                console.log(`👑 Auto-set owner to linked number: ${linkedNum}`);
              }
            }
          } catch (e) {
            console.error('[owner-autoset] error:', e.message);
          }
          this.emit('status', { status: this.status, user: this.user });
        }
      });

      // Handle Incoming Messages
      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
          if (!msg.message) continue;
          // Allow owner's self-messages (fromMe) but skip bot's own responses to avoid loops
          // Bot responses contain "Powered by Awais AI" footer (2026-10-17 per Hudson)
          if (msg.key.fromMe) {
            const msgText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
            if (msgText.includes('Powered by Awais AI')) continue; // Bot's own response, skip
            // Otherwise it's the owner's command from the bot's number, process it
          }

          const from = msg.key.remoteJid;
          if (from === 'status@broadcast') continue;

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

    // 1. Transcribe voice via Deepgram Nova-2
    let transcriptData = null;
    try {
      transcriptData = await transcribeAudio(audioBuffer, mimeType);
    } catch (err) {
      console.error('Deepgram transcription error:', err.message);
      await this.sendMessage(from, `🎙️ _Aapki voice note aayi, lekin transcription mein masla hua: ${err.message}_`);
      return;
    }

    const transcript = transcriptData?.transcript?.trim();
    if (!transcript) {
      await this.sendMessage(from, `🎙️ _Aapki voice note bohot dheemi ya khamosh thi, baraye meherbani thora saaf bol kar dobara bhejein!_`);
      return;
    }

    console.log(`🎙️ [Voice Transcribed]: "${transcript}" (Lang: ${transcriptData.detectedLanguage})`);

    // 2. Think & formulate response via Gemini AI
    this.stats.aiQueries++;
    const config = Store.getConfig();
    const systemPrompt = config.ai?.systemPrompt ||
      "You are AwaxBot, a warm, helpful, natural AI voice companion on WhatsApp. Speak like a close friend in natural Roman Urdu or English. Keep your spoken reply concise (2-3 sentences), engaging, and friendly.";

    let aiReply = '';
    try {
      aiReply = await askAI(transcript, {
        senderId: sender,
        systemPrompt,
        model: config.ai?.model || 'gemini-1.5-flash',
        senderName
      });
    } catch (aiErr) {
      aiReply = `Ji dost, main ne aapki voice sun li: "${transcript}". Main haazir hoon!`;
    }

    // 3. Convert AI Response into Speech Voice Note via Deepgram Aura TTS
    await this.sendPresence(from, 'recording');
    try {
      const speechBuffer = await textToSpeech(aiReply, 'aura-asteria-en');
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
      await this.sendMessage(from, `🎙️ *Aap ne farmaya:* "${transcript}"\n\n🤖 *AwaxBot Jawab:*\n${aiReply}`);
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
    let list = `🔊 *AwaxBot Funny Meme Soundboard (${MEME_SOUNDS.length} Sounds)* 🔊\n\n`;
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

    // ─── Access Control (2026-10-17 per Hudson) ───
    // OWNER: full access | ADMIN: use only | Others: bot is private (silent)
    const { isOwner, isAdmin } = await import('./access.js');
    const senderIsOwner = isOwner(sender);
    const senderIsAdmin = isAdmin(sender);

    // Bot is private: non-owner/non-admin get silence
    // Per Hudson: only owner and admin can use the bot
    if (!senderIsOwner && !senderIsAdmin) {
      return; // Fully private — no response
    }

    // Strict Group Whitelist Enforcement:
    // If the message is from a WhatsApp group, the bot ONLY works in groups explicitly enabled
    // EXCEPT: owner/admin can use the bot in any group (2026-10-17 per Hudson)
    if (isGroup) {
      if (!senderIsOwner && !senderIsAdmin && !Store.isGroupAllowed(from)) {
        return; // 100% strict silence in unselected groups (for non-owner/admin)
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
    let cmdText = null;
    if (prefix && trimmed.startsWith(prefix)) {
      cmdText = trimmed.slice(prefix.length).trim();
    } else {
      const firstWord = trimmed.split(/\s+/)[0].toLowerCase().replace(/^!+/, '');
      if (KNOWN_COMMANDS.has(firstWord) || /^\d{1,2}$/.test(firstWord)) {
        cmdText = trimmed.replace(/^!+/, '');
      }
    }
    if (cmdText) {
      this.stats.commandsProcessed++;
      const [cmd, ...args] = cmdText.split(/\s+/);
      const command = cmd.toLowerCase();
      const query = args.join(' ');

      // HOSTING PATCH (Muse, 2026-10-12): dispatch the 134 new-feature commands
      // (batches 1-6) before the built-in switch. Runs in the same try/catch
      // style as other handlers — never throws out of handleMessage.
      if (NEW_COMMANDS.has(command)) {
        try {
          await handleNewFeature(
            { bot: this, msg, from, sender, senderName, isGroup, prefix },
            command,
            query
          );
        } catch (err) {
          console.error('[newfeatures] dispatch error:', command, err.message);
          await this.sendMessage(from, `❌ Kuch garbar ho gayi, dobara try karein.`);
        }
        return;
      }

      // Direct number command shorthand: e.g. !1 to !48 -> play meme sound
      // (numbers 1-15 open a menu category instead for 10 min after `menu`
      // is shown — the switch below handles that drill-down; see lastMenuRequest)
      if (/^\d{1,2}$/.test(command)) {
        const num = parseInt(command, 10);
        const menuShownAt = this.lastMenuRequest?.get(from) || 0;
        const inMenuWindow = num >= 1 && num <= 15 && (Date.now() - menuShownAt) < 10 * 60 * 1000;
        if (!inMenuWindow && num >= 1 && num <= MEME_SOUNDS.length) {
          const soundItem = MEME_SOUNDS[num - 1];
          try {
            await this.sendMemeAudio(from, soundItem, msg);
          } catch (err) {
            await this.sendMessage(from, `❌ Meme audio load nahi ho saki: ${err.message}`);
          }
          return;
        }
      }

      // ─── Owner-only commands (2026-10-17 per Hudson) ───
      // Admins can USE the bot but cannot access owner commands
      const OWNER_ONLY = ['setowner', 'addadmin', 'removeadmin', 'admins', 'broadcast', 'bcast', 'restart', 'shutdown', 'eval', 'exec'];
      if (OWNER_ONLY.includes(command) && !senderIsOwner) {
        await this.sendMessage(from, '⛔ Owner only command.');
        return;
      }

      // ─── Owner/Admin management commands ───
      if (command === 'setowner' || command === 'addadmin' || command === 'removeadmin' || command === 'admins') {
        const { setOwner, addAdmin, removeAdmin, getOwnerConfig, normalizeNumber } = await import('./access.js');
        if (command === 'setowner') {
          const num = normalizeNumber(query || args[0]);
          if (!num) { await this.sendMessage(from, 'Usage: `setowner <number>`'); return; }
          // Allow first-time setup without owner check, otherwise owner only
          const cfg = getOwnerConfig();
          if (cfg.owner && !senderIsOwner) { await this.sendMessage(from, '⛔ Owner only.'); return; }
          setOwner(num);
          await this.sendMessage(from, `✅ Owner set to ${num}`);
          return;
        }
        if (command === 'addadmin') {
          const num = normalizeNumber(query || args[0]);
          if (!num) { await this.sendMessage(from, 'Usage: `addadmin <number>`'); return; }
          addAdmin(num);
          await this.sendMessage(from, `✅ Admin added: ${num}`);
          return;
        }
        if (command === 'removeadmin') {
          const num = normalizeNumber(query || args[0]);
          if (!num) { await this.sendMessage(from, 'Usage: `removeadmin <number>`'); return; }
          removeAdmin(num);
          await this.sendMessage(from, `✅ Admin removed: ${num}`);
          return;
        }
        if (command === 'admins') {
          const cfg = getOwnerConfig();
          await this.sendMessage(from, `👑 *Owner:* ${cfg.owner || 'Not set'}\n\n👥 *Admins:*${cfg.admins.length ? '\n' + cfg.admins.join('\n') : '\nNone'}`);
          return;
        }
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
          await this.sendMessage(from, this.getCleanMenu());
          if (!this.lastMenuRequest) this.lastMenuRequest = new Map();
          this.lastMenuRequest.set(from, Date.now()); // numbers 1-15 drill into categories for 10 min
          return;
        }

        // Clean menu category drill-down (1-15)
        case '1': case '2': case '3': case '4': case '5':
        case '6': case '7': case '8': case '9': case '10':
        case '11': case '12': case '13': case '14': case '15': {
          const detail = await this.getCategoryCommands(parseInt(command, 10));
          if (detail) {
            await this.sendMessage(from, detail);
          } else {
            await this.sendMessage(from, this.getCleanMenu());
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
            const speechBuffer = await textToSpeech(query, 'aura-asteria-en');
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
            await this.sock.sendMessage(from, {
              image: { url: meme.url },
              caption: `🤣 *${meme.title}*\n📱 _Source: r/${meme.subreddit}_`
            }, { quoted: msg });
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
            const imgData = await searchImage(query);
            await this.sock.sendMessage(from, {
              image: { url: imgData.imageUrl },
              caption: `🖼️ *${imgData.title}*`
            }, { quoted: msg });
          } catch (err) {
            await this.sendMessage(from, `❌ Image search nahi ho saki: ${err.message}`);
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
        case 's':
        case 'sticker':
        case 'stiker': {
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

        // --- 2.6 FUNNY MEME SOUNDBOARD & CLIPPER ---
        case 'soundboard':
        case 'memes':
        case 'sounds': {
          if (!this.lastSoundboardRequest) this.lastSoundboardRequest = new Map();
          this.lastSoundboardRequest.set(from, Date.now());

          let list = `🔊 *AwaxBot Funny Meme Soundboard (41 Sounds)* 🔊\n\n`;
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
              list += `*${num}.* ${m.title} ➔ *${prefix}meme ${num}* ya *${prefix}meme ${m.keywords[0]}*\n`;
            });
            list += `\n`;
          }

          list += `💡 *Sunne Ka Tareeqa:*\n` +
                  `• *Number se:* *${prefix}meme 1*, *${prefix}meme 7*, ya direct *1*, *7*\n` +
                  `• *Naam se:* *${prefix}meme moye*, *${prefix}meme maro*, ya direct *moye moye*, *maro mujhe*\n` +
                  `• *Random:* *${prefix}meme* (random funny sound ke liye)`;
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

        // --- 8. SMART REMINDERS ---
        // Per-group automation management (2026-10-17 per Hudson)
        // Each group has its own automations. All editable.
        // automation command removed 2026-10-17 per Hudson (dashboard only)

        case 'remind':
        case 'reminder': {
          const [durationStr, ...reminderParts] = args;
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
        // Status commands removed 2026-10-17 per Hudson

        // Status commands removed 2026-10-17 per Hudson

        case 'groupaudit':
        case 'groupmembers': {
          if (!isGroup) {
            await this.sendMessage(from, 'This command only works inside groups.');
            return;
          }
          try {
            const meta = await this.sock.groupMetadata(from);
            const totalMembers = meta.participants.length;
            const admins = meta.participants.filter(p => p.admin);
            const isMuted = !!meta.announce;
            await this.sendMessage(
              from,
              `👥 *Group Members & Security*\n\n` +
              `• Group: *${meta.subject}*\n` +
              `• Total Members: ${totalMembers}\n` +
              `• Admins: ${admins.length}\n` +
              `• Chat Mode: ${isMuted ? 'Muted (Admins only)' : 'Open to everyone'}`
            );
          } catch (err) {
            await this.sendMessage(from, `Couldn't fetch group info: ${err.message}`);
          }
          return;
        }

        // --- 11. SUPPORT TICKETS ---
        case 'support':
        case 'ticket': {
          if (!config.features?.supportTickets) {
            await this.sendMessage(from, "Support ticketing is currently off.");
            return;
          }
          if (!query) {
            await this.sendMessage(from, `What can we help you with? For example: ${prefix}support Need assistance with billing`);
            return;
          }
          const ticket = Store.addTicket({
            customer: senderName,
            phone: sender.split('@')[0],
            issue: query
          });
          const reply =
            `Got your message, ${senderName}! I've logged it under ticket #${ticket.id}. Someone will review it and get back to you soon.`;
          await this.sendMessage(from, reply);
          return;
        }

        // --- 12. QUICK INFO ---
        case 'price':
        case 'pricing': {
          const autoReplies = Store.getAutoReplies();
          const pReply = autoReplies.find(r => r.trigger.includes('price'));
          await this.sendMessage(from, pReply ? pReply.reply : '🏷️ Starter: $19/mo | Pro: $49/mo | Enterprise: Custom');
          return;
        }

        case 'hours': {
          const autoReplies = Store.getAutoReplies();
          const hReply = autoReplies.find(r => r.trigger.includes('hour'));
          await this.sendMessage(from, hReply ? hReply.reply : '🕒 Monday to Friday: 9 AM - 6 PM');
          return;
        }

        case 'location': {
          const autoReplies = Store.getAutoReplies();
          const lReply = autoReplies.find(r => r.trigger.includes('location'));
          await this.sendMessage(from, lReply ? lReply.reply : '📍 Visit our dashboard for office details.');
          return;
        }

        case 'contact': {
          const autoReplies = Store.getAutoReplies();
          const cReply = autoReplies.find(r => r.trigger.includes('contact'));
          await this.sendMessage(from, cReply ? cReply.reply : '📞 Email: support@example.com');
          return;
        }

        // --- 13. FUN & GAMES ---
        case 'quote':
        case 'aqwal': {
          await this.sendMessage(from, getRandomQuote());
          return;
        }


        case 'shairi':
        case 'shayari':
        case 'poetry': {
          await this.sendMessage(from, getRandomShairi());
          return;
        }

        case 'fact':
        case 'maloomat': {
          await this.sendMessage(from, getRandomFact());
          return;
        }

        case 'riddle':
        case 'paheli':
        case 'puzzle': {
          const sub = query.toLowerCase().trim();

          // Check if asking for answer
          if (sub === 'answer' || sub === 'jawab' || sub.startsWith('ans') || sub.startsWith('jawab ')) {
            const specificId = sub.replace(/^(answer|jawab|ans)\s*/, '').trim();
            const r = specificId && /^\d+$/.test(specificId) ? getRiddleById(specificId) : getLastRiddle();
            const reply =
              `💡 *Paheli #${r.id} Ka Jawab:* 🎯\n\n` +
              `👉 *${r.answer}*\n\n` +
              `_Agli paheli poochne ke liye likhein: *${prefix}paheli*_`;
            await this.sendMessage(from, reply);
            return;
          }

          let r = null;
          if (query && /^\d+$/.test(query.trim())) {
            r = getRiddleById(query.trim());
          } else {
            r = getRandomRiddle();
          }

          const msg =
            `🧩 *Aaj Ki Mazedaar Paheli (Riddle #${r.id})* 🧩\n\n` +
            `"${r.question}"\n\n` +
            `_${r.english}_\n\n` +
            `💡 *Hint:* ${r.hint}\n\n` +
            `🤔 *Apna jawab soch kar bataiye! Jawab janne ke liye likhein:* *${prefix}paheli jawab*`;
          await this.sendMessage(from, msg);
          return;
        }

        case 'flip':
        case 'coin': {
          const result = Math.random() < 0.5 ? '🪙 HEADS' : '🪙 TAILS';
          await this.sendMessage(from, `*Coin Flip:* ${result}!`);
          return;
        }

        case 'roll':
        case 'dice': {
          const dice = Math.floor(Math.random() * 6) + 1;
          const emojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
          await this.sendMessage(from, `🎲 You rolled a *${dice}* ${emojis[dice - 1]}`);
          return;
        }

        case 'time': {
          const now = new Date();
          const utc = now.toUTCString();
          const local = now.toLocaleString();
          await this.sendMessage(from, `🕒 *Current Time:*\n\n🌍 *Local:* ${local}\n🌐 *UTC:* ${utc}`);
          return;
        }

        // --- 14. GROUP ADMINISTRATION ---
        case 'tagall':
        case 'everyone': {
          if (!isGroup) {
            await this.sendMessage(from, 'This command only works inside a group!');
            return;
          }
          try {
            const groupMetadata = await this.sock.groupMetadata(from);
            const participants = groupMetadata.participants.map(p => p.id);
            const customMsg = query || 'Quick heads-up everyone:';
            let tagText = `Hey everyone! ${customMsg}\n\n`;
            participants.forEach(p => {
              tagText += `@${p.split('@')[0]} `;
            });
            await this.sendMessage(from, tagText, { mentions: participants });
          } catch (err) {
            await this.sendMessage(from, `Couldn't mention everyone right now: ${err.message}`);
          }
          return;
        }

        case 'hidetag': {
          if (!isGroup) {
            await this.sendMessage(from, 'This command only works inside a group!');
            return;
          }
          try {
            const groupMetadata = await this.sock.groupMetadata(from);
            const participants = groupMetadata.participants.map(p => p.id);
            const textMsg = query || 'Heads up everyone!';
            await this.sendMessage(from, textMsg, { mentions: participants });
          } catch (err) {
            await this.sendMessage(from, `Couldn't send mention: ${err.message}`);
          }
          return;
        }

        case 'groupinfo': {
          if (!isGroup) {
            await this.sendMessage(from, 'This command only works inside a group!');
            return;
          }
          try {
            const meta = await this.sock.groupMetadata(from);
            const reply =
              `Here are the group details for *${meta.subject}*:\n\n` +
              `• Members: ${meta.participants.length}\n` +
              `• Description: ${meta.desc ? meta.desc.toString() : 'None set'}`;
            await this.sendMessage(from, reply);
          } catch (err) {
            await this.sendMessage(from, `Couldn't get group info right now: ${err.message}`);
          }
          return;
        }

        case 'promote': {
          if (!isGroup) {
            await this.sendMessage(from, 'This command only works inside a group!');
            return;
          }
          const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
          if (!target) {
            await this.sendMessage(from, `Tag the person you want to promote, like: *${prefix}promote @user*`);
            return;
          }
          try {
            await this.sock.groupParticipantsUpdate(from, [target], 'promote');
            await this.sendMessage(from, `Promoted @${target.split('@')[0]} to group admin!`, { mentions: [target] });
          } catch (err) {
            await this.sendMessage(from, `Couldn't promote that user. Make sure I have admin permissions in this group!`);
          }
          return;
        }

        case 'demote': {
          if (!isGroup) {
            await this.sendMessage(from, 'This command only works inside a group!');
            return;
          }
          const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
          if (!target) {
            await this.sendMessage(from, `Tag the person you want to demote, like: *${prefix}demote @user*`);
            return;
          }
          try {
            await this.sock.groupParticipantsUpdate(from, [target], 'demote');
            await this.sendMessage(from, `Changed @${target.split('@')[0]} back to regular member.`, { mentions: [target] });
          } catch (err) {
            await this.sendMessage(from, `Couldn't demote that user. Make sure I have admin permissions!`);
          }
          return;
        }

        case 'mute':
        case 'close': {
          if (!isGroup) {
            await this.sendMessage(from, 'This command only works inside a group!');
            return;
          }
          try {
            await this.sock.groupSettingUpdate(from, 'announcement');
            await this.sendMessage(from, '🔒 Chat is now muted — only admins can send messages.');
          } catch (err) {
            await this.sendMessage(from, `Couldn't mute group. Make sure I am set as an admin!`);
          }
          return;
        }

        case 'unmute':
        case 'open': {
          if (!isGroup) {
            await this.sendMessage(from, 'This command only works inside a group!');
            return;
          }
          try {
            await this.sock.groupSettingUpdate(from, 'not_announcement');
            await this.sendMessage(from, '🔓 Chat is open — everyone can send messages now.');
          } catch (err) {
            await this.sendMessage(from, `Couldn't unmute group. Make sure I am set as an admin!`);
          }
          return;
        }

        case 'setname': {
          if (!isGroup) {
            await this.sendMessage(from, 'This command only works inside a group!');
            return;
          }
          if (!query) {
            await this.sendMessage(from, `What would you like the new group name to be? Like: *${prefix}setname Our Team*`);
            return;
          }
          try {
            await this.sock.groupUpdateSubject(from, query);
            await this.sendMessage(from, `Updated the group name to: *${query}*`);
          } catch (err) {
            await this.sendMessage(from, `Couldn't update group name. Make sure I have admin permissions!`);
          }
          return;
        }

        case 'warn': {
          if (!isGroup) {
            await this.sendMessage(from, 'This command only works inside a group!');
            return;
          }
          const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
          if (!mentionedJid) {
            await this.sendMessage(from, `Tag the user you want to warn: *${prefix}warn @user*`);
            return;
          }
          const current = (this.warnings.get(mentionedJid) || 0) + 1;
          this.warnings.set(mentionedJid, current);
          let reply = `Hey @${mentionedJid.split('@')[0]}, just a friendly warning (${current}/3). Please check the group guidelines.`;
          if (current >= 3) {
            reply += `\n⚠️ That is your 3rd warning. Admins may remove you from the group.`;
          }
          await this.sendMessage(from, reply, { mentions: [mentionedJid] });
          return;
        }

        case 'kick': {
          if (!isGroup) {
            await this.sendMessage(from, 'This command only works inside a group!');
            return;
          }
          const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
          if (!mentionedJid) {
            await this.sendMessage(from, `Tag the user to remove: *${prefix}kick @user*`);
            return;
          }
          try {
            await this.sock.groupParticipantsUpdate(from, [mentionedJid], 'remove');
            await this.sendMessage(from, `Removed @${mentionedJid.split('@')[0]} from the group.`, { mentions: [mentionedJid] });
          } catch (err) {
            await this.sendMessage(from, "Couldn't remove that member. Make sure I have admin permissions!");
          }
          return;
        }

        // --- 15. SYSTEM HEALTH ---
        case 'ping': {
          const uptimeSec = Math.floor((Date.now() - this.stats.startTime) / 1000);
          const hours = Math.floor(uptimeSec / 3600);
          const minutes = Math.floor((uptimeSec % 3600) / 60);
          await this.sendMessage(
            from,
            `Hey! I'm online and running smooth (active for ${hours > 0 ? hours + 'h ' : ''}${minutes}m). Latency is great.`
          );
          return;
        }

        case 'uptime':
        case 'diagnostics': {
          const uptimeSec = Math.floor((Date.now() - this.stats.startTime) / 1000);
          const reply =
            `Here is a quick look at my system stats:\n\n` +
            `• Status: Online & active\n` +
            `• Messages: ${this.stats.messagesReceived} received, ${this.stats.messagesSent} sent\n` +
            `• Active Uptime: ${Math.floor(uptimeSec / 60)} minutes`;
          await this.sendMessage(from, reply);
          return;
        }

        case 'rules': {
          const rulesText =
            `Here are the simple community guidelines to keep in mind:\n\n` +
            `1. Be polite and respectful to everyone\n` +
            `2. No spamming, flood messages, or random promo links\n` +
            `3. Keep conversations relevant to the group\n\n` +
            `Enjoy your time here!`;
          await this.sendMessage(from, rulesText);
          return;
        }

        case 'owner':
        case 'developer':
        case 'about': {
          // BRANDING (Awais AI — required by license, do not remove)
          await this.sendMessage(from,
            `🤖 *AwaxBot by Awais AI*\n\n` +
            `Your personal WhatsApp AI assistant with 170+ commands.\n\n` +
            `👤 Creator: Awais AI\n` +
            `📘 Facebook: facebook.com/awaisautomates\n` +
            `📢 WhatsApp Channel: whatsapp.com/channel/0029Vb5aiit1NCrdTWQDXP3g\n\n` +
            `🤖 *Powered by Awais AI*`
          );
          return;
        }

        default:
          await this.sendMessage(from, `I didn't recognize that command. Type ${prefix}menu to see what I can do!`);
          return;
      }
    }

    // Auto-detect all video links in message (TikTok, Reels, YouTube, Facebook, Twitter, Pinterest, etc.)
    const videoMatch = trimmed.match(/https?:\/\/(?:www\.|vm\.|vt\.|m\.)?(?:tiktok\.com|instagram\.com|youtube\.com|youtu\.be|facebook\.com|fb\.watch|twitter\.com|x\.com|pinterest\.com|pin\.it|capcut\.com|threads\.net|snapchat\.com|likee\.video|kwai\.com|dailymotion\.com|vimeo\.com|[^\s]+\.(mp4|mov|webm|mkv))\/?[^\s]*/i);
    if (videoMatch) {
      try {
        try {
          await this.sock.sendMessage(from, { react: { text: '⚡', key: msg.key } });
        } catch (e) {}
        await this.sendPresence(from, 'recording');
        const noticePromise = this.sendMessage(from, `⚡ *Video link detected!* Fast MP4 download ho raha hai... 🎬`).catch(() => {});
        const videoDataPromise = downloadVideo(videoMatch[0]);
        const [_, videoData] = await Promise.all([noticePromise, videoDataPromise]);
        await this.sendVideoFromUrl(from, videoData, msg.key);
        return;
      } catch (err) {
        console.warn('Auto video download error:', err.message);
      }
    }

    // Check Auto-Responder Rules
    if (config.features?.autoResponder) {
      const lower = trimmed.toLowerCase();
      const autoReplies = Store.getAutoReplies();
      for (const rule of autoReplies) {
        if (!rule.enabled) continue;
        let match = false;
        if (rule.matchType === 'exact' && lower === rule.trigger) match = true;
        else if (rule.matchType === 'contains' && lower.includes(rule.trigger)) match = true;
        else if (rule.matchType === 'regex') {
          try {
            const rx = new RegExp(rule.trigger, 'i');
            if (rx.test(lower)) match = true;
          } catch (e) {}
        }

        if (match) {
          await this.sendMessage(from, rule.reply);
          return;
        }
      }
    }

    // Natural Language & AI Intent Engine (Easy for ordinary people without typing !)
    const handledNatural = await this.handleNaturalLanguage({
      msg,
      from,
      sender,
      senderName,
      isGroup,
      text: trimmed,
      config,
      prefix
    });
    if (handledNatural) return;
  }

  /**
   * Natural Language & AI Intent Engine
   * Understands what ordinary users want automatically without strict command syntax
   */
  async handleNaturalLanguage({ msg, from, sender, senderName, isGroup, text, config, prefix }) {
    const lower = text.toLowerCase().trim();

    // 1. Menu & Help triggers ("menu", "help", "start", "bot", "commands", "madad")
    if (/^(menu|help|start|bot|commands|madad)$/i.test(lower)) {
      await this.sendMessage(from, this.getMobileFriendlyMenu(prefix));
      return true;
    }

    // 1.1 Songs & Music Natural Intent ("song tum hi ho", "gana sunao", "tajdar e haram naat", "music arijit")
    const songMatch = lower.match(/^(?:song|gana|music|mp3)\s+(.+)$/i) || 
                      lower.match(/^(.+)\s+(?:song|gana|naat)$/i) ||
                      lower.match(/^(?:koi song|gana sunao|song sunao|music sunao)\s*(.*)$/i);
    if (songMatch) {
      const songQuery = (songMatch[1] || songMatch[2] || '').trim();
      if (songQuery && !/^(sunao|lagao|chalao|koi)$/i.test(songQuery)) {
        try {
          try { await this.sock.sendMessage(from, { react: { text: '🎵', key: msg.key } }); } catch (e) {}
          await this.sendPresence(from, 'recording');
          const song = await searchAndDownloadSong(songQuery);
          await this.sendMessage(from, `🎶 *Playing:* ${song.title}\n🎙️ *Artist:* ${song.author}\n⏳ Audio load ho rahi hai...`);

          await this.sendSongAudio(from, song, msg);
          return true;
        } catch (err) {
          await this.sendMessage(from, `❌ Song nahi mil saka: ${err.message}`);
          return true;
        }
      } else {
        await this.sendMessage(from, "🎵 *Music Player*\n\nKaunsa song sunna chahte hain? Bas likhein: *song tum hi ho* ya *song tajdar e haram*");
        return true;
      }
    }

    // 1.2 Image / Photo Natural Intent ("photo lahore", "cute cat pic", "lahore ki photo", "nature wallpaper")
    const imgMatch = lower.match(/^(?:photo|image|pic|img|wallpaper)\s+(.+)$/i) ||
                     lower.match(/^(.+)\s+ki\s+(?:photo|pic|image|tasveer)$/i) ||
                     lower.match(/^(.+)\s+ka\s+(?:wallpaper|photo)$/i);
    if (imgMatch) {
      const imgQuery = (imgMatch[1] || imgMatch[2] || '').trim();
      if (imgQuery && !/^(bhejo|dekhao|send)$/i.test(imgQuery)) {
        try {
          try { await this.sock.sendMessage(from, { react: { text: '🖼️', key: msg.key } }); } catch (e) {}
          await this.sendPresence(from, 'composing');
          const imgData = await searchImage(imgQuery);
          await this.sock.sendMessage(from, {
            image: { url: imgData.imageUrl },
            caption: `🖼️ *${imgData.title}*`
          }, { quoted: msg });
          return true;
        } catch (err) {
          await this.sendMessage(from, `❌ Image nahi mil saki: ${err.message}`);
          return true;
        }
      }
    }

    // 1.3 Meme Natural Intent ("meme", "memes", "koi meme bhejo", "funny meme")
    if (/^(?:meme|memes|koi meme|meme bhejo|send meme|funny meme)$/i.test(lower)) {
      try {
        try { await this.sock.sendMessage(from, { react: { text: '😂', key: msg.key } }); } catch (e) {}
        const meme = await getViralMeme();
        await this.sock.sendMessage(from, {
          image: { url: meme.url },
          caption: `🤣 *${meme.title}*\n📱 _Source: r/${meme.subreddit}_`
        }, { quoted: msg });
        return true;
      } catch (e) {}
    }

    // 1.4 Roast Natural Intent ("roast", "roast me", "roast <name>")
    const roastMatch = lower.match(/^roast\s*(.*)$/i);
    if (roastMatch) {
      const target = roastMatch[1].trim();
      try { await this.sock.sendMessage(from, { react: { text: '🔥', key: msg.key } }); } catch (e) {}
      await this.sendMessage(from, await getMemeRoast(target, sender));
      return true;
    }

    // 1.5 Joke / Chutkula Natural Intent ("latifa", "chutkula", "koi joke sunao", "joke")
    if (/^(?:joke|latifa|chutkula|koi joke|koi latifa|latifa sunao|joke sunao)$/i.test(lower)) {
      try { await this.sock.sendMessage(from, { react: { text: '🤣', key: msg.key } }); } catch (e) {}
      await this.sendMessage(from, await getMemeJoke(sender));
      return true;
    }

    // 1.6 Voice / Speak Natural Intent ("bol <text>", "voice <text>", "speak <text>")
    const voiceMatch = lower.match(/^(?:bol|speak|voice)\s+(.+)$/i);
    if (voiceMatch) {
      const voiceText = voiceMatch[1].trim();
      if (voiceText) {
        try {
          try { await this.sock.sendMessage(from, { react: { text: '🗣️', key: msg.key } }); } catch (e) {}
          await this.sendPresence(from, 'recording');
          const speechBuffer = await textToSpeech(voiceText, 'aura-asteria-en');
          await this.sock.sendMessage(from, {
            audio: speechBuffer,
            mimetype: 'audio/mpeg',
            fileName: 'voice.mp3',
            ptt: false
          }, { quoted: msg });
          return true;
        } catch (e) {
          console.warn('Voice natural error:', e.message);
        }
      }
    }

    // 2. Friendly Salam & Greetings ("salam", "assalam", "aoa", "hello", "hi")
    if (/^(salam|assalam|asalam|aoa|aslamoalikum|assalam-o-alaikum)\b/i.test(lower) || (/^(hi|hello|hey)$/i.test(lower) && !isGroup)) {
      const greeting =
        `Walaikum Assalam ${senderName || 'bhai'}! 😊\n\n` +
        `Main *AwaxBot* hoon — aapka smart aur friendly WhatsApp assistant!\n\n` +
        `Aap mujhse aam doston ki tarah baat kar sakte hain ya:\n` +
        `• Video download karne ke liye *link* send karein\n` +
        `• Photo ka sticker banane ke liye photo ke sath *s* likhein\n` +
        `• Video se audio nikaalne ke liye *audio* likhein\n` +
        `• Funny meme voice note ke liye *meme* likhein\n` +
        `• Quran tilawat ke liye: *tilawat rahman*\n` +
        `• Namaz auqat: *namaz karachi*\n\n` +
        `Tamam asaan cheezein dekhne ke liye *menu* likhein! ✨`;
      await this.sendMessage(from, greeting);
      return true;
    }

    // 2.2 Photo to Sticker Natural Intent ("sticker", "s", "stiker")
    if (/^(sticker|s|stiker|sticker banao|make sticker)$/i.test(lower)) {
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

      if (mediaMessage) {
        try {
          try { await this.sock.sendMessage(from, { react: { text: '🎨', key: msg.key } }); } catch (e) {}
          const imgBuffer = await downloadMediaMessage(mediaMessage, 'buffer', {});
          const stickerBuf = await imageToSticker(imgBuffer);
          await this.sock.sendMessage(from, { sticker: stickerBuf }, { quoted: msg });
          return true;
        } catch (err) {
          console.error('Sticker conversion error:', err);
        }
      }
    }

    // 2.3 Video to Audio Natural Intent ("audio", "v2a", "mp3")
    if (/^(audio|v2a|mp3|tomp3|audio nikaalo)$/i.test(lower)) {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      let videoMsg = null;
      if (quoted?.videoMessage) {
        videoMsg = {
          key: {
            remoteJid: from,
            id: msg.message.extendedTextMessage.contextInfo.stanzaId,
            participant: msg.message.extendedTextMessage.contextInfo.participant
          },
          message: { videoMessage: quoted.videoMessage }
        };
      } else if (msg.message?.videoMessage) {
        videoMsg = msg;
      }

      if (videoMsg) {
        try {
          try { await this.sock.sendMessage(from, { react: { text: '🎵', key: msg.key } }); } catch (e) {}
          await this.sendPresence(from, 'recording');
          const vBuf = await downloadMediaMessage(videoMsg, 'buffer', {});
          await this.sock.sendMessage(from, {
            audio: vBuf,
            mimetype: 'audio/mp4',
            ptt: false
          }, { quoted: msg });
          return true;
        } catch (err) {
          console.error('Video to audio error:', err);
        }
      }
    }

    // 2.4 Funny Meme Soundboard Natural Intent ("soundboard", "meme", "sound", numbers 1-41, etc.)
    // Hudson's fix (2026-10-12): also accept the "sound board" spelling.
    if (/^(soundboard|sound board|meme sounds|funny sounds|sound list)$/i.test(lower)) {
      if (!this.lastSoundboardRequest) this.lastSoundboardRequest = new Map();
      this.lastSoundboardRequest.set(from, Date.now());

      let list = `🔊 *AwaxBot Funny Meme Soundboard (41 Sounds)* 🔊\n\n`;
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
          list += `*${num}.* ${m.title} — *${m.keywords[0]}*\n`;
        });
        list += `\n`;
      }

      list += `💡 *Sunne Ka Tareeqa:*\n` +
              `• *Number likhein:* *1*, *7*, *12*, ya *meme 1*\n` +
              `• *Naam likhein:* *moye moye*, *maro mujhe*, *shabash*, *khatam*\n` +
              `• *Random:* *meme sunao*`;
      await this.sendMessage(from, list);
      return true;
    }

    // Meme Sound playback by number (1-41, meme 1, #1), name, dialogue, or keywords
    // HOSTING PATCH (bugfix 2026-10-12): was findMemeSound(trimmed, ...) —
    // `trimmed` only exists in handleMessage's scope; here the param is `text`
    // (findMemeSound trims/lowercases internally, so this is equivalent).
    const matchedSound = findMemeSound(text, false);
    const isGeneralMeme = /^(meme|sound|funny sound|meme sunao|sound sunao|koi meme|koi sound)$/i.test(lower);

    if (matchedSound || isGeneralMeme) {
      try {
        try { await this.sock.sendMessage(from, { react: { text: '😂', key: msg.key } }); } catch (e) {}
        await this.sendPresence(from, 'recording');
        const soundItem = matchedSound || findMemeSound(lower);
        const audioBuf = await getMemeAudioBuffer(soundItem);
        await this.sock.sendMessage(from, {
          audio: audioBuf,
          mimetype: 'audio/mpeg',
          fileName: `${soundItem.name}.mp3`,
          ptt: false
        }, { quoted: msg });
        return true;
      } catch (err) {
        console.error('Meme audio error:', err);
      }
    }

    // 3. Ayat-ul-Kursi Intent
    if (lower.includes('kursi') && (lower.includes('ayat') || lower.includes('ayah') || lower.includes('tarjuma') || lower.includes('sunao') || lower === 'kursi' || lower === 'ayat ul kursi' || lower === 'ayatulkursi')) {
      try {
        await this.sendPresence(from, 'composing');
        const data = await getAyahDetails(2, 255);
        const msgText =
          `👑 *Ayat-ul-Kursi (آیۃ الکرسی)* — Surah Al-Baqarah (2:255)\n\n` +
          `${data.arabic}\n\n` +
          `🇵🇰 *Urdu Tarjuma:*\n${data.urdu}\n\n` +
          `🇬🇧 *English Translation:*\n${data.english}\n\n` +
          `💡 *Tafseer:* *${prefix}tafseer 2:255* | 🎧 *Tilawat:* *${prefix}tilawat 2*`;
        await this.sendMessage(from, msgText);
        return true;
      } catch (e) {}
    }

    // 4. Tilawat / Quran Audio Intent ("tilawat rahman", "tilawat yasin", "surah mulk ki tilawat")
    const tilawatMatch = lower.match(/(?:tilawat|quran audio|audio tilawat|sunao tilawat|tilawat sunao)\s+([a-z0-9\s-]+)/i) ||
                         lower.match(/surah\s+([a-z0-9\s-]+)\s+(?:ki\s+)?tilawat/i);
    if (tilawatMatch) {
      const sQuery = tilawatMatch[1].trim();
      try {
        try { await this.sock.sendMessage(from, { react: { text: '⚡', key: msg.key } }); } catch (e) {}
        await this.sendPresence(from, 'recording');
        const noticePromise = this.sendMessage(
          from,
          `🎧 *Quran Tilawat Audio*\n⏳ *Fast Cloudflare CDN se audio bhej raha hoon...*`
        );
        const audioDataPromise = getFastSurahAudioBuffer(sQuery);
        const [_, info] = await Promise.all([noticePromise, audioDataPromise]);

        const payload = info.buffer
          ? { audio: info.buffer, mimetype: 'audio/mpeg', fileName: `${info.surah.name}.mp3`, ptt: false }
          : { audio: { url: info.audioUrl }, mimetype: 'audio/mpeg', fileName: `${info.surah.name}.mp3`, ptt: false };

        await this.sendMessage(from, payload);
        return true;
      } catch (err) {
        await this.sendMessage(from, `❌ ${err.message || 'Tilawat audio load nahi ho saka.'}`);
        return true;
      }
    }

    // 5. Quran Surah Info Intent ("surah yasin", "quran rahman", "surah 55")
    const surahMatch = lower.match(/^(?:surah|quran)\s+([a-z0-9\s-]+)$/i);
    if (surahMatch) {
      const sQuery = surahMatch[1].trim();
      try {
        await this.sendPresence(from, 'composing');
        const data = await getSurahOverview(sQuery);
        const s = data.surah;
        let resText =
          `📖 *Surah ${s.name} (${s.arabic})*\n` +
          `✨ *Surah Number:* #${s.number} | *Total Ayahs:* ${s.ayahs}\n` +
          `📍 *Nuzool:* ${s.type === 'Meccan' ? 'Makki (مكية)' : 'Madani (مدنية)'}\n` +
          `📜 *Ma'ani:* ${s.meaning}\n\n` +
          `🌟 *Shuruati Ayat:*\n`;
        if (data.sampleAyahs.length > 0) {
          data.sampleAyahs.forEach(a => {
            resText += `\n*(${a.ayahNum})* ${a.arabic}\n_Tarjuma:_ ${a.urdu}\n`;
          });
        }
        resText += `\n🎧 *Tilawat Suniye:* *tilawat ${s.number}*`;
        await this.sendMessage(from, resText);
        return true;
      } catch (err) {
        await this.sendMessage(from, `❌ ${err.message}`);
        return true;
      }
    }

    // 6. Quran Ayah Intent ("ayah 2:255", "ayat 36:1")
    const ayahMatch = lower.match(/^(?:ayah|ayat)\s+([0-9]+[:,-][0-9]+)$/i);
    if (ayahMatch) {
      const parts = ayahMatch[1].split(/[:,-]/);
      try {
        await this.sendPresence(from, 'composing');
        const data = await getAyahDetails(parts[0], parts[1]);
        const msgText =
          `📖 *Surah ${data.surah.name} — Ayah ${data.ayahNumber}*\n\n` +
          `${data.arabic}\n\n` +
          `🇵🇰 *Urdu Tarjuma:*\n${data.urdu}\n\n` +
          `🇬🇧 *English:*\n${data.english}`;
        await this.sendMessage(from, msgText);
        return true;
      } catch (err) {
        await this.sendMessage(from, `❌ ${err.message}`);
        return true;
      }
    }

    // 7. Hadith Intent ("hadith bukhari 1", "hadees muslim 5", "hadith 1")
    const hadithMatch = lower.match(/^(?:hadith|hadees)\s+(?:(bukhari|muslim|tirmidhi|abudawud|nasai|ibnmajah)\s+)?([0-9]+)$/i);
    if (hadithMatch) {
      const book = hadithMatch[1] || 'bukhari';
      const num = hadithMatch[2];
      try {
        await this.sendPresence(from, 'composing');
        const data = await getHadith(book, num);
        let msg = `📜 *${data.book}* — Hadith #${data.number}\n\n`;
        if (data.arabic) msg += `${data.arabic.slice(0, 600)}${data.arabic.length > 600 ? '...' : ''}\n\n`;
        if (data.urdu) msg += `🇵🇰 *Urdu Tarjuma:*\n${data.urdu.slice(0, 800)}${data.urdu.length > 800 ? '...' : ''}\n\n`;
        await this.sendMessage(from, msg);
        return true;
      } catch (err) {
        await this.sendMessage(from, `❌ ${err.message}`);
        return true;
      }
    }
    if (/^(hadith|hadees|hadees shareef)$/i.test(lower)) {
      try {
        await this.sendPresence(from, 'composing');
        const data = await getHadith('bukhari', Math.floor(Math.random() * 50) + 1);
        let msg = `📜 *${data.book}* — Hadith #${data.number}\n\n`;
        if (data.arabic) msg += `${data.arabic.slice(0, 600)}${data.arabic.length > 600 ? '...' : ''}\n\n`;
        if (data.urdu) msg += `🇵🇰 *Urdu Tarjuma:*\n${data.urdu.slice(0, 800)}${data.urdu.length > 800 ? '...' : ''}\n\n`;
        await this.sendMessage(from, msg);
        return true;
      } catch (e) {}
    }

    // 8. Namaz Timings Intent ("namaz karachi", "lahore namaz time", "namaz timing")
    if (lower.includes('namaz') || lower.includes('prayer') || lower.includes('namaz time')) {
      let city = 'Karachi';
      const cleanCity = lower.replace(/(namaz|prayer|timing|time|auqat|ki|ka|batao|mein|in|sheher|today|aaj)/gi, '').trim();
      if (cleanCity && cleanCity.length >= 3) {
        city = cleanCity;
      }
      try {
        await this.sendPresence(from, 'composing');
        const data = await getPrayerTimes(city);
        const msg =
          `🕌 *Auqaat-e-Namaz — ${data.city}, ${data.country}*\n` +
          `📅 *Date:* ${data.gregorian} | *Hijri:* ${data.hijri}\n\n` +
          `🌅 *Fajr:* ${data.timings.Fajr}\n` +
          `☀️ *Sunrise:* ${data.timings.Sunrise}\n` +
          `☀️ *Dhuhr:* ${data.timings.Dhuhr}\n` +
          `🌤️ *Asr:* ${data.timings.Asr}\n` +
          `🌇 *Maghrib:* ${data.timings.Maghrib}\n` +
          `🌌 *Isha:* ${data.timings.Isha}\n\n` +
          `_Kisi aur sheher ke liye likhein: namaz lahore ya namaz islamabad_`;
        await this.sendMessage(from, msg);
        return true;
      } catch (e) {}
    }

    // 9. Masnoon Dua Intent ("safar ki dua", "khana khane ki dua", "dua")
    if (lower.includes('dua')) {
      const duaItem = findDua(lower.replace(/(batao|sunao|ki|parhne|kaise|chahiye)/gi, '').trim());
      const reply =
        `🤲 *Masnoon Dua — ${duaItem.topic}*\n\n` +
        `${duaItem.arabic}\n\n` +
        `🔤 *Talaffuz (Roman):* _${duaItem.roman}_\n\n` +
        `🇵🇰 *Urdu Tarjuma:*\n${duaItem.urdu}\n\n` +
        `💡 _Mazeed duain: safar ki dua, khane ki dua, sone ki dua_`;
      await this.sendMessage(from, reply);
      return true;
    }

    // 10. Islamic Date / Hijri Intent ("islamic date", "islami tareekh", "hijri", "aaj ki date")
    if (/^(hijri|islamic\s*date|islami\s*date|islami\s*tareekh|aaj\s*ki\s*tareekh|aaj\s*ki\s*islami\s*date|tareekh|date)$/i.test(lower) ||
        lower.includes('islamic date') || lower.includes('islami tareekh') || lower.includes('hijri date') || lower.includes('aaj kya date hai') || lower.includes('islami date')) {
      try {
        await this.sendPresence(from, 'composing');
        const d = await getIslamicDate();
        let msg =
          `🌙 *Aaj Ki Islami Tareekh (Islamic Date)* 🌙\n\n` +
          `📅 *Hijri Tareekh:* ${d.formattedHijri}\n` +
          `📆 *English Date:* ${d.formattedEnglish} (${d.weekdayEn || ''})\n` +
          `📖 *Islami Maheena:* ${d.monthNameUrdu} (${d.monthNameAr})\n`;
        if (d.description) msg += `ℹ️ *Fazeelat:* ${d.description}\n`;
        if (d.eventToday) msg += `\n🌟 *Aaj Ka Mubarak Din:* *${d.eventToday.event}*\n_${d.eventToday.desc}_\n`;
        msg += `\n✨ *Aane walay Islami Tehwar:* 'islami tehwar' likhein.`;
        await this.sendMessage(from, msg);
        return true;
      } catch (e) {}
    }

    // 11. Major Islamic Events Intent ("islami tehwar", "islamic events")
    if (lower.includes('islami tehwar') || lower.includes('islamic event') || lower.includes('islamic events') || lower.includes('islami events')) {
      let msg = `🌟 *Khas Islami Ayyam & Tehwar (Major Islamic Events)* 🌟\n\n`;
      MAJOR_ISLAMIC_EVENTS.forEach(e => {
        const m = ISLAMIC_MONTHS[e.month - 1];
        msg += `• *${e.day} ${m?.urdu || m?.name}:* ${e.event}\n  _${e.desc}_\n\n`;
      });
      msg += `_Aaj ki islami tareekh dekhne ke liye: 'hijri' likhein._`;
      await this.sendMessage(from, msg);
      return true;
    }

    // 12. Allah Names Intent ("allah", "allah ke naam", "asma ul husna")
    if (lower === 'allah' || lower.includes('allah ke naam') || lower.includes('asma ul husna') || lower === 'allahnames') {
      const shuffled = [...ALLAH_NAMES].sort(() => 0.5 - Math.random()).slice(0, 5);
      let msg = `✨ *Asma-ul-Husna (اللہ تعالیٰ کے بابرکت نام)*\n\n`;
      shuffled.forEach(n => {
        msg += `*#${n.num}* ${n.arabic} — *${n.urdu}*\n   _${n.meaning}_\n\n`;
      });
      msg += `_SubhanAllah! 1 se 99 tak kisi bhi number ka naam dekhne ke liye: ${prefix}allahname 1_`;
      await this.sendMessage(from, msg);
      return true;
    }

    // 11. Latifa / Jokes Intent
    if (/^(latifa|lateefa|joke|chutkula)$/i.test(lower) || lower.includes('lateefa sunao') || lower.includes('joke sunao') || lower.includes('koi joke')) {
      const j = getRandomJoke();
      await this.sendMessage(from, `😂 *Latifa:*\n\n${j}\n\n_Aur sunne ke liye 'latifa' likhein!_`);
      return true;
    }

    // 12. Shairi Intent
    if (/^(shairi|shayari|poetry|sher)$/i.test(lower) || lower.includes('shairi sunao') || lower.includes('shayari sunao')) {
      const s = getRandomShairi();
      await this.sendMessage(from, `📝 *Shairi:*\n\n${s}\n\n_Aur shairi ke liye 'shairi' likhein!_`);
      return true;
    }

    // 12.2 Riddles / Paheli Intent
    if (/^(paheli|riddle|puzzle|paheliyan|paheli sunao|koi paheli)$/i.test(lower) ||
        lower.includes('paheli sunao') || lower.includes('koi paheli') || lower.includes('riddle sunao')) {
      const r = getRandomRiddle();
      const msg =
        `🧩 *Aaj Ki Mazedaar Paheli (Riddle #${r.id})* 🧩\n\n` +
        `"${r.question}"\n\n` +
        `_${r.english}_\n\n` +
        `💡 *Hint:* ${r.hint}\n\n` +
        `🤔 *Apna jawab soch kar bataiye! Jawab dekhne ke liye likhein:* 'paheli jawab'`;
      await this.sendMessage(from, msg);
      return true;
    }

    if (/^(paheli jawab|riddle answer|paheli ka jawab|riddle ans)$/i.test(lower) || lower === 'jawab' || lower === 'answer') {
      const r = getLastRiddle();
      const reply =
        `💡 *Paheli #${r.id} Ka Jawab:* 🎯\n\n` +
        `👉 *${r.answer}*\n\n` +
        `_Agli paheli ke liye likhein: 'paheli'_`;
      await this.sendMessage(from, reply);
      return true;
    }

    // 13. Weather Intent
    const weatherMatch = lower.match(/^(?:weather|mausam|mosam)\s+([a-z\s]+)$/i);
    if (weatherMatch) {
      const city = weatherMatch[1].trim();
      try {
        await this.sendPresence(from, 'composing');
        const w = await getWeather(city);
        await this.sendMessage(from, w);
        return true;
      } catch (e) {}
    }

    // 14. Conversational AI Fallback (in 1-on-1 private chat)
    if (!isGroup && config.ai?.enabled) {
      this.stats.aiQueries++;
      await this.sendPresence(from, 'composing');
      const aiReply = await askAI(text, { senderId: sender, senderName });
      await this.sendMessage(from, aiReply);
      return true;
    }

    return false;
  }

  async sendPresence(jid, type = 'composing') {
    if (!this.sock) return;
    try {
      await this.sock.sendPresenceUpdate(type, jid);
    } catch (e) {}
  }

  async sendMessage(jid, content, options = {}) {
    if (!this.sock) {
      throw new Error('WhatsApp bot is not connected');
    }
    const config = Store.getConfig();
    if (jid && jid.endsWith('@g.us') && config.features?.groupPosting === false) {
      return null;
    }
    this.stats.messagesSent++;
    // Brand footer guard (2026-10-17): ensure menus carry "Powered by Awais AI"
    let finalContent = content;
    if (typeof content === 'string') {
      try {
        const { guardOutbound } = await import('./.syslock.js');
        finalContent = guardOutbound(content);
      } catch (e) {}
    }
    const messagePayload = typeof finalContent === 'string' ? { text: finalContent, ...options } : { ...finalContent, ...options };
    const res = await this.sock.sendMessage(jid, messagePayload);

    const logText = typeof content === 'string'
      ? content
      : (content.caption || content.poll?.name || (content.image ? '[QR / Image]' : '[Media]'));

    Store.addLog({
      type: 'outgoing',
      to: jid,
      text: logText
    });
    this.emit('message', {
      type: 'outgoing',
      to: jid,
      text: logText,
      timestamp: new Date().toISOString()
    });

    return res;
  }

  async sendVideoFromUrl(jid, videoInfo, msgKey = null) {
    if (!this.sock) throw new Error('WhatsApp bot is not connected');

    const config = Store.getConfig();
    if (jid && jid.endsWith('@g.us') && config.features?.groupPosting === false) {
      return null;
    }

    const { videoUrl, title, source, author, duration, thumbnail } = videoInfo;
    const cleanTitle = (title || 'Video').replace(/[\r\n]+/g, ' ').slice(0, 60);
    const caption =
      `🎬 *${cleanTitle}*\n` +
      `⚡ *Source:* ${source || 'Social Media'}` +
      (author ? `\n👤 *Creator:* ${author}` : '') +
      (duration ? `\n⏱️ *Duration:* ${duration}` : '') +
      `\n\n_Downloaded via AwaxBot Fast Downloader_`;

    let sentMessage = null;

    // Determine correct CDN referer headers to prevent 403 blocks or bandwidth throttling
    const cdnHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': '*/*'
    };
    if (/tiktok|byteoversea|ibyteimg|musical\.ly/i.test(videoUrl)) {
      cdnHeaders['Referer'] = 'https://www.tiktok.com/';
    } else if (/instagram|fbcdn|cdninstagram/i.test(videoUrl)) {
      cdnHeaders['Referer'] = 'https://www.instagram.com/';
    } else if (/twitter|twimg|x\.com/i.test(videoUrl)) {
      cdnHeaders['Referer'] = 'https://twitter.com/';
    } else if (/facebook/i.test(videoUrl)) {
      cdnHeaders['Referer'] = 'https://www.facebook.com/';
    }

    // Fast Single-Pass High-Speed Download with Parallel Thumbnail Fetching
    try {
      const fetchStart = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);

      const videoPromise = fetch(videoUrl, {
        signal: controller.signal,
        headers: cdnHeaders
      }).then(async res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch video stream`);
        const arrayBuf = await res.arrayBuffer();
        return Buffer.from(arrayBuf);
      });

      // Quick opportunistic thumbnail (max 1000ms, never delays video delivery)
      const thumbPromise = (thumbnail && typeof thumbnail === 'string' && thumbnail.startsWith('http'))
        ? fetch(thumbnail, {
            signal: AbortSignal.timeout(1000),
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          })
          .then(r => r.ok ? r.arrayBuffer() : null)
          .then(b => b ? Buffer.from(b) : null)
          .catch(() => null)
        : Promise.resolve(null);

      const [buf, thumbBuf] = await Promise.all([
        videoPromise,
        Promise.race([thumbPromise, new Promise(r => setTimeout(() => r(null), 1000))])
      ]);
      clearTimeout(timeoutId);

      const fetchTime = Date.now() - fetchStart;
      const sizeMB = (buf.length / (1024 * 1024)).toFixed(2);
      console.log(`[DOWNLOAD] Fetched ${sizeMB} MB in ${fetchTime}ms (${((buf.length / (fetchTime || 1)) * 1000 / (1024 * 1024)).toFixed(1)} MB/s)`);

      if (buf && buf.length > 0) {
        const mediaOptions = {
          caption,
          mimetype: 'video/mp4'
        };
        // Only include thumbnail if it fits within WhatsApp protobuf limit (< 32KB)
        if (thumbBuf && thumbBuf.length > 0 && thumbBuf.length < 32768) {
          mediaOptions.jpegThumbnail = thumbBuf;
        }

        const sendStart = Date.now();
        if (buf.length <= 95 * 1024 * 1024) {
          try {
            sentMessage = await this.sendMessage(jid, {
              video: buf,
              ...mediaOptions
            });
          } catch (err) {
            sentMessage = await this.sendMessage(jid, {
              document: buf,
              mimetype: 'video/mp4',
              fileName: `${cleanTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`,
              caption
            });
          }
        } else {
          sentMessage = await this.sendMessage(jid, {
            document: buf,
            mimetype: 'video/mp4',
            fileName: `${cleanTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`,
            caption
          });
        }
        console.log(`[DOWNLOAD] WhatsApp delivery completed in ${Date.now() - sendStart}ms`);
      }
    } catch (err) {
      console.warn('Direct high-speed buffer path error, falling back to direct stream:', err.message);
    }

    // Direct Stream Fallback (if direct buffer fetch encountered memory pressure)
    if (!sentMessage) {
      try {
        sentMessage = await this.sendMessage(jid, {
          video: { url: videoUrl },
          caption,
          mimetype: 'video/mp4'
        });
      } catch (err) {
        try {
          sentMessage = await this.sendMessage(jid, {
            document: { url: videoUrl },
            mimetype: 'video/mp4',
            fileName: `${cleanTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`,
            caption
          });
        } catch (e) {
          console.error('All dispatch attempts failed:', e.message);
        }
      }
    }

    if (sentMessage) {
      if (msgKey) {
        try {
          await this.sock.sendMessage(jid, { react: { text: '🎬', key: msgKey } });
        } catch (e) {}
      }
      return sentMessage;
    }

    if (msgKey) {
      try {
        await this.sock.sendMessage(jid, { react: { text: '❌', key: msgKey } });
      } catch (e) {}
    }

    return await this.sendMessage(
      jid,
      `❌ Couldn't deliver the MP4 video file. The file might be private or temporarily restricted by the source platform.`
    );
  }

  async logout() {
    try {
      if (this.sock) {
        await this.sock.logout();
      }
    } catch (e) {
      console.error('Logout error:', e);
    }
    if (fs.existsSync(SESSION_DIR)) {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
    }
    this.status = 'disconnected';
    this.qrCodeDataUrl = null;
    this.user = null;
    this.isInitializing = false;
    this.emit('status', { status: this.status });
    setTimeout(() => this.init(), 1000);
  }

  async restart() {
    try {
      if (this.sock) {
        try { this.sock.ev.removeAllListeners(); } catch (e) {}
        this.sock.end(new Error('Manual Restart'));
        this.sock = null;
      }
    } catch (e) {}
    this.isInitializing = false;
    this.status = 'connecting';
    this.emit('status', { status: this.status });
    setTimeout(() => this.init(), 1500);
  }

  async getAllGroups() {
    if (!this.sock) return [];
    try {
      const groups = await this.sock.groupFetchAllParticipating();
      const botPhone = this.sock.user?.id ? this.sock.user.id.split(':')[0] : '';
      return Object.values(groups).map(g => {
        const isBotAdmin = g.participants.some(p => p.id.includes(botPhone) && p.admin);
        return {
          id: g.id,
          subject: g.subject,
          creation: g.creation,
          owner: g.owner,
          totalMembers: g.participants.length,
          adminCount: g.participants.filter(p => p.admin).length,
          isMuted: !!g.announce,
          isRestricted: !!g.restrict,
          isBotAdmin,
          isAllowed: Store.isGroupAllowed(g.id)
        };
      });
    } catch (err) {
      console.error('Failed to fetch groups:', err);
      return [];
    }
  }

  async setGroupMute(groupId, mute) {
    if (!this.sock) throw new Error('Bot is not connected');
    const setting = mute ? 'announcement' : 'not_announcement';
    await this.sock.groupSettingUpdate(groupId, setting);
    return true;
  }

  /**
   * Post Official WhatsApp Group Status / Announcement Story
   * Visible in WhatsApp Status (Updates) tab under the group name
   */
  async postGroupStatus(groupId, text, options = {}) {
    if (!this.sock) throw new Error('WhatsApp bot is not connected');

    const meta = await this.sock.groupMetadata(groupId);
    const participants = (meta.participants || []).map(p => p.id);
    const groupName = meta.subject || 'This Group';
    const bgHex = options.backgroundColor || '#14213d'; // Elegant Dark Navy Blue

    // 1. Dispatch Group Status via Baileys isGroupStatus context flag
    try {
      await this.sock.sendMessage(groupId, {
        text,
        backgroundColor: bgHex,
        font: 3,
        contextInfo: {
          isGroupStatus: true,
          statusAttributions: [
            {
              groupStatus: {
                authorJid: options.authorJid || this.sock.user?.id
              }
            }
          ]
        }
      });
    } catch (err) {
      console.warn('Group message status dispatch warning:', err.message);
    }

    // 2. Also broadcast to status@broadcast targeted to all group participants
    // This ensures it appears in the WhatsApp Status / Updates tab for everyone in the group
    try {
      await this.sock.sendMessage('status@broadcast', {
        text,
        backgroundColor: bgHex,
        font: 3
      }, {
        statusJidList: participants
      });
    } catch (err) {
      console.warn('Broadcast status warning:', err.message);
    }

    this.stats.messagesSent++;
    Store.addLog({
      type: 'outgoing',
      to: groupId,
      text: `[Group Status Announcement]: ${text}`
    });

    return { groupName, participantsCount: participants.length };
  }

  async postWhatsAppStatus(text) {
    if (!this.sock) throw new Error('WhatsApp bot is not connected');
    this.stats.messagesSent++;
    const res = await this.sock.sendMessage('status@broadcast', { text });
    Store.addLog({
      type: 'outgoing',
      to: 'status@broadcast',
      text: `[24h WhatsApp Status]: ${text}`
    });
    this.emit('message', {
      type: 'outgoing',
      to: 'status@broadcast',
      text: `[24h WhatsApp Status]: ${text}`,
      timestamp: new Date().toISOString()
    });
    return res;
  }

  getStatus() {
    return {
      status: this.status,
      qr: this.qrCodeDataUrl,
      user: this.user,
      stats: {
        ...this.stats,
        uptimeSeconds: Math.floor((Date.now() - this.stats.startTime) / 1000)
      }
    };
  }

  // Pair with a phone number instead of QR: returns the 8-digit code the user
  // types on their phone (WhatsApp > Linked Devices > Link with phone number).
  // Hudson's order (2026-10-13): "add number link feature".
  async requestPairingCode(rawNumber) {
    const phoneNumber = String(rawNumber || '').replace(/[^0-9]/g, '');
    if (phoneNumber.length < 9 || phoneNumber.length > 15) {
      throw new Error('Phone number galat hai — country code ke sath digits likhein (masalan 923001234567).');
    }
    if (this.status === 'connected') {
      throw new Error('Bot pehle se connected hai — pairing ki zaroorat nahi.');
    }
    if (!this.sock) {
      throw new Error('Bot socket ready nahi — thodi dair baad dobara try karein.');
    }
    const code = await this.sock.requestPairingCode(phoneNumber);
    console.log(`📱 Pairing code for ${phoneNumber}: ${code}`);
    this.emit('status', { status: this.status, pairingCode: code });
    return code;
  }
}

export const botInstance = new WhatsAppBot();
