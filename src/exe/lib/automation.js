/**
 * Natural-language automation scheduler (2026-10-13).
 * User says: "send X to Y daily" → bot sets up a persistent scheduled task.
 * Tasks survive restarts (file-based). Bulk sends are rate-limited.
 */
import { Store } from './store.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const TASKS_FILE = path.join(DATA_DIR, 'scheduled-tasks.json');

// All automation times are in Pakistan time (Asia/Karachi, UTC+5) — the user's timezone.
// The VM runs on UTC, so we shift explicitly; getUTC* on the shifted date = PKT wall clock.
function pktParts() {
  const d = new Date(Date.now() + 5 * 3600 * 1000);
  return {
    hh: String(d.getUTCHours()).padStart(2, '0'),
    mm: String(d.getUTCMinutes()).padStart(2, '0'),
    date: d.toISOString().slice(0, 10),
    weekday: d.getUTCDay(), // 0=Sun..6=Sat
    dayOfMonth: d.getUTCDate(),
  };
}

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  itwar: 0, peer: 1, mangal: 2, budh: 3, jumerat: 4, jumma: 5, juma: 5, hafta: 6,
};

// Remove scheduling scaffolding from a candidate message:
// "report every monday at 9am" -> "report"
function stripScaffolding(s) {
  const rest = (s || '')
    .replace(/\b(my|the|is|us)\s+(group|channel|status)\b/gi, '')
    .replace(/(\+?92\d{10}|03\d{9})/g, '')
    .replace(/\b(daily|weekly|monthly|har roz|har hafte|har mahine|roz|every\s+\w+)\b/gi, '')
    .replace(/\b(at\s+)?\d{1,2}(:\d{2})?\s*(am|pm|baje)\b/gi, '')
    .replace(/\b(to|ko|pe|par|mein)\b/gi, '')
    .replace(/^\s*(about|that|ke bare mein|ke liye)\s+/i, '')
    .replace(/\s{2,}/g, ' ').trim();
  return rest.length > 2 ? rest : '';
}

function readTasks() {
  try {
    if (!fs.existsSync(TASKS_FILE)) return [];
    return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf-8'));
  } catch { return []; }
}

function writeTasks(tasks) {
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf-8');
}

export function addScheduledTask(task) {
  const tasks = readTasks();
  task.id = 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  task.createdAt = new Date().toISOString();
  task.active = true;
  // Defaults for weekly/monthly from creation day (PKT) when not named in the request
  const p = pktParts();
  if (task.schedule === 'weekly' && task.weekday == null) task.weekday = p.weekday;
  if (task.schedule === 'monthly' && task.dayOfMonth == null) task.dayOfMonth = p.dayOfMonth;
  tasks.push(task);
  writeTasks(tasks);
  return task;
}

export function getScheduledTasks() {
  return readTasks().filter(t => t.active);
}

export function removeScheduledTask(id) {
  const tasks = readTasks();
  const t = tasks.find(x => x.id === id);
  if (t) { t.active = false; writeTasks(tasks); return true; }
  return false;
}

/**
 * Parse natural language automation requests.
 * Examples:
 * - "send hello to 923001234567 daily"
 * - "remind my group every morning at 9am"
 * - "post this on my channel every friday"
 * Returns { action, message, target, schedule } or null.
 */
export function parseAutomationRequest(text) {
  const lower = text.toLowerCase();

  // SAFEGUARD (2026-10-14): Don't trigger on pasted/forwarded content.
  // If someone pastes a long text (like the menu), it's not an automation request.
  if (text.length > 500) return null;

  // Don't trigger on text that looks like a forwarded menu or bot output
  if (/powered by|awaisxbot menu|reply with a (number|command name|category name)/i.test(text)) return null;
  // BOT HELP-TEXT GUARD (2026-10-15): the bot's own usage/help replies
  // ("Misaal:", "Istamal:", ➔ arrows) pasted back must never become automations.
  if (/misaal:|misal:|istamal:|istimal:|➔/i.test(text)) return null;

  // Must contain automation keywords
  if (!/(send|bhej|remind|yaad|post|schedule|roz|daily|har roz|every)/i.test(lower)) return null;

  const result = { action: 'send', message: null, target: null, schedule: 'daily', time: '09:00' };

  // Extract phone number
  const phoneMatch = lower.match(/(\+?92\d{10}|\b03\d{9}\b)/);
  if (phoneMatch) {
    result.target = phoneMatch[1].replace(/^\+/, '').replace(/^0/, '92');
    result.targetType = 'number';
  }
  // Group keywords (channel removed 2026-10-17 per Hudson — no more "not supported" msgs)
  else if (/group/i.test(lower)) { result.targetType = 'group'; }

  // Extract time
  const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|baje)/i);
  if (timeMatch) {
    let h = parseInt(timeMatch[1]);
    if (timeMatch[3]?.toLowerCase() === 'pm' && h < 12) h += 12;
    result.time = `${String(h).padStart(2, '0')}:${timeMatch[2] || '00'}`;
  }

  // Extract message (text in quotes, or after "send"/"message")
  const quoted = text.match(/["'"'"]([^"'"'"]+)["'"'"]/);
  if (quoted) {
    // Explicit quotes = literal message, use as-is
    result.message = quoted[1];
  } else {
    const sendMatch = text.match(/(?:send|bhej)\s+(.+?)\s+(?:to|ko)\s+/i);
    if (sendMatch) result.message = stripScaffolding(sendMatch[1]);
    else {
      // Natural phrasing: "remind my group every friday at 6pm: meeting at 7"
      const colon = text.match(/:\s*(.+)$/);
      if (colon && colon[1].trim().length > 2) {
        result.message = stripScaffolding(colon[1]) || colon[1].trim();
      } else {
        result.message = stripScaffolding(text.replace(/^(send|bhej|remind|yaad|post|schedule)\s+/i, ''));
      }
    }
  }

  // Schedule frequency
  if (/weekly|har hafte|every week/i.test(lower)) result.schedule = 'weekly';
  else if (/monthly|har mahine/i.test(lower)) result.schedule = 'monthly';
  else result.schedule = 'daily';

  // Weekday for weekly schedules ("every friday", "har jumma")
  const dayMatch = lower.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|itwar|peer|mangal|budh|jumerat|jumma|juma|hafta)\b/);
  if (dayMatch) result.weekday = WEEKDAYS[dayMatch[1]];
  // A named weekday implies weekly unless stated otherwise
  if (result.weekday != null && result.schedule === 'daily') result.schedule = 'weekly';

  if (!result.message || !result.target && !result.targetType) return null;
  return result;
}

/**
 * Check and run due tasks. Called every minute by the bot.
 * Times are Pakistan time (PKT); supports daily, weekly and monthly.
 */
export async function runDueTasks(bot) {
  const tasks = getScheduledTasks();
  const p = pktParts();
  const currentTime = `${p.hh}:${p.mm}`;
  const now = Date.now();

  for (const task of tasks) {
    // Skip disabled tasks (2026-10-14 fix: dashboard toggle must actually stop execution)
    if (task.enabled === false || task.active === false) continue;

    // Interval-based schedules: "1m", "5m", "30m", "1h", etc. (2026-10-14 fix)
    const intervalMatch = /^(\d+)(m|h)$/.exec(task.schedule || '');
    if (intervalMatch) {
      const minutes = parseInt(intervalMatch[1]) * (intervalMatch[2] === 'h' ? 60 : 1);
      const lastRun = task.lastRunTs || 0;
      if (now - lastRun < minutes * 60000) continue;
      try {
        await sendTaskMessage(bot, task);
        task.lastRunTs = now;
        writeTasks(readTasks().map(t => t.id === task.id ? task : t));
      } catch (e) {
        console.error('[automation] interval task failed:', task.id, e.message);
      }
      continue;
    }

    // Time-based schedules: daily/weekly/monthly
    if (!task.time) continue; // can't schedule without a time
    if (task.lastRun === p.date && task.schedule === 'daily') continue;
    if (task.time !== currentTime) continue;
    let due = false;
    if (task.schedule === 'daily') due = true;
    else if (task.schedule === 'weekly' && task.weekday === p.weekday) due = true;
    else if (task.schedule === 'monthly' && task.dayOfMonth === p.dayOfMonth) due = true;
    if (!due) continue;
    try {
      await sendTaskMessage(bot, task);
      task.lastRun = p.date;
      writeTasks(readTasks().map(t => t.id === task.id ? task : t));
    } catch (e) {
      console.error('[automation] task failed:', task.id, e.message);
    }
  }
}

async function sendTaskMessage(bot, task) {
  const targets = Array.isArray(task.target) ? task.target : [task.target];
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    if (typeof target !== 'string' || !target) {
      console.warn('[automation] skipping null/empty target for task:', task.id);
      continue;
    }
    const jid = target.includes('@') ? target : `${target}@s.whatsapp.net`;
    await bot.sendMessage(jid, task.message);
    // Rate limit: 10 seconds between messages (Hudson's setting, WhatsApp anti-ban)
    if (i < targets.length - 1) {
      await new Promise(r => setTimeout(r, 10000));
    }
  }
}
