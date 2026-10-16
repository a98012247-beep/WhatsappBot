/**
 * Proactive Reminders — AwaisxBot nudges inactive users
 * (2026-10-13, Hudson's requirement)
 *
 * - Tracks last interaction per user
 * - Every hour, checks for users inactive 24h+ (max 1 nudge per 48h)
 * - Sends a friendly, contextual nudge in English
 * - Never nudges groups, never nudges twice in a row without a reply
 */

import { Store } from './store.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(MODULE_DIR, '..', 'data', 'proactive.json');
const NUDGE_AFTER_MS = 24 * 60 * 60 * 1000;  // 24 hours of silence
const MIN_GAP_MS = 48 * 60 * 60 * 1000;       // max 1 nudge per 48h

function load() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { lastSeen: {}, lastNudge: {}, nudgeCount: {} };
  }
}

function save(d) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 1));
  } catch {}
}

/** Call on every incoming 1-on-1 message */
export function touchUser(sender) {
  const d = load();
  d.lastSeen[sender] = Date.now();
  // User replied → reset nudge tracking so we can nudge again later
  save(d);
}

/** Nudge messages — friendly, varied, always English */
const NUDGES = [
  `Hey! It's been a while — just checking in. Need help with anything? Type *menu* to see what I can do! 👋`,
  `Hi there! You haven't stopped by in a bit. I can download songs, check weather, get news and more — just say the word!`,
  `Hey friend! Still here whenever you need me. Want to try something? Type *menu* for all features.`,
  `Long time no chat! I've got new tricks — songs, videos, news, weather, AI and more. What can I do for you today?`,
];

/** Remove all tracking for a user (called by deletemydata command) */
export function forgetUser(sender) {
  const d = load();
  delete d.lastSeen[sender];
  delete d.lastNudge[sender];
  delete d.nudgeCount[sender];
  save(d);
}

/**
 * Check for inactive users and nudge them. Called hourly by the bot.
 * @param {object} bot - bot instance with sendMessage
 */
export async function runProactiveCheck(bot) {
  const d = load();
  const now = Date.now();
  let nudged = 0;

  for (const [sender, lastSeen] of Object.entries(d.lastSeen)) {
    // Skip groups and channels
    if (sender.includes('@g.us') || sender.includes('@newsletter')) continue;
    // Must be onboarded (don't nudge people mid-onboarding)
    if (!Store.isOnboarded(sender)) continue;
    // Inactive long enough?
    if (now - lastSeen < NUDGE_AFTER_MS) continue;
    // Not nudged too recently?
    const lastNudge = d.lastNudge[sender] || 0;
    if (now - lastNudge < MIN_GAP_MS) continue;

    // Pick a nudge (rotate through them)
    const count = d.nudgeCount[sender] || 0;
    const msg = NUDGES[count % NUDGES.length];

    try {
      const jid = sender.includes('@') ? sender : sender + '@s.whatsapp.net';
      await bot.sendMessage(jid, msg);
      d.lastNudge[sender] = now;
      d.nudgeCount[sender] = count + 1;
      nudged++;
      console.log(`📬 [Proactive] Nudged ${sender}`);
    } catch (e) {
      console.log(`📬 [Proactive] Failed to nudge ${sender}: ${e.message}`);
    }
  }

  if (nudged > 0) save(d);
  return nudged;
}
