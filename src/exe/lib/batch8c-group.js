// ============================================================================
// AwaisxBot — BATCH 8c: Group Admin commands
// ESM only. No new npm deps. No network at import.
// Self-registers via registerBatch() from ./batch-helpers.js
// All commands are GROUP-ONLY and verify bot admin where required.
// ============================================================================
import { registerBatch, readData, writeData, isGroupAdmin, isBotAdmin } from './batch-helpers.js';

const BANLIST_FILE = 'batch8c-banlist.json';   // { [groupId]: [userJid] }
const ANTI_FILE    = 'batch8c-anti.json';      // { [groupId]: true|false }

// ---- state loaded once, written back on change ----
const BAN = readData(BANLIST_FILE, {});       // per-group array of banned jids
const ANTI = readData(ANTI_FILE, {});         // per-group bad-word filter on/off

const MENU_SECTION = {
  title: 'Group Admin',
  commands: [
    { cmd: 'add',        desc: 'Add member to group' },
    { cmd: 'del',        desc: 'Delete a replied message' },
    { cmd: 'ban',        desc: 'Kick + ban user' },
    { cmd: 'unban',      desc: 'Remove user from ban list' },
    { cmd: 'block',      desc: 'Block a user' },
    { cmd: 'unblock',    desc: 'Unblock a user' },
    { cmd: 'blocklist',  desc: 'Show blocked users' },
    { cmd: 'admins',     desc: 'List group admins' },
    { cmd: 'antibadword',desc: 'Bad-word filter on/off' },
    { cmd: 'lock',       desc: 'Lock group (admins only)' },
    { cmd: 'unlock',     desc: 'Unlock group' },
    { cmd: 'disappear',  desc: 'Set disappearing messages' },
  ],
};

const WEB_COMMANDS = [];

// ── send helper (per task contract: ctx.bot.sendMessage) ────────────────────
async function say(ctx, text, extra = {}) {
  try { await ctx.bot.sendMessage(ctx.from, { text, ...extra }); }
  catch (e) { console.error('[batch8c] send failed:', e.message); }
}

// ── guard helpers ────────────────────────────────────────────────────────────
async function needGroup(ctx) {
  if (ctx.isGroup) return true;
  await say(ctx, '❌ Ye command sirf groups mein kaam karta hai.');
  return false;
}

async function needUserAdmin(ctx) {
  const ok = await isGroupAdmin(ctx.bot.sock, ctx.from, ctx.sender);
  if (!ok) await say(ctx, '❌ Ye command sirf group admins ke liye hai.');
  return ok;
}

async function needBotAdmin(ctx) {
  const ok = await isBotAdmin(ctx.bot.sock, ctx.from);
  if (!ok) await say(ctx, '❌ Mujhe (bot ko) admin hona chahiye is command ke liye.');
  return ok;
}

function contextInfo(msg) {
  const m = msg?.message || {};
  return m.extendedTextMessage?.contextInfo
      || m.imageMessage?.contextInfo
      || m.videoMessage?.contextInfo
      || m.documentMessage?.contextInfo
      || m.audioMessage?.contextInfo
      || null;
}

// Resolve a target user JID from query or quoted reply.
// Priority: 1) @mention in query, 2) phone number in query, 3) replied message.
function resolveTarget(ctx, query) {
  const ci = contextInfo(ctx.msg);
  // 1) explicit mention
  const mentioned = ci?.mentionedJid || [];
  if (mentioned.length > 0) return mentioned[0];
  // 2) phone number in query
  const digits = String(query || '').replace(/\D/g, '');
  if (digits.length >= 7 && digits.length <= 15) return `${digits}@s.whatsapp.net`;
  // 3) quoted reply
  const participant = ci?.participant;
  if (participant && typeof participant === 'string' && participant.includes('@')) return participant;
  return null;
}

function displayName(jid) {
  return `+${String(jid).split('@')[0]}`;
}

// Build the delete key for a quoted message.
function quotedDeleteKey(ctx) {
  const ci = contextInfo(ctx.msg);
  if (!ci?.stanzaId) return null;
  return {
    remoteJid: ctx.from,
    fromMe: false,
    id: ci.stanzaId,
    participant: ci.participant || undefined,
  };
}

// safe() wrapper: every handler catches its own errors, never throws.
function safe(fn) {
  return async (ctx, q) => {
    try { await fn(ctx, q); }
    catch (e) { console.error('[batch8c] handler error:', e.message); await say(ctx, '❌ Kuch masla hua, dobara try karein.'); }
  };
}

// ============================================================================
// 1. add — add a participant to the group
// ============================================================================
async function hAdd(ctx, query) {
  if (!(await needGroup(ctx))) return;
  if (!(await needUserAdmin(ctx))) return;
  if (!(await needBotAdmin(ctx))) return;
  const target = resolveTarget(ctx, query);
  if (!target) {
    await say(ctx, `📲 *Add*\n\nUsage: *${ctx.prefix}add <phone number>* ya *${ctx.prefix}add @user*\nExample: ${ctx.prefix}add 923001234567`);
    return;
  }
  if (target === ctx.sender || target === ctx.bot.sock.user?.id) {
    await say(ctx, '❌ Aap khud ko ya bot ko add nahi kar sakte.');
    return;
  }
  await ctx.bot.sock.groupParticipantsUpdate(ctx.from, [target], 'add');
  await say(ctx, `✅ ${displayName(target)} ko group mein add kar diya.`);
}

// ============================================================================
// 2. del / delete — delete a quoted message (bot must be admin)
// ============================================================================
async function hDel(ctx) {
  if (!(await needGroup(ctx))) return;
  if (!(await needUserAdmin(ctx))) return;
  if (!(await needBotAdmin(ctx))) return;
  const key = quotedDeleteKey(ctx);
  if (!key) {
    await say(ctx, `🗑️ *Delete*\n\nKisi message ka *reply* karke likhein: *${ctx.prefix}del*`);
    return;
  }
  try {
    await ctx.bot.sock.sendMessage(ctx.from, { delete: key });
    await say(ctx, '🗑️ Message delete kar diya.');
  } catch (e) {
    await say(ctx, '❌ Delete nahi ho saka. Ho sakta hai bot admin na ho ya message bohat purana ho.');
  }
}

// ============================================================================
// 3. ban / unban — kick + track banned users per group
// ============================================================================
function banList(groupId) {
  if (!Array.isArray(BAN[groupId])) BAN[groupId] = [];
  return BAN[groupId];
}

async function hBan(ctx, query) {
  if (!(await needGroup(ctx))) return;
  if (!(await needUserAdmin(ctx))) return;
  if (!(await needBotAdmin(ctx))) return;
  const target = resolveTarget(ctx, query);
  if (!target) {
    await say(ctx, `🚫 *Ban*\n\nUsage: *${ctx.prefix}ban @user* ya kisi ke message ka reply karke *${ctx.prefix}ban*`);
    return;
  }
  const list = banList(ctx.from);
  if (!list.includes(target)) { list.push(target); writeData(BANLIST_FILE, BAN); }
  await ctx.bot.sock.groupParticipantsUpdate(ctx.from, [target], 'remove');
  await say(ctx, `🚫 ${displayName(target)} ko group se nikal kar ban kar diya.`);
}

async function hUnban(ctx, query) {
  if (!(await needGroup(ctx))) return;
  if (!(await needUserAdmin(ctx))) return;
  const target = resolveTarget(ctx, query);
  if (!target) {
    await say(ctx, `✅ *Unban*\n\nUsage: *${ctx.prefix}unban @user* ya *${ctx.prefix}unban <phone>*`);
    return;
  }
  const list = banList(ctx.from);
  const i = list.indexOf(target);
  if (i === -1) {
    await say(ctx, `ℹ️ ${displayName(target)} ban list mein nahi hai.`);
    return;
  }
  list.splice(i, 1);
  writeData(BANLIST_FILE, BAN);
  await say(ctx, `✅ ${displayName(target)} ka ban hata diya. (Dobara add karne ke liye ${ctx.prefix}add use karein.)`);
}

// ============================================================================
// 4. block / unblock / blocklist — WhatsApp block management
// ============================================================================
async function hBlock(ctx, query) {
  if (!(await needGroup(ctx))) return;
  if (!(await needUserAdmin(ctx))) return;
  const target = resolveTarget(ctx, query);
  if (!target) {
    await say(ctx, `⛔ *Block*\n\nUsage: *${ctx.prefix}block @user* ya reply karke *${ctx.prefix}block*`);
    return;
  }
  await ctx.bot.sock.updateBlockStatus(target, 'block');
  await say(ctx, `⛔ ${displayName(target)} ko block kar diya.`);
}

async function hUnblock(ctx, query) {
  if (!(await needGroup(ctx))) return;
  if (!(await needUserAdmin(ctx))) return;
  const target = resolveTarget(ctx, query);
  if (!target) {
    await say(ctx, `✅ *Unblock*\n\nUsage: *${ctx.prefix}unblock @user* ya *${ctx.prefix}unblock <phone>*`);
    return;
  }
  await ctx.bot.sock.updateBlockStatus(target, 'unblock');
  await say(ctx, `✅ ${displayName(target)} ko unblock kar diya.`);
}

async function hBlocklist(ctx) {
  if (!(await needGroup(ctx))) return;
  if (!(await needUserAdmin(ctx))) return;
  const list = await ctx.bot.sock.fetchBlocklist();
  if (!list || list.length === 0) {
    await say(ctx, '📋 Block list khaali hai — koi blocked user nahi.');
    return;
  }
  const lines = list.map((jid, i) => `${i + 1}. @${String(jid).split('@')[0]}`);
  await say(ctx, `📋 *Blocked Users (${list.length})*\n\n${lines.join('\n')}`, { mentions: list });
}

// ============================================================================
// 5. admins — list group admins with @mentions
// ============================================================================
async function hAdmins(ctx) {
  if (!(await needGroup(ctx))) return;
  const meta = await ctx.bot.sock.groupMetadata(ctx.from);
  const admins = (meta.participants || []).filter(p => p.admin === 'admin' || p.admin === 'superadmin');
  if (admins.length === 0) {
    await say(ctx, 'ℹ️ Is group mein koi admin nahi mila.');
    return;
  }
  const lines = admins.map((p, i) => `${i + 1}. @${p.id.split('@')[0]}${p.admin === 'superadmin' ? ' 👑' : ''}`);
  await say(ctx, `👥 *Group Admins (${admins.length})*\n\n${lines.join('\n')}`, { mentions: admins.map(p => p.id) });
}

// ============================================================================
// 6. antibadword — toggle + onMessage hook
// ============================================================================
// Small built-in list (<=20) of common English + Roman-Urdu profanities.
// Overridable via data/badwords.json (dashboard editable, 2026-10-14).
const DEFAULT_BAD_WORDS = [
  'fuck', 'shit', 'bitch', 'bastard', 'dick', 'pussy', 'slut', 'whore', 'asshole', 'motherfucker',
  'madarchod', 'behenchod', 'chutiya', 'gaand', 'lund', 'harami', 'bhosdi', 'randi', 'kutta', 'gandu',
];
function getBadWords() {
  const custom = readData('badwords.json', null);
  if (Array.isArray(custom) && custom.length) return custom;
  return DEFAULT_BAD_WORDS;
}
function getBadRe() {
  return new RegExp(`\\b(${getBadWords().map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i');
}

function msgText(msg) {
  const m = msg?.message || {};
  if (m.conversation) return m.conversation;
  if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
  if (m.imageMessage?.caption) return m.imageMessage.caption;
  if (m.videoMessage?.caption) return m.videoMessage.caption;
  return '';
}

async function hAntiBadWord(ctx, query) {
  if (!(await needGroup(ctx))) return;
  if (!(await needUserAdmin(ctx))) return;
  const arg = String(query || '').trim().toLowerCase();
  if (arg === 'on') {
    ANTI[ctx.from] = true; writeData(ANTI_FILE, ANTI);
    await say(ctx, `🛡️ *Anti-Badword ON*\nAb is group mein galat alfaaz wale messages delete ho jayenge.`);
  } else if (arg === 'off') {
    ANTI[ctx.from] = false; writeData(ANTI_FILE, ANTI);
    await say(ctx, '🛡️ *Anti-Badword OFF*');
  } else {
    const state = ANTI[ctx.from] ? 'ON 🟢' : 'OFF 🔴';
    await say(ctx, `🛡️ *Anti-Badword* (abhi: ${state})\n\nUsage: *${ctx.prefix}antibadword on* ya *${ctx.prefix}antibadword off*`);
  }
}

async function onMessage(ctx) {
  try {
    if (!ctx.isGroup) return;                 // groups only
    if (!ANTI[ctx.from]) return;               // filter not enabled here
    const text = msgText(ctx.msg);
    if (!text || !getBadRe().test(text)) return;
    if (ctx.msg.key?.fromMe) return;          // don't eat the bot's own messages
    // skip group admins' messages (they moderate, they don't get moderated)
    const isAdm = await isGroupAdmin(ctx.bot.sock, ctx.from, ctx.sender);
    if (isAdm) return;
    // delete offending message — gracefully if bot isn't admin
    const hasAdmin = await isBotAdmin(ctx.bot.sock, ctx.from);
    if (!hasAdmin) return;
    try {
      await ctx.bot.sock.sendMessage(ctx.from, { delete: ctx.msg.key });
    } catch { /* lacks delete rights — stay silent */ return; }
    const who = ctx.senderName ? `@${ctx.sender.split('@')[0]}` : 'User';
    await ctx.bot.sendMessage(ctx.from, {
      text: `⚠️ ${who}, galat alfaaz istemal karna mana hai. Message delete kar diya gaya.`,
      mentions: [ctx.sender],
    });
  } catch (e) {
    console.error('[batch8c] antibadword hook:', e.message);
  }
}

// ============================================================================
// 7. lock / unlock — group send permissions
// ============================================================================
async function hLock(ctx) {
  if (!(await needGroup(ctx))) return;
  if (!(await needUserAdmin(ctx))) return;
  if (!(await needBotAdmin(ctx))) return;
  await ctx.bot.sock.groupSettingUpdate(ctx.from, 'announcement');
  await say(ctx, '🔒 Group *lock* kar diya — ab sirf admins message bhej sakte hain.');
}

async function hUnlock(ctx) {
  if (!(await needGroup(ctx))) return;
  if (!(await needUserAdmin(ctx))) return;
  if (!(await needBotAdmin(ctx))) return;
  await ctx.bot.sock.groupSettingUpdate(ctx.from, 'not_announcement');
  await say(ctx, '🔓 Group *unlock* kar diya — sab members message bhej sakte hain.');
}

// ============================================================================
// 8. disappear / disappearing — disappearing messages timer
// ============================================================================
const EPHEMERAL_MAP = {
  off: 0,
  '24h': 24 * 60 * 60,
  '7d': 7 * 24 * 60 * 60,
  '90d': 90 * 24 * 60 * 60,
};

async function hDisappear(ctx, query) {
  if (!(await needGroup(ctx))) return;
  if (!(await needUserAdmin(ctx))) return;
  if (!(await needBotAdmin(ctx))) return;
  const arg = String(query || '').trim().toLowerCase();
  if (!(arg in EPHEMERAL_MAP)) {
    await say(ctx, `⏳ *Disappearing Messages*\n\nUsage:\n• *${ctx.prefix}disappear off*\n• *${ctx.prefix}disappear 24h*\n• *${ctx.prefix}disappear 7d*\n• *${ctx.prefix}disappear 90d*`);
    return;
  }
  const secs = EPHEMERAL_MAP[arg];
  // Baileys: groupSettingUpdate(jid, 'ephemeral', seconds) — 0 disables.
  await ctx.bot.sock.groupSettingUpdate(ctx.from, 'ephemeral', secs);
  if (secs === 0) await say(ctx, '⏳ Disappearing messages *OFF* kar diye.');
  else await say(ctx, `⏳ Disappearing messages *${arg}* par set kar diye.`);
}

// ============================================================================
// Registration
// ============================================================================
const HANDLERS = {
  add:          safe(hAdd),
  del:          safe(hDel),
  delete:       safe(hDel),
  disappearing: safe(hDisappear),
  disappear:    safe(hDisappear),
  ban:          safe(hBan),
  unban:        safe(hUnban),
  block:        safe(hBlock),
  unblock:      safe(hUnblock),
  blocklist:    safe(hBlocklist),
  admins:       safe(hAdmins),
  antibadword:  safe(hAntiBadWord),
  lock:         safe(hLock),
  unlock:       safe(hUnlock),
};

registerBatch({ MENU_SECTION, WEB_COMMANDS, HANDLERS, onMessage });
