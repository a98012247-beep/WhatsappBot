// ============================================================================
// AwaisxBot — BATCH 4: Group Control + Automation (HOSTING PATCH / new features)
// ESM only. No new npm deps. No network at import.
// Self-registers via registerBatch() from ./newfeatures.js
// ============================================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerBatch, readData, writeData, isGroupAdmin, isBotAdmin } from './batch-helpers.js';
import { groupFeatureOn, isSilent } from './access.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch { /* ignore */ }

const GROUPS_FILE = 'batch4-groups.json';   // per-group settings + stats + lastseen
const AUTO_FILE   = 'batch4-auto.json';     // rss, keyword, fwd, rmsgs, bday, afk
const USAGE_FILE  = 'batch4-usage.json';    // { userId: count }
const PERSONA_FILE = 'batch-persona.json';  // { chatId: styleKey }

const LINK_RE = /(chat\.whatsapp\.com|wa\.me\/|t\.me\/|https?:\/\/)/i;

// Promotion detection patterns (2026-10-17 per Hudson)
const PROMO_RE = /(dm\s*(me|for|now)|buy\s*(now|from|me)|order\s*now|limited\s*(offer|deal|time)|discount|promo\s*code|click\s*(here|link|below)|whatsapp\s*me|contact\s*me|sale\s*(now|!)|offer\s*(ends|valid)|free\s*(delivery|shipping)|cash\s*on\s*delivery|\bcod\b.*available|price.*(only|just)|inbox\s*me|message\s*me)/i;

// Extract domains from text for whitelist/blacklist checking
function extractDomains(text) {
  const matches = text.match(/https?:\/\/([^\/\s]+)/gi) || [];
  return matches.map(m => m.replace(/https?:\/\//i, '').split('/')[0].toLowerCase());
}

// ---- in-memory state ----
let liveSock = null;                 // latest sock seen (for intervals)
const spamMap = new Map();           // `${chat}|${user}` -> [ts,...]
const spamWarned = new Map();        // `${chat}|${user}` -> last warn ts
const slowMap = new Map();           // `${chat}|${user}` -> last msg ts
const kwWarned = new Map();          // `${chat}|${word}` -> last alert ts
const afkWarned = new Map();         // `${chat}|${afkUser}` -> last alert ts
const rmsgsTimers = new Map();       // `${chat}|${idx}` -> interval
let usageDirty = false, groupsDirty = false;

const G = readData(GROUPS_FILE, {}); // { [groupId]: settings }
const A = readData(AUTO_FILE, {});   // { [chatId]: automation }
const U = readData(USAGE_FILE, {});  // { [userId]: count }

function touch(ctx) { if (ctx?.bot?.sock) liveSock = ctx.bot.sock; }

function todayKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }); // YYYY-MM-DD
}
function karachiHour() {
  const h = Number(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi', hour: '2-digit', hourCycle: 'h23' }));
  return Number.isFinite(h) ? h : new Date().getHours();
}

function getG(groupId) {
  if (!G[groupId]) G[groupId] = {};
  const g = G[groupId];
  if (!g.stats || g.stats.date !== todayKey()) g.stats = { date: todayKey(), msgs: 0, joins: 0, leaves: 0 };
  if (!g.lastseen) g.lastseen = {};
  return g;
}
function getA(chatId) {
  if (!A[chatId]) A[chatId] = {};
  const a = A[chatId];
  if (!Array.isArray(a.rss)) a.rss = [];
  if (!Array.isArray(a.keyword)) a.keyword = [];
  if (!a.fwd) a.fwd = { on: false, target: '' };
  if (!Array.isArray(a.rmsgs)) a.rmsgs = [];
  if (!Array.isArray(a.bday)) a.bday = [];
  if (!a.afk) a.afk = {};
  return a;
}
function saveG() { groupsDirty = true; }
function saveA() { writeData(AUTO_FILE, A); }

function parseOnOff(q) {
  const t = String(q || '').trim().toLowerCase();
  if (/^(on|enable|1|haan|yes|khol|karo)$/.test(t)) return true;
  if (/^(off|disable|0|na|nahi|nahin|no|band)$/.test(t)) return false;
  return null;
}

function parseDelay(s) {
  const m = /^\s*(\d+)\s*(m|min|mins|h|hour|hours|d|day|days)\s*$/i.exec(String(s || ''));
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const u = m[2].toLowerCase()[0];
  const ms = u === 'm' ? n * 60000 : u === 'h' ? n * 3600000 : n * 86400000;
  if (!(ms > 0) || ms > 7 * 86400000) return null;
  return ms;
}

function toJid(num) {
  let d = String(num || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('0')) d = '92' + d.slice(1); // Pakistan default
  if (d.length < 10 || d.length > 15) return null;
  return d + '@s.whatsapp.net';
}

function fmtDur(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  const parts = [];
  if (d) parts.push(d + ' din');
  if (h) parts.push(h + ' ghante');
  if (m || !parts.length) parts.push(m + ' min');
  return parts.join(' ');
}

// ---- reply helper (never throws) ----
async function say(ctx, text, mentions) {
  try {
    if (!ctx) return;
    const opts = mentions && mentions.length ? { mentions } : undefined;
    if (typeof ctx.reply === 'function') return await ctx.reply(text);
    if (ctx.bot && typeof ctx.bot.sendMessage === 'function') return await ctx.bot.sendMessage(ctx.from, text, opts);
    if (ctx.bot?.sock) return await ctx.bot.sock.sendMessage(ctx.from, { text, ...(opts || {}) });
  } catch (e) { console.error('[batch4] say:', e.message); }
}

async function needGroupAdmin(ctx) {
  if (!ctx.isGroup) { await say(ctx, '👥 Ye command sirf group mein kaam karta hai.'); return false; }
  const ok = await isGroupAdmin(ctx.bot.sock, ctx.from, ctx.sender).catch(() => false);
  if (!ok) await say(ctx, '⛔ Sirf admin ye command chala sakte hain.');
  return ok;
}

const safe = (fn) => async (ctx, query) => {
  touch(ctx);
  try { await fn(ctx, query ?? ''); }
  catch (e) {
    console.error('[batch4] handler:', e.message);
    try { await say(ctx, '❌ Kuch ghalat ho gaya, dobara try karein.'); } catch { /* ignore */ }
  }
};

// ============================================================================
// HANDLERS
// ============================================================================
const HANDLERS = {
  // ---- 1. antilink ----
  antilink: safe(async (ctx, query) => {
    await say(ctx, '⚙️ Anti-Link is managed from the dashboard.\n\nOpen this group in the dashboard to turn it on/off.');
  }),
  nolink: 'antilink',

  // ---- Link whitelist/blacklist (2026-10-17 per Hudson) ----
  linkallow: safe(async (ctx, query) => {
    await say(ctx, '⚙️ This feature is managed from the dashboard.\n\nOpen this group in the dashboard to turn it on/off.');
  }),

  linkblock: safe(async (ctx, query) => {
    await say(ctx, '⚙️ This feature is managed from the dashboard.\n\nOpen this group in the dashboard to turn it on/off.');
  }),

  // ---- Anti-promotion (2026-10-17 per Hudson) ----
  antipromo: safe(async (ctx, query) => {
    await say(ctx, '⚙️ This feature is managed from the dashboard.\n\nOpen this group in the dashboard to turn it on/off.');
  }),

  // ---- 2. antispam ----
  antispam: safe(async (ctx, query) => {
    await say(ctx, '⚙️ This feature is managed from the dashboard.\n\nOpen this group in the dashboard to turn it on/off.');
  }),
  nospam: 'antispam',

  // ---- 3. welcome ----
  welcome: safe(async (ctx, query) => {
    await say(ctx, '⚙️ This feature is managed from the dashboard.\n\nOpen this group in the dashboard to turn it on/off.');
  }),
  welcomecard: 'welcome',
  setwelcome: 'welcome',

  // ---- 4. goodbye ----
  goodbye: safe(async (ctx, query) => {
    await say(ctx, '⚙️ This feature is managed from the dashboard.\n\nOpen this group in the dashboard to turn it on/off.');
  }),
  byemsg: 'goodbye',

  // ---- 5. afk ----
  afk: safe(async (ctx, query) => {
    const a = getA(ctx.from);
    const q = String(query || '').trim();
    if (/^list$/i.test(q)) {
      const ids = Object.keys(a.afk || {});
      if (!ids.length) return await say(ctx, 'ℹ️ Koi AFK nahi hai.');
      const lines = ids.map(j => '💤 @' + j.split('@')[0] + ' — ' + (a.afk[j].reason || 'bina wajah'));
      return await say(ctx, '💤 *AFK List:*\n' + lines.join('\n'), ids);
    }
    const me = a.afk[ctx.sender];
    if (!q) {
      if (me) {
        delete a.afk[ctx.sender]; saveA();
        return await say(ctx, '👋 *Welcome back!* Aap ' + fmtDur(Date.now() - me.since) + ' AFK thay.');
      }
      return await say(ctx, '💤 *AFK Mode*\n\nIstamal: *afk <wajah>*\nMisal: *afk namaz parh raha hun*\n\nWapas aane par sirf *afk* likhein.');
    }
    a.afk[ctx.sender] = { reason: q, since: Date.now() };
    saveA();
    await say(ctx, '💤 AFK mode *ON*: ' + q + '\nWapas aakar *afk* likhein.');
  }),

  // ---- 6. autoreact ----
  autoreact: safe(async (ctx, query) => {
    if (!await needGroupAdmin(ctx)) return;
    const v = parseOnOff(query);
    if (v === null) return await say(ctx, '😂 *Auto-React*\n\nIstamal: *autoreact on* ya *autoreact off*\nOn hone par har message par random emoji react lagega.');
    const g = getG(ctx.from); g.autoreact = v; saveG();
    await say(ctx, v ? '✅ Auto-React *ON* — ab har message par emoji lagega.' : '❎ Auto-React *OFF*.');
  }),
  reactall: 'autoreact',

  // ---- 7. slowmode ----
  slowmode: safe(async (ctx, query) => {
    if (!await needGroupAdmin(ctx)) return;
    const q = String(query || '').trim();
    if (/^off$/i.test(q)) {
      const g = getG(ctx.from); g.slowmode = 0; saveG();
      return await say(ctx, '❎ Slow mode *OFF* kar diya.');
    }
    const sec = parseInt(q, 10);
    if (!Number.isFinite(sec) || sec < 5 || sec > 3600)
      return await say(ctx, '🐌 *Slow Mode*\n\nIstamal: *slowmode <seconds>* (5–3600)\nMisal: *slowmode 30*\nBand karne ke liye: *slowmode off*');
    const g = getG(ctx.from); g.slowmode = sec; saveG();
    await say(ctx, '✅ Slow mode *ON* — har member ' + sec + ' second mein 1 message bhej sakta hai (admin ke ilawa).');
  }),
  slow: 'slowmode',

  // ---- 8. nightmode ----
  nightmode: safe(async (ctx, query) => {
    if (!await needGroupAdmin(ctx)) return;
    const q = String(query || '').trim();
    const g = getG(ctx.from);
    if (/^off$/i.test(q)) {
      g.night = { on: false }; saveG();
      try { await ctx.bot.sock.groupSettingUpdate(ctx.from, 'not_announcement'); } catch { /* ignore */ }
      return await say(ctx, '☀️ Night mode *OFF* — group ab hamesha khula rahega.');
    }
    const m = /^(\d{1,2})\s+(\d{1,2})$/.exec(q);
    if (!m) return await say(ctx, '🌙 *Night Mode*\n\nIstamal: *nightmode <band hour> <khulne ka hour>*\nMisal: *nightmode 22 7* — raat 10 se subah 7 tak group sirf admin bol sakenge.\n\nBand: *nightmode off*');
    const close = parseInt(m[1], 10), open = parseInt(m[2], 10);
    if (close > 23 || open > 23) return await say(ctx, '❌ Hour 0–23 ke darmiyan hona chahiye.');
    const botAdmin = await isBotAdmin(ctx.bot.sock, ctx.from).catch(() => false);
    if (!botAdmin) return await say(ctx, '⚠️ Night mode ke liye bot ko *group admin* banana zaroori hai.');
    g.night = { on: true, close, open, closed: false }; saveG();
    await say(ctx, '✅ Night mode *ON* — ' + close + ':00 se ' + open + ':00 tak group auto-mute rahega.');
  }),
  night: 'nightmode',

  // ---- 9. groupstats ----
  groupstats: safe(async (ctx, query) => {
    if (!ctx.isGroup) return await say(ctx, '👥 Ye command sirf group mein kaam karta hai.');
    const g = getG(ctx.from);
    const s = g.stats;
    await say(ctx, '📊 *Group Stats (aaj)*\n\n💬 Messages: ' + s.msgs + '\n➕ Naye members: ' + s.joins + '\n➖ Gaye members: ' + s.leaves);
  }),
  gstats: 'groupstats',

  // ---- 10. inactive ----
  inactive: safe(async (ctx, query) => {
    if (!await needGroupAdmin(ctx)) return;
    let days = parseInt(String(query || '').trim(), 10);
    if (!Number.isFinite(days) || days < 1) days = 7;
    const g = getG(ctx.from);
    const cutoff = Date.now() - days * 86400000;
    let parts = [];
    try { parts = (await ctx.bot.sock.groupMetadata(ctx.from)).participants || []; }
    catch { return await say(ctx, '❌ Members ki list nahi mil saki.'); }
    const quiet = parts.filter(p => {
      if (p.id === ctx.bot.sock.user?.id) return false;
      const last = g.lastseen[p.id] || 0;
      return last < cutoff;
    });
    if (!quiet.length) return await say(ctx, '✅ ' + days + ' din mein sab active rahe — koi khamosh member nahi!');
    const lines = quiet.slice(0, 30).map(p => {
      const last = g.lastseen[p.id];
      const ago = last ? fmtDur(Date.now() - last) + ' pehle' : 'kabhi active nahi dekha';
      return '😴 @' + p.id.split('@')[0] + ' — ' + ago;
    });
    await say(ctx, '😴 *' + days + ' din se khamosh members (' + quiet.length + '):*\n' + lines.join('\n'), quiet.slice(0, 30).map(p => p.id));
  }),
  sleepers: 'inactive',

  // ---- 11. birthday ----
  birthday: safe(async (ctx, query) => {
    const a = getA(ctx.from);
    const q = String(query || '').trim();
    let m = /^add\s+(\S+)\s+(\d{1,2})-(\d{1,2})$/i.exec(q);
    if (m) {
      const day = parseInt(m[2], 10), month = parseInt(m[3], 10);
      if (day < 1 || day > 31 || month < 1 || month > 12) return await say(ctx, '❌ Tarikh ghalat hai. Format: *bday add Ali 15-08*');
      a.bday = a.bday.filter(b => b.name.toLowerCase() !== m[1].toLowerCase());
      a.bday.push({ name: m[1], day, month }); saveA();
      return await say(ctx, '🎂 *' + m[1] + '* ki birthday save ho gayi (' + String(day).padStart(2, '0') + '-' + String(month).padStart(2, '0') + ').');
    }
    m = /^del\s+(\S+)$/i.exec(q);
    if (m) {
      const before = a.bday.length;
      a.bday = a.bday.filter(b => b.name.toLowerCase() !== m[1].toLowerCase()); saveA();
      return await say(ctx, before === a.bday.length ? 'ℹ️ *' + m[1] + '* nahi mila.' : '🗑️ *' + m[1] + '* ki birthday delete kar di.');
    }
    if (/^list$/i.test(q) || !q) {
      if (!a.bday.length) return await say(ctx, '🎂 *Birthday Alerts*\n\nKoi birthday save nahi.\nIstamal: *bday add <naam> <DD-MM>*\nMisal: *bday add Ali 15-08*');
      const lines = a.bday.map(b => '🎂 ' + b.name + ' — ' + String(b.day).padStart(2, '0') + '-' + String(b.month).padStart(2, '0'));
      return await say(ctx, '🎂 *Saved Birthdays:*\n' + lines.join('\n'));
    }
    await say(ctx, '🎂 *Birthday*\n\n• *bday add <naam> <DD-MM>*\n• *bday list*\n• *bday del <naam>*');
  }),
  bday: 'birthday',

  // ---- 12. pinmsg ----
  pinmsg: safe(async (ctx, query) => {
    await doPin(ctx, 1);
  }),
  unpin: safe(async (ctx, query) => {
    await doPin(ctx, 2);
  }),

  // ---- 13. pollsched ----
  pollsched: safe(async (ctx, query) => {
    if (!await needGroupAdmin(ctx)) return;
    const q = String(query || '').trim();
    const m = /^(\S+)\s+([\s\S]+)$/.exec(q);
    if (!m) return await say(ctx, '📊 *Scheduled Poll*\n\nIstamal: *pollsched <10m|2h|1d> <sawal> | <option1> | <option2> ...*\nMisal: *pollsched 10m Chai ya coffee? | Chai | Coffee*');
    const ms = parseDelay(m[1]);
    if (ms === null) return await say(ctx, '❌ Waqt ghalat hai. *10m*, *2h* ya *1d* likhein (max 7 din).');
    const parts = m[2].split('|').map(s => s.trim()).filter(Boolean);
    if (parts.length < 3) return await say(ctx, '❌ Sawal ke sath kam az kam 2 options lazmi hain: *sawal | A | B*');
    const [name, ...values] = parts;
    setTimeout(async () => {
      try { await ctx.bot.sock.sendMessage(ctx.from, { poll: { name, values: values.slice(0, 12), selectableCount: 1 } }); }
      catch (e) { console.error('[batch4] pollsched fire:', e.message); }
    }, ms);
    await say(ctx, '⏰ Poll *' + fmtDur(ms) + '* baad bheja jayega: *' + name + '*');
  }),
  schedpoll: 'pollsched',

  // ---- 14. rsswatch ----
  rsswatch: safe(async (ctx, query) => {
    const a = getA(ctx.from);
    const q = String(query || '').trim();
    let m = /^add\s+(https?:\/\/\S+)$/i.exec(q);
    if (m) {
      if (a.rss.length >= 5) return await say(ctx, '❌ Zyada se zyada 5 RSS feeds.');
      if (a.rss.some(r => r.url === m[1])) return await say(ctx, 'ℹ️ Ye feed pehle se add hai.');
      a.rss.push({ url: m[1], seen: [] }); saveA();
      return await say(ctx, '✅ RSS feed add ho gayi. Har 15 min mein nayi khabrein auto-post hon gi.');
    }
    m = /^del\s+(\d+)$/i.exec(q);
    if (m) {
      const i = parseInt(m[1], 10) - 1;
      if (i < 0 || i >= a.rss.length) return await say(ctx, '❌ Ghalat number. *rss list* dekhein.');
      a.rss.splice(i, 1); saveA();
      return await say(ctx, '🗑️ Feed delete kar di.');
    }
    if (!q || /^list$/i.test(q)) {
      if (!a.rss.length) return await say(ctx, '📰 *RSS Watch*\n\nKoi feed nahi.\nIstamal: *rss add <url>*\nMisal: *rss add https://feeds.bbci.co.uk/news/rss.xml*');
      return await say(ctx, '📰 *RSS Feeds:*\n' + a.rss.map((r, i) => (i + 1) + '. ' + r.url).join('\n'));
    }
    await say(ctx, '📰 *RSS*\n\n• *rss add <url>*\n• *rss list*\n• *rss del <number>*');
  }),
  rss: 'rsswatch',

  // ---- 15. keywordalert ----
  keywordalert: safe(async (ctx, query) => {
    const a = getA(ctx.from);
    const q = String(query || '').trim();
    let m = /^add\s+(.+)$/i.exec(q);
    if (m) {
      const w = m[1].trim().toLowerCase();
      if (w.length < 2) return await say(ctx, '❌ Lafz kam az kam 2 harf ka ho.');
      if (a.keyword.length >= 20) return await say(ctx, '❌ Zyada se zyada 20 keywords.');
      if (a.keyword.includes(w)) return await say(ctx, 'ℹ️ Ye keyword pehle se hai.');
      a.keyword.push(w); saveA();
      return await say(ctx, '🔔 Keyword *"' + w + '"* add — ab jahan aayega alert milega.');
    }
    m = /^del\s+(\d+)$/i.exec(q);
    if (m) {
      const i = parseInt(m[1], 10) - 1;
      if (i < 0 || i >= a.keyword.length) return await say(ctx, '❌ Ghalat number. *keyword list* dekhein.');
      a.keyword.splice(i, 1); saveA();
      return await say(ctx, '🗑️ Keyword delete kar diya.');
    }
    if (!q || /^list$/i.test(q)) {
      if (!a.keyword.length) return await say(ctx, '🔔 *Keyword Alerts*\n\nKoi keyword nahi.\nIstamal: *keyword add <lafz>*\nMisal: *keyword add match*');
      return await say(ctx, '🔔 *Keywords:*\n' + a.keyword.map((w, i) => (i + 1) + '. ' + w).join('\n'));
    }
    await say(ctx, '🔔 *Keyword*\n\n• *keyword add <lafz>*\n• *keyword list*\n• *keyword del <number>*');
  }),
  keyword: 'keywordalert',

  // ---- 16. fwd ----
  fwd: safe(async (ctx, query) => {
    const a = getA(ctx.from);
    const q = String(query || '').trim();
    let m = /^set\s+(\+?\d[\d\s-]*)$/.exec(q);
    if (m) {
      const jid = toJid(m[1]);
      if (!jid) return await say(ctx, '❌ Number ghalat hai. Misal: *fwd set 03001234567*');
      a.fwd.target = jid; a.fwd.on = true; saveA();
      return await say(ctx, '📩 Auto-forward *ON* — is chat ke messages ' + jid.split('@')[0] + ' ko bheje jayen ge.');
    }
    const v = parseOnOff(q);
    if (v !== null) {
      if (v && !a.fwd.target) return await say(ctx, '❌ Pehle target set karein: *fwd set <number>*');
      a.fwd.on = v; saveA();
      return await say(ctx, v ? '📩 Auto-forward *ON*.' : '❎ Auto-forward *OFF*.');
    }
    const st = a.fwd.on ? 'ON → ' + (a.fwd.target || '?').split('@')[0] : 'OFF';
    await say(ctx, '📩 *Auto-Forward* (' + st + ')\n\n• *fwd set <number>*\n• *fwd on* / *fwd off*');
  }),
  autoforward: 'fwd',

  // ---- 17. rmsgs ----
  rmsgs: safe(async (ctx, query) => {
    const a = getA(ctx.from);
    const q = String(query || '').trim();
    let m = /^del\s+(\d+)$/i.exec(q);
    if (m) {
      const i = parseInt(m[1], 10) - 1;
      if (i < 0 || i >= a.rmsgs.length) return await say(ctx, '❌ Ghalat number. *rmsgs list* dekhein.');
      a.rmsgs.splice(i, 1); saveA(); rearmRmsgs(ctx.from);
      return await say(ctx, '🗑️ Recurring message delete kar diya.');
    }
    if (!q || /^list$/i.test(q)) {
      if (!a.rmsgs.length) return await say(ctx, '🔁 *Recurring Messages*\n\nKoi nahi set.\nIstamal: *rmsgs <30m|1h|1d> <text>*\nMisal: *rmsgs 1h Pani peena na bhoolein! 💧*');
      return await say(ctx, '🔁 *Recurring:*\n' + a.rmsgs.map((r, i) => (i + 1) + '. har ' + fmtDur(r.ms) + ' — ' + r.text.slice(0, 60)).join('\n'));
    }
    m = /^(\S+)\s+([\s\S]+)$/.exec(q);
    if (!m) return await say(ctx, '🔁 *Recurring Messages*\n\nIstamal: *rmsgs <30m|1h|1d> <text>*');
    const ms = parseDelay(m[1]);
    if (ms === null || ms < 60000) return await say(ctx, '❌ Waqt ghalat hai — kam az kam 1m, zyada se zyada 7d.');
    if (a.rmsgs.length >= 10) return await say(ctx, '❌ Zyada se zyada 10 recurring messages.');
    a.rmsgs.push({ text: m[2].trim().slice(0, 500), ms }); saveA(); rearmRmsgs(ctx.from);
    await say(ctx, '✅ Har *' + fmtDur(ms) + '* ye message bheja jayega.');
  }),
  recurringmsg: 'rmsgs',

  // ---- 18. welcomebiz ----
  welcomebiz: safe(async (ctx, query) => {
    const a = getA(ctx.from);
    const q = String(query || '').trim();
    let m = /^set\s+([\s\S]+)$/i.exec(q);
    if (m) {
      a.bizwelcome = m[1].trim().slice(0, 1000); saveA();
      return await say(ctx, '✅ Business welcome template save ho gaya.\nBhejne ke liye: *welcomebiz send <number>*');
    }
    m = /^send\s+(\+?\d[\d\s-]*)$/i.exec(q);
    if (m) {
      if (!a.bizwelcome) return await say(ctx, '❌ Pehle template set karein: *welcomebiz set <text>*');
      const jid = toJid(m[1]);
      if (!jid) return await say(ctx, '❌ Number ghalat hai.');
      try { await ctx.bot.sock.sendMessage(jid, { text: a.bizwelcome }); }
      catch { return await say(ctx, '❌ DM nahi bheja ja saka.'); }
      return await say(ctx, '✅ Welcome DM bhej diya → ' + jid.split('@')[0]);
    }
    await say(ctx, '💼 *Business Welcome*\n\n• *welcomebiz set <text>* — template save karein\n• *welcomebiz send <number>* — naye customer ko DM');
  }),
  bizwelcome: 'welcomebiz',

  // ---- 19. persona ----
  persona: safe(async (ctx, query) => {
    const styles = {
      funny: 'Ek mazahiya desi dost ki tarah jawab do.',
      formal: 'Nihayat tameez aur formal lehjay mein jawab do.',
      teacher: 'Ek sabar ustad ki tarah samjhao.',
      poet: 'Shaairana andaz mein jawab do.',
    };
    const q = String(query || '').trim().toLowerCase();
    if (/^off$/.test(q)) {
      const p = readData(PERSONA_FILE, {});
      delete p[ctx.from]; writeData(PERSONA_FILE, p);
      return await say(ctx, '🎭 Persona *OFF* — bot normal andaz mein baat karega.');
    }
    if (styles[q]) {
      const p = readData(PERSONA_FILE, {});
      p[ctx.from] = q; writeData(PERSONA_FILE, p);
      return await say(ctx, '🎭 Persona set: *' + q + '* — ' + styles[q]);
    }
    const p = readData(PERSONA_FILE, {});
    const cur = p[ctx.from];
    await say(ctx, '🎭 *Bot ka Andaz*\n\nMojooda: ' + (cur ? '*' + cur + '*' : 'normal') + '\n\n• *persona funny* — mazahiya dost\n• *persona formal* — tehzeeb wala\n• *persona teacher* — ustad ki tarah\n• *persona poet* — shaairana\n• *persona off*');
  }),
  botstyle: 'persona',

  // ---- 20. myusage ----
  myusage: safe(async (ctx, query) => {
    const my = U[ctx.sender] || 0;
    const sorted = Object.entries(U).sort((a, b) => b[1] - a[1]);
    const rank = sorted.findIndex(([id]) => id === ctx.sender) + 1;
    await say(ctx, '📈 *Aapki Usage*\n\n💬 Messages: ' + my + '\n🏆 Rank: ' + (rank || '—') + ' / ' + sorted.length);
  }),
  mystats: 'myusage',

  // ---- 21. exportchat ----
  exportchat: safe(async (ctx, query) => {
    const L = [];
    L.push('AwaisxBot — Aapka Data Export');
    L.push('Date: ' + new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }));
    L.push('User: ' + ctx.sender);
    L.push('');
    const games = readData('batch1-games.json', {});
    const edu = readData('batch3-edu.json', {});
    const biz = readData('batch5-biz.json', {});
    const pushObj = (title, obj) => {
      L.push('--- ' + title + ' ---');
      const keys = Object.keys(obj || {});
      if (!keys.length) { L.push('(koi data nahi)'); }
      else for (const k of keys.slice(0, 200)) {
        let v = obj[k];
        try { v = JSON.stringify(v); } catch { v = String(v); }
        L.push(k + ': ' + String(v).slice(0, 300));
      }
      L.push('');
    };
    pushObj('Games (Batch 1)', games);
    pushObj('Education (Batch 3)', edu);
    pushObj('Business (Batch 5)', biz);
    pushObj('Group/Automation settings (Batch 4)', { auto: A[ctx.from] || {}, group: G[ctx.from] || {} });
    L.push('--- Usage ---');
    L.push('Messages: ' + (U[ctx.sender] || 0));
    const buf = Buffer.from(L.join('\n'), 'utf-8');
    try {
      await ctx.bot.sendMessage(ctx.from, { document: buf, mimetype: 'text/plain', fileName: 'awaxbot-data.txt', caption: '📦 Aapka data export tayyar hai!' });
    } catch { await say(ctx, '❌ File nahi bheji ja saki.'); }
  }),
  chatbackup: 'exportchat',

  // ---- 22. botapi ----
  botapi: safe(async (ctx, query) => {
    await say(ctx,
      '🔌 *Bot HTTP API*\n\n' +
      'POST /api/bot/send  {to, text}\n' +
      'Dashboard server par chalta hai (auth required).\n\n' +
      'Misal:\n' +
      'curl -X POST http://localhost:3000/api/bot/send \\\n' +
      '  -u awax:PASS \\\n' +
      "  -H 'Content-Type: application/json' \\\n" +
      '  -d \'{"to":"923001234567","text":"Salam"}\'\n\n' +
      '⚠️ Ye route server.js mein integrator add karega.');
  }),
  apiinfo: 'botapi',
};

async function doPin(ctx, type) {
  if (!await needGroupAdmin(ctx)) return;
  const ci = ctx.msg?.message?.extendedTextMessage?.contextInfo;
  const qk = ci?.stanzaId;
  if (!qk) {
    await say(ctx, type === 1
      ? '📌 *Pin*\n\nKisi message par *reply* karke *pin* likhein.'
      : '📌 *Unpin*\n\nKisi pinned message par *reply* karke *unpin* likhein.');
    return;
  }
  try {
    await ctx.bot.sock.sendMessage(ctx.from, {
      pin: { key: { remoteJid: ctx.msg.key.remoteJid, id: qk, participant: ci.participant || ctx.msg.key.participant }, type },
    });
    await say(ctx, type === 1 ? '📌 Message pin kar diya.' : '📌 Pin hata diya.');
  } catch (e) {
    console.error('[batch4] pin:', e.message);
    await say(ctx, '❌ Pin nahi ho saka — bot ko admin rights chahiye.');
  }
}

// ============================================================================
// onMessage hook — FAST & silent (never reply unless feature demands it)
// ============================================================================
export async function onMessage(ctx) {
  try {
    touch(ctx);
    const msg = ctx.msg;
    if (msg?.key?.fromMe) return;
    const from = ctx.from, sender = ctx.sender;
    const text = ctx.text || '';
    const isGroup = !!ctx.isGroup;

    // usage counter (all chats)
    try {
      if (sender) { U[sender] = (U[sender] || 0) + 1; usageDirty = true; }
    } catch { /* ignore */ }

    if (isGroup) {
      const g = getG(from);
      // group stats + lastseen
      try {
        g.stats.msgs++; g.lastseen[sender] = Date.now(); groupsDirty = true;
      } catch { /* ignore */ }

      // --- antilink (with whitelist/blacklist + promotion detection) ---
      try {
        if (groupFeatureOn(from, 'antilink', g.antilink) && text) {
          const hasLink = LINK_RE.test(text);
          const isPromo = PROMO_RE.test(text);
          
          let shouldDelete = false;
          let reason = '';
          
          if (hasLink) {
            const domains = extractDomains(text);
            const whitelist = g.linkWhitelist || [];
            const blacklist = g.linkBlacklist || [];
            
            // Check blacklist first
            const blacklisted = domains.some(d => blacklist.some(b => d.includes(b.toLowerCase())));
            // Check whitelist
            const whitelisted = whitelist.length > 0 && domains.every(d => whitelist.some(w => d.includes(w.toLowerCase())));
            
            if (blacklisted) {
              shouldDelete = true;
              reason = 'blacklisted domain';
            } else if (whitelist.length > 0 && !whitelisted) {
              shouldDelete = true;
              reason = 'not in whitelist';
            } else if (whitelist.length === 0) {
              // No whitelist = block all links (default behavior)
              shouldDelete = true;
              reason = 'link detected';
            }
          }
          
          // Promotion detection (even without links)
          if (!shouldDelete && isPromo && groupFeatureOn(from, 'antipromo', g.antipromo)) {
            shouldDelete = true;
            reason = 'promotional content';
          }
          
          if (shouldDelete) {
            const admin = await isGroupAdmin(ctx.bot.sock, from, sender).catch(() => false);
            // Don't delete owner's or admins' messages
            const { isOwner } = await import('./access.js').catch(() => ({ isOwner: () => false }));
            if (!admin && !isOwner(sender) && msg?.key) {
              await ctx.bot.sock.sendMessage(from, { delete: msg.key }).catch(() => {});
              await ctx.bot.sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } }).catch(() => {});
              console.log(`[antilink] Deleted ${reason}: ${text.slice(0, 50)}`);
            }
          }
        }
      } catch { /* ignore */ }

      // --- antispam ---
      try {
        if (groupFeatureOn(from, 'antispam', g.antispam) && sender) {
          const k = from + '|' + sender, now = Date.now();
          const arr = (spamMap.get(k) || []).filter(t => now - t < 10000);
          arr.push(now); spamMap.set(k, arr);
          if (arr.length > 5) {
            const admin = await isGroupAdmin(ctx.bot.sock, from, sender).catch(() => false);
            if (!admin && msg?.key) {
              await ctx.bot.sock.sendMessage(from, { delete: msg.key }).catch(() => {});
              const lastW = spamWarned.get(k) || 0;
              if (now - lastW > 60000) {
                spamWarned.set(k, now);
                await ctx.bot.sock.sendMessage(from, { text: '🐢 Slow down! Itni jaldi messages mat bhejein.' }).catch(() => {});
              }
            }
          }
        }
      } catch { /* ignore */ }

      // --- slowmode ---
      try {
        if (groupFeatureOn(from, 'slowmode', !!g.slowmode) && g.slowmode && sender && text && msg?.key) {
          const admin = await isGroupAdmin(ctx.bot.sock, from, sender).catch(() => false);
          if (!admin) {
            const k = from + '|' + sender, now = Date.now();
            const last = slowMap.get(k) || 0;
            if (now - last < g.slowmode * 1000) {
              await ctx.bot.sock.sendMessage(from, { delete: msg.key }).catch(() => {});
            } else slowMap.set(k, now);
          }
        }
      } catch { /* ignore */ }

      // --- autoreact ---
      try {
        if (g.autoreact && msg?.key && text) {
          const em = ['❤️', '😂', '👍', '🔥', '😮'];
          await ctx.bot.sock.sendMessage(from, { react: { text: em[Math.floor(Math.random() * em.length)], key: msg.key } }).catch(() => {});
        }
      } catch { /* ignore */ }
    }

    // --- AFK mention alert ---
    try {
      const a = getA(from);
      const mentioned = msg?.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (mentioned.length && text) {
        for (const jid of mentioned) {
          const afk = a.afk[jid];
          if (afk && jid !== sender) {
            const k = from + '|' + jid, now = Date.now();
            if (now - (afkWarned.get(k) || 0) > 10 * 60000) {
              afkWarned.set(k, now);
              await say(ctx, '💤 @' + jid.split('@')[0] + ' AFK hain: ' + afk.reason, [jid]).catch(() => {});
            }
          }
        }
      }
    } catch { /* ignore */ }

    // --- keyword alert --- (2026-10-14: respects dashboard toggle)
    try {
      const a = getA(from);
      if (groupFeatureOn(from, 'keywordalerts', true) && a.keyword.length && text) {
        const low = text.toLowerCase();
        for (const w of a.keyword) {
          if (low.includes(w)) {
            const k = from + '|' + w, now = Date.now();
            if (now - (kwWarned.get(k) || 0) > 5 * 60000) {
              kwWarned.set(k, now);
              await ctx.bot.sock.sendMessage(from, { text: "🔔 Keyword alert: '" + w + "' mila!" }).catch(() => {});
            }
          }
        }
      }
    } catch { /* ignore */ }

    // --- auto-forward ---
    try {
      const a = getA(from);
      if (a.fwd.on && a.fwd.target && from !== a.fwd.target && text) {
        await ctx.bot.sock.sendMessage(a.fwd.target, { text: '📩 *Fwd:* ' + text }).catch(() => {});
      }
    } catch { /* ignore */ }
  } catch (e) { console.error('[batch4] onMessage:', e.message); }
}

// ============================================================================
// onParticipantsUpdate hook
// ============================================================================
export async function onParticipantsUpdate(evt) {
  try {
    const { bot, id, participants, action } = evt || {};
    if (!bot || !id || !Array.isArray(participants)) return;
    touch({ bot });
    const g = getG(id);
    for (const p of participants) {
      const jid = typeof p === 'string' ? p : p?.id;
      if (!jid) continue;
      const num = jid.split('@')[0];
      if (action === 'add') {
        try { g.stats.joins++; groupsDirty = true; } catch { /* ignore */ }
        const w = g.welcome;
        if (w && w.on && w.text) {
          try { await bot.sendMessage(id, w.text.replace(/@user/gi, '@' + num), { mentions: [jid] }); }
          catch (e) { console.error('[batch4] welcome:', e.message); }
        }
      } else if (action === 'remove' || action === 'leave') {
        try { g.stats.leaves++; groupsDirty = true; } catch { /* ignore */ }
        const gb = g.goodbye;
        if (gb && gb.on && gb.text) {
          try { await bot.sendMessage(id, gb.text.replace(/@user/gi, '@' + num), { mentions: [jid] }); }
          catch (e) { console.error('[batch4] goodbye:', e.message); }
        }
      }
    }
  } catch (e) { console.error('[batch4] onParticipantsUpdate:', e.message); }
}

// ============================================================================
// Background intervals (all guarded; sock captured from hooks)
// ============================================================================
function rearmRmsgs(chatId) {
  for (const [k, t] of rmsgsTimers) {
    if (k.startsWith(chatId + '|')) { clearInterval(t); rmsgsTimers.delete(k); }
  }
  const a = getA(chatId);
  a.rmsgs.forEach((r, i) => {
    const t = setInterval(async () => {
      try { if (liveSock) await liveSock.sendMessage(chatId, { text: r.text }); }
      catch (e) { console.error('[batch4] rmsgs fire:', e.message); }
    }, r.ms);
    if (t.unref) t.unref();
    rmsgsTimers.set(chatId + '|' + i, t);
  });
}
// re-arm persisted recurring messages at boot
try { for (const chatId of Object.keys(A)) if (getA(chatId).rmsgs.length) rearmRmsgs(chatId); } catch { /* ignore */ }

// nightmode ticker (60s)
setInterval(async () => {
  try {
    if (!liveSock) return;
    const h = karachiHour();
    for (const [gid, raw] of Object.entries(G)) {
      const g = getG(gid);
      const n = g.night;
      if (!n || !n.on) continue;
      const shouldClose = n.close <= n.open ? (h >= n.close && h < n.open) : (h >= n.close || h < n.open);
      if (shouldClose === !!n.closed) continue;
      const botAdmin = await isBotAdmin(liveSock, gid).catch(() => false);
      if (!botAdmin) {
        if (!n.warned) { n.warned = true; saveG(); }
        continue;
      }
      try {
        await liveSock.groupSettingUpdate(gid, shouldClose ? 'announcement' : 'not_announcement');
        n.closed = shouldClose; n.warned = false; saveG();
      } catch (e) { console.error('[batch4] nightmode:', e.message); }
    }
  } catch (e) { console.error('[batch4] nightmode tick:', e.message); }
}, 60000).unref?.();

// birthday ticker (60s; fires at 09:00 Asia/Karachi)
setInterval(async () => {
  try {
    if (!liveSock) return;
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
    if (now.getHours() !== 9 || now.getMinutes() > 2) return;
    const dk = todayKey();
    for (const [chatId, raw] of Object.entries(A)) {
      const a = getA(chatId);
      if (!a.bday.length || a._bdaySent === dk) continue;
      const todays = a.bday.filter(b => b.day === now.getDate() && (b.month === now.getMonth() + 1));
      if (!todays.length) continue;
      a._bdaySent = dk; saveA();
      for (const b of todays) {
        try { await liveSock.sendMessage(chatId, { text: '🎂 Aaj *' + b.name + '* ki birthday hai! 🎉🎊\nJanam din mubarak ho!' }); } catch { /* ignore */ }
      }
    }
  } catch (e) { console.error('[batch4] bday tick:', e.message); }
}, 60000).unref?.();

// RSS ticker (15 min)
setInterval(async () => {
  try {
    if (!liveSock) return;
    for (const [chatId, raw] of Object.entries(A)) {
      const a = getA(chatId);
      for (const feed of a.rss) {
        try {
          const res = await fetch(feed.url, { signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'AwaisxBot/1.0' } });
          if (!res.ok) continue;
          const xml = await res.text();
          const items = [];
          const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
          let im;
          while ((im = itemRe.exec(xml)) && items.length < 10) {
            const body = im[1];
            const t = /<title>([\s\S]*?)<\/title>/i.exec(body);
            const l = /<link>([\s\S]*?)<\/link>/i.exec(body);
            const clean = (s) => (s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim().slice(0, 200);
            const title = clean(t && t[1]), link = clean(l && l[1]);
            if (title && link) items.push({ title, link });
          }
          const seen = new Set(feed.seen || []);
          const fresh = items.filter(i => !seen.has(i.link)).slice(0, 3);
          for (const i of fresh) {
            seen.add(i.link);
            try { await liveSock.sendMessage(chatId, { text: '📰 *' + i.title + '*\n' + i.link }); } catch { /* ignore */ }
          }
          feed.seen = [...seen].slice(-50);
          if (fresh.length) saveA();
        } catch (e) { console.error('[batch4] rss', feed.url, e.message); }
      }
    }
  } catch (e) { console.error('[batch4] rss tick:', e.message); }
}, 15 * 60000).unref?.();

// throttled flush (2 min)
setInterval(() => {
  try {
    if (usageDirty) { writeData(USAGE_FILE, U); usageDirty = false; }
    if (groupsDirty) { writeData(GROUPS_FILE, G); groupsDirty = false; }
  } catch (e) { console.error('[batch4] flush:', e.message); }
}, 120000).unref?.();

// ============================================================================
// MENU + WEB
// ============================================================================
export const MENU_SECTION = `🛡️ *16. Group Control*
• *antilink on|off* ➔ Link auto-delete
• *antispam on|off* ➔ Flood control
• *welcome set <text>* ➔ Custom welcome
• *goodbye set <text>* ➔ Goodbye message
• *afk <wajah>* ➔ AFK mode
• *autoreact on|off* ➔ Auto emoji reacts
• *slowmode <sec>* ➔ Slow mode
• *nightmode <22> <7>* ➔ Raat ko auto-mute
• *groupstats* ➔ Group analytics
• *inactive <days>* ➔ Khamosh members
• *bday add <naam> <DD-MM>* ➔ Birthday alerts
• *pin* ➔ Message pin (reply)
• *pollsched <10m> <Q> | <A>* ➔ Scheduled poll

⚙️ *17. Automation*
• *rss add <url>* ➔ RSS auto-post
• *keyword add <lafz>* ➔ Keyword alerts
• *fwd set <number>* ➔ Auto-forward
• *rmsgs <1h> <text>* ➔ Recurring messages
• *welcomebiz send <num>* ➔ Business welcome DM
• *persona <funny|poet>* ➔ Bot ka andaz
• *myusage* ➔ Aapki usage stats
• *exportchat* ➔ Apna data download
• *botapi* ➔ HTTP API info`;

export const WEB_COMMANDS = [
  { command: 'antilink', title: 'Anti-Link', usage: 'antilink on|off', example: 'antilink on', section: 'Group Control', admin: true, desc: 'Group mein links auto-delete (admin ke ilawa)' },
  { command: 'antispam', title: 'Anti-Spam', usage: 'antispam on|off', example: 'antispam on', section: 'Group Control', admin: true, desc: '10 sec mein 5+ messages par flood control' },
  { command: 'welcome', title: 'Welcome Card', usage: 'welcome set <text>', example: 'welcome set Khush aamdeed @user! 🎉', section: 'Group Control', admin: true, desc: 'Naye member ke liye custom welcome (@user = naam)' },
  { command: 'goodbye', title: 'Goodbye Message', usage: 'goodbye set <text>', example: 'goodbye set Allah Hafiz! 👋', section: 'Group Control', admin: true, desc: 'Member ke janay par auto goodbye' },
  { command: 'afk', title: 'AFK Mode', usage: 'afk <wajah>', example: 'afk namaz parh raha hun', section: 'Group Control', admin: false, desc: 'Door hon to auto-reply; mention par wajah bataye' },
  { command: 'autoreact', title: 'Auto-React', usage: 'autoreact on|off', example: 'autoreact on', section: 'Group Control', admin: true, desc: 'Har message par random emoji react' },
  { command: 'slowmode', title: 'Slow Mode', usage: 'slowmode <seconds>', example: 'slowmode 30', section: 'Group Control', admin: true, desc: 'Members ke darmiyan waqfa lazmi (admin exempt)' },
  { command: 'nightmode', title: 'Night Mode', usage: 'nightmode <band> <khula>', example: 'nightmode 22 7', section: 'Group Control', admin: true, desc: 'Raat ko group auto-mute, subah auto-open (bot admin lazmi)' },
  { command: 'groupstats', title: 'Group Stats', usage: 'groupstats', example: 'groupstats', section: 'Group Control', admin: false, desc: 'Aaj ke messages, joins aur leaves' },
  { command: 'inactive', title: 'Inactive Members', usage: 'inactive <days>', example: 'inactive 7', section: 'Group Control', admin: true, desc: 'Khamosh members ki list' },
  { command: 'birthday', title: 'Birthday Alerts', usage: 'bday add <naam> <DD-MM>', example: 'bday add Ali 15-08', section: 'Group Control', admin: false, desc: 'Subah 9 baje birthday alert' },
  { command: 'pinmsg', title: 'Pin Message', usage: 'pin (reply karke)', example: 'pin', section: 'Group Control', admin: true, desc: 'Reply kiye gaye message ko pin karein (unpin se hatayein)' },
  { command: 'pollsched', title: 'Scheduled Poll', usage: 'pollsched <10m|2h|1d> <Q> | <A> | <B>', example: 'pollsched 10m Chai ya coffee? | Chai | Coffee', section: 'Group Control', admin: true, desc: 'Muqarrar waqt baad poll bhejein' },
  { command: 'rsswatch', title: 'RSS Watch', usage: 'rss add <url>', example: 'rss add https://feeds.bbci.co.uk/news/rss.xml', section: 'Automation', admin: false, desc: 'Har 15 min mein nayi khabrein auto-post' },
  { command: 'keywordalert', title: 'Keyword Alerts', usage: 'keyword add <lafz>', example: 'keyword add match', section: 'Automation', admin: false, desc: 'Lafz kahin aaye to foran alert' },
  { command: 'fwd', title: 'Auto-Forward', usage: 'fwd set <number>', example: 'fwd set 03001234567', section: 'Automation', admin: false, desc: 'Is chat ke messages doosre number par bhejein' },
  { command: 'rmsgs', title: 'Recurring Messages', usage: 'rmsgs <30m|1h|1d> <text>', example: 'rmsgs 1h Pani peete rahein! 💧', section: 'Automation', admin: false, desc: 'Har muqarrar waqt baad message dohrayein' },
  { command: 'welcomebiz', title: 'Business Welcome', usage: 'welcomebiz send <num>', example: 'welcomebiz send 03001234567', section: 'Automation', admin: false, desc: 'Naye customer ko welcome DM bhejein' },
  { command: 'persona', title: 'Bot Persona', usage: 'persona <funny|formal|teacher|poet>', example: 'persona funny', section: 'Automation', admin: false, desc: 'Bot ke baat karne ka andaz badlein' },
  { command: 'myusage', title: 'My Usage', usage: 'myusage', example: 'myusage', section: 'Automation', admin: false, desc: 'Aapke messages ki tadad aur rank' },
  { command: 'exportchat', title: 'Export Chat Data', usage: 'exportchat', example: 'exportchat', section: 'Automation', admin: false, desc: 'Apna sara bot data .txt file mein download karein' },
  { command: 'botapi', title: 'Bot HTTP API', usage: 'botapi', example: 'botapi', section: 'Automation', admin: false, desc: 'POST /api/bot/send ka istemal tareeqa' },
];

registerBatch({ MENU_SECTION, WEB_COMMANDS, HANDLERS, onMessage, onParticipantsUpdate });
