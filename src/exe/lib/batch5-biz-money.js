// Batch 5: Business (14) + Money & Finance (8) = 22 primary commands.
// Contract: ESM only, no new npm deps, handlers never throw, Roman Urdu replies.
import { registerBatch, readData, writeData, fmtNum, isGroupAdmin } from './batch-helpers.js';
import { askAI } from './ai.js';

export const MENU_SECTION = `💼 *18. Business*
• *invoice <client> | <item>* ➔ Invoice banayein
• *expense add <500 chai>* ➔ Kharcha hisab
• *todo add <kaam>* ➔ To-do list
• *notes save <title> | <text>* ➔ Notes
• *sendlater <10m> <text>* ➔ Scheduled message
• *qreply add <naam> | <text>* ➔ Quick replies
• *order <customer> | <item>* ➔ Order book
• *price add <item> | <rate>* ➔ Price list
• *attend* ➔ Hazri lagayein
• *meeting <10m> <topic>* ➔ Meeting reminder
• *email <to> | <sub> | <body>* ➔ Email draft link
• *csvlog <expenses|orders>* ➔ CSV download
• *bizcard <naam> | <num>* ➔ Digital visiting card
• *review <text>* ➔ Feedback jama karein

💰 *19. Money & Finance*
• *cryptoalert <btc above 90000>* ➔ Crypto price alerts
• *stocks <aapl|kse>* ➔ Stock prices
• *goldrate* ➔ Sona rate (andaza)
• *forex* ➔ USD/PKR & more
• *salarytax <monthly>* ➔ Income tax andaza
• *budget set <50000>* ➔ Monthly budget
• *savegoal <naam> <target>* ➔ Savings goal
• *billsplit <3000 4>* ➔ Bill split`;

export const WEB_COMMANDS = [
  { cmd: 'invoice', example: '!invoice Ahmed | Chai 2 500 ; Cake 1 1200', desc: 'Invoice banayein' },
  { cmd: 'expense', example: '!expense add 500 chai', desc: 'Kharcha hisab' },
  { cmd: 'todo', example: '!todo add Doodh lena', desc: 'To-do list' },
  { cmd: 'notes', example: '!notes save List | doodh, anday', desc: 'Notes' },
  { cmd: 'sendlater', example: '!sendlater 2h Meeting yaad dilana', desc: 'Scheduled message' },
  { cmd: 'qreply', example: '!qreply add salam | Walaikum Assalam', desc: 'Quick replies' },
  { cmd: 'orderbook', example: '!order Ahmed | Biryani x2 @250', desc: 'Order book' },
  { cmd: 'pricelist', example: '!pricelist add Chai | 150', desc: 'Price list' },
  { cmd: 'attendance', example: '!attend', desc: 'Hazri lagayein' },
  { cmd: 'meeting', example: '!meeting 30m Team standup', desc: 'Meeting reminder' },
  { cmd: 'email', example: '!email ali@mail.com | Salam | Kaam ho gaya', desc: 'Email draft link' },
  { cmd: 'csvlog', example: '!csvlog expenses', desc: 'CSV download' },
  { cmd: 'bizcard', example: '!bizcard Ahmed | 03001234567 | Awax Store', desc: 'Digital visiting card' },
  { cmd: 'review', example: '!review Bot bohat kaam ka hai', desc: 'Feedback jama karein' },
  { cmd: 'cryptoalert', example: '!cryptoalert btc above 90000', desc: 'Crypto price alerts' },
  { cmd: 'stocks', example: '!stocks aapl', desc: 'Stock prices' },
  { cmd: 'goldrate', example: '!goldrate', desc: 'Sona rate (andaza)' },
  { cmd: 'forex', example: '!forex', desc: 'USD/PKR & more' },
  { cmd: 'salarytax', example: '!salarytax 150000', desc: 'Income tax andaza' },
  { cmd: 'budget', example: '!budget set 50000', desc: 'Monthly budget' },
  { cmd: 'savegoal', example: '!savegoal Umrah 500000', desc: 'Savings goal' },
  { cmd: 'billsplit', example: '!billsplit 3000 4', desc: 'Bill split' },
];

// ---------------- data ----------------
const BIZ_FILE = 'batch5-biz.json';
const MONEY_FILE = 'batch5-money.json';
const TZ = 'Asia/Karachi';

const bizDef = () => ({ todos: {}, notes: {}, expenses: {}, orders: [], prices: {}, qreplies: {}, attendance: {}, feedback: [] });
const moneyDef = () => ({ budgets: {}, goals: {}, alerts: [] });
const getBiz = () => readData(BIZ_FILE, bizDef());
const getMoney = () => readData(MONEY_FILE, moneyDef());

// ---------------- helpers ----------------
function parseAmt(s) {
  if (s == null) return NaN;
  const cleaned = String(s).replace(/,/g, '').replace(/\brs\.?\b|\bpkrs?\b/gi, '').trim();
  if (cleaned === '') return NaN;
  return Number(cleaned);
}
const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });
const monthKey = () => todayKey().slice(0, 7);
const prettyDate = () => new Date().toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
const prettyTime = () => new Date().toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

function bar(pct, len = 10) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  const f = Math.round((p / 100) * len);
  return '█'.repeat(f) + '░'.repeat(len - f) + ` ${p.toFixed(0)}%`;
}

function parseDelay(s) {
  const m = String(s || '').trim().match(/^(\d+)\s*(s|sec|m|min|h|hour|d|day)s?$/i);
  if (!m) return null;
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2].toLowerCase()[0]];
  const ms = Number(m[1]) * mult;
  return ms > 0 && ms <= 7 * 86400000 ? ms : null;
}
function delayLabel(ms) {
  if (ms < 60000) return `${Math.round(ms / 1000)} second`;
  if (ms < 3600000) return `${Math.round(ms / 60000)} minute`;
  if (ms < 86400000) return `${Math.round(ms / 3600000)} ghanta`;
  return `${Math.round(ms / 86400000)} din`;
}

async function say(ctx, text) {
  const { bot, from } = ctx || {};
  try {
    if (bot && typeof bot.sendMessage === 'function') {
      await bot.sendMessage(from, String(text));
      return true;
    }
  } catch (e) { /* fall through */ }
  try {
    if (bot && bot.sock && typeof bot.sock.sendMessage === 'function') {
      await bot.sock.sendMessage(from, { text: String(text) }, { quoted: ctx.msg });
      return true;
    }
  } catch (e) { /* fall through */ }
  return false;
}

async function sendDoc(ctx, buffer, fileName, mimetype, caption) {
  const { bot, from } = ctx || {};
  const payload = { document: buffer, mimetype, fileName };
  if (caption) payload.caption = caption;
  try {
    if (bot && typeof bot.sendMessage === 'function') {
      await bot.sendMessage(from, payload);
      return true;
    }
  } catch (e) { /* fall through */ }
  try {
    if (bot && bot.sock && typeof bot.sock.sendMessage === 'function') {
      await bot.sock.sendMessage(from, payload, { quoted: ctx.msg });
      return true;
    }
  } catch (e) { /* fall through */ }
  return false;
}

async function fetchJson(url, ms = 15000, opts = {}) {
  const { fetchJsonRetry } = await import('./api-helper.js');
  return await fetchJsonRetry(url, { timeout: ms, retries: 2, headers: { 'User-Agent': opts.ua || 'AwaisxBot/1.0' } });
}
async function fetchText(url, ms = 15000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { 'User-Agent': 'AwaisxBot/1.0' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.text();
}
function csvEsc(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// Every handler is wrapped so it can NEVER throw to the dispatcher.
const safe = (fn) => async (ctx, query) => {
  try { await fn(ctx, query || ''); }
  catch (e) { try { await say(ctx, '⚠️ Kuch garbar ho gayi, dobara try karein.'); } catch (e2) { /* noop */ } }
};

// ================= 1. INVOICE =================
function parseInvoice(query) {
  const parts = String(query).split('|').map(s => s.trim());
  if (parts.length < 2 || !parts[0]) return null;
  const client = parts[0];
  let note = '';
  const items = [];
  for (const seg of parts.slice(1).join('|').split(';')) {
    const s = seg.trim();
    if (!s) continue;
    const nm = s.match(/^note\s*:\s*(.+)$/i);
    if (nm) { note = nm[1].trim(); continue; }
    const toks = s.split(/\s+/);
    if (toks.length < 3) return null;
    const price = parseAmt(toks.pop());
    const qty = parseAmt(toks.pop());
    const name = toks.join(' ');
    if (!name || !isFinite(qty) || !isFinite(price) || qty <= 0 || price < 0) return null;
    items.push({ name, qty, price });
  }
  if (!items.length) return null;
  return { client, items, note };
}

async function hInvoice(ctx, query) {
  const p = ctx.prefix || '!';
  const q = (query || '').trim();
  if (!q) return say(ctx,
    `🧾 *Invoice banayein:*\n${p}invoice <client> | <item> <qty> <price> ; <item2> <qty> <price>\n\n` +
    `Misaal:\n${p}invoice Ahmed | Chai 2 500 ; Cake 1 1200\n\n` +
    `Note ke liye aakhir mein: \`; Note: advance mil gaya\``);
  const inv = parseInvoice(q);
  if (!inv) return say(ctx, `❌ Format samajh nahi aaya.\n\nMisaal:\n${p}invoice Ahmed | Chai 2 500 ; Cake 1 1200`);
  const invNo = 'INV-' + todayKey().replace(/-/g, '') + '-' +
    new Date().toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/:/g, '');
  let total = 0;
  const lines = inv.items.map((it, i) => {
    const amt = it.qty * it.price;
    total += amt;
    return `${i + 1}. ${it.name} — ${fmtNum(it.qty)} x Rs ${fmtNum(it.price)} = *Rs ${fmtNum(amt)}*`;
  });
  let out = `🧾 *INVOICE ${invNo}*\n👤 Client: ${inv.client}\n📅 ${prettyDate()}\n\n${lines.join('\n')}\n\nSubtotal: Rs ${fmtNum(total)}\n*Total: Rs ${fmtNum(total)}*`;
  if (inv.note) out += `\n\n📝 Note: ${inv.note}`;
  out += `\n\nShukriya! 🙏`;
  return say(ctx, out);
}

// ================= 2. EXPENSE =================
async function hExpense(ctx, query) {
  const p = ctx.prefix || '!';
  const usage = `💸 *Kharcha hisab:*\n${p}expense add <amount> <note>\n${p}expense today | week | month\n${p}expense list\n${p}expense del <number>\n\nMisaal: ${p}expense add 500 chai`;
  const q = (query || '').trim();
  if (!q) return say(ctx, usage);
  const d = getBiz();
  const uid = ctx.sender;
  d.expenses[uid] = d.expenses[uid] || [];
  const arr = d.expenses[uid];
  const [sub, ...rest] = q.split(/\s+/);
  const s = sub.toLowerCase();
  if (s === 'add') {
    const amt = parseAmt(rest[0]);
    const note = rest.slice(1).join(' ') || '—';
    if (!isFinite(amt) || amt <= 0) return say(ctx, `❌ Amount theek likhein.\nMisaal: ${p}expense add 500 chai`);
    arr.push({ amt, note, date: todayKey(), t: Date.now() });
    writeData(BIZ_FILE, d);
    return say(ctx, `✅ Rs ${fmtNum(amt)} save ho gaya (${note}).`);
  }
  if (s === 'today' || s === 'week' || s === 'month') {
    let list = arr;
    if (s === 'today') list = arr.filter(e => e.date === todayKey());
    else if (s === 'week') {
      const cut = new Date(Date.now() - 6 * 86400000).toLocaleDateString('en-CA', { timeZone: TZ });
      list = arr.filter(e => (e.date || '') >= cut);
    } else list = arr.filter(e => (e.date || '').slice(0, 7) === monthKey());
    const tot = list.reduce((a, e) => a + (e.amt || 0), 0);
    const label = s === 'today' ? 'Aaj' : s === 'week' ? 'Is haftay' : 'Is mahinay';
    return say(ctx, `💸 *${label} ka kharcha:* Rs ${fmtNum(tot)}\n(${list.length} entries)`);
  }
  if (s === 'list') {
    if (!arr.length) return say(ctx, '📭 Abhi koi kharcha save nahi.');
    const shown = arr.slice(-10);
    const start = arr.length - shown.length;
    const lines = shown.map((e, i) => `${start + i + 1}. Rs ${fmtNum(e.amt)} — ${e.note} (${e.date || '?'})`);
    const tot = arr.reduce((a, e) => a + (e.amt || 0), 0);
    return say(ctx, `💸 *Kharcha list:*\n${lines.join('\n')}\n\nTotal: Rs ${fmtNum(tot)}`);
  }
  if (s === 'del' || s === 'delete' || s === 'remove') {
    const n = parseInt(rest[0], 10);
    if (!n || n < 1 || n > arr.length) return say(ctx, `❌ Number 1 se ${arr.length} tak likhein.`);
    const [gone] = arr.splice(n - 1, 1);
    writeData(BIZ_FILE, d);
    return say(ctx, `🗑️ Rs ${fmtNum(gone.amt)} (${gone.note}) delete ho gaya.`);
  }
  return say(ctx, usage);
}

// ================= 3. TODO =================
async function hTodo(ctx, query) {
  const p = ctx.prefix || '!';
  const usage = `📝 *To-do list:*\n${p}todo add <kaam>\n${p}todo list\n${p}todo done <number>\n${p}todo del <number>\n\nMisaal: ${p}todo add Doodh lena`;
  const q = (query || '').trim();
  if (!q) return say(ctx, usage);
  const d = getBiz();
  const uid = ctx.sender;
  d.todos[uid] = d.todos[uid] || [];
  const arr = d.todos[uid];
  const [sub, ...rest] = q.split(/\s+/);
  const s = sub.toLowerCase();
  const tail = rest.join(' ');
  if (s === 'add') {
    if (!tail) return say(ctx, `❌ Kaam likhein. Misaal: ${p}todo add Doodh lena`);
    arr.push({ text: tail, t: Date.now() });
    writeData(BIZ_FILE, d);
    return say(ctx, `✅ Add ho gaya: "${tail}"`);
  }
  if (s === 'list') {
    if (!arr.length) return say(ctx, '📭 List khaali hai. Maza karein! 🎉');
    return say(ctx, `📝 *Aapki to-do list:*\n` + arr.map((t, i) => `${i + 1}. ${t.text}`).join('\n'));
  }
  if (s === 'done' || s === 'del' || s === 'delete' || s === 'remove') {
    const n = parseInt(rest[0], 10);
    if (!n || n < 1 || n > arr.length) return say(ctx, `❌ Number 1 se ${arr.length} tak likhein.`);
    const [gone] = arr.splice(n - 1, 1);
    writeData(BIZ_FILE, d);
    return say(ctx, s === 'done' ? `🎉 Mubarak! Kaam khatam: "${gone.text}"` : `🗑️ Delete ho gaya: "${gone.text}"`);
  }
  return say(ctx, usage);
}

// ================= 4. NOTES =================
async function hNotes(ctx, query) {
  const p = ctx.prefix || '!';
  const usage = `🗒️ *Notes:*\n${p}notes save <title> | <text>\n${p}notes list\n${p}notes get <number>\n${p}notes del <number>\n\nMisaal: ${p}notes save Shopping | doodh, anday, chai`;
  const q = (query || '').trim();
  if (!q) return say(ctx, usage);
  const d = getBiz();
  const uid = ctx.sender;
  d.notes[uid] = d.notes[uid] || [];
  const arr = d.notes[uid];
  const [sub, ...rest] = q.split(/\s+/);
  const s = sub.toLowerCase();
  const tail = rest.join(' ');
  if (s === 'save') {
    const parts = tail.split('|').map(x => x.trim());
    if (parts.length < 2 || !parts[0] || !parts.slice(1).join(' | ')) return say(ctx, `❌ Format: ${p}notes save <title> | <text>`);
    arr.push({ title: parts[0], text: parts.slice(1).join(' | '), t: Date.now() });
    writeData(BIZ_FILE, d);
    return say(ctx, `✅ Note save ho gaya: "${parts[0]}"`);
  }
  if (s === 'list') {
    if (!arr.length) return say(ctx, '📭 Koi note nahi.');
    return say(ctx, `🗒️ *Aapke notes:*\n` + arr.map((n, i) => `${i + 1}. ${n.title}`).join('\n'));
  }
  if (s === 'get' || s === 'show' || s === 'read') {
    const n = parseInt(rest[0], 10);
    if (!n || n < 1 || n > arr.length) return say(ctx, `❌ Number 1 se ${arr.length} tak.`);
    const nt = arr[n - 1];
    return say(ctx, `🗒️ *${nt.title}*\n\n${nt.text}`);
  }
  if (s === 'del' || s === 'delete' || s === 'remove') {
    const n = parseInt(rest[0], 10);
    if (!n || n < 1 || n > arr.length) return say(ctx, `❌ Number 1 se ${arr.length} tak.`);
    const [gone] = arr.splice(n - 1, 1);
    writeData(BIZ_FILE, d);
    return say(ctx, `🗑️ Note delete: "${gone.title}"`);
  }
  return say(ctx, usage);
}

// ================= 5. SENDLATER =================
async function hSendLater(ctx, query) {
  const p = ctx.prefix || '!';
  const q = (query || '').trim();
  if (!q) return say(ctx, `⏰ *Scheduled message:*\n${p}sendlater <10m|2h|1d> <text>\n\nMisaal: ${p}sendlater 2h Meeting yaad dilana`);
  const sp = q.indexOf(' ');
  const dl = sp === -1 ? q : q.slice(0, sp);
  const text = sp === -1 ? '' : q.slice(sp + 1).trim();
  const ms = parseDelay(dl);
  if (ms == null || !text) return say(ctx, `❌ Format: ${p}sendlater <10m|2h|1d> <text>`);
  const bot = ctx.bot, from = ctx.from;
  const timer = setTimeout(() => {
    try { if (bot && typeof bot.sendMessage === 'function') bot.sendMessage(from, `⏰ *Scheduled message:*\n${text}`); } catch (e) { /* noop */ }
  }, ms);
  if (timer.unref) timer.unref();
  return say(ctx, `⏰ ${delayLabel(ms)} baad bhejunga ✅`);
}

// ================= 6. QREPLY =================
async function hQReply(ctx, query) {
  const p = ctx.prefix || '!';
  const usage = `⚡ *Quick replies:*\n${p}qreply add <naam> | <text>\n${p}qreply <naam>\n${p}qreply list\n${p}qreply del <naam>\n\nMisaal: ${p}qreply add salam | Walaikum Assalam!`;
  const q = (query || '').trim();
  if (!q) return say(ctx, usage);
  const d = getBiz();
  const uid = ctx.sender;
  d.qreplies[uid] = d.qreplies[uid] || {};
  const map = d.qreplies[uid];
  const [sub, ...rest] = q.split(/\s+/);
  const s = sub.toLowerCase();
  const tail = rest.join(' ');
  if (s === 'add') {
    const parts = tail.split('|').map(x => x.trim());
    if (parts.length < 2 || !parts[0] || !parts.slice(1).join(' | ')) return say(ctx, `❌ Format: ${p}qreply add <naam> | <text>`);
    map[parts[0].toLowerCase()] = { name: parts[0], text: parts.slice(1).join(' | ') };
    writeData(BIZ_FILE, d);
    return say(ctx, `✅ Quick reply save: "${parts[0]}"`);
  }
  if (s === 'list') {
    const ks = Object.values(map);
    if (!ks.length) return say(ctx, '📭 Koi quick reply nahi.');
    return say(ctx, `⚡ *Quick replies:*\n` + ks.map(k => `• ${k.name}`).join('\n'));
  }
  if (s === 'del' || s === 'delete' || s === 'remove') {
    const key = tail.toLowerCase();
    if (!map[key]) return say(ctx, `❌ "${tail}" nahi mila.`);
    delete map[key];
    writeData(BIZ_FILE, d);
    return say(ctx, `🗑️ "${tail}" delete ho gaya.`);
  }
  const hit = map[q.toLowerCase()];
  if (hit) return say(ctx, hit.text);
  return say(ctx, `❌ "${q}" nahi mila.\n${p}qreply list se dekhein.`);
}

// ================= 7. ORDERBOOK =================
function parseOrder(q) {
  const parts = String(q).split('|').map(s => s.trim());
  if (parts.length < 2 || !parts[0]) return null;
  const rest = parts.slice(1).join('|').trim();
  const m = rest.match(/^(.*?)\s*x\s*(\d+)\s*@\s*([\d.,]+)\s*$/i);
  if (!m) return null;
  const qty = parseInt(m[2], 10), price = parseAmt(m[3]);
  if (!m[1].trim() || !isFinite(qty) || qty <= 0 || !isFinite(price) || price < 0) return null;
  return { customer: parts[0], item: m[1].trim(), qty, price };
}

async function hOrderbook(ctx, query) {
  const p = ctx.prefix || '!';
  const usage = `📦 *Order book:*\n${p}order <customer> | <item> x<qty> @<price>\n${p}orders — pending list\n${p}orders done <number>\n${p}orders total\n\nMisaal: ${p}order Ahmed | Biryani x2 @250`;
  const q = (query || '').trim();
  const d = getBiz();
  d.orders = d.orders || [];
  const pend = () => d.orders.filter(o => o.status === 'pending');
  if (!q) return say(ctx, usage);
  const [sub, ...rest] = q.split(/\s+/);
  const s = sub.toLowerCase();
  if (s === 'list') {
    const list = pend();
    if (!list.length) return say(ctx, '📭 Koi pending order nahi.');
    const lines = list.map((o, i) => `${i + 1}. ${o.customer} — ${o.item} x${o.qty} = Rs ${fmtNum(o.qty * o.price)}`);
    return say(ctx, `📦 *Pending orders (${list.length}):*\n${lines.join('\n')}`);
  }
  if (s === 'done') {
    const n = parseInt(rest[0], 10);
    const list = pend();
    if (!n || n < 1 || n > list.length) return say(ctx, `❌ Number 1 se ${list.length} tak.`);
    const target = list[n - 1];
    const idx = d.orders.indexOf(target);
    if (idx !== -1) d.orders.splice(idx, 1);
    writeData(BIZ_FILE, d);
    return say(ctx, `✅ Order complete: ${target.customer} — ${target.item} x${target.qty}`);
  }
  if (s === 'total') {
    const tot = pend().reduce((a, o) => a + o.qty * o.price, 0);
    return say(ctx, `💰 Pending orders total: *Rs ${fmtNum(tot)}*`);
  }
  const o = parseOrder(q);
  if (!o) return say(ctx, `❌ Format samajh nahi aaya.\n\nMisaal: ${p}order Ahmed | Biryani x2 @250`);
  d.orders.push({ ...o, status: 'pending', by: ctx.senderName || '', t: Date.now() });
  writeData(BIZ_FILE, d);
  return say(ctx, `✅ Order save ho gaya:\n👤 ${o.customer}\n🍱 ${o.item} x${o.qty} @ Rs ${fmtNum(o.price)}\n💰 Total: Rs ${fmtNum(o.qty * o.price)}`);
}

// ================= 8. PRICELIST =================
async function hPricelist(ctx, query) {
  const p = ctx.prefix || '!';
  const usage = `🏷️ *Price list:*\n${p}price add <item> | <amount>\n${p}price <item>\n${p}price list\n${p}price del <item>\n\nMisaal: ${p}price add Chai | 150`;
  const q = (query || '').trim();
  if (!q) return say(ctx, usage);
  const d = getBiz();
  d.prices = d.prices || {};
  const [sub, ...rest] = q.split(/\s+/);
  const s = sub.toLowerCase();
  const tail = rest.join(' ');
  if (s === 'add') {
    const parts = tail.split('|').map(x => x.trim());
    const amt = parseAmt(parts[1]);
    if (parts.length < 2 || !parts[0] || !isFinite(amt) || amt < 0) return say(ctx, `❌ Format: ${p}price add <item> | <amount>`);
    d.prices[parts[0].toLowerCase()] = { name: parts[0], price: amt };
    writeData(BIZ_FILE, d);
    return say(ctx, `✅ "${parts[0]}" = Rs ${fmtNum(amt)}`);
  }
  if (s === 'list') {
    const ks = Object.values(d.prices);
    if (!ks.length) return say(ctx, '📭 Price list khaali hai.');
    return say(ctx, `🏷️ *Price list:*\n` + ks.map(k => `• ${k.name}: Rs ${fmtNum(k.price)}`).join('\n'));
  }
  if (s === 'del' || s === 'delete' || s === 'remove') {
    const key = tail.toLowerCase();
    if (!d.prices[key]) return say(ctx, `❌ "${tail}" nahi mila.`);
    delete d.prices[key];
    writeData(BIZ_FILE, d);
    return say(ctx, `🗑️ "${tail}" delete ho gaya.`);
  }
  const hit = d.prices[q.toLowerCase()];
  if (hit) return say(ctx, `🏷️ ${hit.name}: *Rs ${fmtNum(hit.price)}*`);
  return say(ctx, `❌ "${q}" price list mein nahi.\n${p}price list se dekhein.`);
}

// ================= 9. ATTENDANCE =================
async function hAttendance(ctx, query) {
  const p = ctx.prefix || '!';
  const q = (query || '').trim().toLowerCase();
  const d = getBiz();
  d.attendance[ctx.from] = d.attendance[ctx.from] || {};
  const g = d.attendance[ctx.from];
  const t = todayKey();
  if (!q || q === 'mark') {
    g[t] = g[t] || {};
    const nm = ctx.senderName || (ctx.sender || '').split('@')[0];
    if (g[t][ctx.sender]) return say(ctx, `✅ ${nm} ki hazri pehle se lagi hui hai.`);
    g[t][ctx.sender] = nm;
    writeData(BIZ_FILE, d);
    return say(ctx, `✅ Hazri lag gayi! (${prettyDate()} ${prettyTime()})`);
  }
  if (q === 'list') {
    const day = g[t] || {};
    const names = Object.values(day);
    if (!names.length) return say(ctx, `📭 Aaj (${prettyDate()}) kisi ki hazri nahi lagi.`);
    return say(ctx, `📋 *Aaj ki hazri (${names.length}):*\n` + names.map((n, i) => `${i + 1}. ${n}`).join('\n'));
  }
  if (q === 'report') {
    const mk = monthKey();
    const days = Object.keys(g).filter(k => (k || '').slice(0, 7) === mk);
    if (!days.length) return say(ctx, '📭 Is mahinay koi hazri nahi.');
    const counts = {}, names = {};
    for (const day of days) for (const [jid, nm] of Object.entries(g[day] || {})) {
      counts[jid] = (counts[jid] || 0) + 1;
      names[jid] = nm;
    }
    const rows = Object.entries(counts)
      .map(([jid, c]) => ({ name: names[jid] || jid, c, pct: (c / days.length) * 100 }))
      .sort((a, b) => b.pct - a.pct);
    return say(ctx, `📊 *Hazri report — ${mk}*\n(Kul ${days.length} din)\n` +
      rows.map((r, i) => `${i + 1}. ${r.name}: ${r.c}/${days.length} (${r.pct.toFixed(0)}%)`).join('\n'));
  }
  return say(ctx, `📋 *Hazri:*\n${p}attend — hazri lagayein\n${p}attend list — aaj ki list\n${p}attend report — mahinay ki report`);
}

// ================= 10. MEETING =================
async function hMeeting(ctx, query) {
  const p = ctx.prefix || '!';
  const q = (query || '').trim();
  if (!q) return say(ctx, `📢 *Meeting reminder:*\n${p}meeting <10m|2h|1d> <topic>\n\nMisaal: ${p}meeting 30m Team standup`);
  const sp = q.indexOf(' ');
  const dl = sp === -1 ? q : q.slice(0, sp);
  const topic = sp === -1 ? '' : q.slice(sp + 1).trim();
  const ms = parseDelay(dl);
  if (ms == null || !topic) return say(ctx, `❌ Format: ${p}meeting <10m|2h|1d> <topic>`);
  const bot = ctx.bot, from = ctx.from;
  const timer = setTimeout(() => {
    try { if (bot && typeof bot.sendMessage === 'function') bot.sendMessage(from, `📢 *Meeting reminder:*\n${topic}\n\n${prettyTime()} — waqt ho gaya!`); } catch (e) { /* noop */ }
  }, ms);
  if (timer.unref) timer.unref();
  await say(ctx, `📢 Theek hai! ${delayLabel(ms)} baad yaad dilaunga:\n"${topic}"`);
  // AI agenda — best effort, silent on failure or demo mode
  (async () => {
    try {
      const agenda = await askAI(`Is meeting topic ke liye 3 mukhtasar agenda points likho (Roman Urdu, har point ek line): ${topic}`, ctx.senderName);
      if (agenda && !/demo mode/i.test(agenda) && bot && typeof bot.sendMessage === 'function') {
        await bot.sendMessage(from, `📋 *Meeting agenda (AI):*\n${agenda}`);
      }
    } catch (e) { /* noop */ }
  })();
}

// ================= 11. EMAIL =================
async function hEmail(ctx, query) {
  const p = ctx.prefix || '!';
  const q = (query || '').trim();
  if (!q) return say(ctx, `📧 *Email draft:*\n${p}email <to> | <subject> | <body>\n\nMisaal: ${p}email ahmed@gmail.com | Salam | Kaam ho gaya`);
  const parts = q.split('|').map(s => s.trim());
  if (parts.length < 3 || !/^\S+@\S+\.\S+$/.test(parts[0])) {
    return say(ctx, `❌ Format: ${p}email <to> | <subject> | <body>\nEmail address theek likhein.`);
  }
  const to = parts[0], sub = parts[1], body = parts.slice(2).join(' | ');
  const link = 'https://mail.google.com/mail/?view=cm&to=' + encodeURIComponent(to) +
    '&su=' + encodeURIComponent(sub) + '&body=' + encodeURIComponent(body);
  return say(ctx, `📧 *Email draft tayyar:*\n\nTo: ${to}\nSubject: ${sub}\n\n${body}\n\n👇 Neeche link tap karke apne mail app se bhejein (bot ke paas SMTP nahi):\n${link}`);
}

// ================= 12. CSVLOG =================
async function hCsvlog(ctx, query) {
  const p = ctx.prefix || '!';
  const q = (query || '').trim().toLowerCase();
  if (!['expenses', 'orders', 'todos'].includes(q)) {
    return say(ctx, `📊 *CSV download:*\n${p}csvlog expenses\n${p}csvlog orders\n${p}csvlog todos`);
  }
  const d = getBiz();
  let csv, fname;
  if (q === 'expenses') {
    const arr = d.expenses[ctx.sender] || [];
    csv = 'date,amount,note\n' + arr.map(e => [csvEsc(e.date), csvEsc(e.amt), csvEsc(e.note)].join(',')).join('\n');
    fname = 'expenses.csv';
  } else if (q === 'orders') {
    csv = 'customer,item,qty,price,total,status\n' +
      d.orders.map(o => [csvEsc(o.customer), csvEsc(o.item), o.qty, csvEsc(o.price), csvEsc(o.qty * o.price), csvEsc(o.status)].join(',')).join('\n');
    fname = 'orders.csv';
  } else {
    const arr = d.todos[ctx.sender] || [];
    csv = 'task\n' + arr.map(t => csvEsc(t.text)).join('\n');
    fname = 'todos.csv';
  }
  const ok = await sendDoc(ctx, Buffer.from(csv, 'utf-8'), fname, 'text/csv', `📊 ${fname} — ${q} ka record`);
  if (!ok) return say(ctx, '❌ File nahi bhej saka.');
  return say(ctx, `✅ ${fname} bhej di!`);
}

// ================= 13. BIZCARD =================
async function hBizcard(ctx, query) {
  const p = ctx.prefix || '!';
  const q = (query || '').trim();
  if (!q) return say(ctx, `📇 *Digital visiting card:*\n${p}bizcard <naam> | <phone> | <business>\n\nMisaal: ${p}bizcard Ahmed | 03001234567 | Awax Store`);
  const parts = q.split('|').map(s => s.trim());
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    return say(ctx, `❌ Format: ${p}bizcard <naam> | <phone> | <business>`);
  }
  const [name, phone, biz] = parts;
  const vcf = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${name}`, biz ? `ORG:${biz}` : '', `TEL;TYPE=CELL:${phone}`, 'END:VCARD']
    .filter(Boolean).join('\n');
  const ok = await sendDoc(ctx, Buffer.from(vcf, 'utf-8'), `${name.replace(/\s+/g, '_')}.vcf`, 'text/vcard', `📇 ${name} ka contact card — save kar lein!`);
  if (!ok) return say(ctx, '❌ Card nahi bhej saka.');
  return say(ctx, `✅ Visiting card bhej diya!`);
}

// ================= 14. FEEDBACK =================
async function hFeedback(ctx, query) {
  const p = ctx.prefix || '!';
  const q = (query || '').trim();
  const d = getBiz();
  d.feedback = d.feedback || [];
  if (!q) return say(ctx, `⭐ *Feedback:*\n${p}review <aapki raay>\n\nMisaal: ${p}review Bot bohat kaam ka hai!`);
  if (q.toLowerCase() === 'list') {
    if (ctx.isGroup) {
      const admin = await isGroupAdmin(ctx.bot && ctx.bot.sock, ctx.from, ctx.sender);
      if (!admin) return say(ctx, '🔒 Feedback list sirf admin dekh sakta hai.');
    }
    if (!d.feedback.length) return say(ctx, '📭 Abhi koi feedback nahi.');
    const last = d.feedback.slice(-10).reverse();
    return say(ctx, `⭐ *Feedback (${d.feedback.length}):*\n` +
      last.map((f, i) => `${i + 1}. "${f.text}" — ${f.from}`).join('\n'));
  }
  d.feedback.push({ from: ctx.senderName || ctx.sender, jid: ctx.sender, text: q, t: Date.now() });
  writeData(BIZ_FILE, d);
  return say(ctx, '🙏 Shukriya! Aapka feedback save ho gaya.');
}

// ================= 15. CRYPTOALERT =================
const COINS = {
  btc: 'bitcoin', eth: 'ethereum', sol: 'solana', bnb: 'binancecoin', xrp: 'ripple',
  doge: 'dogecoin', ada: 'cardano', trx: 'tron', link: 'chainlink', dot: 'polkadot',
  ltc: 'litecoin', avax: 'avalanche-2', shib: 'shiba-inu', pepe: 'pepe',
  usdt: 'tether', matic: 'matic-network',
};
let alertTimer = null;
let alertBot = null;

function startAlertLoop() {
  if (alertTimer) return;
  alertTimer = setInterval(async () => {
    try {
      const m = getMoney();
      if (!m.alerts || !m.alerts.length || !alertBot) return;
      const keep = [];
      for (const a of m.alerts) {
        try {
          const data = await fetchJson(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(a.coin)}&vs_currencies=usd`);
          const price = data && data[a.coin] && data[a.coin].usd;
          if (!isFinite(price)) { keep.push(a); continue; }
          const hit = a.dir === 'above' ? price >= a.price : price <= a.price;
          if (hit) {
            try { await alertBot.sendMessage(a.chat, `🚨 *Crypto Alert:* ${a.sym.toUpperCase()} $${fmtNum(price)}\nTarget: ${a.dir} $${fmtNum(a.price)} — hit ho gaya!`); } catch (e) { /* noop */ }
          } else keep.push(a);
        } catch (e) { keep.push(a); }
      }
      if (keep.length !== m.alerts.length) { m.alerts = keep; writeData(MONEY_FILE, m); }
    } catch (e) { /* noop */ }
  }, 120000);
  if (alertTimer.unref) alertTimer.unref();
}

async function hCryptoalert(ctx, query) {
  const p = ctx.prefix || '!';
  const usage = `🚨 *Crypto price alerts:*\n${p}cryptoalert <coin> <above|below> <price>\n${p}cryptoalert list\n${p}cryptoalert del <number>\n\nMisaal: ${p}cryptoalert btc above 90000`;
  const q = (query || '').trim();
  if (!q) return say(ctx, usage);
  alertBot = ctx.bot;
  const m = getMoney();
  m.alerts = m.alerts || [];
  const [sub, ...rest] = q.split(/\s+/);
  const s = sub.toLowerCase();
  if (s === 'list') {
    if (!m.alerts.length) return say(ctx, '📭 Koi alert set nahi.');
    return say(ctx, `🚨 *Crypto alerts:*\n` +
      m.alerts.map((a, i) => `${i + 1}. ${a.sym.toUpperCase()} ${a.dir} $${fmtNum(a.price)}`).join('\n'));
  }
  if (s === 'del' || s === 'delete' || s === 'remove') {
    const n = parseInt(rest[0], 10);
    if (!n || n < 1 || n > m.alerts.length) return say(ctx, `❌ Number 1 se ${m.alerts.length} tak.`);
    const [gone] = m.alerts.splice(n - 1, 1);
    writeData(MONEY_FILE, m);
    return say(ctx, `🗑️ Alert delete: ${gone.sym.toUpperCase()} ${gone.dir} $${fmtNum(gone.price)}`);
  }
  const dir = (rest[0] || '').toLowerCase();
  const price = parseAmt(rest[1]);
  if (!['above', 'below'].includes(dir) || !isFinite(price) || price <= 0) return say(ctx, usage);
  const coin = COINS[s] || s;
  m.alerts.push({ chat: ctx.from, coin, sym: s, dir, price, t: Date.now() });
  writeData(MONEY_FILE, m);
  startAlertLoop();
  return say(ctx, `🚨 Alert set! ${s.toUpperCase()} jab $${fmtNum(price)} se ${dir === 'above' ? 'upar' : 'neeche'} jayega to khabar dunga.`);
}

// ================= 16. STOCKS =================
async function hStocks(ctx, query) {
  const p = ctx.prefix || '!';
  const q = (query || '').trim();
  if (!q) return say(ctx, `📈 *Stock prices:*\n${p}stocks <symbol>\n\nMisaal: ${p}stocks aapl\nPakistan index: ${p}stocks kse`);
  let sym = q.toUpperCase();
  if (sym === 'KSE' || sym === 'PSX') sym = '^KSE100';
  try {
    const data = await fetchJson(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`, 15000, {
      ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    });
    const meta = data?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    const prev = meta?.previousClose || meta?.chartPreviousClose;
    if (!isFinite(price)) throw new Error('N/D');
    const chg = isFinite(prev) && prev ? ((price - prev) / prev) * 100 : 0;
    const arrow = chg >= 0 ? '🟢' : '🔴';
    return say(ctx, `${arrow} *${meta.symbol || sym}* — ${fmtNum(price)}\nPrev close: ${fmtNum(prev)} | Change: ${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%\n📅 ${meta.exchangeName || ''}`);
  } catch (e) {
    return say(ctx, `❌ "${q}" ka rate nahi mil saka. Symbol check karein (misaal: aapl, tsla, kse).`);
  }
}

// ================= 17. GOLDRATE =================
async function hGoldrate(ctx, query) {
  try {
    const [goldData, fx] = await Promise.all([
      fetchJson('https://api.gold-api.com/price/XAU'),
      fetchJson('https://open.er-api.com/v6/latest/USD'),
    ]);
    const xau = goldData?.price;
    const pkr = fx && fx.rates && fx.rates.PKR;
    if (!isFinite(xau) || !isFinite(pkr)) throw new Error('bad data');
    const tola = (xau / 31.1035) * 11.6638 * pkr;
    return say(ctx, `🥇 *Aaj sona (live):*\nRs ${fmtNum(Math.round(tola))} / tola\n\n(XAU $${fmtNum(Math.round(xau))} × USD/PKR ${fmtNum(pkr)})\n_Ye live market rate hai, sarafa rate thora farq ho sakta hai._`);
  } catch (e) {
    return say(ctx, `🥇 *Sona (andaza, offline):*\nRs ~278,000 / tola\n\n_Live rate nahi mil saka, ye takhmeena hai._`);
  }
}

// ================= 18. FOREX =================
async function hForex(ctx, query) {
  try {
    const fx = await fetchJson('https://open.er-api.com/v6/latest/USD');
    const r = fx.rates || {};
    const want = ['PKR', 'EUR', 'GBP', 'SAR', 'AED'];
    const lines = want.map(k => (r[k] ? `• 1 USD = ${fmtNum(r[k])} ${k}` : null)).filter(Boolean);
    if (!lines.length) throw new Error('no rates');
    return say(ctx, `💱 *Forex rates (1 USD):*\n${lines.join('\n')}\n\n_Source: open.er-api.com_`);
  } catch (e) {
    return say(ctx, '❌ Forex rates nahi mil sakay. Thori dair baad try karein.');
  }
}

// ================= 19. SALARYTAX =================
function annualTax(a) {
  // FY2025-26 FBR slabs (2026-10-13: was FY2024-25 rates mislabeled)
  const lim = [600000, 1200000, 2200000, 3200000, 4100000, Infinity];
  const exc = [0, 600000, 1200000, 2200000, 3200000, 4100000];
  const base = [0, 0, 6000, 116000, 346000, 616000];
  const rate = [0, 0.01, 0.11, 0.23, 0.30, 0.35];
  for (let i = 0; i < lim.length; i++) {
    if (a <= lim[i]) return base[i] + Math.max(0, a - exc[i]) * rate[i];
  }
  return 0;
}

async function hSalarytax(ctx, query) {
  const p = ctx.prefix || '!';
  const q = (query || '').trim();
  const sal = parseAmt(q.split(/\s+/)[0]);
  if (!q || !isFinite(sal) || sal <= 0) {
    return say(ctx, `🧾 *Income tax (andaza):*\n${p}salarytax <monthly salary>\n\nMisaal: ${p}salarytax 150000`);
  }
  const annual = sal * 12;
  const taxM = annualTax(annual) / 12;
  const net = sal - taxM;
  return say(ctx, `🧾 *Salary tax — FY2025-26 slabs (andaza):*\n\nMonthly salary: Rs ${fmtNum(sal)}\nAnnual: Rs ${fmtNum(annual)}\n\nMonthly tax: *Rs ${fmtNum(Math.round(taxM))}*\nNet in hand: *Rs ${fmtNum(Math.round(net))}*\n\n_Ye sirf andaza hai, asal tax FBR rules ke mutabiq hoga._`);
}

// ================= 20. BUDGET =================
async function hBudget(ctx, query) {
  const p = ctx.prefix || '!';
  const usage = `💰 *Monthly budget:*\n${p}budget set <amount>\n${p}budget add <spent> <note>\n${p}budget left\n\nMisaal: ${p}budget set 50000`;
  const q = (query || '').trim();
  const m = getMoney();
  const uid = ctx.sender;
  const mk = monthKey();
  let b = m.budgets[uid];
  if (!b || b.month !== mk) b = null; // new month -> reset
  const show = () => {
    if (!b) return say(ctx, `📭 Budget set nahi.\n${p}budget set <amount>`);
    const left = b.amount - b.spent;
    return say(ctx, `💰 *Budget — ${mk}:*\nTotal: Rs ${fmtNum(b.amount)}\nKharch: Rs ${fmtNum(b.spent)}\nBaqi: *Rs ${fmtNum(left)}*\n\n${bar(b.amount ? (b.spent / b.amount) * 100 : 0)}`);
  };
  if (!q || q.toLowerCase() === 'left' || q.toLowerCase() === 'status') return show();
  const [sub, ...rest] = q.split(/\s+/);
  const s = sub.toLowerCase();
  if (s === 'set') {
    const amt = parseAmt(rest[0]);
    if (!isFinite(amt) || amt <= 0) return say(ctx, `❌ Amount likhein. Misaal: ${p}budget set 50000`);
    m.budgets[uid] = { amount: amt, spent: 0, month: mk };
    writeData(MONEY_FILE, m);
    return say(ctx, `✅ Monthly budget set: Rs ${fmtNum(amt)}`);
  }
  if (s === 'add') {
    if (!b) return say(ctx, `📭 Pehle budget set karein: ${p}budget set <amount>`);
    const amt = parseAmt(rest[0]);
    if (!isFinite(amt) || amt <= 0) return say(ctx, `❌ Amount likhein. Misaal: ${p}budget add 2000 sabzi`);
    b.spent += amt;
    m.budgets[uid] = b;
    writeData(MONEY_FILE, m);
    return say(ctx, `✅ Rs ${fmtNum(amt)} add ho gaya (${rest.slice(1).join(' ') || '—'}).\nBaqi: Rs ${fmtNum(b.amount - b.spent)}`);
  }
  return say(ctx, usage);
}

// ================= 21. SAVEGOAL =================
async function hSavegoal(ctx, query) {
  const p = ctx.prefix || '!';
  const usage = `🎯 *Savings goal:*\n${p}savegoal <naam> <target>\n${p}savegoal add <amount>\n${p}savegoal status\n\nMisaal: ${p}savegoal Umrah 500000`;
  const q = (query || '').trim();
  const m = getMoney();
  const uid = ctx.sender;
  const show = () => {
    const g = m.goals[uid];
    if (!g) return say(ctx, `📭 Koi goal nahi.\n${p}savegoal <naam> <target>`);
    const pct = g.target ? (g.saved / g.target) * 100 : 0;
    return say(ctx, `🎯 *${g.name}*\nTarget: Rs ${fmtNum(g.target)}\nSaved: Rs ${fmtNum(g.saved)}\nBaqi: Rs ${fmtNum(Math.max(0, g.target - g.saved))}\n\n${bar(pct)}`);
  };
  if (!q || q.toLowerCase() === 'status') return show();
  const [sub, ...rest] = q.split(/\s+/);
  if (sub.toLowerCase() === 'add') {
    const g = m.goals[uid];
    if (!g) return say(ctx, `📭 Pehle goal banayein: ${p}savegoal <naam> <target>`);
    const amt = parseAmt(rest[0]);
    if (!isFinite(amt) || amt <= 0) return say(ctx, `❌ Amount likhein. Misaal: ${p}savegoal add 5000`);
    g.saved += amt;
    writeData(MONEY_FILE, m);
    const pct = g.target ? (g.saved / g.target) * 100 : 0;
    return say(ctx, `✅ Rs ${fmtNum(amt)} save ho gaye!\n🎯 ${g.name}: ${bar(pct)}`);
  }
  const toks = q.split(/\s+/);
  const target = parseAmt(toks[toks.length - 1]);
  const name = toks.slice(0, -1).join(' ');
  if (!name || !isFinite(target) || target <= 0) return say(ctx, usage);
  m.goals[uid] = { name, target, saved: 0, t: Date.now() };
  writeData(MONEY_FILE, m);
  return say(ctx, `🎯 Goal set: "${name}" — Rs ${fmtNum(target)}\n${p}savegoal add <amount> se progress barhayein!`);
}

// ================= 22. BILLSPLIT =================
async function hBillsplit(ctx, query) {
  const p = ctx.prefix || '!';
  const q = (query || '').trim();
  if (!q) return say(ctx, `🧮 *Bill split:*\n${p}billsplit <total> <kitne log>\n${p}billsplit <total> <ali,ahmed,sara>\n\nMisaal: ${p}billsplit 3000 4`);
  const toks = q.split(/\s+/);
  const total = parseAmt(toks[0]);
  const rest = toks.slice(1).join(' ').trim();
  if (!isFinite(total) || total <= 0 || !rest) return say(ctx, `❌ Format: ${p}billsplit <total> <4 ya naam,naam>`);
  let names;
  if (/^\d+$/.test(rest)) {
    const n = parseInt(rest, 10);
    if (n < 1 || n > 100) return say(ctx, '❌ Logon ki tadad 1–100 tak.');
    names = Array.from({ length: n }, (_, i) => `Person ${i + 1}`);
  } else {
    names = rest.split(',').map(s => s.trim()).filter(Boolean);
    if (!names.length) return say(ctx, `❌ Naam comma se likhein. Misaal: ${p}billsplit 3000 ali,ahmed`);
  }
  const per = total / names.length;
  const lines = names.map(n => `• ${n}: Rs ${fmtNum(Math.round(per))}`);
  return say(ctx, `🧮 *Bill split:*\nTotal: Rs ${fmtNum(total)} (${names.length} log)\n\n${lines.join('\n')}\n\nFi banda: *Rs ${fmtNum(Math.round(per))}*`);
}

// ---------------- registry ----------------
export const HANDLERS = {
  invoice: safe(hInvoice),
  bill: 'invoice',

  expense: safe(hExpense),
  kharcha: 'expense',

  todo: safe(hTodo),
  task: 'todo',

  notes: safe(hNotes),
  note: 'notes',

  sendlater: safe(hSendLater),
  later: 'sendlater',

  qreply: safe(hQReply),
  quickreply: 'qreply',

  orderbook: safe(hOrderbook),
  order: 'orderbook',
  orders: safe((ctx, q) => hOrderbook(ctx, (q || '').trim() ? q : 'list')),

  pricelist: safe(hPricelist),

  attendance: safe(hAttendance),
  attend: 'attendance',
  hazri: 'attendance',

  meeting: safe(hMeeting),
  meet: 'meeting',

  email: safe(hEmail),
  mail: 'email',

  csvlog: safe(hCsvlog),
  sheetlog: 'csvlog',

  bizcard: safe(hBizcard),
  vcard: 'bizcard',

  review: safe(hFeedback),
  rating: 'review',

  cryptoalert: safe(hCryptoalert),
  alertcrypto: 'cryptoalert',

  stocks: safe(hStocks),
  shareprice: 'stocks',

  goldrate: safe(hGoldrate),
  sona: 'goldrate',

  forex: safe(hForex),
  usdpkr: 'forex',

  salarytax: safe(hSalarytax),
  incometax: 'salarytax',

  budget: safe(hBudget),

  savegoal: safe(hSavegoal),
  goal: 'savegoal',

  billsplit: safe(hBillsplit),
  splitbill: 'billsplit',
};

registerBatch({ MENU_SECTION, WEB_COMMANDS, HANDLERS });
