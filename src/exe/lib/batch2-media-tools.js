// batch2-media-tools.js — Batch 2: Downloader Pro (14) + Daily Utilities (15) = 29 features.
// Self-registers with newfeatures.js. ESM only, no new npm deps.
import { registerBatch, readData, writeData, getMediaBuffer, fmtNum } from './batch-helpers.js';
import { execFileSync, execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

// ---- Environment probes (no network at import time) ----
let HAS_FFMPEG = false;
try { execSync('which ffmpeg', { stdio: 'ignore' }); HAS_FFMPEG = true; } catch {}

// ---- Tiny helpers ----
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
const T = (ms = 15000) => AbortSignal.timeout(ms);
const MAXW = 60 * 1024 * 1024; // WhatsApp media limit
const say = (ctx, t) => ctx.bot.sendMessage(ctx.from, String(t));
const safe = (fn) => async (ctx, query) => {
  try { await fn(ctx, (query || '').trim()); }
  catch (e) { try { await say(ctx, '⚠️ Kuch ghalat ho gaya, dobara try karein.'); } catch {} }
};

async function jget(url, headers = {}) {
  // Robust fetch with retry (2026-10-14 fix for flaky APIs)
  const { fetchJsonRetry } = await import('./api-helper.js');
  return await fetchJsonRetry(url, { timeout: 15000, retries: 2, headers });
}

async function fetchBin(url, headers = {}) {
  const r = await fetch(url, { signal: T(), headers: { ...UA, ...headers } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const len = Number(r.headers.get('content-length') || 0);
  if (len > MAXW) { const e = new Error('too-big'); e.tooBig = true; throw e; }
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAXW) { const e = new Error('too-big'); e.tooBig = true; throw e; }
  if (!buf.length) throw new Error('empty');
  return { buf, ctype: (r.headers.get('content-type') || '').toLowerCase() };
}

// Deep-search a JSON payload for the best direct media URL (video > audio > image).
function pickDirectUrl(json) {
  const cand = [];
  const walk = (o, d) => {
    if (!o || d > 5) return;
    if (typeof o === 'string') { if (/^https?:\/\//i.test(o)) cand.push(o); return; }
    if (Array.isArray(o)) { for (const v of o) walk(v, d + 1); return; }
    if (typeof o === 'object') {
      for (const k of ['download_url', 'downloadUrl', 'url', 'media_url', 'mediaUrl', 'video_url', 'videoUrl', 'video', 'audio_url', 'audioUrl', 'audio', 'image_url', 'imageUrl', 'image', 'src', 'link', 'file', 'stream_url', 'playback_url']) {
        if (typeof o[k] === 'string' && /^https?:\/\//i.test(o[k])) cand.push(o[k]);
      }
      for (const v of Object.values(o)) walk(v, d + 1);
    }
  };
  walk(json, 0);
  const uniq = [...new Set(cand)].map(u => u.replace(/\\\//g, '/'));
  const isV = (u) => /\.(mp4|mov|m4v)(\?|#|$)/i.test(u);
  const isA = (u) => /\.(mp3|m4a|ogg|wav|opus)(\?|#|$)/i.test(u);
  const isI = (u) => /\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(u);
  return uniq.find(isV) || uniq.find(isA) || uniq.find(isI) || null;
}

async function sendMediaUrl(ctx, url, caption = '') {
  const { buf, ctype } = await fetchBin(url);
  const isVideo = ctype.includes('video') || /\.(mp4|mov|m4v)(\?|#|$)/i.test(url);
  const isAudio = ctype.includes('audio') || /\.(mp3|m4a|ogg|wav|opus)(\?|#|$)/i.test(url);
  const isImage = ctype.includes('image') || /\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(url);
  if (isVideo) await ctx.bot.sock.sendMessage(ctx.from, { video: buf, caption }, { quoted: ctx.msg });
  else if (isAudio) await ctx.bot.sock.sendMessage(ctx.from, { audio: buf, mimetype: 'audio/mpeg' }, { quoted: ctx.msg });
  else if (isImage) await ctx.bot.sock.sendMessage(ctx.from, { image: buf, caption }, { quoted: ctx.msg });
  else await say(ctx, ('📎 ' + caption + '\n' + url).trim());
}

// Shared skeleton for the 5 URL downloaders.
async function genericDl(ctx, q, usage, label, fn) {
  if (!q) return say(ctx, usage);
  const url = q.split(/\s+/)[0];
  if (!/^https?:\/\//i.test(url)) return say(ctx, '⚠️ Sahi link bhejein.\n' + usage);
  await say(ctx, '⏳ ' + label + ' download ho raha hai...');
  try {
    const media = await fn(url);
    if (!media) return say(ctx, '⚠️ Download nahi ho saka, link check kar ke dobara try karein.');
    await sendMediaUrl(ctx, media, '✅ ' + label);
  } catch (e) {
    if (e && e.tooBig) return say(ctx, '⚠️ File 60MB se bari hai, direct link:\n' + url);
    return say(ctx, '⚠️ Download nahi ho saka, thori der baad try karein.');
  }
}

function tmpdir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'b2-')); }
function cleanTmp(d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch {} }
function runFfmpeg(args, timeoutMs = 90000) {
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...args], { stdio: 'ignore', timeout: timeoutMs });
}
function parseTs(s) {
  if (!s) return null;
  s = String(s).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  const p = s.split(':');
  if (p.length > 3 || p.some((x) => !/^\d+(\.\d+)?$/.test(x))) return null;
  let t = 0;
  for (const x of p) t = t * 60 + parseFloat(x);
  return t;
}
async function getSharp() {
  try { const { default: sharp } = await import('sharp'); return sharp; }
  catch { return null; }
}

// ---- Utilities data ----
function pkCarrier(local) {
  const n = parseInt(String(local).slice(0, 4), 10);
  if (n >= 300 && n <= 309) return 'Jazz (Mobilink)';
  if (n >= 310 && n <= 318) return 'Telenor';
  if (n >= 320 && n <= 327) return 'Jazz (Warid)';
  if (n >= 330 && n <= 337) return 'Ufone';
  if (n >= 340 && n <= 349) return 'Zong';
  return null;
}
const UNITS = {
  km: ['len', 1000], m: ['len', 1], cm: ['len', 0.01], mm: ['len', 0.001],
  mile: ['len', 1609.344], miles: ['len', 1609.344], ft: ['len', 0.3048], feet: ['len', 0.3048],
  inch: ['len', 0.0254], in: ['len', 0.0254], yard: ['len', 0.9144], yards: ['len', 0.9144],
  kg: ['wt', 1], g: ['wt', 0.001], gram: ['wt', 0.001], grams: ['wt', 0.001],
  lbs: ['wt', 0.45359237], lb: ['wt', 0.45359237], pound: ['wt', 0.45359237], pounds: ['wt', 0.45359237], ton: ['wt', 1000],
  liter: ['vol', 1], litre: ['vol', 1], l: ['vol', 1], ml: ['vol', 0.001],
  gallon: ['vol', 3.785411784], gallons: ['vol', 3.785411784],
  marla: ['area', 1], kanal: ['area', 20], acre: ['area', 160],
  c: ['temp'], celsius: ['temp'], f: ['temp'], fahrenheit: ['temp'], k: ['temp'], kelvin: ['temp'],
};
const TZCITY = {
  karachi: 'Asia/Karachi', lahore: 'Asia/Karachi', islamabad: 'Asia/Karachi',
  london: 'Europe/London', dubai: 'Asia/Dubai', newyork: 'America/New_York',
  toronto: 'America/Toronto', sydney: 'Australia/Sydney', tokyo: 'Asia/Tokyo',
  paris: 'Europe/Paris', berlin: 'Europe/Berlin', riyadh: 'Asia/Riyadh', jeddah: 'Asia/Riyadh',
  delhi: 'Asia/Kolkata', mumbai: 'Asia/Kolkata', dhaka: 'Asia/Dhaka',
  kathmandu: 'Asia/Kathmandu', singapore: 'Asia/Singapore', kualalumpur: 'Asia/Kuala_Lumpur',
  istanbul: 'Europe/Istanbul', losangeles: 'America/Los_Angeles', chicago: 'America/Chicago',
};
function parseTimeToken(s) {
  const m = String(s).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const mi = m[2] ? parseInt(m[2], 10) : 0;
  const ap = (m[3] || '').toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  if (h > 23 || mi > 59) return null;
  return { h, m: mi };
}
function resolveTz(s) {
  s = String(s).trim();
  let tz = s;
  if (!s.includes('/')) {
    tz = TZCITY[s.toLowerCase().replace(/[\s_]+/g, '')] || null;
    if (!tz) return null;
  }
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return tz; }
  catch { return null; }
}
function zonedToUtc(tz, y, mo, d, h, mi) {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const off = (ms) => {
    const p = Object.fromEntries(dtf.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
    const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second);
    return asUTC - ms;
  };
  let guess = Date.UTC(y, mo - 1, d, h, mi);
  for (let i = 0; i < 3; i++) guess = Date.UTC(y, mo - 1, d, h, mi) - off(guess);
  return guess;
}
// Minimal CSV parse (handles quoted commas/quotes) + stringify.
function parseCsv(text) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); rows.push(row); row = []; cur = '';
    } else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.length && !(r.length === 1 && r[0] === ''));
}
const csvEsc = (v) => { v = String(v ?? ''); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
function detectSrc(text) {
  const t = text.trim();
  if (!t) return 'txt';
  try { JSON.parse(t); return 'json'; } catch {}
  const first = t.split('\n').find((l) => l.trim());
  if (first && first.includes(',')) return 'csv';
  return 'txt';
}
function convertFile(text, src, tgt) {
  if (src === tgt) return null;
  if (src === 'txt' && tgt === 'json') return JSON.stringify({ lines: text.split('\n') }, null, 2);
  if (src === 'txt' && tgt === 'csv') return text.split('\n').map((l) => csvEsc(l)).join('\n');
  if (src === 'json' && tgt === 'txt') { try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return null; } }
  if (src === 'json' && tgt === 'csv') {
    try {
      const j = JSON.parse(text);
      const arr = Array.isArray(j) ? j : [j];
      if (!arr.length || typeof arr[0] !== 'object' || Array.isArray(arr[0])) return null;
      const heads = [...new Set(arr.flatMap((o) => Object.keys(o)))];
      return [heads.map(csvEsc).join(','), ...arr.map((o) => heads.map((h) => csvEsc(o[h])).join(','))].join('\n');
    } catch { return null; }
  }
  if (src === 'csv' && tgt === 'json') {
    const rows = parseCsv(text);
    if (rows.length < 2) return null;
    const heads = rows[0];
    return JSON.stringify(rows.slice(1).map((r) => Object.fromEntries(heads.map((h, i) => [h, r[i] ?? '']))), null, 2);
  }
  if (src === 'csv' && tgt === 'txt') {
    const rows = parseCsv(text);
    if (!rows.length) return null;
    return rows.map((r) => r.join(' | ')).join('\n');
  }
  return null;
}

// ================= HANDLERS =================
export const HANDLERS = {
  // ---- 1-6. Downloaders ----
  pindl: safe((ctx, q) => genericDl(ctx, q,
    '📌 Istemal: !pindl <pinterest link>', 'Pinterest',
    async (url) => pickDirectUrl(await jget('https://api.siputzx.my.id/api/d/pinterest?url=' + encodeURIComponent(url))))),

  redditdl: safe((ctx, q) => genericDl(ctx, q,
    '📌 Istemal: !redditdl <reddit post link>', 'Reddit',
    async (url) => {
      const api = url.split('?')[0].replace(/\/+$/, '') + '.json';
      const j = await jget(api);
      const d = j?.[0]?.data?.children?.[0]?.data;
      if (!d) return null;
      const v = d.secure_media?.reddit_video?.fallback_url || d.media?.reddit_video?.fallback_url;
      if (v) return v;
      if (d.url_overridden_by_destinations && /^https?:\/\//i.test(d.url_overridden_by_destinations)) return d.url_overridden_by_destinations;
      return pickDirectUrl(d);
    })),

  dmd: safe((ctx, q) => genericDl(ctx, q,
    '📌 Istemal: !dmd <dailymotion link>', 'Dailymotion',
    async (url) => {
      const m = url.match(/(?:dailymotion\.com\/(?:video|embed\/video)\/|dai\.ly\/)([a-zA-Z0-9]+)/);
      if (!m) throw new Error('bad url');
      const j = await jget('https://www.dailymotion.com/player/metadata/video/' + m[1]);
      const auto = j?.qualities?.auto;
      if (Array.isArray(auto) && auto[0]?.url) return auto[0].url;
      return pickDirectUrl(j);
    })),

  vimeodl: safe((ctx, q) => genericDl(ctx, q,
    '📌 Istemal: !vimeodl <vimeo link>', 'Vimeo',
    async (url) => {
      const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
      if (!m) throw new Error('bad url');
      const j = await jget('https://player.vimeo.com/video/' + m[1] + '/config');
      const prog = j?.request?.files?.progressive;
      if (Array.isArray(prog) && prog.length) {
        prog.sort((a, b) => (b.width || 0) - (a.width || 0));
        if (prog[0]?.url) return prog[0].url;
      }
      return pickDirectUrl(j);
    })),

  spotidl: safe(async (ctx, q) => {
    if (!q || !/spotify\.com/i.test(q)) return say(ctx, '🎵 Istemal: !spotidl <spotify track link>');
    const url = q.split(/\s+/)[0];
    await say(ctx, '⏳ Spotify MP3 download ho raha hai...');
    try {
      const j = await jget('https://api.siputzx.my.id/api/d/spotify?url=' + encodeURIComponent(url));
      const media = pickDirectUrl(j);
      if (!media) return say(ctx, '⚠️ Download nahi ho saka, link check kar ke dobara try karein.');
      const { buf } = await fetchBin(media);
      await ctx.bot.sock.sendMessage(ctx.from, { audio: buf, mimetype: 'audio/mpeg' }, { quoted: ctx.msg });
    } catch (e) {
      if (e && e.tooBig) return say(ctx, '⚠️ File 60MB se bari hai:\n' + url);
      return say(ctx, '⚠️ Download nahi ho saka, thori der baad try karein.');
    }
  }),
  spotify: 'spotidl',

  ytpl: safe(async (ctx, q) => {
    if (!q) return say(ctx, '🎶 Istemal: !ytpl <youtube playlist link>');
    const url = q.split(/\s+/)[0];
    if (!/^https?:\/\//i.test(url)) return say(ctx, '⚠️ Sahi playlist link bhejein.\n🎶 Istemal: !ytpl <youtube playlist link>');
    await say(ctx, '⏳ Playlist parh raha hoon...');
    let html = '';
    try {
      const r = await fetch(url, { signal: T(), headers: UA });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      html = await r.text();
    } catch { return say(ctx, '⚠️ Playlist nahi khul saki, link check karein.'); }
    const ids = [...new Set([...html.matchAll(/watch\?v=([\w-]{11})/g)].map((m) => m[1]))].slice(0, 3);
    if (!ids.length) return say(ctx, '⚠️ Playlist mein koi video nahi mili.');
    let mod;
    try { mod = await import('./downloader.js'); }
    catch { return say(ctx, '⚠️ Audio engine load nahi ho saka.'); }
    await say(ctx, `🎶 Playlist ke pehle ${ids.length} songs bhej raha hoon...`);
    for (const id of ids) {
      try {
        const a = await mod.downloadAudio('https://youtu.be/' + id);
        const au = a?.audioUrl || a?.url;
        const mt = a?.mimetype || 'audio/mpeg';
        if (a?.buffer) await ctx.bot.sock.sendMessage(ctx.from, { audio: a.buffer, mimetype: mt }, { quoted: ctx.msg });
        else if (au) await ctx.bot.sock.sendMessage(ctx.from, { audio: { url: au }, mimetype: mt }, { quoted: ctx.msg });
        else await say(ctx, '⚠️ Ek song download nahi ho saka, agla bhej raha hoon...');
      } catch { await say(ctx, '⚠️ Ek song download nahi ho saka, agla bhej raha hoon...'); }
    }
  }),

  // ---- 7-14. Media editing (reply to media) ----
  togif: safe(async (ctx, q) => {
    if (!HAS_FFMPEG) return say(ctx, '⚠️ GIF feature is waqt available nahi.');
    const m = await getMediaBuffer(ctx.msg, 'video');
    if (!m) return say(ctx, '🎬 Kisi video par reply kar ke !togif likhein.');
    await say(ctx, '⏳ GIF ban raha hai...');
    const d = tmpdir();
    try {
      const inp = path.join(d, 'in.mp4'), out = path.join(d, 'out.gif');
      fs.writeFileSync(inp, m.buffer);
      runFfmpeg(['-i', inp, '-t', '3', '-vf', 'fps=10,scale=320:-1:flags=lanczos', out]);
      const buf = fs.readFileSync(out);
      await ctx.bot.sock.sendMessage(ctx.from, { video: buf, gifPlayback: true, caption: '🎞 GIF tayyar!' }, { quoted: ctx.msg });
    } catch { await say(ctx, '⚠️ GIF nahi ban saka.'); }
    finally { cleanTmp(d); }
  }),
  gif: 'togif',

  photofx: safe(async (ctx, q) => {
    const fx = (q.split(/\s+/)[0] || '').toLowerCase();
    const m = await getMediaBuffer(ctx.msg, 'image');
    if (!m) return say(ctx, '🖼 Kisi photo par reply kar ke !photofx <filter> likhein.\nFilters: grey, sepia, blur, bright, invert');
    if (!['grey', 'sepia', 'blur', 'bright', 'invert'].includes(fx))
      return say(ctx, '🎨 Filter chunein: grey, sepia, blur, bright, invert\nMisaal: !photofx sepia');
    const sharp = await getSharp();
    if (!sharp) return say(ctx, '⚠️ Photo feature is waqt available nahi.');
    await say(ctx, '⏳ Filter lag raha hai...');
    try {
      let p = sharp(m.buffer);
      if (fx === 'grey') p = p.greyscale();
      else if (fx === 'sepia') p = p.recomb([[0.393, 0.769, 0.189], [0.349, 0.686, 0.168], [0.272, 0.534, 0.131]]);
      else if (fx === 'blur') p = p.blur(6);
      else if (fx === 'bright') p = p.modulate({ brightness: 1.5 });
      else if (fx === 'invert') p = p.negate();
      const buf = await p.jpeg({ quality: 85 }).toBuffer();
      await ctx.bot.sock.sendMessage(ctx.from, { image: buf, caption: `✨ Filter: ${fx}` }, { quoted: ctx.msg });
    } catch { await say(ctx, '⚠️ Photo process nahi ho saki.'); }
  }),
  fx: 'photofx',

  hdphoto: safe(async (ctx, q) => {
    const m = await getMediaBuffer(ctx.msg, 'image');
    if (!m) return say(ctx, '🖼 Kisi photo par reply kar ke !hdphoto likhein.');
    const sharp = await getSharp();
    if (!sharp) return say(ctx, '⚠️ Photo feature is waqt available nahi.');
    await say(ctx, '⏳ Photo enhance ho rahi hai...');
    try {
      const meta = await sharp(m.buffer).metadata();
      const w = Math.min((meta.width || 800) * 2, 4000);
      const buf = await sharp(m.buffer).resize({ width: w, withoutEnlargement: false }).sharpen().normalize().jpeg({ quality: 90 }).toBuffer();
      await ctx.bot.sock.sendMessage(ctx.from, { image: buf, caption: '✨ Enhanced! Quality behtar kar di.' }, { quoted: ctx.msg });
    } catch { await say(ctx, '⚠️ Enhance nahi ho saka.'); }
  }),
  enhance: 'hdphoto',

  shrinkphoto: safe(async (ctx, q) => {
    const m = await getMediaBuffer(ctx.msg, 'image');
    if (!m) return say(ctx, '🖼 Kisi photo par reply kar ke !shrinkphoto likhein.');
    const sharp = await getSharp();
    if (!sharp) return say(ctx, '⚠️ Photo feature is waqt available nahi.');
    try {
      const buf = await sharp(m.buffer).jpeg({ quality: 60 }).toBuffer();
      const kb = (b) => (b / 1024).toFixed(1);
      const saved = Math.max(0, Math.round((1 - buf.length / m.buffer.length) * 100));
      await ctx.bot.sock.sendMessage(ctx.from, { image: buf, caption: `📉 Compress ho gaya!\n${kb(m.buffer.length)} KB → ${kb(buf.length)} KB (${saved}% chhota)` }, { quoted: ctx.msg });
    } catch { await say(ctx, '⚠️ Compress nahi ho saka.'); }
  }),
  compress: 'shrinkphoto',

  shrinkvideo: safe(async (ctx, q) => {
    if (!HAS_FFMPEG) return say(ctx, '⚠️ Video compress is waqt available nahi.');
    const m = await getMediaBuffer(ctx.msg, 'video');
    if (!m) return say(ctx, '🎬 Kisi video par reply kar ke !shrinkvideo likhein.');
    await say(ctx, '⏳ Video compress ho rahi hai, thora wait karein...');
    const d = tmpdir();
    try {
      const inp = path.join(d, 'in.mp4'), out = path.join(d, 'out.mp4');
      fs.writeFileSync(inp, m.buffer);
      runFfmpeg(['-i', inp, '-crf', '28', '-preset', 'veryfast', '-vcodec', 'libx264', '-acodec', 'aac', out], 120000);
      const buf = fs.readFileSync(out);
      const mb = (b) => (b / 1048576).toFixed(1);
      await ctx.bot.sock.sendMessage(ctx.from, { video: buf, caption: `📉 Compress ho gaya!\n${mb(m.buffer.length)} MB → ${mb(buf.length)} MB` }, { quoted: ctx.msg });
    } catch { await say(ctx, '⚠️ Video compress nahi ho saki.'); }
    finally { cleanTmp(d); }
  }),
  vidcompress: 'shrinkvideo',

  trim: safe(async (ctx, q) => {
    if (!HAS_FFMPEG) return say(ctx, '⚠️ Audio trim is waqt available nahi.');
    const m = await getMediaBuffer(ctx.msg, 'audio');
    if (!m) return say(ctx, '🎵 Kisi audio par reply kar ke !trim <start-end> likhein.\nMisaal: !trim 0:10-0:30');
    const mm = q.match(/(\S+)\s*-\s*(\S+)/) || [];
    const s = parseTs(mm[1] || ''), e = parseTs(mm[2] || '');
    if (s == null || e == null || e <= s) return say(ctx, '⚠️ Format: !trim 0:10-0:30');
    await say(ctx, '⏳ Audio kaat raha hoon...');
    const d = tmpdir();
    try {
      const inp = path.join(d, 'in'), out = path.join(d, 'out.mp3');
      fs.writeFileSync(inp, m.buffer);
      runFfmpeg(['-ss', String(s), '-to', String(e), '-i', inp, '-c:a', 'libmp3lame', out]);
      const buf = fs.readFileSync(out);
      await ctx.bot.sock.sendMessage(ctx.from, { audio: buf, mimetype: 'audio/mpeg' }, { quoted: ctx.msg });
    } catch { await say(ctx, '⚠️ Audio trim nahi ho saka.'); }
    finally { cleanTmp(d); }
  }),
  cutaudio: 'trim',

  tez: safe(async (ctx, q) => {
    if (!HAS_FFMPEG) return say(ctx, '⚠️ Speed feature is waqt available nahi.');
    const m = await getMediaBuffer(ctx.msg, 'audio');
    if (!m) return say(ctx, '🎵 Kisi audio par reply kar ke !tez <0.5-2> likhein.\nMisaal: !tez 1.5');
    const r = parseFloat(q.split(/\s+/)[0] || '');
    if (!isFinite(r) || r < 0.5 || r > 2) return say(ctx, '⚠️ Speed 0.5 se 2 ke darmiyan likhein.\nMisaal: !tez 1.5');
    await say(ctx, '⏳ Speed change ho rahi hai...');
    const d = tmpdir();
    try {
      const inp = path.join(d, 'in'), out = path.join(d, 'out.mp3');
      fs.writeFileSync(inp, m.buffer);
      runFfmpeg(['-i', inp, '-filter:a', `atempo=${r}`, out]);
      const buf = fs.readFileSync(out);
      await ctx.bot.sock.sendMessage(ctx.from, { audio: buf, mimetype: 'audio/mpeg' }, { quoted: ctx.msg });
    } catch { await say(ctx, '⚠️ Speed change nahi ho saki.'); }
    finally { cleanTmp(d); }
  }),
  speedaudio: 'tez',

  ringtone: safe(async (ctx, q) => {
    if (!HAS_FFMPEG) return say(ctx, '⚠️ Ringtone feature is waqt available nahi.');
    const m = await getMediaBuffer(ctx.msg, 'audio');
    if (!m) return say(ctx, '🎵 Kisi audio par reply kar ke !ringtone <seconds> likhein.\nMisaal: !ringtone 30');
    let n = parseInt(q.split(/\s+/)[0] || '', 10);
    if (!isFinite(n) || n <= 0) n = 30;
    n = Math.min(n, 60);
    await say(ctx, '⏳ Ringtone ban raha hai...');
    const d = tmpdir();
    try {
      const inp = path.join(d, 'in'), out = path.join(d, 'out.mp3');
      fs.writeFileSync(inp, m.buffer);
      runFfmpeg(['-t', String(n), '-i', inp, '-c:a', 'libmp3lame', out]);
      const buf = fs.readFileSync(out);
      await ctx.bot.sock.sendMessage(ctx.from, { audio: buf, mimetype: 'audio/mpeg' }, { quoted: ctx.msg });
      await say(ctx, `📱 ${n} second ka ringtone tayyar!`);
    } catch { await say(ctx, '⚠️ Ringtone nahi ban saka.'); }
    finally { cleanTmp(d); }
  }),
  ring: 'ringtone',

  // ---- 15-29. Daily utilities ----
  qrscan: safe(async (ctx, q) => {
    const m = await getMediaBuffer(ctx.msg, 'image');
    if (!m) return say(ctx, '🔍 QR wali photo par reply kar ke !qrscan likhein.');
    await say(ctx, '⏳ QR scan ho raha hai...');
    try {
      const fd = new FormData();
      fd.append('file', new Blob([m.buffer], { type: 'image/png' }), 'qr.png');
      const r = await fetch('https://api.qrserver.com/v1/read-qr-code/', { method: 'POST', body: fd, signal: T() });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      const sym = j?.[0]?.symbol?.[0];
      if (sym?.data) await say(ctx, '✅ QR mein ye likha hai:\n\n' + sym.data);
      else await say(ctx, '⚠️ QR parha nahi ja saka.' + (sym?.error ? '\n(' + sym.error + ')' : ''));
    } catch { await say(ctx, '⚠️ QR scan nahi ho saka.'); }
  }),
  scanqr: 'qrscan',

  barcode: safe(async (ctx, q) => {
    if (!q) return say(ctx, '📊 Istemal: !barcode <text>\nMisaal: !barcode 03001234567');
    try {
      const { buf } = await fetchBin('https://barcode.tec-it.com/barcode.ashx?data=' + encodeURIComponent(q.slice(0, 60)) + '&code=Code128');
      await ctx.bot.sock.sendMessage(ctx.from, { image: buf, caption: `📊 Barcode: ${q.slice(0, 60)}` }, { quoted: ctx.msg });
    } catch { await say(ctx, '⚠️ Barcode nahi ban saka.'); }
  }),
  mkbarcode: 'barcode',

  passgen: safe(async (ctx, q) => {
    let n = parseInt(q.split(/\s+/)[0] || '', 10);
    if (!isFinite(n)) n = 16;
    n = Math.min(Math.max(n, 4), 64);
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_+=';
    let pw = '';
    for (let i = 0; i < n; i++) pw += chars[crypto.randomInt(chars.length)];
    await say(ctx, `🔑 Mazboot password (${n} harf):\n\`\`\`${pw}\`\`\`\n⚠️ Ye kisi ke saath share na karein.`);
  }),
  newpass: 'passgen',

  shorturl: safe(async (ctx, q) => {
    if (!q) return say(ctx, '🔗 Istemal: !shorturl <link>\nMisaal: !shorturl https://youtube.com/...');
    const url = q.split(/\s+/)[0];
    try {
      const r = await fetch('https://is.gd/create.php?format=simple&url=' + encodeURIComponent(url), { signal: T(), headers: UA });
      const t = (await r.text()).trim();
      if (!r.ok || /^error/i.test(t)) throw new Error(t);
      await say(ctx, '🔗 Chhota link:\n' + t);
    } catch { await say(ctx, '⚠️ Link chhota nahi ho saka.'); }
  }),
  tinyurl: 'shorturl',

  tempemail: safe(async (ctx, q) => {
    const a = q.split(/\s+/).filter(Boolean);
    const base = 'https://www.1secmail.com/api/v1/';
    if (a[0] === 'inbox' && a[1] && a[2]) {
      try {
        const j = await jget(`${base}?action=getMessages&login=${encodeURIComponent(a[1])}&domain=${encodeURIComponent(a[2])}`);
        if (!j || !j.length) return say(ctx, `📭 Inbox khaali hai (${a[1]}@${a[2]})`);
        const lines = j.slice(0, 10).map((m) => `• #${m.id} — ${m.from}\n  "${m.subject}" (${m.date})`).join('\n');
        await say(ctx, `📥 Inbox (${a[1]}@${a[2]}):\n${lines}\n\nParhne ke liye: !tempemail read ${a[1]} ${a[2]} <id>`);
      } catch { await say(ctx, '⚠️ Inbox nahi khul saka.'); }
      return;
    }
    if (a[0] === 'read' && a[1] && a[2] && a[3]) {
      try {
        const j = await jget(`${base}?action=readMessage&login=${encodeURIComponent(a[1])}&domain=${encodeURIComponent(a[2])}&id=${encodeURIComponent(a[3])}`);
        const body = (j.textBody || j.htmlBody || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500);
        await say(ctx, `✉️ ${j.subject || '(no subject)'}\nFrom: ${j.from || ''}\n\n${body || '(khaali)'}`);
      } catch { await say(ctx, '⚠️ Email nahi khul saka.'); }
      return;
    }
    try {
      const j = await jget(base + '?action=genRandomMailbox&login=&domain=');
      const addr = String(Array.isArray(j) ? j[0] : j || '');
      if (!addr.includes('@')) throw new Error('no addr');
      const [login, domain] = addr.split('@');
      await say(ctx, `📧 Temp email tayyar:\n${addr}\n\n📥 Inbox dekhne ke liye:\n!tempemail inbox ${login} ${domain}`);
    } catch { await say(ctx, '⚠️ Temp email nahi ban saka.'); }
  }),
  fakemail: 'tempemail',

  numinfo: safe(async (ctx, q) => {
    if (!q) return say(ctx, '📱 Istemal: !numinfo <number>\nMisaal: !numinfo 03001234567');
    const d = q.replace(/\D/g, '');
    if (d.length < 10) return say(ctx, '⚠️ Sahi number likhein. Misaal: !numinfo 03001234567');
    let local = d;
    if (d.startsWith('92') && d.length >= 12) local = '0' + d.slice(2);
    const car = pkCarrier(local);
    await say(ctx, `📱 Number: ${q}\n🌍 Mulk: Pakistan\n📶 Carrier: ${car || 'Maloom nahi'}\n📞 Type: Mobile`);
  }),
  siminfo: 'numinfo',

  websnap: safe(async (ctx, q) => {
    if (!q) return say(ctx, '📸 Istemal: !websnap <website>\nMisaal: !websnap google.com');
    let u = q.split(/\s+/)[0];
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    await say(ctx, '⏳ Screenshot le raha hoon...');
    try {
      const { buf } = await fetchBin('https://image.thum.io/get/width/800/crop/600/noanimate/' + u);
      await ctx.bot.sock.sendMessage(ctx.from, { image: buf, caption: `📸 ${u}` }, { quoted: ctx.msg });
    } catch { await say(ctx, '⚠️ Screenshot nahi le saka.'); }
  }),
  sitepic: 'websnap',

  sitedown: safe(async (ctx, q) => {
    if (!q) return say(ctx, '🌐 Istemal: !sitedown <website>\nMisaal: !sitedown google.com');
    let u = q.split(/\s+/)[0];
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    const t0 = Date.now();
    try {
      const r = await fetch(u, { signal: T(10000), headers: UA, redirect: 'follow' });
      const ms = Date.now() - t0;
      if (r.ok) await say(ctx, `🟢 UP — ${u}\n⚡ ${ms}ms mein jawab mila (HTTP ${r.status})`);
      else await say(ctx, `🔴 DOWN — ${u}\nHTTP ${r.status} (${ms}ms)`);
    } catch (e) {
      const why = e && e.name === 'AbortError' ? 'timeout (10s)' : (e?.message || 'error');
      await say(ctx, `🔴 DOWN — ${u}\nWajah: ${why}`);
    }
  }),
  isdown: 'sitedown',

  unitconv: safe(async (ctx, q) => {
    const m = q.match(/^([\d.]+)\s+([a-zA-Z]+)\s+([a-zA-Z]+)$/);
    if (!m) return say(ctx, '📏 Istemal: !unitconv <number> <from> <to>\nMisaal: !unitconv 5 km miles\nUnits: km, miles, m, cm, inch, ft | kg, g, lbs | c, f, k | liter, gallon, ml | marla, kanal, acre');
    const val = parseFloat(m[1]), f = m[2].toLowerCase(), t = m[3].toLowerCase();
    const uf = UNITS[f], ut = UNITS[t];
    if (!uf || !ut || uf[0] !== ut[0]) return say(ctx, '⚠️ Ye units convert nahi ho saktin. List upar dekhein.');
    let res;
    if (uf[0] === 'temp') {
      const c = f[0] === 'c' ? val : f[0] === 'f' ? (val - 32) * 5 / 9 : val - 273.15;
      res = t[0] === 'c' ? c : t[0] === 'f' ? c * 9 / 5 + 32 : c + 273.15;
    } else res = val * uf[1] / ut[1];
    await say(ctx, `📏 ${fmtNum(val)} ${f} = ${fmtNum(res)} ${t}`);
  }),
  convert: 'unitconv',

  currency: safe(async (ctx, q) => {
    const a = q.split(/\s+/).filter(Boolean);
    if (!a.length) return say(ctx, '💱 Istemal: !currency <amount> <from> <to>\nMisaal: !currency 100 usd pkr');
    const amt = parseFloat(a[0]);
    if (!isFinite(amt)) return say(ctx, '⚠️ Pehle raqam likhein. Misaal: !currency 100 usd pkr');
    const from = (a[1] || 'USD').toUpperCase(), to = (a[2] || 'PKR').toUpperCase();
    try {
      const j = await jget('https://open.er-api.com/v6/latest/' + from);
      const rate = j?.rates?.[to];
      if (!isFinite(rate)) throw new Error('no rate');
      await say(ctx, `💱 ${fmtNum(amt)} ${from} = ${fmtNum(amt * rate)} ${to}\n(1 ${from} = ${fmtNum(rate)} ${to})`);
    } catch { await say(ctx, '⚠️ Rate nahi mil saka, thori der baad try karein.'); }
  }),
  pkrate: 'currency',

  timeconv: safe(async (ctx, q) => {
    const a = q.split(/\s+/).filter(Boolean);
    if (a.length < 3) return say(ctx, '🕐 Istemal: !timeconv <time> <from> <to>\nMisaal: !timeconv 15:00 karachi london\nMisaal: !timeconv 3pm Asia/Karachi Europe/London');
    const tm = parseTimeToken(a[0]);
    if (!tm) return say(ctx, '⚠️ Time samajh nahi aaya. Misaal: 15:00 ya 3pm');
    const fz = resolveTz(a[1]), tz = resolveTz(a[2]);
    if (!fz || !tz) return say(ctx, '⚠️ Timezone samajh nahi aaya. Misaal: karachi, london, dubai ya Asia/Karachi');
    try {
      const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: fz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const [y, mo, d] = ymd.split('-').map(Number);
      const utcMs = zonedToUtc(fz, y, mo, d, tm.h, tm.m);
      const fmt = (tzx) => new Intl.DateTimeFormat('en-GB', { timeZone: tzx, weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(utcMs));
      await say(ctx, `🕐 ${fmt(fz)} (${a[1]})\n➡️ ${fmt(tz)} (${a[2]})`);
    } catch { await say(ctx, '⚠️ Time convert nahi ho saka.'); }
  }),
  timezone: 'timeconv',

  bmi: safe(async (ctx, q) => {
    const a = q.split(/\s+/).map(Number);
    if (a.length < 2 || !isFinite(a[0]) || !isFinite(a[1]) || a[0] <= 0 || a[1] <= 0)
      return say(ctx, '⚖️ Istemal: !bmi <wazan kg> <qad cm>\nMisaal: !bmi 70 175');
    const bmi = a[0] / Math.pow(a[1] / 100, 2);
    const cat = bmi < 18.5 ? '📉 Kamzor (underweight)' : bmi < 25 ? '✅ Bilkul fit (normal)' : bmi < 30 ? '⚠️ Wazan zyada (overweight)' : '🔴 Motapa (obese)';
    await say(ctx, `⚖️ BMI: ${bmi.toFixed(1)}\n${cat}`);
  }),

  age: safe(async (ctx, q) => {
    const m = q.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return say(ctx, '🎂 Istemal: !age <YYYY-MM-DD>\nMisaal: !age 2000-05-12');
    const bd = new Date(+m[1], +m[2] - 1, +m[3]);
    if (isNaN(bd) || bd.getFullYear() !== +m[1] || bd.getMonth() !== +m[2] - 1 || bd.getDate() !== +m[3])
      return say(ctx, '⚠️ Sahi tareekh likhein. Misaal: !age 2000-05-12');
    const now = new Date();
    if (bd > now) return say(ctx, '⚠️ Ye tareekh to mustaqbil ki hai! 😄');
    let y = now.getFullYear() - bd.getFullYear(), mo = now.getMonth() - bd.getMonth(), d = now.getDate() - bd.getDate();
    if (d < 0) { mo--; d += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
    if (mo < 0) { y--; mo += 12; }
    let nb = new Date(now.getFullYear(), bd.getMonth(), bd.getDate());
    if (nb <= now) nb = new Date(now.getFullYear() + 1, bd.getMonth(), bd.getDate());
    const daysTo = Math.ceil((nb - now) / 86400000);
    await say(ctx, `🎂 Umar: ${y} saal, ${mo} mahine, ${d} din\n🎉 Agli birthday mein ${daysTo} din baqi!`);
  }),
  agecalc: 'age',

  emi: safe(async (ctx, q) => {
    const a = q.split(/\s+/).map(Number);
    if (a.length < 3 || a.some((x) => !isFinite(x)) || a[0] <= 0 || a[2] <= 0)
      return say(ctx, '🏦 Istemal: !emi <raqam> <salanah %> <mahine>\nMisaal: !emi 500000 18 24');
    const [P, annual, n] = a, r = annual / 1200;
    const emi = r === 0 ? P / n : P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
    const total = emi * n, interest = total - P;
    await say(ctx, `🏦 Mahana qist (EMI): ${fmtNum(Math.round(emi))}\n💰 Kul wapas: ${fmtNum(Math.round(total))}\n📈 Kul sood: ${fmtNum(Math.round(interest))}\n(${n} mahine, ${annual}% salana)`);
  }),
  emicalc: 'emi',

  fileconv: safe(async (ctx, q) => {
    const t = (q.split(/\s+/)[0] || '').toLowerCase();
    if (!['txt', 'json', 'csv'].includes(t)) return say(ctx, '📄 Kisi file par reply kar ke likhein:\n!fileconv txt | json | csv');
    const m = await getMediaBuffer(ctx.msg, 'document');
    if (!m) return say(ctx, '📄 Kisi .txt/.json/.csv file par reply kar ke !fileconv <txt|json|csv> likhein.');
    try {
      const text = m.buffer.toString('utf-8');
      if (text.length > 500000) return say(ctx, '⚠️ File bohat bari hai (500KB se kam honi chahiye).');
      const out = convertFile(text, detectSrc(text), t);
      if (!out) return say(ctx, '⚠️ Convert nahi ho saka. File ka format check karein.');
      const mime = t === 'json' ? 'application/json' : t === 'csv' ? 'text/csv' : 'text/plain';
      await ctx.bot.sock.sendMessage(ctx.from, { document: Buffer.from(out, 'utf-8'), mimetype: mime, fileName: `converted.${t}` }, { quoted: ctx.msg });
    } catch { await say(ctx, '⚠️ File convert nahi ho saki.'); }
  }),
  convertfile: 'fileconv',
};

export const MENU_SECTION = `📥 *12. Downloader Pro*
• *pindl <link>* ➔ Pinterest video/photo
• *redditdl <link>* ➔ Reddit video/photo
• *dmd <link>* ➔ Dailymotion video
• *vimeodl <link>* ➔ Vimeo video
• *spotidl <link>* ➔ Spotify MP3
• *ytpl <link>* ➔ Playlist ke pehle 3 songs
• *togif* ➔ Video se GIF (reply karein)
• *photofx <grey|sepia|blur>* ➔ Photo filters (reply)
• *hdphoto* ➔ Photo enhance 2x (reply)
• *shrinkphoto* ➔ Photo compress (reply)
• *shrinkvideo* ➔ Video compress (reply)
• *trim <0:10-0:30>* ➔ Audio kaat lein (reply)
• *tez <0.5-2>* ➔ Audio speed (reply)
• *ringtone <sec>* ➔ Ringtone banayein (reply)

🧰 *13. Daily Utilities*
• *qrscan* ➔ QR photo scan (reply)
• *barcode <text>* ➔ Barcode image
• *passgen <len>* ➔ Strong password
• *shorturl <link>* ➔ Chhota link
• *tempemail* ➔ Free temp email + inbox
• *numinfo <number>* ➔ SIM carrier maloom karein
• *websnap <url>* ➔ Website ka screenshot
• *sitedown <url>* ➔ Site up ya down?
• *unitconv <5 km miles>* ➔ Unit converter
• *currency <100 usd pkr>* ➔ Currency rates
• *timeconv <3pm Karachi London>* ➔ Time zone
• *bmi <70 175>* ➔ BMI calculator
• *age <2000-05-12>* ➔ Umar calculator
• *emi <500000 18 24>* ➔ Loan EMI
• *fileconv <txt|json|csv>* ➔ File convert (reply)`;

export const WEB_COMMANDS = [
  { cmd: '!pindl <link>', desc: 'Pinterest video/photo downloader' },
  { cmd: '!redditdl <link>', desc: 'Reddit video/photo downloader' },
  { cmd: '!dmd <link>', desc: 'Dailymotion video downloader' },
  { cmd: '!vimeodl <link>', desc: 'Vimeo video downloader' },
  { cmd: '!spotidl <link>', desc: 'Spotify MP3 downloader' },
  { cmd: '!ytpl <link>', desc: 'Playlist ke pehle 3 songs' },
  { cmd: '!togif', desc: 'Video se GIF banayein (reply)' },
  { cmd: '!photofx <filter>', desc: 'Photo filters — grey, sepia, blur, bright, invert (reply)' },
  { cmd: '!hdphoto', desc: 'Photo enhance 2x quality (reply)' },
  { cmd: '!shrinkphoto', desc: 'Photo compress, size kam karein (reply)' },
  { cmd: '!shrinkvideo', desc: 'Video compress, size kam karein (reply)' },
  { cmd: '!trim <start-end>', desc: 'Audio ka hissa kaat lein (reply)' },
  { cmd: '!tez <0.5-2>', desc: 'Audio ki speed change karein (reply)' },
  { cmd: '!ringtone <sec>', desc: 'Audio se ringtone banayein (reply)' },
  { cmd: '!qrscan', desc: 'QR code photo scan karein (reply)' },
  { cmd: '!barcode <text>', desc: 'Text se barcode image banayein' },
  { cmd: '!passgen <len>', desc: 'Mazboot random password' },
  { cmd: '!shorturl <link>', desc: 'Lamba link chhota karein' },
  { cmd: '!tempemail', desc: 'Free temporary email + inbox' },
  { cmd: '!numinfo <number>', desc: 'Pakistani SIM ka carrier maloom karein' },
  { cmd: '!websnap <url>', desc: 'Kisi website ka screenshot' },
  { cmd: '!sitedown <url>', desc: 'Website up hai ya down?' },
  { cmd: '!unitconv <5 km miles>', desc: 'Unit converter (lambai, wazan, garmi...)' },
  { cmd: '!currency <100 usd pkr>', desc: 'Live currency converter' },
  { cmd: '!timeconv <3pm Karachi London>', desc: 'Time zone converter' },
  { cmd: '!bmi <70 175>', desc: 'BMI calculator' },
  { cmd: '!age <2000-05-12>', desc: 'Umar calculator' },
  { cmd: '!emi <500000 18 24>', desc: 'Loan EMI calculator' },
  { cmd: '!fileconv <txt|json|csv>', desc: 'txt/json/csv file convert (reply)' },
];

registerBatch({ MENU_SECTION, WEB_COMMANDS, HANDLERS });
