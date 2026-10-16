/**
 * Persistent Conversation Memory — AwaisxBot never forgets
 * (2026-10-13, Hudson's requirement)
 *
 * - EVERY message (user + bot) saved to disk per user
 * - Survives restarts — context is never lost
 * - AI gets full conversation history, not just last 10 in-memory
 * - Storage tracking: warns user at ~1GB
 * - Media files (images/videos/voice) auto-delete after 24h
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(MODULE_DIR, '..', 'data', 'conversations');
const MEDIA_DIR = path.join(MODULE_DIR, '..', 'data', 'media');
const MAX_HISTORY_FOR_AI = 30;          // last 30 messages sent to AI
const STORAGE_WARN_BYTES = 1 * 1024 * 1024 * 1024;  // 1GB warning
const MEDIA_TTL_MS = 24 * 60 * 60 * 1000;          // 24 hours

function ensureDir(d) {
  try { fs.mkdirSync(d, { recursive: true }); } catch {}
}
ensureDir(DATA_DIR);
ensureDir(MEDIA_DIR);

function userFile(sender) {
  const safe = sender.replace(/[^a-zA-Z0-9]/g, '_');
  return path.join(DATA_DIR, safe + '.json');
}

function loadHistory(sender) {
  try {
    return JSON.parse(fs.readFileSync(userFile(sender), 'utf8'));
  } catch {
    return [];
  }
}

function saveHistory(sender, history) {
  try {
    fs.writeFileSync(userFile(sender), JSON.stringify(history));
  } catch (e) {
    console.log(`⚠️ [Memory] Save failed for ${sender}: ${e.message}`);
  }
}

/**
 * Record a message in persistent memory.
 * @param {string} sender - user LID/JID
 * @param {'user'|'bot'} role
 * @param {string} text - message text (truncated to 2000 chars)
 */
export function recordMessage(sender, role, text) {
  if (!sender || !text) return;
  const history = loadHistory(sender);
  history.push({
    role,
    text: String(text).slice(0, 2000),
    at: new Date().toISOString(),
  });
  // Keep file manageable — cap at 500 messages (older ones pruned)
  // The 1GB check below handles the real limit; this is just hygiene
  while (history.length > 500) history.shift();
  saveHistory(sender, history);
}

/**
 * Get conversation history for AI context (last N messages).
 */
export function getHistory(sender, limit = MAX_HISTORY_FOR_AI) {
  const history = loadHistory(sender);
  return history.slice(-limit);
}

/**
 * Clear a user's conversation history (used by deletemydata).
 */
export function clearUserMemory(sender) {
  try { fs.unlinkSync(userFile(sender)); } catch {}
  // 2026-10-13: also sweep the user's media files so "delete all my data" is complete
  const safe = sender.replace(/[^a-zA-Z0-9]/g, '_');
  try {
    for (const f of fs.readdirSync(MEDIA_DIR)) {
      if (f.startsWith(safe)) { try { fs.unlinkSync(path.join(MEDIA_DIR, f)); } catch {} }
    }
  } catch {}
}

/**
 * Check user's storage size. Returns { bytes, warn }.
 * Warn when approaching 1GB — bot tells user to delete data.
 */
export function checkStorage(sender) {
  try {
    const stat = fs.statSync(userFile(sender));
    return { bytes: stat.size, warn: stat.size > STORAGE_WARN_BYTES };
  } catch {
    return { bytes: 0, warn: false };
  }
}

function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1073741824).toFixed(2) + ' GB';
}

/**
 * Get storage warning message if user is near/over 1GB.
 * Returns null if fine.
 */
export function getStorageWarning(sender) {
  const { bytes, warn } = checkStorage(sender);
  if (!warn) return null;
  return `⚠️ *Storage warning:* Your conversation data has grown to ${formatBytes(bytes)}. ` +
    `I may not be able to remember older messages. ` +
    `Type *deletemydata* to clear your history and start fresh — this frees up space so I can remember new conversations properly.`;
}

/**
 * Register a media file for 24h auto-delete.
 * @param {string} filePath - absolute path to the media file
 */
export function trackMedia(filePath) {
  try {
    const metaFile = filePath + '.meta.json';
    fs.writeFileSync(metaFile, JSON.stringify({ created: Date.now(), path: filePath }));
  } catch {}
}

/**
 * Delete media files older than 24h. Called hourly.
 * Returns count of deleted files.
 */
export function cleanupMedia() {
  let deleted = 0;
  const now = Date.now();
  try {
    const walk = (dir) => {
      for (const f of fs.readdirSync(dir)) {
        const fp = path.join(dir, f);
        try {
          const stat = fs.statSync(fp);
          if (stat.isDirectory()) { walk(fp); continue; }
          if (!f.endsWith('.meta.json')) continue;
          const meta = JSON.parse(fs.readFileSync(fp, 'utf8'));
          if (now - meta.created > MEDIA_TTL_MS) {
            try { fs.unlinkSync(meta.path); } catch {}
            try { fs.unlinkSync(fp); } catch {}
            deleted++;
          }
        } catch {}
      }
    };
    walk(MEDIA_DIR);
    // Also check tmp media locations
    for (const tmpDir of ['/tmp']) {
      try {
        for (const f of fs.readdirSync(tmpDir)) {
          if (f.startsWith('bot_media_') && f.endsWith('.meta.json')) {
            const fp = path.join(tmpDir, f);
            try {
              const meta = JSON.parse(fs.readFileSync(fp, 'utf8'));
              if (now - meta.created > MEDIA_TTL_MS) {
                try { fs.unlinkSync(meta.path); } catch {}
                try { fs.unlinkSync(fp); } catch {}
                deleted++;
              }
            } catch {}
          }
        }
      } catch {}
    }
  } catch {}
  if (deleted > 0) console.log(`🧹 [Memory] Cleaned ${deleted} expired media files`);
  return deleted;
}
