// Batch 7 — 39 more features: AI & Media Plus, Deen Plus, Group Admin Plus,
// More Tools, Business Plus, Fun Plus, Info Plus.
// Self-registers with batch-helpers.js via registerBatch() at load time.
import { registerBatch, readData, writeData, getMediaBuffer, isGroupAdmin, fmtNum, makeStateStore } from './batch-helpers.js';
import { askAI, callGemini, getApiKeys } from './ai.js';
import { Store } from './store.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomInt } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

const T = (ms = 15000) => AbortSignal.timeout(ms);
const say = (ctx, text) => ctx.bot.sendMessage(ctx.from, text);
const safe = (fn) => async (ctx, q) => {
  try { await fn(ctx, q || ''); }
  catch (e) { try { await say(ctx, '❌ Kuch garbar ho gayi: ' + (e.message || e)); } catch {} }
};
async function jget(url, headers = {}) {
  const { fetchJsonRetry } = await import('./api-helper.js');
  return await fetchJsonRetry(url, { timeout: 15000, retries: 2, headers });
}
async function fetchBin(url) {
  const r = await fetch(url, { signal: T(25000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 60 * 1024 * 1024) throw new Error('File bohat bara hai (60MB+).');
  return buf;
}
async function geocodeCity(city) {
  const d = await jget('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(city) + '&count=1');
  const g = d.results && d.results[0];
  if (!g) throw new Error('City nahi mili.');
  return { lat: g.latitude, lon: g.longitude, name: g.name + (g.country ? ', ' + g.country : '') };
}
let _sharp = null, _sharpTried = false;
async function getSharp() {
  if (!_sharpTried) { _sharpTried = true; try { _sharp = (await import('sharp')).default; } catch {} }
  return _sharp;
}
async function geminiVision(base64, mime, prompt) {
  if (!getApiKeys().length) throw new Error('AI key mojood nahi.');
  const { data } = await callGemini(':generateContent', {
    contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime || 'image/jpeg', data: base64 } }] }]
  }, { timeoutMs: 30000 });
  const t = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  if (!t.trim()) throw new Error('Text nahi mil saka.');
  return t.trim();
}

// ================= 1-8. AI & MEDIA =================

const memegen = safe(async (ctx, q) => {
  if (!q || !q.includes('|')) return say(ctx, '😂 *Meme Generator*\n\nPhoto ko reply karke likhein:\n*memegen <upper text> | <neeche text>*\n\nMisaal: memegen _jab bijli chali jaye_ | _aur UPS bhi jawab de jaye_');
  const m = await getMediaBuffer(ctx.msg, 'image');
  if (!m) return say(ctx, '⚠️ Pehle kisi photo ko *reply* karein, phir memegen likhein.');
  const sharp = await getSharp();
  if (!sharp) return say(ctx, '⚠️ Photo feature abhi unavailable hai.');
  const img = sharp(m.buffer);
  const meta = await img.metadata();
  const W = meta.width || 512, H = meta.height || 512;
  const [top, bottom] = q.split('|').map(s => s.trim().slice(0, 60));
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fs2 = Math.max(22, Math.round(W / 11));
  const line = (txt, y) => txt ? `<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="${fs2}" fill="white" stroke="black" stroke-width="${Math.max(2, fs2 / 12)}" paint-order="stroke">${esc(txt.toUpperCase())}</text>` : '';
  const svg = `<svg width="${W}" height="${H}">${line(top, fs2 + 14)}${line(bottom, H - 16)}</svg>`;
  const out = await img.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).jpeg().toBuffer();
  await ctx.bot.sock.sendMessage(ctx.from, { image: out, caption: '😂 *Meme tayyar!*' }, { quoted: ctx.msg });
});

const cartoon = safe(async (ctx, q) => {
  await ctx.bot.sendPresence(ctx.from, 'composing');
  const prompt = 'fun colorful cartoon style illustration of: ' + (q || 'a happy person');
  const url = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?width=768&height=768&nologo=true&seed=' + randomInt(999999);
  await ctx.bot.sock.sendMessage(ctx.from, { image: { url }, caption: '🎨 *Cartoon version tayyar!*' }, { quoted: ctx.msg });
});

const avatar = safe(async (ctx, q) => {
  const styles = { professional: 'professional corporate headshot', anime: 'anime style', sketch: 'pencil sketch style' };
  let styleKey = 'professional';
  let rest = q;
  const first = (q.split(/\s+/)[0] || '').toLowerCase();
  if (styles[first]) { styleKey = first; rest = q.slice(first.length).trim(); }
  if (!rest && !q) return say(ctx, '🧑‍🎨 *AI Avatar*\n\nLikhein: *avatar <professional|anime|sketch> <optional text>*\n\nMisaal: *avatar anime smiling boy*');
  await ctx.bot.sendPresence(ctx.from, 'composing');
  const prompt = styles[styleKey] + ' avatar portrait of ' + (rest || 'a smiling person') + ', centered, high quality';
  const url = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?width=768&height=768&nologo=true&seed=' + randomInt(999999);
  await ctx.bot.sock.sendMessage(ctx.from, { image: { url }, caption: `🧑‍🎨 *${styleKey} avatar tayyar!*` }, { quoted: ctx.msg });
});

const ocr = safe(async (ctx, q) => {
  const m = await getMediaBuffer(ctx.msg, 'image');
  if (!m) return say(ctx, '🔍 *OCR — Photo se Text*\n\nKisi photo ko *reply* karke *ocr* likhein.');
  await ctx.bot.sendPresence(ctx.from, 'composing');
  try {
    const text = await geminiVision(m.buffer.toString('base64'), m.mimetype, 'Extract ALL text visible in this image. Reply with only the extracted text, nothing else.');
    await say(ctx, '🔍 *Photo ka text:*\n\n' + text);
  } catch (e) { await say(ctx, '⚠️ Text nahi parh saka: ' + e.message); }
});

const imgtr = safe(async (ctx, q) => {
  const target = (q.split(/\s+/)[0] || 'ur').toLowerCase();
  const m = await getMediaBuffer(ctx.msg, 'image');
  if (!m) return say(ctx, '🌐 *Photo Text Translate*\n\nPhoto ko *reply* karke likhein:\n*imgtr <ur|en>*\n\nMisaal: *imgtr ur*');
  await ctx.bot.sendPresence(ctx.from, 'composing');
  try {
    const text = await geminiVision(m.buffer.toString('base64'), m.mimetype, 'Extract ALL text visible in this image. Reply with only the extracted text, nothing else.');
    const src = /[؀-ۿ]/.test(text) ? 'ur' : 'en';
    const d = await jget('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text.slice(0, 900)) + '&langpair=' + src + '|' + encodeURIComponent(target));
    const tr = d.responseData?.translatedText;
    if (!tr || /INVALID/i.test(tr)) throw new Error('translate nahi ho saka');
    await say(ctx, `🌐 *Translate (${target}):*\n\n${tr}\n\n_Original:_\n${text.slice(0, 500)}`);
  } catch (e) { await say(ctx, '⚠️ ' + e.message); }
});

const lyrics = safe(async (ctx, q) => {  if (!q || !q.includes('-')) return say(ctx, '🎤 *Lyrics Finder*\n\nLikhein: *lyrics <artist> - <title>*\n\nMisaal: *lyrics Atif Aslam - Tajdar e Haram*');
  const [artist, ...rest] = q.split('-');
  const title = rest.join('-').trim();
  if (!artist.trim() || !title) return say(ctx, '⚠️ Format: *lyrics <artist> - <title>*');
  await ctx.bot.sendPresence(ctx.from, 'composing');
  try {
    const d = await jget('https://api.lyrics.ovh/v1/' + encodeURIComponent(artist.trim()) + '/' + encodeURIComponent(title));
    if (!d.lyrics) throw new Error('Lyrics nahi mile.');
    await say(ctx, `🎤 *${artist.trim()} — ${title}*\n\n${d.lyrics.slice(0, 1500)}${d.lyrics.length > 1500 ? '\n\n_(mukhtasar)_' : ''}`);
  } catch (e) { await say(ctx, '⚠️ Lyrics nahi mile. Spelling check karke dobara try karein.'); }
});

const ytshorts = safe(async (ctx, q) => {
  if (!q) return say(ctx, '▶️ *YouTube Shorts Downloader*\n\nLikhein: *ytshorts <shorts link>*');
  if (!/youtu\.?be/i.test(q)) return say(ctx, '⚠️ Sirf YouTube link bhejein.');
  await ctx.bot.sendPresence(ctx.from, 'composing');
  await say(ctx, '⏳ Shorts download ho raha hai...');
  try {
    const { downloadVideo } = await import('./downloader.js');
    const res = await downloadVideo(q.trim());
    const vurl = res && (res.videoUrl || res.url);
    if (vurl && /\.(mp4|mov|webm)(\?|$)/i.test(vurl)) {
      const buf = await fetchBin(vurl);
      await ctx.bot.sock.sendMessage(ctx.from, { video: buf, caption: `▶️ *${res.title || 'YouTube Short'}*` }, { quoted: ctx.msg });
    } else if (vurl) {
      await say(ctx, `▶️ *${res.title || 'Short'}*\n\nDirect download: ${vurl}`);
    } else throw new Error('video URL nahi mila');
  } catch (e) { await say(ctx, '⚠️ Shorts download nahi ho saka: ' + e.message); }
});

// stickerpack: file-based queue in data/
const packKey = (ctx) => String(ctx.sender || 'anon').replace(/[^0-9a-z]/gi, '');
const packFiles = (ctx) => {
  const k = packKey(ctx);
  try {
    return fs.readdirSync(DATA_DIR).filter(f => f.startsWith('batch7-pack-' + k + '-')).map(f => path.join(DATA_DIR, f));
  } catch { return []; }
};
const stickerpack = safe(async (ctx, q) => {
  const sub = (q || '').toLowerCase().trim();
  if (sub === 'done') {
    const files = packFiles(ctx);
    if (!files.length) return say(ctx, '📦 Pack khaali hai. Pehle photos ko reply karke *stickerpack* likhein.');
    const { imageToSticker } = await import('./media.js');
    let n = 0;
    for (const f of files.slice(0, 5)) {
      try {
        const st = await imageToSticker(fs.readFileSync(f));
        await ctx.bot.sock.sendMessage(ctx.from, { sticker: st }, { quoted: ctx.msg });
        n++;
      } catch {}
    }
    for (const f of files) { try { fs.unlinkSync(f); } catch {} }
    return say(ctx, `📦 *${n} stickers bhej diye!* Pack clear ho gaya.`);
  }
  if (sub === 'clear') {
    const files = packFiles(ctx);
    for (const f of files) { try { fs.unlinkSync(f); } catch {} }
    return say(ctx, '🗑️ Pack clear kar diya.');
  }
  const m = await getMediaBuffer(ctx.msg, 'image');
  if (!m) return say(ctx, '📦 *Sticker Pack*\n\nPhoto ko *reply* karke *stickerpack* likhein (max 5).\nJab ho jaye: *stickerpack done*\nClear: *stickerpack clear*');
  const files = packFiles(ctx);
  if (files.length >= 5) return say(ctx, '⚠️ Pack full hai (5/5). *stickerpack done* likhein ya *stickerpack clear*.');
  fs.writeFileSync(path.join(DATA_DIR, `batch7-pack-${packKey(ctx)}-${Date.now()}.img`), m.buffer);
  await say(ctx, `✅ Sticker pack mein add ho gaya (${files.length + 1}/5).`);
});

// ================= 9-10. DEEN PLUS =================

const quransearch = safe(async (ctx, q) => {
  if (!q) return say(ctx, '📖 *Quran Search*\n\nLikhein: *quransearch <lafz>*\n\nMisaal: *quransearch mercy*');
  await ctx.bot.sendPresence(ctx.from, 'composing');
  try {
    const d = await jget('https://api.alquran.cloud/v1/search/' + encodeURIComponent(q.slice(0, 60)) + '/all/en');
    const matches = d.data?.matches || [];
    if (!matches.length) return say(ctx, '⚠️ Koi natija nahi mila.');
    let out = `📖 *Quran mein "${q}" — top ${Math.min(3, matches.length)}:*\n`;
    for (const m of matches.slice(0, 3)) {
      out += `\n*Surah ${m.surah.number}:${m.numberInSurah}* (${m.surah.englishName})\n${m.text.slice(0, 280)}\n`;
    }
    await say(ctx, out);
  } catch (e) { await say(ctx, '⚠️ Search nahi ho saki: ' + e.message); }
});

const prayermonth = safe(async (ctx, q) => {
  if (!q) return say(ctx, '🕌 *Monthly Namaz Times*\n\nLikhein: *prayermonth <city>*\n\nMisaal: *prayermonth Lahore*');
  await ctx.bot.sendPresence(ctx.from, 'composing');
  try {
    const g = await geocodeCity(q);
    const now = new Date();
    const d = await jget(`https://api.aladhan.com/v1/calendar/${now.getFullYear()}/${now.getMonth() + 1}?latitude=${g.lat}&longitude=${g.lon}&method=1`);
    const days = d.data || [];
    const today = now.getDate();
    let out = `🕌 *${g.name} — is mahine ke namaz auqaat:*\n\`Din  Fajr  Dhuhr  Asr   Magh  Isha\`\n`;
    for (const day of days) {
      const gd = parseInt(day.date?.gregorian?.day || '0');
      if (gd < today) continue;
      const t = day.timings || {};
      const f = (s) => String(s || '').slice(0, 5).padEnd(5);
      out += `\`${String(gd).padStart(2)}   ${f(t.Fajr)} ${f(t.Dhuhr)} ${f(t.Asr)} ${f(t.Maghrib)} ${f(t.Isha)}\`\n`;
      if (out.length > 3000) { out += '_(mukhtasar)_'; break; }
    }
    await say(ctx, out);
  } catch (e) { await say(ctx, '⚠️ ' + e.message); }
});

// ================= 11-16. GROUP ADMIN PLUS =================

const vkickState = makeStateStore(5 * 60 * 1000);
const votekick = safe(async (ctx, q) => {
  if (!ctx.isGroup) return say(ctx, '⚠️ Ye command sirf group mein kaam karta hai.');
  if (!await isGroupAdmin(ctx.bot.sock, ctx.from, ctx.sender)) return say(ctx, '⛔ Sirf group admin vote shuru kar sakta hai.');
  const mentioned = ctx.msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  let target = mentioned[0] || null;
  if (!target) {
    const num = (q.match(/\d{7,15}/) || [])[0];
    if (num) target = num + '@s.whatsapp.net';
  }
  if (!target) return say(ctx, '🗳️ *VoteKick*\n\nLikhein: *votekick @user*\n60 second mein 3 "votekick yes" votes par member remove hoga.');
  if (await isGroupAdmin(ctx.bot.sock, ctx.from, target)) return say(ctx, '⚠️ Admin ko vote se nahi nikal sakte.');
  const key = ctx.from;
  if (vkickState.get(key)) return say(ctx, '⚠️ Ek vote pehle se chal raha hai.');
  const st = { target, votes: new Set(), timer: null };
  st.timer = setTimeout(async () => {
    vkickState.del(key);
    const n = st.votes.size;
    if (n >= 3) {
      try {
        await ctx.bot.sock.groupParticipantsUpdate(ctx.from, [target], 'remove');
        await say(ctx, `🗳️ *Vote pass!* @${target.split('@')[0]} group se remove kar diya gaya. (${n} votes)`);
      } catch (e) { await say(ctx, '⚠️ Remove nahi ho saka — kya bot admin hai?'); }
    } else {
      await say(ctx, `🗳️ Vote khatam. Sirf ${n}/3 votes — member nahi nikala gaya.`);
    }
  }, 60000);
  if (st.timer.unref) st.timer.unref();
  vkickState.set(key, st);
  await say(ctx, `🗳️ *VoteKick shuru!*\n\nTarget: @${target.split('@')[0]}\n60 second mein *3* members *votekick yes* likhein.`);
});

const topactive = safe(async (ctx, q) => {
  if (!ctx.isGroup) return say(ctx, '⚠️ Ye command sirf group mein kaam karta hai.');
  let usage = {};
  try { usage = readData('batch4-usage.json', {}); } catch {}
  // defensive: support {userId:count} or {chats:{chatId:{userId:count}}} or {counts:{...}}
  let counts = usage;
  if (usage.chats && usage.chats[ctx.from]) counts = usage.chats[ctx.from];
  else if (usage.counts) counts = usage.counts;
  const entries = Object.entries(counts).filter(([k, v]) => typeof v === 'number');
  if (!entries.length) return say(ctx, '📊 Abhi koi activity record nahi. Thori baat cheet ke baad dobara dekhein.');
  entries.sort((a, b) => b[1] - a[1]);
  let out = '🏆 *Sab se active members:*\n';
  entries.slice(0, 10).forEach(([jid, c], i) => {
    out += `${i + 1}. @${String(jid).split('@')[0]} — ${fmtNum(c)} msgs\n`;
  });
  await say(ctx, out);
});

const needAdmin = async (ctx) => {
  if (!ctx.isGroup) { await say(ctx, '⚠️ Ye command sirf group mein kaam karta hai.'); return false; }
  if (!await isGroupAdmin(ctx.bot.sock, ctx.from, ctx.sender)) { await say(ctx, '⛔ Sirf group admin ye kar sakta hai.'); return false; }
  return true;
};

const groupicon = safe(async (ctx, q) => {
  if (!await needAdmin(ctx)) return;
  const m = await getMediaBuffer(ctx.msg, 'image');
  if (!m) return say(ctx, '🖼️ Photo ko *reply* karke *groupicon* likhein.');
  try {
    await ctx.bot.sock.updateProfilePicture(ctx.from, m.buffer);
    await say(ctx, '✅ Group icon change ho gaya!');
  } catch (e) { await say(ctx, '⚠️ Icon change nahi ho saka — kya bot admin hai?'); }
});

const groupdesc = safe(async (ctx, q) => {
  if (!q) return say(ctx, '📝 Likhein: *groupdesc <nayi description>*');
  if (!await needAdmin(ctx)) return;
  try {
    await ctx.bot.sock.groupUpdateDescription(ctx.from, q.slice(0, 500));
    await say(ctx, '✅ Group description update ho gayi!');
  } catch (e) { await say(ctx, '⚠️ Update nahi ho saki — kya bot admin hai?'); }
});

const grouplink = safe(async (ctx, q) => {
  if (!await needAdmin(ctx)) return;
  try {
    const code = await ctx.bot.sock.groupInviteCode(ctx.from);
    await say(ctx, `🔗 *Group invite link:*\nhttps://chat.whatsapp.com/${code}`);
  } catch (e) { await say(ctx, '⚠️ Link nahi mil saka — kya bot admin hai?'); }
});

const revokelink = safe(async (ctx, q) => {
  if (!await needAdmin(ctx)) return;
  try {
    const code = await ctx.bot.sock.groupRevokeInvite(ctx.from);
    await say(ctx, `🔄 *Purana link khatam! Naya link:*\nhttps://chat.whatsapp.com/${code}`);
  } catch (e) { await say(ctx, '⚠️ Reset nahi ho saka — kya bot admin hai?'); }
});

// ================= 17-26. MORE TOOLS =================

const whois = safe(async (ctx, q) => {
  if (!q) return say(ctx, '🌐 Likhein: *whois <domain>*\n\nMisaal: *whois google.com*');
  const dom = q.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  try {
    const r = await fetch('https://api.hackertarget.com/whois/?q=' + encodeURIComponent(dom), { signal: T() });
    const t = await r.text();
    await say(ctx, `🌐 *WHOIS: ${dom}*\n\n${t.slice(0, 1200)}`);
  } catch (e) { await say(ctx, '⚠️ Lookup nahi ho saka: ' + e.message); }
});

const dnslookup = safe(async (ctx, q) => {
  if (!q) return say(ctx, '🌐 Likhein: *dnslookup <domain>*\n\nMisaal: *dnslookup google.com*');
  const dom = q.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  try {
    const r = await fetch('https://api.hackertarget.com/dnslookup/?q=' + encodeURIComponent(dom), { signal: T() });
    const t = await r.text();
    await say(ctx, `🌐 *DNS: ${dom}*\n\n${t.slice(0, 1200)}`);
  } catch (e) { await say(ctx, '⚠️ Lookup nahi ho saka: ' + e.message); }
});

const iploc = safe(async (ctx, q) => {
  if (!q) return say(ctx, '📍 Likhein: *iploc <ip address>*\n\nMisaal: *iploc 8.8.8.8*');
  const ip = q.trim().split(/\s+/)[0];
  if (!/^[\d.:a-fA-F]+$/.test(ip)) return say(ctx, '⚠️ Valid IP likhein.');
  try {
    const d = await jget(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city,isp,query`);
    if (d.status !== 'success') throw new Error('IP nahi mili.');
    await say(ctx, `📍 *IP: ${d.query}*\n🌍 Country: ${d.country}\n🏙️ City: ${d.city}, ${d.regionName}\n🏢 ISP: ${d.isp}`);
  } catch (e) { await say(ctx, '⚠️ ' + e.message); }
});

const wifiqr = safe(async (ctx, q) => {
  if (!q || !q.includes('|')) return say(ctx, '📶 *WiFi QR*\n\nLikhein: *wifiqr <ssid> | <password> | <WPA|WEP|nopass>*\n\nMisaal: *wifiqr HomeWiFi | mypass123 | WPA*');
  const [ssid = '', pass = '', type = 'WPA'] = q.split('|').map(s => s.trim());
  if (!ssid) return say(ctx, '⚠️ WiFi ka naam (SSID) likhein.');
  const escW = s => s.replace(/([\\;,":])/g, '\\$1');
  const wifiStr = `WIFI:T:${type.toUpperCase()};S:${escW(ssid)};P:${escW(pass)};;`;
  const { default: QRCode } = await import('qrcode');
  const buf = await QRCode.toBuffer(wifiStr, { width: 512, margin: 2 });
  await ctx.bot.sock.sendMessage(ctx.from, { image: buf, caption: `📶 *${ssid}*\nScan karke WiFi connect karein!` }, { quoted: ctx.msg });
});

const random = safe(async (ctx, q) => {
  const parts = q.trim().split(/\s+/).map(Number);
  let min = 1, max = 100;
  if (parts.length >= 2 && parts.every(isFinite)) { min = Math.min(parts[0], parts[1]); max = Math.max(parts[0], parts[1]); }
  else if (parts.length === 1 && isFinite(parts[0])) { max = parts[0]; }
  if (!q) return say(ctx, '🎲 Likhein: *random <min> <max>*\n\nMisaal: *random 1 100*');
  const n = randomInt(Math.ceil(min), Math.floor(max) + 1);
  await say(ctx, `🎲 *Random number (${min}–${max}):* ${fmtNum(n)}`);
});

const choose = safe(async (ctx, q) => {
  if (!q || !q.includes('|')) return say(ctx, '🤔 Likhein: *choose <a> | <b> | <c>*\n\nMisaal: *choose chai | coffee | doodh*');
  const opts = q.split('|').map(s => s.trim()).filter(Boolean);
  const pick = opts[randomInt(opts.length)];
  await say(ctx, `🤔 *Mera faisla:* ${pick}`);
});

const countdown = safe(async (ctx, q) => {
  const m = q.match(/(\d{4}-\d{2}-\d{2})\s*(.*)/);
  if (!m) return say(ctx, '⏳ Likhein: *countdown <YYYY-MM-DD> <event>*\n\nMisaal: *countdown 2027-03-23 Eid ul Fitr*');
  const target = new Date(m[1] + 'T00:00:00');
  if (isNaN(target)) return say(ctx, '⚠️ Tareekh ka format: YYYY-MM-DD');
  const diff = target - Date.now();
  if (diff < 0) return say(ctx, '⏳ Ye tareekh guzar chuki hai!');
  const d = Math.floor(diff / 86400000), h = Math.floor(diff / 3600000) % 24, mi = Math.floor(diff / 60000) % 60;
  await say(ctx, `⏳ *${m[2] || 'Event'}* mein baaqi:\n\n📅 *${d} din*, ${h} ghante, ${mi} minute`);
});

const moon = safe(async (ctx, q) => {
  const synodic = 29.530588853;
  const known = Date.UTC(2000, 0, 6, 18, 14) / 86400000;
  const age = (((Date.now() / 86400000 - known) % synodic) + synodic) % synodic;
  const phases = ['New Moon 🌑', 'Waxing Crescent 🌒', 'First Quarter 🌓', 'Waxing Gibbous 🌔', 'Full Moon 🌕', 'Waning Gibbous 🌖', 'Last Quarter 🌗', 'Waning Crescent 🌘'];
  const idx = Math.floor(age / synodic * 8 + 0.5) % 8;
  const pct = Math.round(age / synodic * 100);
  await say(ctx, `🌙 *Aaj ka chand:* ${phases[idx]}\n\nCycle: ${pct}% mukammal`);
});

const MORSE = { a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.', ' ': '/', '.': '.-.-.-', ',': '--..--', '?': '..--..' };
const morse = safe(async (ctx, q) => {
  if (!q) return say(ctx, '📡 *Morse Code*\n\nEncode: *morse <text>*\nDecode: *morse -d <code>*');
  if (q.startsWith('-d ')) {
    const rev = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));
    const dec = q.slice(3).trim().split(/\s+/).map(c => rev[c] ?? '?').join('');
    return say(ctx, `📡 *Decoded:*\n${dec}`);
  }
  const enc = q.toLowerCase().split('').map(c => MORSE[c] ?? '').join(' ').replace(/\s+/g, ' ').trim();
  await say(ctx, `📡 *Morse:*\n${enc}`);
});

const FANCY_MAPS = (() => {
  const mk = (lo, hi, d0, d1) => {
    const m = {};
    for (let i = 0; i < 26; i++) {
      m[String.fromCharCode(97 + i)] = String.fromCodePoint(lo + i);
      m[String.fromCharCode(65 + i)] = String.fromCodePoint(hi + i);
    }
    for (let i = 0; i < 10; i++) m[String(i)] = String.fromCodePoint(d0 + i);
    return m;
  };
  return {
    1: mk(0x1D41A, 0x1D400, 0x1D7CE, 0), // bold — digits at 1D7CE (𝟎)
    2: mk(0x1D44E, 0x1D434, 0x30, 0),    // italic — keep digits normal
    3: mk(0x1D68A, 0x1D670, 0x1D7F6, 0), // monospace — digits at 1D7F6 (𝟶)
    4: (() => { const m = {}; for (let i = 0; i < 26; i++) { m[String.fromCharCode(97 + i)] = String.fromCodePoint(0x24D0 + i); m[String.fromCharCode(65 + i)] = String.fromCodePoint(0x24B6 + i); } for (let i = 0; i < 10; i++) m[String(i)] = String.fromCodePoint(0x2460 + i); return m; })(),
    5: (() => { const m = {}; for (let i = 0; i < 26; i++) { m[String.fromCharCode(97 + i)] = String.fromCodePoint(0xFF41 + i); m[String.fromCharCode(65 + i)] = String.fromCodePoint(0xFF21 + i); } for (let i = 0; i < 10; i++) m[String(i)] = String.fromCodePoint(0xFF10 + i); m[' '] = '　'; return m; })(),
  };
})();
const fancy = safe(async (ctx, q) => {
  const m = q.match(/^([1-5])\s+(.+)/s);
  if (!m) return say(ctx, '✨ *Stylish Text*\n\nLikhein: *fancy <1-5> <text>*\n\n1: 𝐁𝐨𝐥𝐝  2: 𝐼𝑡𝑎𝑙𝑖𝑐  3: 𝙼𝚘𝚗𝚘  4: Ⓢⓣⓨⓛⓔ  5: Ｆｕｌｌ');
  const map = FANCY_MAPS[m[1]];
  const out = [...m[2]].map(c => map[c] ?? c).join('');
  await say(ctx, `✨ ${out}`);
});

// ================= 27-34. BUSINESS PLUS =================

const quotation = safe(async (ctx, q) => {
  if (!q || !q.includes('|')) return say(ctx, '🧾 *Quotation Maker*\n\nLikhein:\n*quotation <client> | <item> <qty> <price> ; <item2> <qty> <price>*\n\nMisaal: *quotation Ahmed | paint 2 5000 ; brush 5 200*');
  const [client, ...itemParts] = q.split('|').map(s => s.trim());
  const items = itemParts.join('|').split(';').map(s => s.trim()).filter(Boolean);
  if (!client || !items.length) return say(ctx, '⚠️ Format: *quotation <client> | <item> <qty> <price> ; ...*');
  let total = 0, lines = [];
  for (const it of items) {
    const m = it.match(/^(.+?)\s+([\d.]+)\s+([\d.]+)$/);
    if (!m) continue;
    const amt = parseFloat(m[2]) * parseFloat(m[3]);
    total += amt;
    lines.push(`• ${m[1].trim()} × ${m[2]} @ ${fmtNum(m[3])} = *${fmtNum(amt)}*`);
  }
  if (!lines.length) return say(ctx, '⚠️ Items samajh nahi aaye. Format check karein.');
  const qno = 'QT-' + new Date().toISOString().slice(2, 10).replace(/-/g, '');
  await say(ctx, `🧾 *QUOTATION ${qno}*\nClient: ${client}\nDate: ${new Date().toLocaleDateString('en-PK')}\n\n${lines.join('\n')}\n\n*Total: Rs ${fmtNum(total)}*\n_Valid for 15 days._`);
});

const receipt = safe(async (ctx, q) => {
  if (!q || !q.includes('|')) return say(ctx, '🧾 *Payment Receipt*\n\nLikhein:\n*receipt <name> | <amount> | <note>*\n\nMisaal: *receipt Ahmed | 5000 | advance*');
  const [name, amtS, note = ''] = q.split('|').map(s => s.trim());
  const amt = parseFloat((amtS || '').replace(/,/g, ''));
  if (!name || !isFinite(amt)) return say(ctx, '⚠️ Format: *receipt <name> | <amount> | <note>*');
  const rno = 'R-' + Date.now().toString(36).toUpperCase();
  await say(ctx, `🧾 *PAYMENT RECEIPT*\nReceipt No: ${rno}\nDate: ${new Date().toLocaleDateString('en-PK')}\n\nReceived from: *${name}*\nAmount: *Rs ${fmtNum(amt)}*\nNote: ${note || '-'}\n\n_Shukriya!_`);
});

const stockmgr = safe(async (ctx, q) => {
  const d = readData('batch7-stock.json', { items: {} });
  const parts = q.trim().split(/\s+/);
  const sub = (parts[0] || '').toLowerCase();
  if (sub === 'add' && parts.length >= 3) {
    const qty = parseFloat(parts[parts.length - 1]);
    const item = parts.slice(1, -1).join(' ');
    if (!item || !isFinite(qty)) return say(ctx, '⚠️ Format: *stock add <item> <qty>*');
    d.items[item] = (d.items[item] || 0) + qty;
    writeData('batch7-stock.json', d);
    return say(ctx, `✅ *${item}*: stock ${fmtNum(d.items[item])}`);
  }
  if (sub === 'sell' && parts.length >= 3) {
    const qty = parseFloat(parts[parts.length - 1]);
    const item = parts.slice(1, -1).join(' ');
    const cur = d.items[item] || 0;
    if (!item || !isFinite(qty)) return say(ctx, '⚠️ Format: *stock sell <item> <qty>*');
    if (cur < qty) return say(ctx, `⚠️ Stock kam hai! *${item}*: sirf ${fmtNum(cur)} mojood.`);
    d.items[item] = cur - qty;
    writeData('batch7-stock.json', d);
    return say(ctx, `✅ Sold ${fmtNum(qty)} ${item}. Baqi: ${fmtNum(d.items[item])}`);
  }
  if (sub === 'low') {
    const low = Object.entries(d.items).filter(([, v]) => v < 5);
    if (!low.length) return say(ctx, '✅ Sab items ka stock theek hai.');
    return say(ctx, '⚠️ *Low stock (<5):*\n' + low.map(([k, v]) => `• ${k}: ${fmtNum(v)}`).join('\n'));
  }
  const entries = Object.entries(d.items);
  if (!entries.length) return say(ctx, '📦 *Stock Manager*\n\n*stock add <item> <qty>*\n*stock sell <item> <qty>*\n*stock list*\n*stock low*');
  await say(ctx, '📦 *Inventory:*\n' + entries.map(([k, v]) => `• ${k}: *${fmtNum(v)}*`).join('\n'));
});

const ledger = safe(async (ctx, q) => {
  const d = readData('batch7-ledger.json', { people: {} });
  const m = q.trim().match(/^(add|got)\s+(.+?)\s+([\d.,]+)\s*(.*)$/i);
  if (m) {
    const [, op, name, amtS, note] = m;
    const amt = parseFloat(amtS.replace(/,/g, ''));
    if (!name || !isFinite(amt)) return say(ctx, '⚠️ Format: *ledger add <naam> <amount>*');
    const p = d.people[name] = d.people[name] || { bal: 0, log: [] };
    p.bal += (op.toLowerCase() === 'add' ? amt : -amt);
    p.log.push({ t: Date.now(), op: op.toLowerCase(), amt, note: note || '' });
    writeData('batch7-ledger.json', d);
    return say(ctx, `${op.toLowerCase() === 'add' ? '📕 Udhaar' : '📗 Wusooli'}: *${name}* — Rs ${fmtNum(amt)}\n\n*Balance: Rs ${fmtNum(p.bal)}* ${p.bal > 0 ? '(dena hai)' : p.bal < 0 ? '(advance)' : '(clear ✅)'}`);
  }
  if (q.trim().toLowerCase() === 'list') {
    const entries = Object.entries(d.people);
    if (!entries.length) return say(ctx, '📕 Khata khaali hai.');
    return say(ctx, '📕 *Khata Book:*\n' + entries.map(([k, v]) => `• ${k}: *Rs ${fmtNum(v.bal)}*`).join('\n'));
  }
  const name = q.trim();
  if (!name) return say(ctx, '📕 *Udhaar Khata*\n\n*ledger add <naam> <amount> [note]* — udhaar\n*ledger got <naam> <amount>* — wusooli\n*ledger <naam>* — balance\n*ledger list*');
  const p = d.people[name];
  if (!p) return say(ctx, `⚠️ *${name}* ka khata nahi mila.`);
  await say(ctx, `📕 *${name}* — Balance: *Rs ${fmtNum(p.bal)}*\n\n` + p.log.slice(-5).reverse().map(e => `• ${e.op === 'add' ? '📕' : '📗'} Rs ${fmtNum(e.amt)} ${e.note}`).join('\n'));
});

const COINMAP = { btc: 'bitcoin', eth: 'ethereum', sol: 'solana', bnb: 'binancecoin', xrp: 'ripple', doge: 'dogecoin', ada: 'cardano', trx: 'tron', matic: 'matic-network', ltc: 'litecoin', dot: 'polkadot', link: 'chainlink' };
const folio = safe(async (ctx, q) => {
  const d = readData('batch7-misc.json', {});
  d.folio = d.folio || {};
  const m = q.trim().match(/^add\s+(\w+)\s+([\d.]+)\s+([\d.]+)/i);
  if (m) {
    const coin = m[1].toLowerCase(), qty = parseFloat(m[2]), buy = parseFloat(m[3]);
    const id = COINMAP[coin] || coin;
    if (!isFinite(qty) || !isFinite(buy)) return say(ctx, '⚠️ Format: *folio add <coin> <qty> <buy_usd>*');
    d.folio[id] = { coin, qty, buy };
    writeData('batch7-misc.json', d);
    return say(ctx, `✅ *${coin.toUpperCase()}* add: ${qty} @ $${buy}`);
  }
  if (q.trim().toLowerCase() === 'clear') { d.folio = {}; writeData('batch7-misc.json', d); return say(ctx, '🗑️ Portfolio clear.'); }
  const ids = Object.keys(d.folio);
  if (!ids.length) return say(ctx, '💰 *Crypto Portfolio*\n\n*folio add <coin> <qty> <buy_usd>*\n*folio value*\n*folio clear*\n\nMisaal: *folio add btc 0.01 60000*');
  try {
    const prices = await jget('https://api.coingecko.com/api/v3/simple/price?ids=' + ids.join(',') + '&vs_currencies=usd');
    let totalVal = 0, totalCost = 0, out = '💰 *Portfolio:*\n';
    for (const id of ids) {
      const f = d.folio[id];
      const px = prices[id]?.usd;
      if (!px) { out += `\n• ${f.coin.toUpperCase()}: price nahi mili\n`; continue; }
      const val = f.qty * px, cost = f.qty * f.buy;
      totalVal += val; totalCost += cost;
      const pl = val - cost, pct = cost ? (pl / cost * 100) : 0;
      out += `\n• *${f.coin.toUpperCase()}* ${f.qty} @ $${fmtNum(px)}\n  Value: $${fmtNum(val)} | ${pl >= 0 ? '🟢' : '🔴'} ${pct.toFixed(1)}%\n`;
    }
    const tpl = totalVal - totalCost;
    out += `\n*Total: $${fmtNum(totalVal)}* (${tpl >= 0 ? '+' : ''}$${fmtNum(tpl)})`;
    await say(ctx, out);
  } catch (e) { await say(ctx, '⚠️ Prices nahi mil saki: ' + e.message); }
});

const dietplan = safe(async (ctx, q) => {
  if (!q) return say(ctx, '🥗 Likhein: *dietplan <weight loss|muscle|general>*');
  await ctx.bot.sendPresence(ctx.from, 'composing');
  const out = await askAI(`Pakistani khano par mushtamil 7-day diet plan banao Roman Urdu mein, mukhtasar (nashta/dopeher/shaam): goal = ${q}. Roz ke calories ka andaza bhi do.`, ctx.senderName);
  await say(ctx, '🥗 *Diet Plan:*\n\n' + out);
});

const essay = safe(async (ctx, q) => {
  if (!q) return say(ctx, '📝 Likhein: *essay <topic>*\n\nMisaal: *essay my best friend*');
  await ctx.bot.sendPresence(ctx.from, 'composing');
  const out = await askAI(`Write a ~300 word English essay on "${q}" with introduction, 2-3 body paragraphs and conclusion. Then add a 2-line Roman Urdu summary at the end.`, ctx.senderName);
  await say(ctx, '📝 *Essay:*\n\n' + out);
});

const presentation = safe(async (ctx, q) => {
  if (!q) return say(ctx, '📊 Likhein: *presentation <topic>*\n\nMisaal: *presentation climate change*');
  await ctx.bot.sendPresence(ctx.from, 'composing');
  const out = await askAI(`Create an 8-slide presentation outline on "${q}". For each slide: title + 3-4 bullet points. English mein, concise.`, ctx.senderName);
  await say(ctx, '📊 *Presentation Outline:*\n\n' + out);
});

// ================= 35-37. FUN PLUS =================

const ANTAK_LINES = [
  'Tujhe dekha to ye jana sanam', 'Mere sapno ki rani kab aayegi tu', 'Chaiyya chaiyya chaiyya chaiyya',
  'Aankhein khuli ho ya ho band', 'Pehla nasha pehla khumar', 'Tum hi ho bandhu sakha tum hi ho',
  'Kal ho naa ho', 'Har ghadi badal rahi hai roop zindagi', 'Zindagi ek safar hai suhana',
  'Mere desh ki dharti sona ugle', 'Rang barse bheege chunar wali', 'Hothon se chhu lo tum',
  'Lag ja gale ke phir ye haseen raat', 'Ajeeb dastan hai ye', 'Ye dosti hum nahi todenge',
  'Shava shava', 'Mundian to bach ke rahin', 'Lungi dance thalaiva',
  'Jai ho', 'Maa tujhe salaam', 'Chak de India',
  'Dil chahta hai', 'Koi kahe kehta rahe', 'Badtameez dil',
  'Kar har maidan fateh', 'Apna time aayega', 'Zinda hai to pyala',
  'Ghar more pardesiya', 'Teri mitti mein mil jawan', 'Sandese aate hain',
  'Ae watan watan mere', 'Lehra do lehra do', 'Kar chale hum fida',
  'Vande mataram', 'Mile sur mera tumhara', 'Ek pyaar ka naghma hai',
  'Abhi na jao chhod kar', 'Kuch to log kahenge', 'Dum maro dum',
];
const antakState = makeStateStore(15 * 60 * 1000);
const lastAlpha = (s) => (s.toLowerCase().replace(/[^a-z]/g, '').slice(-1) || '');
const antakshari = safe(async (ctx, q) => {
  const key = ctx.from;
  if (!q) {
    const line = ANTAK_LINES[randomInt(ANTAK_LINES.length)];
    antakState.set(key, { last: line, score: 0, round: 1 });
    return say(ctx, `🎵 *Antakshari shuru!*\n\nMeri line:\n_"${line}"_\n\nAakhri lafz *"${lastAlpha(line)}"* se shuru hone wali line bhejein:\n*antakshari <aapki line>*`);
  }
  const st = antakState.get(key);
  if (!st) return say(ctx, '🎵 Pehle *antakshari* likh kar game shuru karein.');
  const need = lastAlpha(st.last);
  const got = (q.trim()[0] || '').toLowerCase();
  if (got !== need) return say(ctx, `⚠️ Line *"${need}"* se shuru honi chahiye! Dobara try karein.`);
  st.score++;
  const cands = ANTAK_LINES.filter(l => l[0].toLowerCase() === lastAlpha(q) && l !== st.last);
  const next = cands.length ? cands[randomInt(cands.length)] : ANTAK_LINES[randomInt(ANTAK_LINES.length)];
  st.last = next; st.round++;
  antakState.set(key, st);
  await say(ctx, `✅ Wah! Score: *${st.score}*\n\nMeri agli line:\n_"${next}"_\n\nAb *"${lastAlpha(next)}"* se line bhejein!`);
});

const WYR = [
  'Hamesha dhoop mein rehna ya hamesha barish mein?', 'Urdu mein baat karna ya English mein — sirf ek hamesha ke liye?',
  'Biryani roz khana ya kabhi biryani na khana?', 'Subah 5 baje uthna ya raat 3 baje sona?',
  'Amir hona ya mashhoor hona?', 'Paharon mein rehna ya samandar ke kinare?',
  'Waqt mein peeche jana ya mustaqbil dekhna?', 'Super taqat: urhna ya dimagh parhna?',
  'Chai ya coffee — sirf ek zindagi bhar?', 'Filmon mein hero banna ya real life mein hero?',
  'Duniya ghoomna ya ek jagah sukoon se rehna?', 'Bachon jaisi hansi ya buzurgon jaisa sukoon?',
  'Internet ke baghair ek mahina ya doston ke baghair?', 'Barf mein khelna ya dhoop mein nahana?',
  'Khana banana seekhna ya gaari chalana?', 'Sher se dosti ya hathi ki sawari?',
  'Chand par jana ya samandar ki teh mein?', 'Ek din ke liye badshah banna ya ek din ke liye invisible?',
  'Hamesha sach bolna ya hamesha khamosh rehna?', 'Neend mein khwab dekhna ya jaagte mein?',
];
const wyr = safe(async (ctx, q) => {
  await say(ctx, '🤔 *Would You Rather:*\n\n' + WYR[randomInt(WYR.length)]);
});

const NHIE = [
  'Never have I ever... raat ko chupke fridge khola ho 🙋', 'Never have I ever... exam mein cheating ki ho 🙋',
  'Never have I ever... jhoot bola ho ke "bas 5 minute mein aaya" 🙋', 'Never have I ever... barish mein bheega ho jaan boojh kar 🙋',
  'Never have I ever... ami ke paise churaye hon 🙋', 'Never have I ever... class mein so gaya hon 🙋',
  'Never have I ever... kisi ka birthday bhoola hon 🙋', 'Never have I ever... aaina dekh kar khud se baat ki ho 🙋',
  'Never have I ever... dusron ka khana kha liya ho 🙋', 'Never have I ever... jhoot bola ho "network nahi tha" 🙋',
  'Never have I ever... raat bhar jaaga hon 🙋', 'Never have I ever... kisi ko stalk kiya ho 🙋',
  'Never have I ever... ghalat number par I love you bhej diya ho 🙋', 'Never have I ever... khud ko Google kiya ho 🙋',
  'Never have I ever... train miss ki ho 🙋', 'Never have I ever... jhooti tareef ki ho 🙋',
];
const neverhave = safe(async (ctx, q) => {
  await say(ctx, NHIE[randomInt(NHIE.length)] + '\n\n_Jis ne kiya ho wo 🙋 bheje!_');
});

// ================= 38-39. INFO PLUS =================

const aqi = safe(async (ctx, q) => {
  if (!q) return say(ctx, '🌫️ Likhein: *aqi <city>*\n\nMisaal: *aqi Lahore*');
  try {
    const g = await geocodeCity(q);
    const d = await jget(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${g.lat}&longitude=${g.lon}&hourly=us_aqi`);
    const arr = d.hourly?.us_aqi || [];
    const nowH = new Date().getHours();
    const val = arr[Math.min(nowH, arr.length - 1)];
    if (val == null) throw new Error('data nahi mila');
    const cat = val <= 50 ? ['Good 🟢', 'Bilkul saaf hawa!'] : val <= 100 ? ['Moderate 🟡', 'Qabil-e-bardasht.'] : val <= 150 ? ['Unhealthy (sensitive) 🟠', 'Bache/buzurg ehtiyat karein.'] : val <= 200 ? ['Unhealthy 🔴', 'Bahir kam niklein, mask lagayein.'] : val <= 300 ? ['Very Unhealthy 🟣', 'Bahir nikalna avoid karein.'] : ['Hazardous 🟤', 'Ghar par rahein!'];
    await say(ctx, `🌫️ *AQI — ${g.name}*\n\nUS AQI: *${val}* — ${cat[0]}\n${cat[1]}`);
  } catch (e) { await say(ctx, '⚠️ ' + e.message); }
});

const uv = safe(async (ctx, q) => {
  if (!q) return say(ctx, '☀️ Likhein: *uv <city>*\n\nMisaal: *uv Karachi*');
  try {
    const g = await geocodeCity(q);
    const d = await jget(`https://api.open-meteo.com/v1/forecast?latitude=${g.lat}&longitude=${g.lon}&hourly=uv_index&forecast_days=1`);
    const arr = d.hourly?.uv_index || [];
    const nowH = new Date().getHours();
    const cur = arr[Math.min(nowH, arr.length - 1)] ?? 0;
    const max = Math.max(...arr);
    const advice = max >= 8 ? '🧴 Sunscreen zaroor lagayein, dhoop se bachein.' : max >= 6 ? '🧴 Dhoop tez hai, ehtiyat karein.' : max >= 3 ? '🕶️ Halki dhoop, theek hai.' : '🌤️ Dhoop halki hai.';
    await say(ctx, `☀️ *UV Index — ${g.name}*\n\nAbhi: *${cur}* | Aaj max: *${max}*\n${advice}`);
  } catch (e) { await say(ctx, '⚠️ ' + e.message); }
});

// ================= MENU / WEB / REGISTRY =================

export const MENU_SECTION =
`🤖 *22. AI & Media Plus*
• *memegen <top> | <bottom>* ➔ Custom meme (photo reply)
• *cartoon* ➔ Photo to cartoon (reply)
• *avatar <style>* ➔ AI avatar (reply)
• *ocr* ➔ Photo se text (reply)
• *imgtr <ur>* ➔ Photo text translate (reply)
• *lyrics <artist> - <title>* ➔ Song lyrics
• *ytshorts <link>* ➔ Shorts downloader
• *stickerpack* ➔ Sticker pack banayein (reply)

🕌 *23. Deen Plus*
• *quransearch <lafz>* ➔ Quran mein search
• *prayermonth <city>* ➔ Monthly namaz times

🛡️ *24. Group Admin Plus*
• *votekick @user* ➔ Vote to remove
• *topactive* ➔ Active members ranking
• *groupicon* ➔ Group icon badlein (reply)
• *groupdesc <text>* ➔ Description badlein
• *revokelink* ➔ Link reset karein
• *grouplink* ➔ Invite link

🧰 *25. More Tools*
• *whois <domain>* ➔ Domain info
• *dnslookup <domain>* ➔ DNS records
• *iploc <ip>* ➔ IP location
• *wifiqr <ssid> | <pass>* ➔ WiFi QR
• *random <1> <100>* ➔ Random number
• *choose <a> | <b>* ➔ Random pick
• *countdown <date> <event>* ➔ Countdown
• *moon* ➔ Aaj ka chand
• *morse <text>* ➔ Morse code
• *fancy <1-5> <text>* ➔ Stylish text

💼 *26. Business Plus*
• *quotation <client> | <item>* ➔ Quotation
• *receipt <name> | <amount>* ➔ Receipt
• *stock add <item> <qty>* ➔ Inventory
• *ledger add <naam> <amount>* ➔ Udhaar khata
• *folio add <coin> <qty>* ➔ Crypto portfolio
• *dietplan <goal>* ➔ Diet plan
• *essay <topic>* ➔ Essay writer
• *presentation <topic>* ➔ Slides outline

🎮 *27. Fun Plus*
• *antakshari* ➔ Song game
• *wyr* ➔ Would you rather
• *neverhave* ➔ Never have I ever

📡 *28. Info Plus*
• *aqi <city>* ➔ Air quality
• *uv <city>* ➔ UV index
`;

export const WEB_COMMANDS = [
  { cmd: '!memegen Top text | Bottom text', desc: 'Custom meme maker' },
  { cmd: '!cartoon', desc: 'Photo to cartoon' },
  { cmd: '!avatar anime', desc: 'AI avatar generator' },
  { cmd: '!ocr', desc: 'Photo se text nikalein' },
  { cmd: '!imgtr ur', desc: 'Photo text translate' },
  { cmd: '!lyrics Atif Aslam - Tajdar e Haram', desc: 'Song lyrics' },
  { cmd: '!ytshorts <link>', desc: 'YouTube Shorts downloader' },
  { cmd: '!stickerpack', desc: 'Sticker pack banayein' },
  { cmd: '!quransearch mercy', desc: 'Quran mein lafz search' },
  { cmd: '!prayermonth Lahore', desc: 'Monthly namaz timetable' },
  { cmd: '!votekick @user', desc: 'Vote to remove member' },
  { cmd: '!topactive', desc: 'Active members ranking' },
  { cmd: '!groupicon', desc: 'Group icon change (admin)' },
  { cmd: '!groupdesc New description', desc: 'Group description (admin)' },
  { cmd: '!grouplink', desc: 'Invite link (admin)' },
  { cmd: '!revokelink', desc: 'Reset invite link (admin)' },
  { cmd: '!whois google.com', desc: 'Domain info lookup' },
  { cmd: '!dnslookup google.com', desc: 'DNS records' },
  { cmd: '!iploc 8.8.8.8', desc: 'IP location' },
  { cmd: '!wifiqr HomeWiFi | mypass123 | WPA', desc: 'WiFi QR code' },
  { cmd: '!random 1 100', desc: 'Random number' },
  { cmd: '!choose chai | coffee', desc: 'Random choice' },
  { cmd: '!countdown 2027-03-23 Eid', desc: 'Date countdown' },
  { cmd: '!moon', desc: "Aaj ka chand" },
  { cmd: '!morse hello', desc: 'Morse code' },
  { cmd: '!fancy 1 hello', desc: 'Stylish text' },
  { cmd: '!quotation Ahmed | paint 2 5000', desc: 'Quotation maker' },
  { cmd: '!receipt Ahmed | 5000 | advance', desc: 'Payment receipt' },
  { cmd: '!stock add cement 50', desc: 'Inventory manager' },
  { cmd: '!ledger add Ahmed 5000', desc: 'Udhaar khata' },
  { cmd: '!folio add btc 0.01 60000', desc: 'Crypto portfolio' },
  { cmd: '!dietplan weight loss', desc: 'AI diet plan' },
  { cmd: '!essay my best friend', desc: 'Essay writer' },
  { cmd: '!presentation climate change', desc: 'Slides outline' },
  { cmd: '!antakshari', desc: 'Desi song game' },
  { cmd: '!wyr', desc: 'Would you rather' },
  { cmd: '!neverhave', desc: 'Never have I ever' },
  { cmd: '!aqi Lahore', desc: 'Air quality index' },
  { cmd: '!uv Karachi', desc: 'UV index' },
];

export const HANDLERS = {
  memegen, mememaker: 'memegen',
  cartoon, tocartoon: 'cartoon',
  avatar, aiavatar: 'avatar',
  ocr, readtext: 'ocr',
  imgtr, imagetranslate: 'imgtr',
  lyrics, geetlyrics: 'lyrics',
  ytshorts, shortsdl: 'ytshorts',
  stickerpack, spack: 'stickerpack',
  quransearch, qsearch: 'quransearch',
  prayermonth, namazmonth: 'prayermonth',
  votekick, vkick: 'votekick',
  topactive, activeboard: 'topactive',
  groupicon, gicon: 'groupicon',
  groupdesc, gdesc: 'groupdesc',
  grouplink, glink: 'grouplink',
  revokelink, revoke: 'revokelink',
  whois,
  dnslookup, dns: 'dnslookup',
  iploc, iplookup: 'iploc',
  wifiqr, wifishare: 'wifiqr',
  random, randnum: 'random',
  choose, pickone: 'choose',
  countdown, countto: 'countdown',
  moon, chand: 'moon',
  morse,
  fancy, stylish: 'fancy',
  quotation, qt: 'quotation',
  receipt, raseed: 'receipt',
  stockmgr, stock: 'stockmgr',
  ledger, khata: 'ledger',
  folio, portfolio: 'folio',
  dietplan, diet: 'dietplan',
  essay, mazmoon: 'essay',
  presentation, ppt: 'presentation',
  antakshari, antak: 'antakshari',
  wyr, wouldyourather: 'wyr',
  neverhave, nhie: 'neverhave',
  aqi, airquality: 'aqi',
  uv, uvindex: 'uv',
};

// onMessage: votekick vote collection (silent otherwise)
export async function onMessage(ctx) {
  try {
    const t = (ctx.text || '').trim().toLowerCase();
    if (t !== 'votekick yes' || !ctx.isGroup) return;
    const st = vkickState.get(ctx.from);
    if (!st) return;
    if (st.votes.has(ctx.sender)) return;
    st.votes.add(ctx.sender);
    vkickState.set(ctx.from, st);
    await ctx.bot.sendMessage(ctx.from, `🗳️ Vote: *${st.votes.size}/3*`);
  } catch {}
}

registerBatch({ MENU_SECTION, WEB_COMMANDS, HANDLERS, onMessage });
