// lib/menu-groups.js — DISPLAY-LAYER dedup for menu commands.
// Groups commands that share the exact same handler (switch fall-throughs,
// CORE_ALIASES, and BATCH_ALIASES from newfeatures.js covering ALL batch
// string aliases) so the menu shows one line per real command with aliases
// listed. Dispatch is untouched: every alias still triggers when typed.
import { CORE_ALIASES } from './batch8-newcmds.js';
import { BATCH_ALIASES, NEW_COMMANDS } from './newfeatures.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));

// Switch fall-through groups extracted from lib/bot.js dispatch switch.
// All members of a group execute byte-identical handler code.
const SWITCH_GROUPS = [
  ['menu', 'help', 'start', 'info', 'more', 'all', 'tools', 'bot'],
  ['textmenu', 'fullmenu'],
  ['voice', 'speak', 'tts', 'bol'],
  ['memepic', 'memeimage', 'picmeme'],
  ['roast'],
  ['chutkula', 'joke', 'latifa'],
  ['song', 'music', 'gana', 'mp3'],
  ['photo', 'image', 'img', 'pic', 'wallpaper'],
  ['dl', 'down', 'download', 'video', 'v', 'tiktok', 'tt', 'reel', 'reels', 'ig', 'igdl', 'insta', 'yt', 'ytdl', 'youtube', 'fb', 'fbdown', 'facebook', 'tw', 'twitter', 'x', 'pin', 'pinterest', 'capcut', 'snapchat', 'snap', 'threads', 'likee', 'kwai', 'vimeo', 'dailymotion'],
  ['s', 'attp'],
  ['sticker', 'stiker'],
  ['vs', 'stickergif'],
  ['v2a', 'tomp3', 'audio'],
  ['soundboard', 'memes', 'sounds'],
  ['clip', 'trim', 'videoclip'],
  ['meme', 'sound', 'sfx'],
  ['quran', 'surah'],
  ['ayah', 'ayat'],
  ['tafseer', 'tafsir'],
  ['tilawat', 'quranaudio', 'quranmp3'],
  ['hadith', 'hadees', 'hadis'],
  ['namaz', 'prayer', 'prayertimes'],
  ['hijri', 'islamicdate', 'islami_date', 'tareekh', 'date'],
  ['events', 'islamicevents', 'tehwar'],
  ['allahnames', 'asmaulhusna', 'allahname'],
  ['dua', 'duain', 'azkar'],
  ['ai', 'ask'],
  ['poll'],
  ['qr'],
  ['calc', 'math'],
  ['weather'],
  ['crypto', 'btc', 'eth'],
  ['deletemydata', 'deletedata', 'reset', 'resetmydata'],
  ['remind', 'reminder'],
  ['catalog'],
  ['feedback'],
  ['status', 'groupstatus', 'gstatus', 'setstatus'],
  ['clearstatus', 'delstatus'],
  ['poststatus', 'story'],
  ['groupaudit', 'groupmembers'],
  ['support', 'ticket'],
  ['price', 'pricing'],
  ['hours'],
  ['location'],
  ['contact'],
  ['quote', 'aqwal'],
  ['shairi', 'shayari', 'poetry'],
  ['fact', 'maloomat'],
  ['riddle', 'paheli', 'puzzle'],
  ['flip', 'coin'],
  ['roll', 'dice'],
  ['time'],
  ['tagall', 'everyone'],
  ['hidetag'],
  ['groupinfo'],
  ['promote'],
  ['demote'],
  ['mute', 'close'],
  ['unmute', 'open'],
  ['setname'],
  ['warn'],
  ['kick'],
  ['ping'],
  ['uptime', 'diagnostics'],
  ['rules'],
  ['owner', 'developer', 'about']
];

// group[0] is sometimes a cryptic name; prefer these canonical display names.
const DISPLAY_OVERRIDES = { v2a: 'audio', s: 'attp', chutkula: 'joke', shairi: 'shayari' };

const _groupOf = new Map();
for (const g of SWITCH_GROUPS) for (const m of g) _groupOf.set(m, g[0]);

// Combined alias map: batch string-aliases first, then core aliases.
// (No key should exist in both; CORE wins on conflict.)
const _ALL_ALIASES = { ...BATCH_ALIASES, ...CORE_ALIASES };

export function resolveCore(cmd) {
  let cur = String(cmd).toLowerCase(), seen = new Set();
  while (_ALL_ALIASES[cur] && !seen.has(cur)) { seen.add(cur); cur = _ALL_ALIASES[cur]; }
  return cur;
}

export function resolvePrimary(cmd) {
  const c = String(cmd).toLowerCase();
  const core = resolveCore(c);
  // Batch commands are dispatched BEFORE the switch, so switch fall-through
  // groups never apply to them (e.g. batch `trim` vs switch `clip/trim`).
  if (NEW_COMMANDS.has(core)) return core;
  const p = _groupOf.get(core) || _groupOf.get(c) || core;
  return DISPLAY_OVERRIDES[p] || p;
}

let _audit = null;
export function getAudit() {
  if (_audit) return _audit;
  try { _audit = JSON.parse(readFileSync(join(__dir, 'data/command-audit.json'), 'utf-8')); }
  catch { _audit = {}; }
  return _audit;
}

export function isBlocked(name) {
  const a = getAudit()[String(name).toLowerCase()];
  return !!(a && a.notes && a.notes.includes('BLOCKED'));
}

// Group one menu category's commands by resolved primary.
// Returns [{ primary, desc, blocked, members: [cmdObj...], aliases: [names...] }]
export async function getDisplayGroups(catNum) {
  const { MENU_CATEGORIES } = await import('./menu-data.js');
  const { cleanDesc } = await import('./menu-desc.js');
  const cat = MENU_CATEGORIES.find(c => c.num === catNum);
  if (!cat) return null;
  return groupCommands(cat.cmds, cleanDesc);
}

export function groupCommands(cmds, cleanDesc) {
  const map = new Map();
  for (const c of cmds || []) {
    const p = resolvePrimary(c.name);
    if (!map.has(p)) map.set(p, { primary: p, members: [] });
    map.get(p).members.push(c);
  }
  const out = [];
  for (const g of map.values()) {
    const rep = g.members.find(m => m.desc && m.desc.trim()) || g.members[0];
    let desc = rep ? cleanDesc(g.primary, rep.desc) : g.primary;
    const aliases = g.members.map(m => m.name).filter(n => String(n).toLowerCase() !== g.primary.toLowerCase());
    out.push({ primary: g.primary, desc, blocked: isBlocked(g.primary), members: g.members, aliases });
  }
  return out;
}

// BEAUTIFUL MENU (2026-10-15): match a typed category name ("voice ai",
// "memes") to its category number, so users can reply with a name or number.
export async function matchCategoryByName(text) {
  const { MENU_CATEGORIES } = await import('./menu-data.js');
  const { cleanTitle } = await import('./menu-desc.js');
  const t = String(text || '').toLowerCase().trim().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ');
  if (t.length < 3) return null;
  // exact title match first
  for (const c of MENU_CATEGORIES) {
    if (cleanTitle(c.title).toLowerCase() === t) return c.num;
  }
  // then loose contains-match (single best: longest title wins)
  let best = null, bestLen = 0;
  for (const c of MENU_CATEGORIES) {
    const title = cleanTitle(c.title).toLowerCase();
    if (title.length >= 4 && (t.includes(title) || title.includes(t)) && title.length > bestLen) {
      best = c.num; bestLen = title.length;
    }
  }
  return best;
}
