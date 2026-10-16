// Batch 6 — Health & News/Info (features 111-134 of the 134-feature set).
// Health: water/pani, medicine/med, calories, workout, sleeplog, recipe, stepchallenge.
// News & Info: paknews, cricket, football, prayeralert, rainalert, loadshed, train, jobs.
// HOSTING PATCH: none — pure feature module, no bot-core changes.
import { registerBatch, readData, writeData, fmtNum } from './batch-helpers.js';
import { askAI } from './ai.js';
import { getPrayerTimes } from './islamic.js';

const HEALTH_FILE = 'batch6-health.json';
const NEWS_FILE = 'batch6-news.json';

// ---------------- PKT time helpers ----------------
function pktParts() {
  const parts = new Intl.DateTimeFormat('en-PK', {
    timeZone: 'Asia/Karachi', hourCycle: 'h23',
    hour: '2-digit', minute: '2-digit',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const g = (t) => parts.find((p) => p.type === t)?.value || '';
  return { hm: `${g('hour')}:${g('minute')}`, date: `${g('year')}-${g('month')}-${g('day')}` };
}
function hmToMin(hm) {
  const m = String(hm).match(/(\d{1,2}):(\d{2})/);
  if (!m) return NaN;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

// ---------------- Data ----------------
function loadHealth() {
  return readData(HEALTH_FILE, { water: {}, meds: {}, sleep: {}, steps: {} });
}
function saveHealth(d) { writeData(HEALTH_FILE, d); }
function loadNews() {
  return readData(NEWS_FILE, { prayeralert: {}, loadshed: {} });
}
function saveNews(d) { writeData(NEWS_FILE, d); }

// ---------------- Bot capture / send ----------------
let liveBot = null;
function rememberBot(ctx) { if (ctx && ctx.bot) liveBot = ctx.bot; }
async function reply(ctx, text) {
  try {
    if (ctx?.bot && typeof ctx.bot.sendMessage === 'function') {
      await ctx.bot.sendMessage(ctx.from, text);
    } else if (ctx?.bot?.sock?.sendMessage) {
      await ctx.bot.sock.sendMessage(ctx.from, { text });
    }
  } catch (e) { console.error('[batch6] reply failed:', e.message); }
}
async function sendTo(chatId, text) {
  if (!liveBot || !chatId || !text) return;
  try {
    if (typeof liveBot.sendMessage === 'function') await liveBot.sendMessage(chatId, text);
    else if (liveBot.sock?.sendMessage) await liveBot.sock.sendMessage(chatId, { text });
  } catch (e) { console.error('[batch6] scheduled send failed:', e.message); }
}
const safe = (fn) => async (ctx, query) => {
  try { await fn(ctx, query || ''); }
  catch (e) {
    console.error('[batch6] handler error:', e.message);
    await reply(ctx, '⚠️ Kuch masla ho gaya, thodi dair baad dobara try karein.');
  }
};

// ---------------- Network helpers ----------------
async function fetchText(url) {
  // Use robust helper with retry (2026-10-14 fix for flaky APIs)
  const { fetchTextRetry } = await import('./api-helper.js');
  return await fetchTextRetry(url, { timeout: 15000, retries: 2 });
}
async function fetchJSON(url) { return JSON.parse(await fetchText(url)); }
function decodeEnt(s) {
  return String(s)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&quot;/g, '"');
}
function parseRSS(xml, max = 5) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) && items.length < max) {
    const body = m[1];
    const tm = body.match(/<title>([\s\S]*?)<\/title>/);
    const lm = body.match(/<link>([\s\S]*?)<\/link>/);
    const title = tm ? decodeEnt(tm[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim()) : '';
    if (!title) continue;
    const link = lm ? lm[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
    items.push({ title, link });
  }
  return items;
}

// ---------------- 1. water / pani ----------------
function usageWater(p) {
  return `💧 *Pani Reminders*\n\n• *${p}water on* ➔ Har ghante (subah 9 – raat 10) pani ki yaad-dihani\n• *${p}water off* ➔ Reminders band\n• *${p}water log* ➔ Aaj ka ek glass count karein\n• *${p}water status* ➔ Aaj ki report`;
}
async function hWater(ctx, query) {
  rememberBot(ctx);
  const p = ctx.prefix || '!';
  const q = query.trim().toLowerCase();
  const d = loadHealth();
  d.water = d.water || {};
  const st = d.water[ctx.from] || { on: false, log: {}, notified: '' };
  const { date } = pktParts();
  if (!q) return reply(ctx, usageWater(p));
  if (q === 'on') {
    st.on = true; d.water[ctx.from] = st; saveHealth(d);
    return reply(ctx, '💧 *Pani reminders ON!* ✅\n\nAb har ghante (subah 9 – raat 10) yaad dilayenge: pani piyen! 🥛');
  }
  if (q === 'off') {
    st.on = false; d.water[ctx.from] = st; saveHealth(d);
    return reply(ctx, '💧 Pani reminders *band* kar diye. Sehat ka khayal rakhiyega! 🙂');
  }
  if (q === 'log') {
    st.log = st.log || {};
    st.log[date] = (st.log[date] || 0) + 1;
    d.water[ctx.from] = st; saveHealth(d);
    const n = st.log[date];
    const msg = n >= 8
      ? `🎉 *MashaAllah!* Aaj ${n} glass ho gaye — target poora! 💪`
      : `💧 Glass count ho gaya! Aaj ab tak: *${n} glass* 🥛\nRoz 8-10 glass ka target rakhein.`;
    return reply(ctx, msg);
  }
  if (q === 'status') {
    const n = (st.log && st.log[date]) || 0;
    return reply(ctx, `💧 *Pani Report (aaj)*\n\n🥛 Glass piye: *${n}*\n🔔 Reminders: ${st.on ? '*ON* ✅' : '*OFF* ❌'}\n\n${n < 8 ? 'Thora aur pani piyen! 💪' : 'Bohat khoob! 🎉'}`);
  }
  return reply(ctx, usageWater(p));
}

// ---------------- 2. medicine / med / dawai ----------------
function usageMed(p) {
  return `💊 *Dawai Reminders*\n\n• *${p}med 09:00 Panadol* ➔ Roz subah 9 baje yaad-dihani\n• *${p}med list* ➔ Sari dawaiyan dekhein\n• *${p}med del 1* ➔ Number 1 wali dawai hatayein\n\n_Waqt 24-hour format mein likhein (masalan 21:30)._\n⏰ Waqt par dawai lena na bhoolein!`;
}
async function hMedicine(ctx, query) {
  rememberBot(ctx);
  const p = ctx.prefix || '!';
  const q = query.trim();
  const d = loadHealth();
  d.meds = d.meds || {};
  const list = d.meds[ctx.from] || [];
  if (!q) return reply(ctx, usageMed(p));
  const low = q.toLowerCase();
  if (low === 'list') {
    if (!list.length) return reply(ctx, '💊 Koi dawai reminder set nahi hai.\n\n*' + p + 'med 09:00 Panadol* likh kar add karein.');
    const lines = list.map((m, i) => `*${i + 1}.* ⏰ ${m.time} — _${m.name}_`);
    return reply(ctx, `💊 *Dawai Reminders*\n\n${lines.join('\n')}\n\nHatane ke liye: *${p}med del <number>*`);
  }
  const del = low.match(/^del(?:ete)?\s+(\d+)$/);
  if (del) {
    const n = parseInt(del[1], 10);
    if (n < 1 || n > list.length) return reply(ctx, `⚠️ Number 1 se ${list.length} ke darmiyan likhein.`);
    const gone = list.splice(n - 1, 1)[0];
    d.meds[ctx.from] = list; saveHealth(d);
    return reply(ctx, `🗑️ *${gone.name}* (${gone.time}) ka reminder hata diya.`);
  }
  const add = q.match(/^(\d{1,2}):(\d{2})\s+(.+)$/);
  if (!add) return reply(ctx, usageMed(p));
  const hh = parseInt(add[1], 10), mm = parseInt(add[2], 10);
  if (hh > 23 || mm > 59) return reply(ctx, '⚠️ Waqt ghalat hai. 24-hour format use karein, masalan *21:30*.');
  const time = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  list.push({ time, name: add[3].trim(), last: '' });
  d.meds[ctx.from] = list; saveHealth(d);
  return reply(ctx, `💊 *Reminder set!* ✅\n\n⏰ Roz *${time}* baje: _${add[3].trim()}_\n\nWaqt par yaad dilaunga. 🤲`);
}

// ---------------- 3. calories ----------------
async function hCalories(ctx, query) {
  rememberBot(ctx);
  const p = ctx.prefix || '!';
  const q = query.trim();
  if (!q) return reply(ctx, `🔥 *Calories Andaza*\n\n*${p}calories 2 roti salan*\n*${p}calories 1 plate biryani*\n\nKhana likhein, andaza calories bata dunga.\n⚠️ _Yeh sirf andaza hoga, exact nahi._`);
  const ai = await askAI(`Is khane ki calories ka andaza number mein do (sirf andaza, mukhtasar Roman Urdu mein, 3-4 line se zyada nahi): ${q}`, ctx.senderName);
  return reply(ctx, `🔥 *Calories (andaza)*\n\n${ai}\n\n⚠️ _Yeh sirf andaza hai — exact calories ke liye nutritionist se ruju karein._`);
}

// ---------------- 4. workout / exercise ----------------
async function hWorkout(ctx, query) {
  rememberBot(ctx);
  const p = ctx.prefix || '!';
  const q = query.trim().toLowerCase();
  if (!q) return reply(ctx, `🏋️ *Workout Plan*\n\n*${p}workout weight loss*\n*${p}workout muscle*\n*${p}workout general*\n\nGoal likhein — 7 din ka ghar par karne wala plan bana dunga.`);
  const goal = ['weight loss', 'muscle', 'general'].includes(q) ? q : 'general fitness';
  const ai = await askAI(`"${goal}" goal ke liye 7 din ka ghar par (bina gym) workout plan banao. Roman Urdu, mukhtasar, roz ki exercise naam + sets/reps ke sath. 15 line se zyada nahi.`, ctx.senderName);
  return reply(ctx, `🏋️ *7-Din Workout Plan* (${goal})\n\n${ai}\n\n💪 _Roz thora thora — istiqamat hi kamyabi hai!_`);
}

// ---------------- 5. sleeplog / sleep / neend ----------------
const SLEEP_TIPS = [
  'Sone se 1 ghanta pehle mobile side par rakh dein. 📵',
  'Roz ek hi waqt par soyin — routine neend behtar karti hai. 🕙',
  'Chai/coffee sham 6 baje ke baad na piyen. ☕',
  'Kamra thanda aur andhera rakhein. 🌙',
  'Sone se pehle gehre saans lein ya halki walk karein. 🚶',
  'Bhaari khana sone se 2-3 ghante pehle kha lein. 🍽️',
  'Din mein zyada se zyada 20 min ki jhapki lein. 😴',
];
function usageSleep(p) {
  return `😴 *Neend Tracker*\n\n• *${p}sleep 7.5* ➔ Aaj kitne ghante soye, log karein\n• *${p}sleep week* ➔ Pichle 7 din ki report + tip`;
}
function dateNDaysAgo(n) {
  const dt = new Date(Date.now() - n * 86400000);
  const parts = new Intl.DateTimeFormat('en-PK', {
    timeZone: 'Asia/Karachi', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(dt);
  const g = (t) => parts.find((x) => x.type === t)?.value || '';
  return `${g('year')}-${g('month')}-${g('day')}`;
}
async function hSleep(ctx, query) {
  rememberBot(ctx);
  const p = ctx.prefix || '!';
  const q = query.trim().toLowerCase();
  const d = loadHealth();
  d.sleep = d.sleep || {};
  const mine = d.sleep[ctx.sender] || {};
  if (!q) return reply(ctx, usageSleep(p));
  if (q === 'week' || q === 'report') {
    const vals = [];
    for (let i = 0; i < 7; i++) {
      const dt = dateNDaysAgo(i);
      if (typeof mine[dt] === 'number') vals.push(mine[dt]);
    }
    if (!vals.length) return reply(ctx, `😴 Pichle 7 din ka koi record nahi.\n\n*${p}sleep 7.5* likh kar aaj ki neend log karein.`);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const tip = SLEEP_TIPS[Math.floor(Date.now() / 86400000) % SLEEP_TIPS.length];
    const verdict = avg >= 7 ? '🎉 Bohat khoob — neend poori ho rahi hai!' : avg >= 6 ? '🙂 Theek hai, thori aur behtar ho sakti hai.' : '⚠️ Neend kam hai — sehat par asar parega!';
    return reply(ctx, `😴 *Neend Report (7 din)*\n\n📊 Ausat: *${avg.toFixed(1)} ghante*/roz\n${verdict}\n\n💡 *Tip:* ${tip}`);
  }
  const hrs = parseFloat(q);
  if (!isFinite(hrs) || hrs <= 0 || hrs > 24) return reply(ctx, usageSleep(p));
  const { date } = pktParts();
  mine[date] = Math.round(hrs * 10) / 10;
  d.sleep[ctx.sender] = mine; saveHealth(d);
  const msg = hrs >= 7
    ? `😴 *${hrs} ghante* log ho gaye — MashaAllah, neend poori! 🎉`
    : `😴 *${hrs} ghante* log ho gaye.\n\n⚠️ 7-8 ghante ki neend sehat ke liye zaroori hai. Aaj jaldi so jayein! 🌙`;
  return reply(ctx, msg);
}

// ---------------- 6. recipe / khana ----------------
async function hRecipe(ctx, query) {
  rememberBot(ctx);
  const p = ctx.prefix || '!';
  const q = query.trim();
  if (!q) return reply(ctx, `🍳 *Recipe Banayein*\n\n*${p}recipe aloo, pyaz, tamatar*\n*${p}recipe chicken, dahi, masale*\n\nGhar mein jo ajza (ingredients) hain wo likhein — asaan recipe steps ke sath bana dunga.`);
  const ai = await askAI(`In ajza se ek asaan Desi recipe banao Roman Urdu mein, steps number kar ke, 12 line se zyada nahi: ${q}`, ctx.senderName);
  return reply(ctx, `🍳 *Recipe*\n\n${ai}\n\n😋 _Khana tayyar — Allah barkat de!_`);
}

// ---------------- 7. stepchallenge / steps ----------------
async function hSteps(ctx, query) {
  rememberBot(ctx);
  const p = ctx.prefix || '!';
  const q = query.trim().toLowerCase();
  const d = loadHealth();
  d.steps = d.steps || {};
  const { date } = pktParts();
  const today = d.steps[ctx.from] || {};
  const board = today[date] || {};
  if (!q) return reply(ctx, `👟 *Step Challenge*\n\n• *${p}steps 8500* ➔ Aaj ke qadam log karein\n• *${p}steps board* ➔ Aaj ka leaderboard 🏆\n\nRoz zyada chalein, sehat banayein! 💪`);
  if (q === 'board' || q === 'leaderboard') {
    const entries = Object.entries(board).sort((a, b) => b[1].count - a[1].count).slice(0, 10);
    if (!entries.length) return reply(ctx, `👟 Aaj ka leaderboard khaali hai.\n\n*${p}steps 5000* likh kar pehla qadam barhayein! 🏃`);
    const medals = ['🥇', '🥈', '🥉'];
    const lines = entries.map(([jid, e], i) => `${medals[i] || `*${i + 1}.*`} ${e.name} — *${fmtNum(e.count)}* qadam`);
    return reply(ctx, `🏆 *Step Leaderboard (aaj)*\n\n${lines.join('\n')}\n\n👟 _Roz 10,000 qadam ka target rakhein!_`);
  }
  const n = parseInt(q.replace(/[^0-9]/g, ''), 10);
  if (!isFinite(n) || n <= 0 || n > 200000) return reply(ctx, `⚠️ Qadam ki tadad likhein, masalan *${p}steps 8500*.`);
  board[ctx.sender] = { name: ctx.senderName || 'Dost', count: n };
  today[date] = board; d.steps[ctx.from] = today; saveHealth(d);
  const msg = n >= 10000
    ? `🎉 *MashaAllah!* ${fmtNum(n)} qadam — 10,000 ka target poora! 🏆`
    : `👟 *${fmtNum(n)} qadam* log ho gaye!\n\n${fmtNum(10000 - n)} aur — target 10,000 hai! 💪`;
  return reply(ctx, msg);
}

// ---------------- 8. paknews / news ----------------
async function hPakNews(ctx, query) {
  rememberBot(ctx);
  try {
    const xml = await fetchText('https://news.google.com/rss/search?q=Pakistan&hl=en-PK&gl=PK&ceid=PK:en');
    const items = parseRSS(xml, 5);
    if (!items.length) return reply(ctx, '📰 Abhi khabrein nahi mil sakin. Thodi dair baad try karein.');
    const lines = items.map((it, i) => `*${i + 1}.* ${it.title}`);
    return reply(ctx, `📰 *Pakistan Headlines*\n\n${lines.join('\n\n')}`);
  } catch (e) {
    return reply(ctx, '📰 Khabrein lane mein masla hua. Thodi dair baad dobara try karein.');
  }
}

// ---------------- 9. cricket / livescore ----------------
async function hCricket(ctx, query) {
  rememberBot(ctx);
  try {
    const xml = await fetchText('https://news.google.com/rss/search?q=cricket%20live%20score&hl=en-PK&gl=PK&ceid=PK:en');
    const items = parseRSS(xml, 5);
    if (!items.length) return reply(ctx, '🏏 Abhi cricket updates nahi mil sakin. Thodi dair baad try karein.');
    const lines = items.map((it, i) => `*${i + 1}.* ${it.title}`);
    return reply(ctx, `🏏 *Cricket Updates*\n\n⚠️ _Live score API available nahi — taaza headlines:_\n\n${lines.join('\n\n')}`);
  } catch (e) {
    return reply(ctx, '🏏 Cricket updates lane mein masla hua. Thodi dair baad dobara try karein.');
  }
}

// ---------------- 10. football / fbscore ----------------
async function hFootball(ctx, query) {
  rememberBot(ctx);
  try {
    const matches = await fetchJSON('https://api.openligadb.de/getmatchdata/bl1');
    if (!Array.isArray(matches) || !matches.length) throw new Error('no data');
    const byDay = new Map();
    for (const m of matches) {
      const gid = m?.group?.groupOrderID ?? 0;
      if (!byDay.has(gid)) byDay.set(gid, []);
      byDay.get(gid).push(m);
    }
    const finishedDays = [...byDay.keys()]
      .filter((g) => byDay.get(g).length && byDay.get(g).every((m) => m.matchIsFinished))
      .sort((a, b) => b - a);
    const day = finishedDays[0];
    if (day == null) throw new Error('no finished matchday');
    const lines = byDay.get(day).map((m) => {
      const res = (m.matchResults || []).find((r) => r.resultName === 'Endergebnis') || (m.matchResults || []).slice(-1)[0];
      const score = res ? `${res.pointsTeam1} - ${res.pointsTeam2}` : 'vs';
      return `⚽ ${m.team1?.teamName} *${score}* ${m.team2?.teamName}`;
    });
    return reply(ctx, `⚽ *Bundesliga — Matchday ${day}* (akhri mukammal)\n\n${lines.join('\n')}\n\n_Mazid leagues jald aa rahi hain!_`);
  } catch (e) {
    return reply(ctx, '⚽ Football scores lane mein masla hua. Thodi dair baad dobara try karein.');
  }
}

// ---------------- 11. prayeralert / namazalert ----------------
function usagePrayer(p) {
  return `🕌 *Namaz Alerts*\n\n• *${p}prayeralert on Lahore* ➔ Har namaz se 5 min pehle yaad-dihani\n• *${p}prayeralert off* ➔ Alerts band\n\n_Sheher ka naam likhein, masalan Karachi, Islamabad, Multan._`;
}
async function hPrayerAlert(ctx, query) {
  rememberBot(ctx);
  const p = ctx.prefix || '!';
  const q = query.trim();
  const d = loadNews();
  d.prayeralert = d.prayeralert || {};
  if (!q) return reply(ctx, usagePrayer(p));
  const low = q.toLowerCase();
  if (low === 'off') {
    delete d.prayeralert[ctx.from]; saveNews(d);
    return reply(ctx, '🕌 Namaz alerts *band* kar diye.');
  }
  const on = q.match(/^on\s+(.+)$/i);
  if (!on) return reply(ctx, usagePrayer(p));
  const city = on[1].trim();
  try {
    await getPrayerTimes(city, 'Pakistan');
  } catch (e) {
    return reply(ctx, `⚠️ *${city}* ke namaz ke auqat nahi mil sakay. Sheher ka naam check kar ke dobara likhein.`);
  }
  d.prayeralert[ctx.from] = { city, reminded: {} };
  saveNews(d);
  return reply(ctx, `🕌 *Namaz alerts ON!* ✅\n\n📍 Sheher: *${city}*\n⏰ Har namaz se *5 min pehle* yaad dilaunga. 🤲`);
}
const prayerCache = new Map(); // cityLower -> { date, timings }
async function getCachedTimings(city, date) {
  const key = city.toLowerCase();
  const c = prayerCache.get(key);
  if (c && c.date === date) return c.timings;
  const pt = await getPrayerTimes(city, 'Pakistan');
  prayerCache.set(key, { date, timings: pt.timings });
  return pt.timings;
}
const PRAYER_URDU = { Fajr: 'Fajr', Dhuhr: 'Zohar', Asr: 'Asr', Maghrib: 'Maghrib', Isha: 'Isha' };
async function tickPrayer(hm, date) {
  const d = loadNews();
  if (!d.prayeralert) return;
  let changed = false;
  const nowMin = hmToMin(hm);
  for (const [chat, cfg] of Object.entries(d.prayeralert)) {
    if (!cfg || !cfg.city) continue;
    let timings;
    try { timings = await getCachedTimings(cfg.city, date); } catch { continue; }
    cfg.reminded = cfg.reminded || {};
    for (const name of Object.keys(PRAYER_URDU)) {
      const t = String(timings[name] || '').match(/(\d{1,2}):(\d{2})/);
      if (!t) continue;
      const diff = hmToMin(`${t[1]}:${t[2]}`) - nowMin;
      const rkey = `${date}|${name}`;
      if (diff >= 0 && diff <= 5 && !cfg.reminded[rkey]) {
        cfg.reminded[rkey] = true; changed = true;
        await sendTo(chat, `🕌 *${PRAYER_URDU[name]} ka waqt hone wala hai!* (${cfg.city})\n\n${diff === 0 ? 'Waqt ho gaya hai' : `Sirf ${diff} min baqi`} — namaz ki tayyari kar lein. 🤲`);
      }
    }
  }
  if (changed) saveNews(d);
}

// ---------------- 12. rainalert / barish ----------------
async function hRainAlert(ctx, query) {
  rememberBot(ctx);
  const p = ctx.prefix || '!';
  const city = query.trim();
  if (!city) return reply(ctx, `☔ *Barish Alert*\n\n*${p}rainalert Lahore*\n\nSheher likhein — agle 24 ghante mein barish ka imkan bata dunga.`);
  try {
    const g = await fetchJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&format=json`);
    const loc = g?.results?.[0];
    if (!loc) return reply(ctx, `⚠️ *${city}* nahi mila. Sheher ka naam check kar ke dobara likhein.`);
    const f = await fetchJSON(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&hourly=precipitation_probability&forecast_days=2&timezone=Asia%2FKarachi`);
    const times = f?.hourly?.time || [];
    const probs = f?.hourly?.precipitation_probability || [];
    const { date, hm } = pktParts();
    const nowKey = `${date}T${hm.slice(0, 2)}:00`;
    let start = times.findIndex((t) => t >= nowKey);
    if (start < 0) start = 0;
    let best = { p: 0, t: '' };
    for (let i = start; i < Math.min(start + 24, times.length); i++) {
      const pr = probs[i] ?? 0;
      if (pr > best.p) best = { p: pr, t: times[i] };
    }
    const place = loc.name + (loc.country ? `, ${loc.country}` : '');
    if (best.p < 20) {
      return reply(ctx, `☔ *Barish Alert* (${place})\n\nAgle 24 ghante mein koi khaas barish ka imkan nahi. 🙂\n_Zyada se zyada imkan: ${best.p}%_`);
    }
    const when = best.t ? best.t.slice(11, 16) : '';
    return reply(ctx, `☔ *Barish ka imkan!* (${place})\n\n🌧️ *${best.p}%* imkan ${when ? `— taqreeban *${when}* baje` : ''}\n\n_Chatri sath rakh lein!_ ☂️`);
  } catch (e) {
    return reply(ctx, '☔ Mausam ki maloomat lane mein masla hua. Thodi dair baad dobara try karein.');
  }
}

// ---------------- 13. loadshed / bijli ----------------
function to24h(h, mi, ap) {
  let H = parseInt(h, 10);
  if (H < 1 || H > 12) return null;
  const a = String(ap).toLowerCase();
  if (a === 'pm' && H !== 12) H += 12;
  if (a === 'am' && H === 12) H = 0;
  return `${String(H).padStart(2, '0')}:${String(mi || '0').padStart(2, '0')}`;
}
const WIN_RE = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/gi;
function parseWindows(text) {
  const wins = [];
  let m;
  WIN_RE.lastIndex = 0;
  while ((m = WIN_RE.exec(text))) {
    const s = to24h(m[1], m[2], m[3]);
    const e = to24h(m[4], m[5], m[6]);
    if (s && e) wins.push({ s, e, raw: m[0].trim() });
  }
  return wins;
}
function usageLoadshed(p) {
  return `⚡ *Bijli Schedule*\n\n• *${p}loadshed set Gulberg 10am-12pm, 4pm-6pm* ➔ Schedule save karein\n• *${p}loadshed* ➔ Save shuda schedule dekhein\n• *${p}loadshed off* ➔ Schedule hatayein\n\n_Bijli jane se 15 min pehle yaad dilaunga._\n⚠️ _Schedule aap khud set karte hain — apne area ka sahi time likhein._`;
}
async function hLoadshed(ctx, query) {
  rememberBot(ctx);
  const p = ctx.prefix || '!';
  const q = query.trim();
  const d = loadNews();
  d.loadshed = d.loadshed || {};
  if (!q) {
    const cfg = d.loadshed[ctx.from];
    if (!cfg || !cfg.windows?.length) return reply(ctx, usageLoadshed(p));
    const lines = cfg.windows.map((w) => `• ${w.raw} (${w.s} – ${w.e})`);
    return reply(ctx, `⚡ *Bijli Schedule* (${cfg.area})\n\n${lines.join('\n')}\n\n_Bijli jane se 15 min pehle yaad dilaunga._`);
  }
  const low = q.toLowerCase();
  if (low === 'off' || low === 'clear') {
    delete d.loadshed[ctx.from]; saveNews(d);
    return reply(ctx, '⚡ Bijli schedule hata diya.');
  }
  const rest = q.replace(/^set\s+/i, '').trim();
  const wins = parseWindows(rest);
  if (!wins.length) return reply(ctx, usageLoadshed(p));
  const area = rest.replace(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/gi, '').replace(/[,|]+/g, ' ').trim() || 'Aapka area';
  d.loadshed[ctx.from] = { area, windows: wins, notified: {} };
  saveNews(d);
  const lines = wins.map((w) => `• ${w.raw}`);
  return reply(ctx, `⚡ *Bijli schedule save!* ✅\n\n📍 ${area}\n${lines.join('\n')}\n\n_Bijli jane se 15 min pehle yaad dilaunga._ 🔋`);
}
async function tickLoadshed(hm, date) {
  const d = loadNews();
  if (!d.loadshed) return;
  let changed = false;
  const nowMin = hmToMin(hm);
  for (const [chat, cfg] of Object.entries(d.loadshed)) {
    if (!cfg || !Array.isArray(cfg.windows)) continue;
    cfg.notified = cfg.notified || {};
    for (const w of cfg.windows) {
      const diff = hmToMin(w.s) - nowMin;
      const nkey = `${date}|${w.s}`;
      if (diff >= 0 && diff <= 15 && !cfg.notified[nkey]) {
        cfg.notified[nkey] = true; changed = true;
        await sendTo(chat, `⚡ *Bijli jane wali hai!* (${cfg.area})\n\n🕐 ${w.raw}: ${diff === 0 ? '*abhi*' : `*${diff} min* mein`} light jayegi.\n\n_Mobile/laptop charge kar lein!_ 🔋`);
      }
    }
  }
  if (changed) saveNews(d);
}

// ---------------- 14. train / railway ----------------
const TRAINS = [
  { from: 'Lahore', to: 'Karachi', train: 'Karachi Express', time: '~18:00' },
  { from: 'Karachi', to: 'Lahore', train: 'Karachi Express', time: '~21:30' },
  { from: 'Lahore', to: 'Rawalpindi', train: 'Subak Raftar', time: '~07:30' },
  { from: 'Rawalpindi', to: 'Lahore', train: 'Subak Raftar', time: '~15:00' },
  { from: 'Karachi', to: 'Rawalpindi', train: 'Tezgam', time: '~17:00' },
  { from: 'Rawalpindi', to: 'Karachi', train: 'Tezgam', time: '~07:00' },
  { from: 'Lahore', to: 'Multan', train: 'Pak Business Express', time: '~16:00' },
  { from: 'Multan', to: 'Lahore', train: 'Pak Business Express', time: '~07:00' },
  { from: 'Lahore', to: 'Faisalabad', train: 'Millat Express', time: '~18:30' },
  { from: 'Faisalabad', to: 'Lahore', train: 'Millat Express', time: '~06:30' },
  { from: 'Peshawar', to: 'Rawalpindi', train: 'Awam Express', time: '~06:00' },
  { from: 'Rawalpindi', to: 'Peshawar', train: 'Awam Express', time: '~21:00' },
];
const norm = (s) => String(s).toLowerCase().replace(/[^a-z]/g, '');
function usageTrain(p) {
  const routes = TRAINS.map((t) => `${t.from} → ${t.to}`).join(', ');
  return `🚂 *Railway Timings*\n\n*${p}train Lahore Karachi*\n*${p}train Karachi Lahore*\n\n_Dastiyab routes:_ ${routes}\n\n⚠️ _Yeh andaza timings hain — safar se pehle *pakrail.gov.pk* par verify karein._`;
}
async function hTrain(ctx, query) {
  rememberBot(ctx);
  const p = ctx.prefix || '!';
  const q = query.trim().toLowerCase();
  if (!q) return reply(ctx, usageTrain(p));
  const toks = q.split(/\s+/).filter(Boolean);
  let hits = [];
  if (toks.length >= 2) {
    const a = norm(toks[0]), b = norm(toks.slice(1).join(' '));
    hits = TRAINS.filter((t) => norm(t.from).includes(a) && norm(t.to).includes(b));
    if (!hits.length) {
      const rev = TRAINS.filter((t) => norm(t.from).includes(b) && norm(t.to).includes(a));
      if (rev.length) {
        const lines = rev.map((t) => `🚂 *${t.train}*\n${t.from} → ${t.to} — rawangi ${t.time}`);
        return reply(ctx, `🔄 Ulti direction mili:\n\n${lines.join('\n\n')}\n\n⚠️ _Andaza timings — pakrail.gov.pk par verify karein._`);
      }
    }
  } else {
    const a = norm(toks[0]);
    hits = TRAINS.filter((t) => norm(t.from).includes(a) || norm(t.to).includes(a));
  }
  if (!hits.length) return reply(ctx, `⚠️ Is route ki timing nahi mili.\n\n${usageTrain(p)}`);
  const lines = hits.map((t) => `🚂 *${t.train}*\n${t.from} → ${t.to} — rawangi *${t.time}*`);
  return reply(ctx, `${lines.join('\n\n')}\n\n⚠️ _Yeh andaza timings hain — safar se pehle *pakrail.gov.pk* par verify karein._`);
}

// ---------------- 15. jobs / naukri ----------------
async function hJobs(ctx, query) {
  rememberBot(ctx);
  try {
    const xml = await fetchText('https://news.google.com/rss/search?q=jobs%20in%20Pakistan&hl=en-PK&gl=PK&ceid=PK:en');
    const items = parseRSS(xml, 5);
    if (!items.length) return reply(ctx, '💼 Abhi job alerts nahi mil sakin. Thodi dair baad try karein.');
    const lines = items.map((it, i) => `*${i + 1}.* ${it.title}`);
    return reply(ctx, `💼 *Job Alerts (Pakistan)*\n\n${lines.join('\n\n')}\n\n_Tafseel ke liye rozee.pk ya mustakbil.com dekhein._`);
  } catch (e) {
    return reply(ctx, '💼 Job alerts lane mein masla hua. Thodi dair baad dobara try karein.');
  }
}

// ---------------- Schedulers ----------------
async function tickWater(hm, date) {
  if (!hm.endsWith(':00')) return;
  const hour = parseInt(hm.slice(0, 2), 10);
  if (hour < 9 || hour > 22) return;
  const d = loadHealth();
  if (!d.water) return;
  let changed = false;
  for (const [chat, st] of Object.entries(d.water)) {
    if (!st || !st.on) continue;
    const key = `${date} ${hour}`;
    if (st.notified === key) continue;
    st.notified = key; changed = true;
    await sendTo(chat, '💧 *Pani peene ka waqt!* 🥛\n\nEk glass pani pi lein — sehat ka khayal rakhein! 💪\n\n_Piyas lage ya na lage, pani zaroor piyen._');
  }
  if (changed) saveHealth(d);
}
async function tickMeds(hm, date) {
  const d = loadHealth();
  if (!d.meds) return;
  let changed = false;
  for (const [chat, list] of Object.entries(d.meds)) {
    if (!Array.isArray(list)) continue;
    for (const m of list) {
      const key = `${date} ${hm}`;
      if (m.time === hm && m.last !== key) {
        m.last = key; changed = true;
        await sendTo(chat, `💊 *Dawai ka waqt!* ⏰\n\n_${m.name}_ lena na bhoolein.\n\nSehatmand rahein! 🤲`);
      }
    }
  }
  if (changed) saveHealth(d);
}
async function tick() {
  try {
    if (!liveBot) return;
    const { hm, date } = pktParts();
    await tickWater(hm, date);
    await tickMeds(hm, date);
    await tickPrayer(hm, date);
    await tickLoadshed(hm, date);
  } catch (e) { console.error('[batch6] tick:', e.message); }
}

// ---------------- Registry ----------------
export const MENU_SECTION = `🏃 *20. Health*
• *water on* ➔ Pani reminders
• *med <09:00> <name>* ➔ Dawai reminders
• *calories <khana>* ➔ Calories andaza
• *workout <goal>* ➔ Workout plan
• *sleep <hours>* ➔ Neend tracker
• *recipe <ajza>* ➔ Recipe banayein
• *steps <count>* ➔ Step challenge

📡 *21. News & Info*
• *paknews* ➔ Pakistan headlines
• *cricket* ➔ Cricket updates
• *football* ➔ Football scores
• *prayeralert on <city>* ➔ Namaz alerts
• *rainalert <city>* ➔ Barish alert
• *loadshed set <area>* ➔ Bijli schedule
• *train <from> <to>* ➔ Railway timings
• *jobs* ➔ Job alerts`;

export const WEB_COMMANDS = [
  { cmd: 'water', section: 'Health', label: 'Pani Reminders', hint: 'Hourly water reminders (9am–10pm)', example: '!water on' },
  { cmd: 'medicine', section: 'Health', label: 'Dawai Reminders', hint: 'Daily medicine reminders', example: '!med 09:00 Panadol' },
  { cmd: 'calories', section: 'Health', label: 'Calories Andaza', hint: 'Estimate food calories', example: '!calories 2 roti salan' },
  { cmd: 'workout', section: 'Health', label: 'Workout Plan', hint: '7-day home workout plan', example: '!workout weight loss' },
  { cmd: 'sleeplog', section: 'Health', label: 'Neend Tracker', hint: 'Log sleep, weekly report', example: '!sleep 7.5' },
  { cmd: 'recipe', section: 'Health', label: 'Recipe Banayein', hint: 'Recipe from ingredients', example: '!recipe aloo, pyaz' },
  { cmd: 'stepchallenge', section: 'Health', label: 'Step Challenge', hint: 'Daily steps leaderboard', example: '!steps 8500' },
  { cmd: 'paknews', section: 'News & Info', label: 'Pakistan Headlines', hint: 'Top Pakistan news', example: '!paknews' },
  { cmd: 'cricket', section: 'News & Info', label: 'Cricket Updates', hint: 'Latest cricket headlines', example: '!cricket' },
  { cmd: 'football', section: 'News & Info', label: 'Football Scores', hint: 'Bundesliga latest results', example: '!football' },
  { cmd: 'prayeralert', section: 'News & Info', label: 'Namaz Alerts', hint: 'Prayer reminder 5 min before', example: '!prayeralert on Lahore' },
  { cmd: 'rainalert', section: 'News & Info', label: 'Barish Alert', hint: '24h rain forecast', example: '!rainalert Lahore' },
  { cmd: 'loadshed', section: 'News & Info', label: 'Bijli Schedule', hint: 'Loadshedding reminders', example: '!loadshed set Gulberg 10am-12pm' },
  { cmd: 'train', section: 'News & Info', label: 'Railway Timings', hint: 'Train timings by route', example: '!train Lahore Karachi' },
  { cmd: 'jobs', section: 'News & Info', label: 'Job Alerts', hint: 'Latest jobs in Pakistan', example: '!jobs' },
];

export const HANDLERS = {
  water: safe(hWater), pani: 'water',
  medicine: safe(hMedicine), med: 'medicine', dawai: 'medicine',
  calories: safe(hCalories), cal: 'calories',
  workout: safe(hWorkout), exercise: 'workout', kasrat: 'workout',
  sleeplog: safe(hSleep), sleep: 'sleeplog', neend: 'sleeplog',
  recipe: safe(hRecipe), khana: 'recipe',
  stepchallenge: safe(hSteps), steps: 'stepchallenge',
  paknews: safe(hPakNews), news: 'paknews',
  cricket: safe(hCricket), livescore: 'cricket',
  football: safe(hFootball), fbscore: 'football',
  prayeralert: safe(hPrayerAlert), namazalert: 'prayeralert',
  rainalert: safe(hRainAlert), barish: 'rainalert',
  loadshed: safe(hLoadshed), bijli: 'loadshed',
  train: safe(hTrain), railway: 'train',
  jobs: safe(hJobs), naukri: 'jobs',
};

registerBatch({ MENU_SECTION, WEB_COMMANDS, HANDLERS });

// Schedulers: per-minute tick covers water (hourly 09:00-22:00 PKT),
// medicine, prayer alerts and loadshedding reminders.
setInterval(() => { tick(); }, 60 * 1000).unref?.();
