// Access control + per-group feature settings + silent mode (2026-10-14).
// Single source of truth for: owner/admin identity, dashboard-controlled
// per-group feature toggles, and silent mode.
//
// Storage:
//   data/owner-config.json   { owner, admins[], silentDefault, features{} }
//   data/group-settings.json { "<groupJid>": { welcome, goodbye, antilink, ... } }
//
// featureEnabled(groupId, feature, fallback):
//   - If the dashboard/config has an explicit value for this group+feature, use it.
//   - Otherwise use `fallback` (the command-set value), else the built-in default.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

const OWNER_FILE = 'owner-config.json';
const GROUP_SETTINGS_FILE = 'group-settings.json';
const STOPPED_CHATS_FILE = 'stopped-chats.json';

// Per-group features controllable from the dashboard.
export const GROUP_FEATURES = [
  'welcome',      // welcome new members
  'goodbye',      // goodbye on leave
  'antilink',     // auto-delete links
  'antipromo',    // auto-delete promotional messages
  'antispam',     // anti-spam / slowdown
  'autoreply',    // keyword auto-replies (batch8)
  'chatbot',      // AI chatbot responses in group
  'keywordalerts',// keyword alert notifications
  'slowmode',     // slowmode enforcement
  'antidelete',   // anti-delete
  'silent',       // silent mode: NO announcements at all
];

// Built-in defaults when nothing is set anywhere.
// (Group reply and auto-delete features are default FALSE per user configuration)
const DEFAULTS = {
  welcome: false,
  goodbye: false,
  antilink: false,
  antipromo: false,
  antispam: false,
  autoreply: false,
  chatbot: false,
  keywordalerts: false,
  slowmode: false,
  antidelete: false,
  silent: false,
};

// In-memory caches to eliminate disk I/O bottlenecks in hot message paths
let _cachedOwnerConfig = null;
let _cachedGroupSettings = null;
let _cachedStoppedChats = null;
let _cachedSectionConfig = null;
let _cachedStats = null;
let _statsSaveTimer = null;

function readJson(file, def) {
  try {
    const p = path.join(DATA_DIR, file);
    if (!fs.existsSync(p)) return def;
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch { return def; }
}

function writeJson(file, data) {
  try {
    const p = path.join(DATA_DIR, file);
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('[access] writeJson', file, e.message);
    return false;
  }
}

// ─── Number normalization ───
// "923001234567@s.whatsapp.net" / "923001234567:26@..." → "923001234567"
export function normalizeNumber(jid) {
  if (!jid) return '';
  return String(jid).split('@')[0].split(':')[0].replace(/\D/g, '');
}

// ─── Chat ID standardizer ───
export function cleanChatId(jid) {
  if (!jid) return '';
  const str = String(jid).trim();
  if (str.includes('@s.whatsapp.net')) {
    const num = str.split('@')[0].split(':')[0].replace(/\D/g, '');
    return `${num}@s.whatsapp.net`;
  }
  if (!str.includes('@') && /^\d+$/.test(str)) {
    return `${str}@s.whatsapp.net`;
  }
  return str;
}

// ─── Stopped chats control ───
export function isChatStopped(chatId) {
  if (!chatId) return false;
  const all = getStoppedChats();
  const raw = String(chatId).trim();
  const clean = cleanChatId(raw);
  const normNum = normalizeNumber(raw);

  if (all[raw]?.stopped) return true;
  if (all[clean]?.stopped) return true;
  if (normNum && all[normNum]?.stopped) return true;
  return false;
}

export function stopChat(chatId, sender) {
  if (!chatId) return false;
  const all = getStoppedChats();
  const clean = cleanChatId(chatId);
  all[clean] = {
    stopped: true,
    stoppedAt: new Date().toISOString(),
    stoppedBy: sender ? normalizeNumber(sender) : 'owner'
  };
  _cachedStoppedChats = all;
  writeJson(STOPPED_CHATS_FILE, all);
  return true;
}

export function startChat(chatId) {
  if (!chatId) return false;
  const all = getStoppedChats();
  const raw = String(chatId).trim();
  const clean = cleanChatId(raw);
  const normNum = normalizeNumber(raw);
  let changed = false;
  if (all[raw]) { delete all[raw]; changed = true; }
  if (all[clean]) { delete all[clean]; changed = true; }
  if (normNum && all[normNum]) { delete all[normNum]; changed = true; }
  if (changed) {
    _cachedStoppedChats = all;
    writeJson(STOPPED_CHATS_FILE, all);
  }
  return true;
}

export function getStoppedChats() {
  if (_cachedStoppedChats) return _cachedStoppedChats;
  _cachedStoppedChats = readJson(STOPPED_CHATS_FILE, {});
  return _cachedStoppedChats;
}

// ─── Owner / admin (Sole Owner: +923243877900 / 108074899644670) ───
const KNOWN_OWNER_IDS = new Set(['923243877900', '108074899644670']);

export function getOwnerConfig() {
  if (_cachedOwnerConfig) return _cachedOwnerConfig;
  const cfg = readJson(OWNER_FILE, {});
  _cachedOwnerConfig = {
    owner: cfg.owner || '923243877900',
    ownerLid: cfg.ownerLid || '108074899644670',
    admins: Array.isArray(cfg.admins) ? cfg.admins : ['923243877900', '108074899644670'],
    silentDefault: !!cfg.silentDefault,
    features: cfg.features && typeof cfg.features === 'object' ? cfg.features : {},
  };
  return _cachedOwnerConfig;
}

export function saveOwnerConfig(patch) {
  const cfg = getOwnerConfig();
  const next = { ...cfg, ...patch };
  const ownerNum = normalizeNumber(next.owner || '923243877900');
  const ownerLid = normalizeNumber(next.ownerLid || '108074899644670');
  const rawAdmins = Array.isArray(next.admins) ? next.admins : [];
  const cleanAdmins = [...new Set([
    ownerNum,
    ownerLid,
    ...rawAdmins.map(normalizeNumber).filter(Boolean)
  ])];
  const clean = {
    owner: ownerNum,
    ownerLid: ownerLid,
    admins: cleanAdmins,
    silentDefault: !!next.silentDefault,
    features: next.features && typeof next.features === 'object' ? next.features : {},
  };
  _cachedOwnerConfig = clean;
  writeJson(OWNER_FILE, clean);
  return clean;
}

export function setOwner(number) {
  const n = normalizeNumber(number);
  if (!n) throw new Error('Invalid number');
  return saveOwnerConfig({ owner: n });
}

export function addAdmin(number) {
  const n = normalizeNumber(number);
  if (!n) throw new Error('Invalid number or ID');
  const cfg = getOwnerConfig();
  const admins = Array.isArray(cfg.admins) ? [...cfg.admins] : [];
  if (!admins.map(normalizeNumber).includes(n)) {
    admins.push(n);
  }
  return saveOwnerConfig({ admins });
}

export function removeAdmin(number) {
  const n = normalizeNumber(number);
  if (!n) throw new Error('Invalid number or ID');
  const cfg = getOwnerConfig();
  const ownerNum = normalizeNumber(cfg.owner || '923243877900');
  const ownerLid = normalizeNumber(cfg.ownerLid || '108074899644670');
  if (n === ownerNum || n === ownerLid) {
    throw new Error('Cannot remove the Bot Owner from access');
  }
  const admins = (Array.isArray(cfg.admins) ? cfg.admins : []).filter(a => normalizeNumber(a) !== n);
  return saveOwnerConfig({ admins });
}

export function isOwner(sender) {
  if (!sender) return false;
  const raw = String(sender);
  if (raw.includes('923243877900') || raw.includes('108074899644670')) return true;
  const norm = normalizeNumber(sender);
  if (KNOWN_OWNER_IDS.has(norm)) return true;
  const cfg = getOwnerConfig();
  if (cfg.owner && norm === normalizeNumber(cfg.owner)) return true;
  if (cfg.ownerLid && norm === normalizeNumber(cfg.ownerLid)) return true;
  return false;
}

export function isAdmin(sender) {
  if (!sender) return false;
  if (isOwner(sender)) return true;
  const cfg = getOwnerConfig();
  const raw = String(sender);
  const norm = normalizeNumber(sender);
  const admins = Array.isArray(cfg.admins) ? cfg.admins : [];

  for (const adm of admins) {
    const admNorm = normalizeNumber(adm);
    if (!admNorm) continue;
    if (raw.includes(admNorm) || norm === admNorm) {
      return true;
    }
  }
  return false;
}

export function canUseBot(sender) {
  return isOwner(sender) || isAdmin(sender);
}

// ─── Per-group settings ───
function readGroupSettings() {
  if (_cachedGroupSettings) return _cachedGroupSettings;
  _cachedGroupSettings = readJson(GROUP_SETTINGS_FILE, {});
  return _cachedGroupSettings;
}

export function getGroupSettings(groupId) {
  const all = readGroupSettings();
  const explicit = all[groupId] || {};
  // Merge with defaults so callers always get a full object.
  const merged = {};
  for (const f of GROUP_FEATURES) {
    merged[f] = f in explicit ? !!explicit[f] : DEFAULTS[f];
  }
  return merged;
}

export function updateGroupSettings(groupId, patch) {
  const all = readGroupSettings();
  const cur = all[groupId] || {};
  for (const [k, v] of Object.entries(patch || {})) {
    if (GROUP_FEATURES.includes(k)) cur[k] = !!v;
  }
  all[groupId] = cur;
  _cachedGroupSettings = all;
  writeJson(GROUP_SETTINGS_FILE, all);
  return getGroupSettings(groupId);
}

// Dashboard override with fallback to the command-set value, then default.
// Use in hooks: groupFeatureOn(from, 'antilink', g.antilink)
export function groupFeatureOn(groupId, feature, fallback) {
  if (!GROUP_FEATURES.includes(feature)) return fallback !== undefined ? !!fallback : false;
  const all = readGroupSettings();
  const explicit = all[groupId];
  if (explicit && feature in explicit) return !!explicit[feature];
  if (fallback !== undefined) return !!fallback;
  return !!DEFAULTS[feature];
}

// Silent mode: per-group setting wins, else global default.
export function isSilent(groupId) {
  const all = readGroupSettings();
  const explicit = all[groupId];
  if (explicit && 'silent' in explicit) return !!explicit.silent;
  return !!getOwnerConfig().silentDefault;
}

// ─── Global feature toggles (command categories) ───
export function getGlobalFeatures() {
  return getOwnerConfig().features;
}

export function setGlobalFeature(name, enabled) {
  const cfg = getOwnerConfig();
  cfg.features[name] = !!enabled;
  return saveOwnerConfig({ features: cfg.features }).features;
}

export function globalFeatureOn(name, fallback = true) {
  const f = getGlobalFeatures();
  if (name in f) return !!f[name];
  return !!fallback;
}

// ─── Per-section / per-command control (2026-10-14) ───
// data/section-config.json: { "<slug>": { "commands": { "<cmd>": { "enabled": bool } } } }
// Category enable/disable stays in owner-config features (globalFeatureOn).
// This adds per-COMMAND toggles within a category.
const SECTION_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'section-config.json');
const STATS_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'command-stats.json');

function readJsonFile(p, def) {
  try {
    if (!fs.existsSync(p)) return def;
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch { return def; }
}
function writeJsonFile(p, data) {
  try { fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8'); return true; }
  catch (e) { console.error('[access] write', p, e.message); return false; }
}

export function getSectionConfig() {
  if (_cachedSectionConfig) return _cachedSectionConfig;
  _cachedSectionConfig = readJsonFile(SECTION_FILE, {});
  return _cachedSectionConfig;
}

export function isCommandEnabled(slug, cmdName) {
  const cfg = getSectionConfig();
  const sec = cfg[slug];
  if (!sec || !sec.commands) return true;
  const c = sec.commands[(cmdName || '').toLowerCase()];
  if (!c) return true;
  return c.enabled !== false;
}

export function setCommandEnabled(slug, cmdName, enabled) {
  const cfg = getSectionConfig();
  if (!cfg[slug]) cfg[slug] = { commands: {} };
  if (!cfg[slug].commands) cfg[slug].commands = {};
  const key = (cmdName || '').toLowerCase();
  if (!cfg[slug].commands[key]) cfg[slug].commands[key] = {};
  cfg[slug].commands[key].enabled = !!enabled;
  _cachedSectionConfig = cfg;
  writeJsonFile(SECTION_FILE, cfg);
  return cfg[slug].commands[key];
}

export function getDisabledCommands(slug) {
  const cfg = getSectionConfig();
  const sec = cfg[slug];
  if (!sec || !sec.commands) return [];
  return Object.entries(sec.commands)
    .filter(([, v]) => v && v.enabled === false)
    .map(([k]) => k);
}

// ─── Command usage stats (lightweight counter with throttled disk writes) ───
export function recordCommandUse(cmdName) {
  try {
    if (!_cachedStats) {
      _cachedStats = readJsonFile(STATS_FILE, {});
    }
    const key = (cmdName || '').toLowerCase();
    _cachedStats[key] = (_cachedStats[key] || 0) + 1;
    _cachedStats._updated = new Date().toISOString();

    if (!_statsSaveTimer) {
      _statsSaveTimer = setTimeout(() => {
        _statsSaveTimer = null;
        if (_cachedStats) {
          writeJsonFile(STATS_FILE, _cachedStats);
        }
      }, 15000); // Batch write to disk every 15 seconds max
    }
  } catch { /* never break dispatch */ }
}

export function getCommandStats() {
  if (_cachedStats) return _cachedStats;
  _cachedStats = readJsonFile(STATS_FILE, {});
  return _cachedStats;
}
