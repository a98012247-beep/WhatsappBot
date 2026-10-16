// Interactive (button/list) menu for AwaisxBot — tap instead of type.
// Main menu: category list. Category: command list. Command tap: dispatches it.
import { MENU_CATEGORIES } from './menu-data.js';
import { Store } from './store.js';
import { resolvePrimary } from './menu-groups.js';

const TAP_PREFIX = 'awaxmenu:';

// DEDUP (2026-10-15): collapse commands sharing one handler to a single row,
// displayed under the primary name. Typing any alias still works.
function primaryCmds(cmds) {
  const seen = new Map(); // primary -> display cmd
  for (const c of (cmds || []).filter(x => x.primary !== false)) {
    const p = resolvePrimary(c.name);
    if (!seen.has(p)) seen.set(p, { ...c, name: p });
  }
  return [...seen.values()];
}

export function getCategory(num) {
  const cat = MENU_CATEGORIES.find(c => c.num === num);
  if (!cat) return null;
  return { ...cat, cmds: primaryCmds(cat.cmds) };
}

export function getVisibleCategories() {
  const hidden = new Set(Store.getConfig().menu?.hiddenCategories || []);
  return MENU_CATEGORIES
    .filter(c => !hidden.has(c.num))
    .map(c => ({ ...c, cmds: primaryCmds(c.cmds) }));
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// Raw listMessage proto must be relayed directly: this Baileys version's
// generateWAMessageContent has no listMessage branch, so sock.sendMessage()
// always throws "Invalid media type". relayMessage encrypts + sends the proto.
async function sendListMessage(sock, jid, listMessage, quoted) {
  const contextInfo = quoted?.key ? {
    stanzaId: quoted.key.id,
    participant: quoted.key.participant || quoted.participant,
    quotedMessage: quoted.message,
  } : undefined;
  await sock.relayMessage(jid, {
    listMessage: { ...listMessage, contextInfo }
  }, {});
}

export async function sendMainMenu(sock, jid, quoted) {
  const cats = getVisibleCategories();
  if (!cats.length) {
    await sock.sendMessage(jid, { text: '⚠️ Menu mein koi category enabled nahi. Dashboard → Menu tab se categories on karein.' }, quoted ? { quoted } : {});
    return;
  }
  const sections = chunk(cats, 7).map((group, gi) => ({
    title: `Categories ${gi + 1}`,
    rows: group.map(c => ({
      title: `${c.icon} ${c.num}. ${c.title}`.slice(0, 60),
      rowId: `${TAP_PREFIX}cat:${c.num}`,
      description: `${c.cmds.length} commands — tap to open`
    }))
  }));
  // Raw listMessage proto — this Baileys version does not auto-convert the
  // { text, buttonText, sections } shorthand, so build the proto directly.
  await sendListMessage(sock, jid, {
    title: '🌟 AwaisxBot Menu',
    description: 'Neeche button dabayein, category khulegi — phir jis command pe tap karein wohi chal jayegi. Type karne ki zaroorat nahi! 👇',
    buttonText: '📋 Open Menu',
    listType: 1,
    sections,
    footerText: 'AwaisxBot'
  }, quoted);
}

export async function sendCategoryMenu(sock, jid, num, quoted) {
  const cat = getCategory(num);
  if (!cat) return sendMainMenu(sock, jid, quoted);
  const rows = cat.cmds.map(c => ({
    title: `!${c.name}`.slice(0, 60),
    rowId: `${TAP_PREFIX}cmd:${c.name}`,
    description: (c.desc || 'Tap to run').slice(0, 72)
  }));
  rows.push({ title: '⬅ Back', rowId: `${TAP_PREFIX}main`, description: 'Categories par wapas jayein' });
  const sections = chunk(rows, 10).map((group, gi) => ({
    title: `${cat.icon} ${cat.title}${gi ? ` (${gi + 1})` : ''}`.slice(0, 60),
    rows: group
  }));
  await sendListMessage(sock, jid, {
    title: `${cat.icon} ${cat.title}`.slice(0, 60),
    description: `${cat.num}. ${cat.title} — koi command select karein 👇`,
    buttonText: '⚡ Choose',
    listType: 1,
    sections,
    footerText: 'AwaisxBot'
  }, quoted);
}

/**
 * Routes a tapped list/button row. Returns true if it was a menu tap.
 * bot must expose handleMessage({msg, from, sender, senderName, isGroup, text}).
 */
export async function handleMenuTap(bot, ctx, rowId) {
  if (!rowId || !rowId.startsWith(TAP_PREFIX)) return false;
  const rest = rowId.slice(TAP_PREFIX.length);
  try {
    if (rest === 'main') {
      await sendMainMenu(bot.sock, ctx.from, ctx.msg);
      return true;
    }
    if (rest.startsWith('cat:')) {
      const num = parseInt(rest.slice(4), 10);
      await sendCategoryMenu(bot.sock, ctx.from, num, ctx.msg);
      return true;
    }
    if (rest.startsWith('cmd:')) {
      const name = rest.slice(4).replace(/[^a-z0-9_]/gi, '').toLowerCase();
      if (!name) return true;
      // Dispatch as if the user typed the command
      await bot.handleMessage({ ...ctx, text: '!' + name });
      return true;
    }
  } catch (e) {
    console.error('[interactive-menu]', e.message);
  }
  return true;
}
