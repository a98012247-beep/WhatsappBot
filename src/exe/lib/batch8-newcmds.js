// Batch 8: New commands from user request (2026-10-14).
// Maps ~270 new command names to existing functionality via two mechanisms:
//   1. CORE_ALIASES (exported): alias -> core bot.js command. bot.js resolves
//      these before dispatch so they hit the built-in switch.
//   2. HANDLERS string aliases: alias -> batch 1-7 real handler (has run fn).
//      These resolve inside newfeatures.js.
//   3. New implementations below (emojimix, wikipedia, textmaker, autoreply).
// Skipped (documented at bottom): dangerous/unclear commands.
import { registerBatch, readData, writeData } from './batch-helpers.js';
import { groupFeatureOn } from './access.js';

// ─── CORE_ALIASES: new name -> existing CORE command (bot.js KNOWN_COMMANDS) ──
// bot.js imports this and resolves before dispatch.
export const CORE_ALIASES = {
  // ---- DOWNLOADS (all -> core downloader commands) ----
  alldl: 'dl', cc: 'dl', imgdl: 'dl', repost: 'dl', reposts: 'dl', ttrepost: 'dl',
  capcutdl: 'capcut',
  extractaudio: 'audio', v2mp3: 'audio', tomp3: 'audio',
  fbdl: 'fb',
  play: 'song', sp: 'song', spotify: 'song',
  tik: 'tiktok',
  tovn: 'voice', tovoice: 'voice', vn: 'voice', vo: 'voice', vv: 'voice',
  twit: 'twitter', xdl: 'twitter',
  instagram: 'insta',
  ytmp3: 'yt', yts: 'yt', ytsearch: 'yt', ytmp4: 'ytdl',

  // ---- AI ----
  abot: 'ai', chatbot: 'ai',

  // ---- MEDIA ----
  stick: 'sticker', qrcode: 'qr',
  hm: 'attp', hmm: 'attp', ok: 'attp', okay: 'attp', okey: 'attp',

  // ---- GROUP ----
  htag: 'hidetag', htagall: 'tagall', silenttag: 'hidetag',
  rwarn: 'warn', resetwarn: 'warn', warnings: 'warn',
  ban: 'kick',
  gcinfo: 'groupinfo', ginfo: 'groupinfo',

  // ---- FUN ----
  j: 'joke', q: 'quote', shayri: 'shayari',
  randmeme: 'meme', randomfact: 'fact',

  // ---- TOOLS ----
  alive: 'ping', speed: 'ping', wspeed: 'ping', nettest: 'ping',
  say: 'tts', vtts: 'tts', vttsg: 'tts', vttsv: 'tts', vttslist: 'tts',
  runtime: 'uptime',
  menuweb: 'menu', pmenu: 'menu',
  w: 'weather',
  prayertime: 'prayer', waqt: 'prayer',
  reminders: 'remind', remindme: 'remind', remindset: 'remind', rmdp: 'remind',
  remindcustom: 'remind',
  // ---- URDU ALIASES (2026-10-14 audit: menu commands with no handler) ----
  hisaab: 'calc',      // hisaab = calculation in Urdu
  khabrain: 'news',     // khabrain = news in Urdu
  mosam: 'weather',     // mosam = weather in Urdu
};

const MENU_SECTION = {
  title: 'New Commands',
  commands: [
    { cmd: 'emojimix', desc: 'Mix two emojis into one sticker' },
    { cmd: 'wikipedia', desc: 'Search Wikipedia' },
    { cmd: 'textmaker', desc: 'Fancy text effects (neon, glitch...)' },
    { cmd: 'autoreply', desc: 'ManyChat-style keyword auto-replies' },
  ],
};
const WEB_COMMANDS = [];

function safe(fn) {
  return async (ctx, q) => {
    try { return await fn(ctx, q); }
    catch (e) { console.error('[batch8]', e.message); await ctx.bot.sendMessage(ctx.from, '❌ Kuch masla hua, dobara try karein.'); }
  };
}
async function say(ctx, text) { await ctx.bot.sendMessage(ctx.from, text); }

// ─── STRING ALIASES -> batch 1-7 REAL handlers (resolve in newfeatures.js) ───
const ALIASES = {
  // Group links
  alink: 'grouplink', invitelink: 'grouplink', link: 'grouplink',
  // Group info/stats
  groupstatinfo: 'groupstats', gs: 'groupstats', gsinfo: 'groupstats',
  setdesc: 'groupdesc',
  revoke: 'revokelink', unpinmsg: 'unpin',
  // Polls
  channelpoll: 'pollsched', cpoll: 'pollsched', upoll: 'pollsched', uptimepoll: 'pollsched',
  // Tools -> batch handlers
  areact: 'autoreact',
  checknum: 'numinfo',
  cook: 'recipe', recipeur: 'recipe',
  khabrein: 'paknews', headlines: 'paknews',
  crm: 'currency',
  define: 'dictionary',
  eightball: '8ball',
  fstatus: 'mystats', stats: 'mystats', sysinfo: 'mystats', systeminfo: 'mystats',
  fx: 'forex',
  gold: 'goldrate',
  horo: 'horoscope', starsign: 'horoscope',
  league: 'football', score: 'cricket', standings: 'football',
  pinimage: 'pindl', pinimg: 'pindl', pinsrc: 'pindl',
  qiblah: 'qibla',
  zakaat: 'zakat',
  remini: 'enhance',
  short: 'shorturl',
  ss: 'websnap', screenshot: 'websnap', ssweb: 'websnap',
  table: 'timetable', tc: 'timetable',
  tr: 'translate',
  trivia: 'quizgame',
  umar: 'age',
  unit: 'unitconv', units: 'unitconv', convert: 'unitconv',
  userinfo: 'myusage', who: 'myusage',
  wiki: 'wikipedia',
  clock: 'timezone',
  gettxt: 'ocr',
  // Fun -> batch handlers
  truth: 'truthdare',
  ttc: 'tictactoe',
  // AI/image -> batch handlers
  gen: 'imggen', imagine: 'imggen', img2: 'imggen',
  scantext: 'ocr', gettxt: 'ocr',
  // Media -> batch8b (registered separately)
  getdpall: 'getdp',
};

// NOTE: batch8b-media.js, batch8c-group.js, batch8d-fun.js register their
// real handlers directly via registerBatch (loaded after this file).
// No forwarders needed.

const HANDLERS = {
  ...ALIASES,

  // NOTE: batch8b-media.js, batch8c-group.js, batch8d-fun.js register their
  // real handlers directly (they load after this file and take precedence).
  // No forwarders needed here.

  // ── Owner-only restart ──
  restart: safe(async (ctx, q) => {
    // Owner check via access.js (2026-10-14): unified owner system.
    // Falls back to legacy batch8-owner.json for backward compatibility.
    const { isOwner } = await import('./access.js');
    let allowed = false;
    try { allowed = isOwner(ctx.sender); } catch {}
    if (!allowed) {
      const ownerJid = (ctx.bot.sock.user?.id || '').split(':')[0];
      const senderNum = (ctx.sender || '').split('@')[0].split(':')[0];
      if (senderNum === ownerJid) allowed = true; // bot itself
    }
    if (!allowed) {
      const ownerData = readData('batch8-owner.json', {});
      const senderNum = (ctx.sender || '').split('@')[0].split(':')[0];
      if (ownerData.owner && senderNum === String(ownerData.owner).split('@')[0].split(':')[0]) allowed = true;
    }
    if (!allowed) {
      await say(ctx, '🔒 Ye command sirf owner ke liye hai. Dashboard → Access me owner set karein.');
      return;
    }
    await say(ctx, '🔄 Bot restart ho raha hai...');
    setTimeout(() => { try { ctx.bot.restart(); } catch (e) { process.exit(0); } }, 1000);
  }),
  setowner: safe(async (ctx, q) => {
    const num = (q || '').trim().replace(/[^0-9]/g, '');
    if (!num) {
      await say(ctx, '👑 *Set Owner*\n\nIstamal: *setowner <number>*\nMisaal: *setowner 923001234567*');
      return;
    }
    // Write to BOTH files for sync (2026-10-14 fix):
    // - batch8-owner.json (legacy, for backward compat)
    // - owner-config.json via access.js (dashboard reads this)
    writeData('batch8-owner.json', { owner: num });
    try {
      const { setOwner } = await import('./access.js');
      setOwner(num);
    } catch (e) { console.error('[setowner] access.js sync failed:', e.message); }
    await say(ctx, `✅ Owner set: ${num}`);
  }),

  // ── EmojiMix: combine two emojis ──
  emojimix: safe(async (ctx, q) => {
    // Extract emojis with or without spaces (2026-10-15, per Hudson:
    // space between emojis is NOT required).
    const query = (q || '').trim();
    let emojis = [];
    try {
      const seg = new Intl.Segmenter('en', { granularity: 'grapheme' });
      for (const { segment } of seg.segment(query)) {
        if (/\p{Extended_Pictographic}/u.test(segment)) emojis.push(segment);
      }
    } catch {
      emojis = query.match(/\p{Extended_Pictographic}(\uFE0F|\u200D\p{Extended_Pictographic})*/gu) || [];
    }
    if (emojis.length < 2) {
      await say(ctx, '😀➕😎 *EmojiMix*\n\nDo emoji bhejein, mix karke dunga!\nMisaal: *emojimix 😀 😎*');
      return;
    }
    try {
      const e1 = encodeURIComponent(emojis[0]);
      const e2 = encodeURIComponent(emojis[1]);
      const url = `https://emojik.vercel.app/s/${e1}_${e2}?size=256`;
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error('mix failed ' + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1000) throw new Error('empty image');
      // Convert to WebP (2026-10-15): WhatsApp mobile rejects non-WebP
      // stickers ("information missing"); Web renders them leniently.
      let stickerBuf = buf;
      try {
        const sharp = (await import('sharp')).default;
        stickerBuf = await sharp(buf).resize(512, 512, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 90 }).toBuffer();
      } catch {}
      await ctx.bot.sock.sendMessage(ctx.from, { sticker: stickerBuf }, { quoted: ctx.msg });
    } catch (e) {
      await say(ctx, '😅 Emoji mix nahi ho saka. Do valid emoji bhejein.\nMisaal: *emojimix 😀 😎*');
    }
  }),
  emix: 'emojimix',

  // ── Wikipedia search ──
  wikipedia: safe(async (ctx, q) => {
    const query = (q || '').trim();
    if (!query) {
      await say(ctx, '📚 *Wikipedia*\n\nIstamal: *wikipedia <topic>*\nMisaal: *wikipedia Pakistan*');
      return;
    }
    try {
      const { fetchJsonRetry } = await import('./api-helper.js');
      const data = await fetchJsonRetry(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
        { timeout: 15000, retries: 2 }
      );
      if (data?.extract) {
        let out = `📚 *${data.title}*\n\n${data.extract.slice(0, 800)}`;
        if (data.extract.length > 800) out += '...';
        if (data.content_urls?.desktop?.page) out += `\n\n🔗 ${data.content_urls.desktop.page}`;
        await say(ctx, out);
      } else {
        await say(ctx, '📚 Is topic par Wikipedia mein kuch nahi mila.');
      }
    } catch (e) {
      await say(ctx, '📚 Wikipedia search nahi ho saki, dobara try karein.');
    }
  }),

  // ── TextMaker: fancy text effect images ──
  textmaker: safe(async (ctx, q) => {
    const styles = ['neon', 'glitch', 'fire', 'ice', 'matrix', 'metallic', 'thunder', 'hacker', 'purple', 'sand', 'snow', 'devil', 'light', 'leaves', 'diesel', 'fuel', 'petrol', 'arena', 'blackpink', 'impressive', '1917'];
    const parts = (q || '').trim().split(/\s+/);
    if (parts.length < 2) {
      await say(ctx, `🎨 *TextMaker*\n\nStyles: ${styles.join(', ')}\n\nIstamal: *textmaker <style> <text>*\nMisaal: *textmaker neon Hello*`);
      return;
    }
    const style = parts[0].toLowerCase();
    const text = parts.slice(1).join(' ').slice(0, 30);
    if (!styles.includes(style)) {
      await say(ctx, `🎨 Style "${style}" nahi mila.\n\nAvailable: ${styles.join(', ')}`);
      return;
    }
    try {
      const sharp = (await import('sharp')).default;
      const styleColors = {
        neon: '#00FFFF', glitch: '#FF00FF', fire: '#FF4500', ice: '#87CEEB',
        matrix: '#00FF00', metallic: '#C0C0C0', thunder: '#FFD700', hacker: '#00FF41',
        purple: '#9B59B6', sand: '#D2B48C', snow: '#FFFFFF', devil: '#FF0000',
        light: '#FFFFE0', leaves: '#228B22', diesel: '#696969', fuel: '#FF8C00',
        petrol: '#20B2AA', arena: '#FF6347', blackpink: '#FF1493', impressive: '#4169E1',
        '1917': '#8B7355',
      };
      const color = styleColors[style] || '#FFFFFF';
      const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const svg = `<svg width="800" height="300" xmlns="http://www.w3.org/2000/svg">`
        + `<defs><filter id="glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`
        + `<rect width="800" height="300" fill="#0a0a0a"/>`
        + `<text x="400" y="150" font-family="Arial,sans-serif" font-size="72" font-weight="bold" fill="${color}" text-anchor="middle" dominant-baseline="middle" filter="url(#glow)">${esc}</text>`
        + `<text x="400" y="260" font-family="Arial,sans-serif" font-size="24" fill="#666" text-anchor="middle">Style: ${style}</text></svg>`;
      const buf = await sharp(Buffer.from(svg)).png().toBuffer();
      await ctx.bot.sock.sendMessage(ctx.from, { image: buf, caption: `🎨 *TextMaker — ${style}*\n"${text}"` }, { quoted: ctx.msg });
    } catch (e) {
      await say(ctx, '🎨 Text effect nahi ban saka, dobara try karein.');
    }
  }),

  // ── ManyChat-style keyword auto-reply ──
  autoreply: safe(async (ctx, q) => {
    const data = readData('batch8-autoreply.json', {});
    const key = ctx.from;
    if (!data[key]) data[key] = [];
    const query = (q || '').trim();
    const addMatch = /^add\s+(.+?)\s*\|\s*(.+)$/is.exec(query);
    if (addMatch) {
      const keyword = addMatch[1].trim().toLowerCase();
      const reply = addMatch[2].trim();
      if (data[key].length >= 30) { await say(ctx, '❌ Zyada se zyada 30 auto-replies.'); return; }
      if (data[key].some(r => r.keyword === keyword)) { await say(ctx, 'ℹ️ Ye keyword pehle se hai.'); return; }
      data[key].push({ keyword, reply });
      writeData('batch8-autoreply.json', data);
      await say(ctx, `✅ *Auto-reply set!*\n\n🔑 Keyword: "${keyword}"\n💬 Reply: "${reply.slice(0, 100)}${reply.length > 100 ? '...' : ''}"\n\nAb jo bhi "${keyword}" bhejega, ye reply milega!`);
      return;
    }
    const delMatch = /^del\s+(\d+)$/i.exec(query);
    if (delMatch) {
      const i = parseInt(delMatch[1]) - 1;
      if (i < 0 || i >= data[key].length) { await say(ctx, '❌ Ghalat number. *autoreply list* dekhein.'); return; }
      data[key].splice(i, 1);
      writeData('batch8-autoreply.json', data);
      await say(ctx, '🗑️ Auto-reply delete kar diya.');
      return;
    }
    if (/^list$/i.test(query) || !query) {
      if (!data[key].length) {
        await say(ctx, `🤖 *Auto-Reply (ManyChat Style)*\n\nKoi auto-reply nahi set.\n\n*autoreply add <keyword> | <reply>*\nMisaal: *autoreply add link | https://example.com/video*\n\nPhir jo bhi "link" bhejega, usay ye reply milega!`);
        return;
      }
      const list = data[key].map((r, i) => `${i + 1}. "${r.keyword}" → "${r.reply.slice(0, 50)}${r.reply.length > 50 ? '...' : ''}"`).join('\n');
      await say(ctx, `🤖 *Auto-Replies:*\n\n${list}\n\n*autoreply del <number>* se hatayein.`);
      return;
    }
    await say(ctx, `🤖 *Auto-Reply*\n\n• *autoreply add <keyword> | <reply>*\n• *autoreply list*\n• *autoreply del <number>*`);
  }),
};

// Text maker style shortcuts -> textmaker with style prepended
for (const style of ['neon', 'glitch', 'fire', 'ice', 'matrix', 'metallic', 'thunder', 'hacker', 'purple', 'sand', 'snow', 'devil', 'light', 'leaves', 'diesel', 'fuel', 'petrol', 'arena', 'blackpink', 'impressive', '1917']) {
  HANDLERS[style] = safe(async (ctx, q) => {
    await HANDLERS.textmaker(ctx, `${style} ${q || ''}`.trim());
  });
}

// ─── onMessage hook: check auto-reply triggers ───
async function onMessage(ctx) {
  try {
    const text = (ctx.text || '').trim().toLowerCase();
    if (!text || text.length > 100) return false;
    // Don't trigger on commands (messages starting with prefix)
    if (/^[!/.]/.test((ctx.text || '').trim())) return false;
    // Dashboard control: per-group autoreply toggle (2026-10-14)
    if (ctx.isGroup && !groupFeatureOn(ctx.from, 'autoreply', true)) return false;
    const data = readData('batch8-autoreply.json', {});
    const replies = data[ctx.from] || [];
    for (const r of replies) {
      if (text.includes(r.keyword)) {
        await ctx.bot.sendMessage(ctx.from, r.reply);
        return true;
      }
    }
  } catch (e) { /* ignore */ }
  return false;
}

registerBatch({ MENU_SECTION, WEB_COMMANDS, HANDLERS, onMessage });

// ─── SKIPPED (documented, not implemented) ───
// DANGEROUS (never implement as chat commands):
//   eval, exec -> arbitrary code execution. shutdown -> kills the bot.
// UNCLEAR single-word commands with no clear meaning in this bot:
//   code, getcode, msgcode, re, try, pairrm, privacy, repo, show,
//   stag, statustag, swgc, togstatus, deal, products, fdroid, crmsnipp,
//   sonarate, sim, simdata, check, mv, k, lsp, lstick,
//   nreact, creact, chanreact (channel reactions),
//   cekidch, channelinfo, channelpost, channelstatus, channelstory,
//   chanstatus, chpost, chstatus, chstory, cstatus, cvote, follow,
//   idch, inspect, jid, joinchannel, leavechannel, sendch,
//   sendchannel, swnc, unfollow (channel management - low value),
//   img2prompt (needs paid API), magicview (view-once bypass - questionable),
//   dino (game - complex), keep, unkeep, pending, event,
//   ilock, iunlock (unclear), antidelet (typo of antidelete),
//   gettxt -> mapped to ocr instead.
