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

// Per-group features controllable from the dashboard.
export const GROUP_FEATURES = [
  'welcome',      // welcome new members
  'goodbye',      // goodbye on leave
  'antilink',     // auto-delete links
  'antispam',     // anti-spam / slowdown
  'autoreply',    // keyword auto-replies (batch8)
  'chatbot',      // AI chatbot responses in group
  'keywordalerts',// keyword alert notifications
  'slowmode',     // slowmode enforcement
  'antidelete',   // anti-delete
  'silent',       // silent mode: NO announcements at all
];

// Built-in defaults when nothing is set anywhere.
const DEFAULTS = {
  welcome: true,
  goodbye: true,
  antilink: false,
  antispam: false,
  autoreply: true,
  chatbot: true,
  keywordalerts: true,
  slowmode: false,
  antidelete: false,
  silent: false,
};

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

// ─── Owner / admin ───
export function getOwnerConfig() {
  const cfg = readJson(OWNER_FILE, {});
  return {
    owner: cfg.owner || null,
    admins: Array.isArray(cfg.admins) ? cfg.admins : [],
    silentDefault: !!cfg.silentDefault,
    features: cfg.features && typeof cfg.features === 'object' ? cfg.features : {},
  };
}

export function saveOwnerConfig(patch) {
  const cfg = getOwnerConfig();
  const next = { ...cfg, ...patch };
  // keep only known keys
  const clean = {
    owner: next.owner || null,
    admins: Array.isArray(next.admins) ? [...new Set(next.admins.map(normalizeNumber).filter(Boolean))] : [],
    silentDefault: !!next.silentDefault,
    features: next.features && typeof next.features === 'object' ? next.features : {},
  };
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
  if (!n) throw new Error('Invalid number');
  const cfg = getOwnerConfig();
  if (!cfg.admins.includes(n)) cfg.admins.push(n);
  return saveOwnerConfig({ admins: cfg.admins });
}

export function removeAdmin(number) {
  const n = normalizeNumber(number);
  const cfg = getOwnerConfig();
  return saveOwnerConfig({ admins: cfg.admins.filter(a => a !== n) });
}

export function isOwner(sender) {
  const cfg = getOwnerConfig();
  if (!cfg.owner) return false;
  const norm = normalizeNumber(sender);
  if (norm === cfg.owner) return true;
  // Owner LIDs (2026-10-17): WhatsApp sends owner messages in @lid format
  const ownerLids = ['69505992642696', '108074899644670'];
  return ownerLids.includes(norm);
}

export function isAdmin(sender) {
  if (isOwner(sender)) return true;
  const cfg = getOwnerConfig();
  return cfg.admins.includes(normalizeNumber(sender));
}

// ─── Per-group settings ───
function readGroupSettings() {
  return readJson(GROUP_SETTINGS_FILE, {});
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
  writeJson(GROUP_SETTINGS_FILE, all);
  return getGroupSettings(groupId);
}

// Dashboard override with fallback to the command-set value, then default.
// Use in hooks: groupFeatureOn(from, 'antilink', g.antilink)
export function groupFeatureOn(groupId, feature, fallback) {
  if (!GROUP_FEATURES.includes(feature)) return fallback !== undefined ? !!fallback : true;
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
  return readJsonFile(SECTION_FILE, {});
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

// ─── Command usage stats (lightweight counter) ───
export function recordCommandUse(cmdName) {
  try {
    const stats = readJsonFile(STATS_FILE, {});
    const key = (cmdName || '').toLowerCase();
    stats[key] = (stats[key] || 0) + 1;
    stats._updated = new Date().toISOString();
    writeJsonFile(STATS_FILE, stats);
  } catch { /* never break dispatch */ }
}

export function getCommandStats() {
  return readJsonFile(STATS_FILE, {});
}
