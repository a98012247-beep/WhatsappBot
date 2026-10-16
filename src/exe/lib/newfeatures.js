// Central registry for the 134 new features (batches 1-6).
// Batch modules import { registerBatch, ...helpers } from './batch-helpers.js'
// (a leaf module with no cycle). This file dynamically imports the batch
// modules, then builds the dispatch registries bot.js consumes.
//
// bot.js integration:
//   import { NEW_COMMANDS, handleNewFeature, getNewMenuSections,
//            runMessageHooks, runMemberHooks } from './newfeatures.js';
import { _getBatches } from './batch-helpers.js';

// ---- Batch modules (each self-registers on import) ----
// Fault-tolerant: a missing/broken batch must not take down the bot.
for (const f of [
  './batch1-fun-ai.js',
  './batch2-media-tools.js',
  './batch3-deen-edu.js',
  './batch4-groups-auto.js',
  './batch5-biz-money.js',
  './batch6-health-news.js',
  './batch7-more.js',
  './batch8-newcmds.js',
  './batch8b-media.js',
  './batch8c-group.js',
  './batch8d-fun.js',
  './batch9-missing.js',
]) {
  try { await import(f); }
  catch (e) { console.warn(`[newfeatures] batch ${f} not loaded:`, e.message); }
}

// ---- Build registries ----
export const NEW_COMMANDS = new Set();
const handlers = new Map(); // name -> { run }
const menuSections = [];
const webCommands = [];
const messageHooks = [];
const memberHooks = [];

for (const b of _getBatches()) {
  if (b.MENU_SECTION) menuSections.push(b.MENU_SECTION);
  if (Array.isArray(b.WEB_COMMANDS)) webCommands.push(...b.WEB_COMMANDS);
  for (const [name, fn] of Object.entries(b.HANDLERS || {})) {
    const key = String(name).toLowerCase();
    if (typeof fn === 'string') {
      handlers.set(key, { aliasOf: fn.toLowerCase() });
    } else if (typeof fn === 'function') {
      handlers.set(key, { run: fn });
    }
    NEW_COMMANDS.add(key);
  }
  if (typeof b.onMessage === 'function') messageHooks.push(b.onMessage);
  if (typeof b.onParticipantsUpdate === 'function') memberHooks.push(b.onParticipantsUpdate);
}
// Resolve aliases (alias -> primary name), following chains recursively.
// (2026-10-14 fix: was single-pass, broke chained aliases like clock->timezone->timeconv)
function resolveAliasTarget(name, seen = new Set()) {
  if (seen.has(name)) return null; // circular
  seen.add(name);
  const t = handlers.get(name);
  if (!t) return null;
  if (t.run) return t;
  if (t.aliasOf) return resolveAliasTarget(t.aliasOf, seen);
  return null;
}
for (const [key, h] of handlers) {
  if (h.aliasOf) {
    const target = resolveAliasTarget(h.aliasOf);
    if (target) handlers.set(key, target);
    else console.warn(`[newfeatures] alias ${key} -> unknown ${h.aliasOf}`);
  }
}

// MENU DEDUP (2026-10-15): alias -> immediate target name, captured for
// menu-groups.js so the menu can collapse aliases under their primary.
// (Covers string aliases from ALL batch files: batch2/3/8 series.)
export const BATCH_ALIASES = {};
for (const b of _getBatches()) {
  for (const [name, fn] of Object.entries(b.HANDLERS || {})) {
    if (typeof fn === 'string') BATCH_ALIASES[String(name).toLowerCase()] = fn.toLowerCase();
  }
}

export function getNewMenuSections() {
  return menuSections.join('\n');
}

export function getNewWebCommands() {
  return webCommands;
}

export async function handleNewFeature(ctx, command, query) {
  const h = handlers.get(String(command).toLowerCase());
  if (!h || !h.run) return false;
  await h.run(ctx, query || '');
  return true;
}

export async function runMessageHooks(ctx) {
  for (const hook of messageHooks) {
    try { await hook(ctx); } catch (e) { console.error('[newfeatures] onMessage hook:', e.message); }
  }
}

export async function runMemberHooks(evt) {
  for (const hook of memberHooks) {
    try { await hook(evt); } catch (e) { console.error('[newfeatures] member hook:', e.message); }
  }
}

// Test/introspection helpers (QA harnesses, not the bot runtime)
export function _testHandlers() { return handlers; }
export function _testWebCommands() { return webCommands; }
export function _testMenuSections() { return menuSections; }
export function _testHooks() { return { messageHooks: messageHooks.length, memberHooks: memberHooks.length }; }
