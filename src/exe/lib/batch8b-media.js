// batch8b-media.js — Batch 8b: Media Tools (10 commands + 2 message hooks).
// Self-registers with newfeatures.js. ESM only. No npm deps beyond what the
// bot already ships (sharp is optional, used lazily like other batches).
import { registerBatch, readData, writeData, getMediaBuffer, isGroupAdmin } from './batch-helpers.js';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

const AUTO_FILE = 'batch8b-autosticker.json';
const ANTI_FILE = 'batch8b-antisticker.json';
const VAULT_FILE = 'batch8b-vault.json';
const SAVE_DIR = path.join(DATA_DIR, 'batch8b-saves');

// ---- Tiny helpers ----
const T = (ms = 30000) => AbortSignal.timeout(ms);
const say = (ctx, t) => ctx.bot.sendMessage(ctx.from, String(t));
const safe = (fn) => async (ctx, query) => {
  try { await fn(ctx, (query || '').trim()); }
  catch (e) { try { await say(ctx, '⚠️ Kuch ghalat ho gaya, dobara try karein.'); } catch {} }
};
async function getSharp() {
  try { const { default: sharp } = await import('sharp'); return sharp; }
  catch { return null; }
}
const kb = (b) => (b / 1024).toFixed(1);
const mb = (b) => (b / 1048576).toFixed(2);

// First word of a caption/text, used by hooks to skip command-looking messages.
const firstWord = (t) => (t || '').trim().split(/\s+/)[0].toLowerCase().replace(/^!+/, '');
// All command + alias names of this batch (hooks skip these so a captioned
// image that looks like a command still gets handled as a command).
const CMD_WORDS = new Set([
  'getdp', 'setdp', 'setpp', 'setfullpp', 'toimg', 's2img', 'toimage',
  'webptoimg', 'tourl', 'collage', 'grid', 'album', 'carousel',
  'autosticker', 'antisticker', 'once', 'see', 'reveal', 'saveonce',
  'save', 'sv', 'vault',
]);
function looksLikeCommand(ctx) {
  const t = (ctx.text || '').trim();
  if (!t) return false;
  if (ctx.prefix && t.startsWith(ctx.prefix)) return true;
  return CMD_WORDS.has(firstWord(t));
}

// Download the media sitting directly on this message (no quoted lookup).
async function mediaOf(msg, key) {
  const content = msg?.message?.[key];
  if (!content) return null;
  try {
    const buffer = await downloadMediaMessage(
      { key: msg.key, message: { [key]: content } }, 'buffer', {}
    );
    if (!buffer || !buffer.length) return null;
    return { buffer, mimetype: content.mimetype || '' };
  } catch (e) {
    console.error('[batch8b] mediaOf:', e.message);
    return null;
  }
}

// Unwrap a quoted message down to its real content (view-once / ephemeral).
function unwrapQuoted(quoted) {
  let q = quoted;
  for (let i = 0; i < 3 && q; i++) {
    if (q.viewOnceMessageV2?.message) q = q.viewOnceMessageV2.message;
    else if (q.viewOnceMessage?.message) q = q.viewOnceMessage.message;
    else if (q.ephemeralMessage?.message) q = q.ephemeralMessage.message;
    else break;
  }
  return q;
}
function quotedMessageOf(msg) {
  const m = msg?.message || {};
  const ci = m.extendedTextMessage?.contextInfo
    || m.imageMessage?.contextInfo
    || m.videoMessage?.contextInfo
    || m.stickerMessage?.contextInfo;
  return ci?.quotedMessage || null;
}

// ================= HANDLERS =================
export const HANDLERS = {
  // ---- 1. getdp — profile picture ----
  getdp: safe(async (ctx, q) => {
    const m = ctx.msg?.message || {};
    const ci = m.extendedTextMessage?.contextInfo || m.imageMessage?.contextInfo;
    let target = null, label = 'Aapki';
    if (ci?.mentionedJid?.length) { target = ci.mentionedJid[0]; label = 'User ki'; }
    if (!target && q) {
      const digits = q.replace(/\D/g, '');
      if (digits.length >= 10) { target = digits + '@s.whatsapp.net'; label = 'User ki'; }
    }
    if (!target && ci?.participant) { target = ci.participant; label = 'User ki'; }
    if (!target) { target = ctx.sender; label = 'Aapki'; }
    try {
      const url = await ctx.bot.sock.profilePictureUrl(target, 'image');
      await ctx.bot.sock.sendMessage(
        ctx.from, { image: { url }, caption: `🖼️ ${label} profile picture` },
        { quoted: ctx.msg }
      );
    } catch {
      await say(ctx, 'No profile picture found.');
    }
  }),

  // ---- 2. setdp — bot ki profile picture ----
  // NOTE: bot mein koi owner registry nahi hai (kisi bhi batch mein owner
  // check ka pattern nahi mila), is liye ye command allow hai lekin warning
  // ke saath — owner lock chahiye to parent ko batayein.
  setdp: safe(async (ctx, q) => {
    const media = await getMediaBuffer(ctx.msg, 'image');
    if (!media) return say(ctx,
      '🖼️ Usage: apni photo bhejein aur us par reply kar ke *setdp* likhein,\n' +
      'ya photo ke saath caption mein *setdp* likhein.\n' +
      '⚠️ Ye bot ki profile picture badal dega.');
    await say(ctx, '⏳ Bot ki profile picture update ho rahi hai...');
    try {
      await ctx.bot.sock.updateProfilePicture(ctx.bot.sock.user.id, media.buffer);
      await say(ctx, '✅ Bot ki profile picture update ho gayi!\n⚠️ Note: is command par owner lock nahi hai — koi bhi user ise chala sakta hai.');
    } catch {
      await say(ctx, '⚠️ Profile picture update nahi ho saki.');
    }
  }),
  setpp: 'setdp',
  setfullpp: 'setdp',

  // ---- 3. toimg — sticker se PNG ----
  toimg: safe(async (ctx, q) => {
    const sharp = await getSharp();
    if (!sharp) return say(ctx, '⚠️ Sticker convert is waqt available nahi.');
    const media = await getMediaBuffer(ctx.msg, 'sticker');
    if (!media) return say(ctx,
      '🖼️ Usage: kisi sticker par reply kar ke *toimg* likhein.\n' +
      'Sticker PNG image mein convert ho jayega.');
    try {
      const buf = await sharp(media.buffer).png().toBuffer();
      await ctx.bot.sock.sendMessage(
        ctx.from, { image: buf, caption: '✅ Sticker → PNG' }, { quoted: ctx.msg }
      );
    } catch { await say(ctx, '⚠️ Sticker convert nahi ho saka.'); }
  }),
  s2img: 'toimg',
  toimage: 'toimg',
  webptoimg: 'toimg',

  // ---- 4. tourl — Catbox upload ----
  tourl: safe(async (ctx, q) => {
    const media = await getMediaBuffer(ctx.msg, 'image')
      || await getMediaBuffer(ctx.msg, 'video');
    if (!media) return say(ctx,
      '🔗 Usage: kisi photo ya video par reply kar ke *tourl* likhein.\n' +
      'Shareable link mil jayega.');
    if (media.buffer.length > 200 * 1024 * 1024)
      return say(ctx, '⚠️ File bohat bari hai (200MB limit).');
    await say(ctx, '⏳ Upload ho raha hai...');
    try {
      const mt = (media.mimetype || '').toLowerCase();
      const ext = mt.includes('png') ? 'png' : mt.includes('webp') ? 'webp'
        : mt.includes('gif') ? 'gif' : mt.includes('mp4') ? 'mp4'
        : mt.includes('jpeg') || mt.includes('jpg') ? 'jpg' : 'bin';
      const fd = new FormData();
      fd.append('reqtype', 'fileToUpload');
      fd.append('fileToUpload', new Blob([media.buffer], { type: mt || 'application/octet-stream' }), `upload.${ext}`);
      const r = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST', body: fd, signal: T(30000),
      });
      const url = (await r.text()).trim();
      if (!r.ok || !/^https?:\/\//i.test(url)) throw new Error('bad response');
      await say(ctx, `🔗 Link tayyar!\n${url}\n📦 ${mb(media.buffer.length)} MB • ${mt || 'file'}`);
    } catch { await say(ctx, '⚠️ Upload nahi ho saka, thori der baad try karein.'); }
  }),

  // ---- 5. collage — 2x2 grid, same photo 4 filters ke saath ----
  collage: safe(async (ctx, q) => {
    const sharp = await getSharp();
    if (!sharp) return say(ctx, '⚠️ Collage feature is waqt available nahi.');
    const media = await getMediaBuffer(ctx.msg, 'image');
    if (!media) return say(ctx,
      '🖼️ Usage: kisi photo par reply kar ke *collage* likhein.\n' +
      '2x2 grid banega — normal, grey, sepia, bright.');
    await say(ctx, '⏳ Collage ban raha hai...');
    try {
      const S = 512;
      const base = sharp(media.buffer).resize(S, S, { fit: 'cover' });
      const v1 = await base.clone().jpeg({ quality: 85 }).toBuffer();
      const v2 = await base.clone().greyscale().jpeg({ quality: 85 }).toBuffer();
      const v3 = await base.clone()
        .recomb([[0.393, 0.769, 0.189], [0.349, 0.686, 0.168], [0.272, 0.534, 0.131]])
        .jpeg({ quality: 85 }).toBuffer();
      const v4 = await base.clone().modulate({ brightness: 1.4 }).jpeg({ quality: 85 }).toBuffer();
      const out = await sharp({
        create: { width: S * 2, height: S * 2, channels: 3, background: '#111111' },
      }).composite([
        { input: v1, left: 0, top: 0 }, { input: v2, left: S, top: 0 },
        { input: v3, left: 0, top: S }, { input: v4, left: S, top: S },
      ]).jpeg({ quality: 88 }).toBuffer();
      await ctx.bot.sock.sendMessage(
        ctx.from, { image: out, caption: '🖼️ 2x2 Collage: normal • grey • sepia • bright' },
        { quoted: ctx.msg }
      );
    } catch { await say(ctx, '⚠️ Collage nahi ban saka.'); }
  }),
  grid: 'collage',
  album: 'collage',
  carousel: 'collage',

  // ---- 6. autosticker — toggle ----
  autosticker: safe(async (ctx, q) => {
    const arg = (q.split(/\s+/)[0] || '').toLowerCase();
    if (arg !== 'on' && arg !== 'off') return say(ctx,
      '✨ Usage: *autosticker on* ya *autosticker off*\n' +
      'ON hone par is chat mein bheji gayi har photo khud sticker ban jayegi.');
    const st = readData(AUTO_FILE, {});
    if (arg === 'on') st[ctx.from] = true; else delete st[ctx.from];
    writeData(AUTO_FILE, st);
    await say(ctx, arg === 'on'
      ? '✅ Autosticker ON — ab is chat ki har photo sticker ban kar aayegi.'
      : '❌ Autosticker OFF — photos normal aayengi.');
  }),

  // ---- 7. antisticker — group toggle (admin only) ----
  antisticker: safe(async (ctx, q) => {
    if (!ctx.isGroup) return say(ctx,
      '🚫 Istemal (sirf groups mein): *antisticker on* ya *antisticker off*\n' +
      'ON hone par stickers auto-delete ho jayenge. Sirf admin chala sakta hai.');
    const admin = await isGroupAdmin(ctx.bot.sock, ctx.from, ctx.sender).catch(() => false);
    if (!admin) return say(ctx, '⚠️ Sirf group admin ye command chala sakta hai.');
    const arg = (q.split(/\s+/)[0] || '').toLowerCase();
    if (arg !== 'on' && arg !== 'off') return say(ctx,
      '🚫 Usage: *antisticker on* ya *antisticker off*');
    const st = readData(ANTI_FILE, {});
    if (arg === 'on') st[ctx.from] = true; else delete st[ctx.from];
    writeData(ANTI_FILE, st);
    await say(ctx, arg === 'on'
      ? '✅ Antisticker ON — ab stickers delete ho jayenge.'
      : '❌ Antisticker OFF — stickers allowed.');
  }),

  // ---- 8. once — view-once ko normal message ki tarah dobara bhejein ----
  once: safe(async (ctx, q) => {
    const quoted = quotedMessageOf(ctx.msg);
    if (!quoted) return say(ctx,
      '👁️ Usage: kisi *view-once* photo/video par reply kar ke *once* likhein.\n' +
      'Wo media normal message ki tarah dobara bhej diya jayega.');
    const inner = unwrapQuoted(quoted);
    const key = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage']
      .find((k) => inner && inner[k]);
    if (!key) return say(ctx, '⚠️ Reply kiye gaye message mein view-once media nahi mila.');
    await say(ctx, '⏳ Media nikal raha hoon...');
    try {
      const buffer = await downloadMediaMessage(
        { key: ctx.msg.key, message: { [key]: inner[key] } }, 'buffer', {}
      );
      if (!buffer || !buffer.length) throw new Error('empty');
      const cap = inner[key]?.caption || '👁️ View-once se save kiya gaya';
      if (key === 'imageMessage')
        await ctx.bot.sock.sendMessage(ctx.from, { image: buffer, caption: cap }, { quoted: ctx.msg });
      else if (key === 'videoMessage')
        await ctx.bot.sock.sendMessage(ctx.from, { video: buffer, caption: cap }, { quoted: ctx.msg });
      else if (key === 'audioMessage')
        await ctx.bot.sock.sendMessage(ctx.from, { audio: buffer, mimetype: inner[key]?.mimetype || 'audio/ogg; codecs=opus' }, { quoted: ctx.msg });
      else if (key === 'documentMessage')
        await ctx.bot.sock.sendMessage(ctx.from, { document: buffer, mimetype: inner[key]?.mimetype || 'application/octet-stream', fileName: inner[key]?.fileName || 'file' }, { quoted: ctx.msg });
      else
        await ctx.bot.sock.sendMessage(ctx.from, { sticker: buffer }, { quoted: ctx.msg });
    } catch { await say(ctx, '⚠️ View-once media download nahi ho saka. (Purane ya khud ke bheje view-once download nahi hote.)'); }
  }),
  see: 'once',
  reveal: 'once',
  saveonce: 'once',

  // ---- 9. save — media download + file info ----
  save: safe(async (ctx, q) => {
    const media = await getMediaBuffer(ctx.msg, 'image')
      || await getMediaBuffer(ctx.msg, 'video');
    if (!media) return say(ctx,
      '💾 Usage: kisi photo ya video par reply kar ke *save* likhein.\n' +
      'File bot mein save ho jayegi aur info mil jayegi.');
    try {
      fs.mkdirSync(SAVE_DIR, { recursive: true });
      const mt = (media.mimetype || '').toLowerCase();
      const ext = mt.includes('png') ? 'png' : mt.includes('webp') ? 'webp'
        : mt.includes('gif') ? 'gif' : mt.includes('mp4') ? 'mp4'
        : mt.includes('jpeg') || mt.includes('jpg') ? 'jpg' : 'bin';
      const kind = mt.startsWith('video') ? 'video' : 'image';
      const name = `save-${Date.now()}.${ext}`;
      fs.writeFileSync(path.join(SAVE_DIR, name), media.buffer);
      await say(ctx,
        `✅ Save ho gaya!\n📁 ${name}\n🗂️ ${kind} (${mt || 'unknown'})\n📦 ${mb(media.buffer.length)} MB`);
    } catch { await say(ctx, '⚠️ File save nahi ho saki.'); }
  }),
  sv: 'save',

  // ---- 10. vault — private notes ----
  vault: safe(async (ctx, q) => {
    const usage = '🗝️ Usage:\n' +
      '• *vault add <text>* — note save karein\n' +
      '• *vault list* — saare notes dekhein\n' +
      '• *vault get <n>* — note #n parhein\n' +
      '• *vault del <n>* — note #n delete karein';
    const parts = q.split(/\s+/).filter(Boolean);
    const sub = (parts[0] || '').toLowerCase();
    if (!['add', 'list', 'get', 'del'].includes(sub)) return say(ctx, usage);
    const store = readData(VAULT_FILE, {});
    const mine = Array.isArray(store[ctx.sender]) ? store[ctx.sender] : [];
    const persist = () => { store[ctx.sender] = mine; writeData(VAULT_FILE, store); };
    if (sub === 'add') {
      const text = parts.slice(1).join(' ').trim();
      if (!text) return say(ctx, '⚠️ Note ka text likhein.\nExample: *vault add kal 5 baje meeting hai*');
      if (text.length > 2000) return say(ctx, '⚠️ Note 2000 harf se chhota hona chahiye.');
      mine.push({ text, ts: Date.now() });
      persist();
      return say(ctx, `✅ Note #${mine.length} save ho gaya.`);
    }
    if (sub === 'list') {
      if (!mine.length) return say(ctx, '🗝️ Vault khaali hai.\n*vault add <text>* se pehla note save karein.');
      const lines = mine.map((n, i) => {
        const d = new Date(n.ts).toLocaleDateString('en-GB');
        const prev = String(n.text).replace(/\n/g, ' ').slice(0, 45);
        return `*#${i + 1}* (${d}) — ${prev}${n.text.length > 45 ? '…' : ''}`;
      });
      return say(ctx, `🗝️ Aapke notes (${mine.length}):\n\n${lines.join('\n')}\n\nParhne ke liye: *vault get <n>*`);
    }
    const n = parseInt(parts[1] || '', 10);
    if (!isFinite(n) || n < 1 || n > mine.length)
      return say(ctx, `⚠️ Sahi number likhein (1 se ${mine.length} tak).\n` + usage);
    if (sub === 'get') return say(ctx, `🗝️ Note #${n}:\n\n${mine[n - 1].text}`);
    mine.splice(n - 1, 1);
    persist();
    return say(ctx, `🗑️ Note #${n} delete ho gaya.`);
  }),
};

// ================= onMessage hooks =================
export async function onMessage(ctx) {
  try {
    if (ctx.msg?.key?.fromMe) return;

    // --- autosticker: incoming images -> stickers ---
    try {
      const st = readData(AUTO_FILE, {});
      if (st[ctx.from] && ctx.msg?.message?.imageMessage && !looksLikeCommand(ctx)) {
        const sharp = await getSharp();
        const media = sharp ? await mediaOf(ctx.msg, 'imageMessage') : null;
        if (media && sharp) {
          const webp = await sharp(media.buffer)
            .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 80 }).toBuffer();
          await ctx.bot.sock.sendMessage(ctx.from, { sticker: webp }, { quoted: ctx.msg });
        }
      }
    } catch (e) { console.error('[batch8b] autosticker hook:', e.message); }

    // --- antisticker: delete stickers in groups ---
    try {
      const st = readData(ANTI_FILE, {});
      if (ctx.isGroup && st[ctx.from] && ctx.msg?.message?.stickerMessage) {
        await ctx.bot.sock.sendMessage(ctx.from, { delete: ctx.msg.key }).catch(() => {});
      }
    } catch (e) { console.error('[batch8b] antisticker hook:', e.message); }
  } catch (e) { console.error('[batch8b] onMessage:', e.message); }
}

// ================= Menu / web registration =================
const MENU_SECTION = {
  title: 'Media Tools',
  commands: [
    { cmd: 'getdp', desc: 'Get profile picture (own, @user, or reply)' },
    { cmd: 'setdp', desc: 'Set bot profile picture (send with image)' },
    { cmd: 'toimg', desc: 'Convert sticker to PNG image (reply)' },
    { cmd: 'tourl', desc: 'Upload photo/video, get shareable link (reply)' },
    { cmd: 'collage', desc: '2x2 photo collage with 4 filters (reply)' },
    { cmd: 'autosticker', desc: 'Auto-convert chat photos to stickers (on/off)' },
    { cmd: 'antisticker', desc: 'Auto-delete stickers in group (admin, on/off)' },
    { cmd: 'once', desc: 'Resend view-once media as normal message (reply)' },
    { cmd: 'save', desc: 'Save photo/video to bot storage (reply)' },
    { cmd: 'vault', desc: 'Private notes: add / list / get / del' },
  ],
};
const WEB_COMMANDS = [];

registerBatch({ MENU_SECTION, WEB_COMMANDS, HANDLERS, onMessage });
