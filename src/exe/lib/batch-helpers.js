// Shared helpers for the new-feature batch modules.
// Lives in its own module (no import of newfeatures.js) so batch files can
// import helpers WITHOUT creating an import cycle. newfeatures.js pulls the
// registered batches from here after dynamically importing the batch files.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { downloadMediaMessage } from '@whiskeysockets/baileys';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

const batches = [];
export function registerBatch(b) {
  if (!b || !b.HANDLERS) throw new Error('registerBatch: batch missing HANDLERS');
  batches.push(b);
}
export function _getBatches() { return batches; }

export function readData(file, def) {
  const p = path.join(DATA_DIR, file);
  try {
    if (!fs.existsSync(p)) return def;
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (e) {
    console.error('[batch-helpers] readData', file, e.message);
    return def;
  }
}

export function writeData(file, data) {
  const p = path.join(DATA_DIR, file);
  try {
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('[batch-helpers] writeData', file, e.message);
    return false;
  }
}

// Download image/video/audio/document from the quoted message or the message itself.
// Returns { buffer, mimetype } or null.
export async function getMediaBuffer(msg, kind) {
  try {
    const m = msg?.message || {};
    const quoted = m.extendedTextMessage?.contextInfo?.quotedMessage
      || m.imageMessage?.contextInfo?.quotedMessage
      || m.videoMessage?.contextInfo?.quotedMessage;
    const pick = (message) => {
      if (!message) return null;
      const k = kind.toLowerCase();
      const key = Object.keys(message).find(x => x.toLowerCase().startsWith(k));
      if (!key) return null;
      return { key: msg.key, message: { [key]: message[key] } };
    };
    const target = pick(quoted) || pick(m);
    if (!target) return null;
    const buffer = await downloadMediaMessage(target, 'buffer', {});
    const msgKey = Object.keys(target.message)[0];
    return { buffer, mimetype: target.message[msgKey]?.mimetype || '' };
  } catch (e) {
    console.error('[batch-helpers] getMediaBuffer:', e.message);
    return null;
  }
}

export async function isGroupAdmin(sock, groupId, userJid) {
  try {
    const meta = await sock.groupMetadata(groupId);
    const p = (meta.participants || []).find(x => x.id === userJid);
    return !!p && (p.admin === 'admin' || p.admin === 'superadmin');
  } catch { return false; }
}

export async function isBotAdmin(sock, groupId) {
  try {
    const me = sock.user?.id;
    if (!me) return false;
    return await isGroupAdmin(sock, groupId, me);
  } catch { return false; }
}

export function fmtNum(n) {
  const x = Number(n);
  if (!isFinite(x)) return String(n);
  return x.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

// Simple per-chat in-memory state store with expiry.
export function makeStateStore(ttlMs = 10 * 60 * 1000) {
  const map = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of map) if (now - v.t > ttlMs) map.delete(k);
  }, 60 * 1000).unref?.();
  return {
    get: (k) => map.get(k)?.v ?? null,
    set: (k, v) => map.set(k, { v, t: Date.now() }),
    del: (k) => map.delete(k),
    has: (k) => map.has(k),
  };
}
