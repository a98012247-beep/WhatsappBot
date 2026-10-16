import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import crypto from 'crypto';
import fs from 'fs';
import { Store } from './lib/store.js';
import { botInstance } from './lib/bot.js';
import { downloadVideo } from './lib/downloader.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

app.use(express.json());

// HOSTING PATCH (dashboard auth): HTTP basic auth on every dashboard route
// when DASH_USER/DASH_PASS are set. Unset = current localhost behavior,
// nothing changes.
const DASH_USER = process.env.DASH_USER || '';
const DASH_PASS = process.env.DASH_PASS || '';
if (DASH_USER && DASH_PASS) {
  const wantU = Buffer.from(DASH_USER);
  const wantP = Buffer.from(DASH_PASS);
  app.use((req, res, next) => {
    const hdr = req.headers.authorization || '';
    const [scheme, encoded] = hdr.split(' ');
    let ok = false;
    if (scheme === 'Basic' && encoded) {
      try {
        const decoded = Buffer.from(encoded, 'base64').toString('utf8');
        const i = decoded.indexOf(':');
        const u = decoded.slice(0, i);
        const p = decoded.slice(i + 1);
        ok = i > 0 &&
             crypto.timingSafeEqual(Buffer.from(u), wantU) &&
             crypto.timingSafeEqual(Buffer.from(p), wantP);
      } catch { ok = false; }
    }
    if (!ok) {
      res.set('WWW-Authenticate', 'Basic realm="AwaxBot Dashboard"');
      return res.status(401).send('Auth required');
    }
    next();
  });
}

app.use(express.static(path.join(__dirname, 'public')));

// Socket.io Real-time connection
io.on('connection', (socket) => {
  // Send initial state on connection
  const currentStatus = botInstance.getStatus();
  socket.emit('status', currentStatus);
  socket.emit('logs', Store.getRecentLogs());

  socket.on('request_qr', () => {
    socket.emit('status', botInstance.getStatus());
  });
});

// Forward Bot Events to Socket.io
botInstance.on('status', (data) => {
  io.emit('status', botInstance.getStatus());
});

botInstance.on('qr', (data) => {
  io.emit('qr', data);
});

botInstance.on('message', (msg) => {
  io.emit('message', msg);
});

// Periodic Stats Emitter
setInterval(() => {
  io.emit('stats', botInstance.getStatus().stats);
}, 5000);

// --- REST API ENDPOINTS ---

// Bot status
app.get('/api/status', (req, res) => {
  res.json(botInstance.getStatus());
});

// Config
app.get('/api/config', (req, res) => {
  res.json(Store.getConfig());
});

// Interactive menu categories (for the Menu customiser tab)
app.get('/api/menu-categories', async (req, res) => {
  try {
    const { MENU_CATEGORIES } = await import('./lib/menu-data.js');
    res.json(MENU_CATEGORIES.map(c => ({ num: c.num, icon: c.icon, title: c.title, count: c.cmds.length })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/config', (req, res) => {
  const updated = Store.updateConfig(req.body);
  res.json({ success: true, config: updated });
});

// Auto-Replies
app.get('/api/replies', (req, res) => {
  res.json(Store.getAutoReplies());
});

app.post('/api/replies', (req, res) => {
  const { trigger, matchType, reply, enabled } = req.body;
  if (!trigger || !reply) {
    return res.status(400).json({ error: 'Trigger and reply text are required.' });
  }
  const created = Store.addAutoReply({ trigger, matchType, reply, enabled });
  res.status(201).json(created);
});

app.put('/api/replies/:id', (req, res) => {
  const updated = Store.updateAutoReply(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json(updated);
});

app.delete('/api/replies/:id', (req, res) => {
  Store.deleteAutoReply(req.params.id);
  res.json({ success: true });
});

// 24-Hour Statuses (Group 24h Status & WhatsApp Story Broadcast)
app.get('/api/statuses', (req, res) => {
  res.json(Store.getStatuses());
});

app.post('/api/statuses', async (req, res) => {
  const { groupId, groupName, text, isBroadcast } = req.body;
  if (!text) return res.status(400).json({ error: 'Status message is required' });
  try {
    if (isBroadcast || groupId === 'status@broadcast') {
      try {
        await botInstance.postWhatsAppStatus(text);
      } catch (e) {
        console.warn('WhatsApp status broadcast notice:', e.message);
      }
    } else if (groupId && groupId.endsWith('@g.us')) {
      try {
        await botInstance.postGroupStatus(groupId, text);
      } catch (e) {
        console.warn('WhatsApp group status post notice:', e.message);
      }
    }
    const created = Store.setGroupStatus({
      groupId: isBroadcast ? 'status@broadcast' : groupId,
      groupName: isBroadcast ? 'WhatsApp Story (Broadcast)' : (groupName || 'Group Chat'),
      text,
      author: 'Dashboard',
      authorName: 'Dashboard Admin',
      isBroadcast: !!isBroadcast
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/statuses/:id', (req, res) => {
  Store.deleteStatus(req.params.id);
  res.json({ success: true });
});

// Groups Management & Whitelist Access Control
app.get('/api/groups', async (req, res) => {
  try {
    const groups = await botInstance.getAllGroups();
    const settings = Store.getGroupSettings();
    res.json({
      mode: settings.mode || 'whitelist',
      allowedGroups: settings.allowedGroups || [],
      totalJoined: groups.length,
      totalAllowed: groups.filter(g => g.isAllowed).length,
      groups
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/groups/toggle', (req, res) => {
  const { groupId, allowed } = req.body;
  if (!groupId) return res.status(400).json({ error: 'groupId is required' });
  const result = Store.toggleGroupAllowed(groupId, allowed);
  res.json(result);
});

app.post('/api/groups/mode', (req, res) => {
  const { mode } = req.body;
  if (!['whitelist', 'all', 'disabled'].includes(mode)) {
    return res.status(400).json({ error: 'Invalid mode. Allowed: whitelist, all, disabled' });
  }
  const result = Store.setGroupMode(mode);
  res.json(result);
});

app.post('/api/groups/select-all', async (req, res) => {
  try {
    const { allowed } = req.body;
    if (allowed) {
      const groups = await botInstance.getAllGroups();
      const allIds = groups.map(g => g.id);
      Store.setAllowedGroups(allIds);
      res.json({ success: true, count: allIds.length, allowedGroups: allIds });
    } else {
      Store.setAllowedGroups([]);
      res.json({ success: true, count: 0, allowedGroups: [] });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/groups/:id/toggle-mute', async (req, res) => {
  try {
    const { id } = req.params;
    const { mute } = req.body;
    await botInstance.setGroupMute(id, mute);
    res.json({ success: true, message: `Group ${mute ? 'muted' : 'unmuted'} successfully` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Owner / Access Control (2026-10-14) ───
app.get('/api/owner', async (req, res) => {
  const { getOwnerConfig } = await import('./lib/access.js');
  res.json(getOwnerConfig());
});

app.post('/api/owner/set', async (req, res) => {
  try {
    const { setOwner, saveOwnerConfig } = await import('./lib/access.js');
    const { number } = req.body || {};
    if (!number) {
      const cfg = saveOwnerConfig({ owner: null });
      return res.json({ ok: true, owner: cfg.owner });
    }
    const cfg = setOwner(number);
    res.json({ ok: true, owner: cfg.owner });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/owner/admins/add', async (req, res) => {
  try {
    const { addAdmin } = await import('./lib/access.js');
    const { number } = req.body || {};
    if (!number) return res.status(400).json({ error: 'number is required' });
    const cfg = addAdmin(number);
    res.json({ ok: true, admins: cfg.admins });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/owner/admins/remove', async (req, res) => {
  try {
    const { removeAdmin } = await import('./lib/access.js');
    const { number } = req.body || {};
    if (!number) return res.status(400).json({ error: 'number is required' });
    const cfg = removeAdmin(number);
    res.json({ ok: true, admins: cfg.admins });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/owner/silent-default', async (req, res) => {
  const { saveOwnerConfig } = await import('./lib/access.js');
  const { silent } = req.body || {};
  const cfg = saveOwnerConfig({ silentDefault: !!silent });
  res.json({ ok: true, silentDefault: cfg.silentDefault });
});

// ─── Per-group feature settings (2026-10-14) ───
app.get('/api/groups/:id/settings', async (req, res) => {
  const { getGroupSettings } = await import('./lib/access.js');
  res.json(getGroupSettings(req.params.id));
});

app.post('/api/groups/:id/settings', async (req, res) => {
  const { updateGroupSettings } = await import('./lib/access.js');
  const settings = updateGroupSettings(req.params.id, req.body || {});
  res.json({ ok: true, settings });
});

// ─── Automation overview (2026-10-14) ───
app.get('/api/automation', async (req, res) => {
  try {
    const { readData } = await import('./lib/batch-helpers.js');
    const autoReplies = readData('autoReplies.json', []);
    const scheduled = readData('scheduled-tasks.json', []);
    const manychat = readData('batch8-autoreply.json', {});
    const auto = readData('batch4-auto.json', {});
    const keywords = Array.isArray(auto.keyword)
      ? auto.keyword.map((k, i) => ({ id: 'kw-' + i, keyword: k, enabled: true }))
      : [];
    // Flatten ManyChat-style per-chat auto-replies
    const manychatFlat = [];
    for (const [chat, list] of Object.entries(manychat)) {
      (list || []).forEach((r, i) => manychatFlat.push({
        id: `mc-${chat}-${i}`, chat, keyword: r.keyword,
        reply: (r.reply || '').slice(0, 80), enabled: true,
      }));
    }
    res.json({
      autoreplies: (Array.isArray(autoReplies) ? autoReplies : []).map(r => ({
        id: r.id, trigger: r.trigger, reply: (r.reply || '').slice(0, 80),
        enabled: r.enabled !== false,
      })),
      scheduled: (Array.isArray(scheduled) ? scheduled : []).map(t => ({
        id: t.id, message: (t.message || '').slice(0, 80),
        target: t.target || t.targetType, schedule: t.schedule,
        enabled: t.enabled !== false,
      })),
      keywords,
      manychat: manychatFlat,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/automation/toggle', async (req, res) => {
  try {
    const { readData, writeData } = await import('./lib/batch-helpers.js');
    const { type, id, enabled } = req.body || {};
    if (!type || !id) return res.status(400).json({ error: 'type and id required' });
    const on = !!enabled;
    if (type === 'autoreply') {
      const list = readData('autoReplies.json', []);
      const item = (Array.isArray(list) ? list : []).find(r => String(r.id) === String(id));
      if (!item) return res.status(404).json({ error: 'not found' });
      item.enabled = on; writeData('autoReplies.json', list);
    } else if (type === 'scheduled') {
      const list = readData('scheduled-tasks.json', []);
      const item = (Array.isArray(list) ? list : []).find(t => String(t.id) === String(id));
      if (!item) return res.status(404).json({ error: 'not found' });
      item.enabled = on; writeData('scheduled-tasks.json', list);
    } else {
      return res.status(400).json({ error: 'type must be autoreply or scheduled' });
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Per-group automation CRUD (2026-10-17 per Hudson) ───
app.post('/api/automation/scheduled', async (req, res) => {
  try {
    const { addScheduledTask } = await import('./lib/automation.js');
    const task = addScheduledTask(req.body || {});
    res.json({ ok: true, task });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/automation/scheduled/:id', async (req, res) => {
  try {
    const { updateScheduledTask } = await import('./lib/automation.js');
    const task = updateScheduledTask(req.params.id, req.body || {});
    if (!task) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true, task });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/automation/scheduled/:id', async (req, res) => {
  try {
    const { removeScheduledTask } = await import('./lib/automation.js');
    const ok = removeScheduledTask(req.params.id);
    res.json({ ok });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Global feature toggles (2026-10-14) ───
app.get('/api/features', async (req, res) => {
  const { getGlobalFeatures } = await import('./lib/access.js');
  const { MENU_CATEGORIES } = await import('./lib/menu-data.js');
  const saved = getGlobalFeatures();
  const categories = MENU_CATEGORIES.map(c => {
    const slug = 'cat-' + (c.num || c.title).toString().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return {
      name: slug,
      title: c.title,
      enabled: slug in saved ? !!saved[slug] : true,
    };
  });
  res.json({ categories, features: saved });
});

app.post('/api/features', async (req, res) => {
  const { setGlobalFeature } = await import('./lib/access.js');
  const { name, enabled } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  const features = setGlobalFeature(name, !!enabled);
  res.json({ ok: true, features });
});


// ─── Section Control Center (2026-10-14) ───
// Per-category detail panels: per-command toggles, settings editors, usage stats.
function sectionSlug(cat) {
  return 'cat-' + (cat.num || cat.title).toString().toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

app.get('/api/sections', async (req, res) => {
  try {
    const { getGlobalFeatures } = await import('./lib/access.js');
    const { getCommandStats } = await import('./lib/access.js');
    const { MENU_CATEGORIES } = await import('./lib/menu-data.js');
    const saved = getGlobalFeatures();
    const stats = getCommandStats();
    const sections = MENU_CATEGORIES.map(c => {
      const slug = sectionSlug(c);
      const cmds = c.cmds || [];
      let uses = 0;
      for (const cmd of cmds) uses += stats[(cmd.name || '').toLowerCase()] || 0;
      return {
        slug, title: c.title, cmdCount: cmds.length,
        enabled: slug in saved ? !!saved[slug] : true,
        totalUses: uses,
      };
    });
    res.json({ sections });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/sections/:slug', async (req, res) => {
  try {
    const { getGlobalFeatures, getSectionConfig, getCommandStats } = await import('./lib/access.js');
    const { MENU_CATEGORIES } = await import('./lib/menu-data.js');
    const cat = MENU_CATEGORIES.find(c => sectionSlug(c) === req.params.slug);
    if (!cat) return res.status(404).json({ error: 'Section not found' });
    const saved = getGlobalFeatures();
    const secCfg = getSectionConfig();
    const stats = getCommandStats();
    const slug = req.params.slug;
    const cmdCfg = (secCfg[slug] && secCfg[slug].commands) || {};
    // AUDIT (2026-10-14): load command audit for status badges + system tags
    let audit = {};
    try {
      const { readFileSync } = await import('fs');
      audit = JSON.parse(readFileSync(new URL('./data/command-audit.json', import.meta.url), 'utf-8'));
    } catch {}
    const catLower = cat.title.toLowerCase();
    const tagFor = catLower.includes('automat') || catLower.includes('business') || catLower.includes('remind') || catLower.includes('rss') ? 'automation'
      : catLower.includes('group') ? 'groups'
      : catLower.includes('monitor') || catLower.includes('stat') ? 'monitoring' : 'manual';
    const commands = (cat.cmds || []).map(c => {
      const name = (c.name || '').toLowerCase();
      const a = audit[name] || {};
      return {
        name: c.name,
        desc: c.desc || '',
        usage: c.usage || '',
        example: c.example || '',
        enabled: cmdCfg[name] ? cmdCfg[name].enabled !== false : true,
        uses: stats[name] || 0,
        hasSettings: !!SETTINGS_REGISTRY[name],
        auditStatus: a.status || 'unknown',
        duplicateOf: a.duplicateOf || null,
        auditNotes: a.notes || '',
        systemTag: tagFor,
      };
    });
    res.json({
      slug, title: cat.title,
      enabled: slug in saved ? !!saved[slug] : true,
      commands,
      groups: await buildSectionGroups(commands),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DEDUP (2026-10-15): group section commands by shared handler for display.
// Every command keeps its own toggle — this is display-layer only.
async function buildSectionGroups(commands) {
  const { resolvePrimary } = await import('./lib/menu-groups.js');
  const map = new Map();
  for (const c of commands || []) {
    const p = resolvePrimary(c.name);
    if (!map.has(p)) map.set(p, { primary: p, members: [] });
    map.get(p).members.push(c);
  }
  return [...map.values()].map(g => {
    const prim = g.members.find(m => String(m.name).toLowerCase() === g.primary.toLowerCase()) || g.members[0];
    return {
      primary: g.primary,
      desc: (prim && prim.desc) || '',
      members: g.members,
      aliases: g.members.filter(m => String(m.name).toLowerCase() !== g.primary.toLowerCase()).map(m => m.name),
    };
  });
}

app.post('/api/sections/:slug/command', async (req, res) => {
  try {
    const { setCommandEnabled } = await import('./lib/access.js');
    const { command, enabled } = req.body || {};
    if (!command) return res.status(400).json({ error: 'command is required' });
    const result = setCommandEnabled(req.params.slug, command, !!enabled);
    res.json({ ok: true, command, enabled: result.enabled });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Settings editors registry ───
// Each entry: { title, fields: [{key,label,type,help}], get(), set(data) }
const SETTINGS_REGISTRY = {
  autoreply: {
    title: 'Keyword Auto-Replies (ManyChat style)',
    fields: [{ key: 'items', label: 'Replies', type: 'kvlist', klabel: 'Keyword', vlabel: 'Reply message' }],
    async get() {
      const { readData } = await import('./lib/batch-helpers.js');
      return { items: readData('batch8-autoreply.json', {}) };
    },
    async set(data) {
      const { writeData } = await import('./lib/batch-helpers.js');
      writeData('batch8-autoreply.json', data.items || {});
      return { ok: true };
    },
  },
  keywordalert: {
    title: 'Keyword Alerts',
    fields: [{ key: 'keywords', label: 'Keywords (one per line)', type: 'list' }],
    async get() {
      const { readData } = await import('./lib/batch-helpers.js');
      const d = readData('batch4-auto.json', {});
      const out = {};
      for (const [chat, v] of Object.entries(d)) if (v && v.keyword) out[chat] = v.keyword;
      return { keywords: out };
    },
    async set(data) {
      const { readData, writeData } = await import('./lib/batch-helpers.js');
      const d = readData('batch4-auto.json', {});
      for (const [chat, kw] of Object.entries(data.keywords || {})) {
        if (!d[chat]) d[chat] = {};
        d[chat].keyword = Array.isArray(kw) ? kw : String(kw).split('\n').filter(Boolean);
      }
      writeData('batch4-auto.json', d);
      return { ok: true };
    },
  },
  antibadword: {
    title: 'Banned Words List',
    fields: [{ key: 'words', label: 'Banned words (one per line)', type: 'list' }],
    async get() {
      const { readData } = await import('./lib/batch-helpers.js');
      return { words: readData('badwords.json', null) || 'default' };
    },
    async set(data) {
      const { writeData } = await import('./lib/batch-helpers.js');
      const words = Array.isArray(data.words) ? data.words : String(data.words || '').split('\n').map(s => s.trim()).filter(Boolean);
      writeData('badwords.json', words);
      return { ok: true, count: words.length };
    },
  },
  welcomebiz: {
    title: 'Business Welcome Template',
    fields: [{ key: 'template', label: 'Welcome message template', type: 'textarea' }],
    async get() {
      const { readData } = await import('./lib/batch-helpers.js');
      const d = readData('batch4-auto.json', {});
      const out = {};
      for (const [chat, v] of Object.entries(d)) if (v && v.bizwelcome) out[chat] = v.bizwelcome;
      return { template: out };
    },
    async set(data) {
      const { readData, writeData } = await import('./lib/batch-helpers.js');
      const d = readData('batch4-auto.json', {});
      for (const [chat, tpl] of Object.entries(data.template || {})) {
        if (!d[chat]) d[chat] = {};
        d[chat].bizwelcome = tpl;
      }
      writeData('batch4-auto.json', d);
      return { ok: true };
    },
  },
  rmsgs: {
    title: 'Recurring Messages',
    fields: [{ key: 'note', label: 'Info', type: 'info', text: 'Recurring messages are managed per-chat. Use the Automation tab for full CRUD.' }],
    get() { return { note: 'See Automation tab' }; },
    set() { return { ok: true }; },
  },
  rss: {
    title: 'RSS Feeds',
    fields: [{ key: 'feeds', label: 'Feed URLs (one per line)', type: 'list' }],
    async get() {
      const { readData } = await import('./lib/batch-helpers.js');
      const d = readData('batch4-auto.json', {});
      const out = {};
      for (const [chat, v] of Object.entries(d)) if (v && v.rss) out[chat] = v.rss;
      return { feeds: out };
    },
    async set(data) {
      const { readData, writeData } = await import('./lib/batch-helpers.js');
      const d = readData('batch4-auto.json', {});
      for (const [chat, feeds] of Object.entries(data.feeds || {})) {
        if (!d[chat]) d[chat] = {};
        d[chat].rss = Array.isArray(feeds) ? feeds : String(feeds).split('\n').filter(Boolean);
      }
      writeData('batch4-auto.json', d);
      return { ok: true };
    },
  },
};
// Aliases for settings registry
SETTINGS_REGISTRY['keyword'] = SETTINGS_REGISTRY['keywordalert'];
SETTINGS_REGISTRY['recurringmsg'] = SETTINGS_REGISTRY['rmsgs'];
SETTINGS_REGISTRY['bizwelcome'] = SETTINGS_REGISTRY['welcomebiz'];
SETTINGS_REGISTRY['rsswatch'] = SETTINGS_REGISTRY['rss'];

app.get('/api/sections/:slug/settings/:command', async (req, res) => {
  try {
    const cmd = (req.params.command || '').toLowerCase();
    const reg = SETTINGS_REGISTRY[cmd];
    if (!reg) return res.status(404).json({ error: 'No settings editor for this command' });
    res.json({ title: reg.title, fields: reg.fields, values: await reg.get() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/sections/:slug/settings/:command', async (req, res) => {
  try {
    const cmd = (req.params.command || '').toLowerCase();
    const reg = SETTINGS_REGISTRY[cmd];
    if (!reg) return res.status(404).json({ error: 'No settings editor for this command' });
    const result = await reg.set(req.body || {});
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Support Tickets
app.get('/api/tickets', (req, res) => {
  res.json(Store.getTickets());
});

app.post('/api/tickets', (req, res) => {
  const { customer, phone, issue, priority } = req.body;
  if (!issue) return res.status(400).json({ error: 'Issue is required' });
  const created = Store.addTicket({ customer, phone, issue, priority });
  res.status(201).json(created);
});

app.put('/api/tickets/:id/status', (req, res) => {
  const updated = Store.updateTicketStatus(req.params.id, req.body.status);
  if (!updated) return res.status(404).json({ error: 'Ticket not found' });
  res.json(updated);
});

// Message Logs
app.get('/api/logs', (req, res) => {
  res.json(Store.getRecentLogs());
});

// Terminal logs: raw process log tails (bot / errors / tunnel)
const TERMINAL_LOGS = { bot: 'out.log', errors: 'err.log', tunnel: 'tunnel.log' };
function tailLogFile(name, n) {
  try {
    const p = path.join(__dirname, '..', '..', 'logs', name);
    const lines = fs.readFileSync(p, 'utf8').split('\n');
    return lines.slice(-n).join('\n');
  } catch (e) {
    return `(log unavailable: ${e.message})`;
  }
}
app.get('/api/terminal-logs', (req, res) => {
  // Incremental tail-follow: client passes ?offset=N (bytes already seen) and
  // gets only new bytes back. First call (no offset) returns the last ~30KB.
  const src = TERMINAL_LOGS[req.query.src] ? req.query.src : 'bot';
  try {
    const p = path.join(__dirname, '..', '..', 'logs', TERMINAL_LOGS[src]);
    const size = fs.statSync(p).size;
    let offset = parseInt(req.query.offset);
    if (isNaN(offset) || offset < 0) offset = Math.max(0, size - 30000);
    if (offset > size) offset = Math.max(0, size - 30000); // log truncated/rotated
    const len = Math.min(size - offset, 200000);
    let chunk = '';
    if (len > 0) {
      const fd = fs.openSync(p, 'r');
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, offset);
      fs.closeSync(fd);
      chunk = buf.toString('utf8');
      if (offset > 0) chunk = chunk.slice(chunk.indexOf('\n') + 1); // skip partial first line
    }
    res.json({ src, offset: offset + len, size, chunk });
  } catch (e) {
    res.json({ src, offset: 0, size: 0, chunk: `(log unavailable: ${e.message})` });
  }
});

// Send WhatsApp message
// Hudson's order (2026-10-13): number-link pairing — get an 8-digit code for a
// phone number instead of scanning QR. POST /api/pairing-code { phoneNumber }.
// The user types the code on their phone: WhatsApp > Linked Devices > Link a
// Device > "Link with phone number instead".
app.post('/api/pairing-code', async (req, res) => {
  const { phoneNumber } = req.body || {};
  if (!phoneNumber) {
    return res.status(400).json({ error: 'phoneNumber is required (e.g. 923001234567)' });
  }
  try {
    const code = await botInstance.requestPairingCode(phoneNumber);
    res.json({ success: true, pairingCode: code });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to get pairing code' });
  }
});

app.post('/api/send', async (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) {
    return res.status(400).json({ error: 'Phone number and message are required' });
  }

  // Format recipient jid
  let jid = to.trim();
  if (!jid.includes('@')) {
    // Remove +, spaces, hyphens
    const cleanNumber = jid.replace(/[^0-9]/g, '');
    jid = `${cleanNumber}@s.whatsapp.net`;
  }

  try {
    await botInstance.sendMessage(jid, message);
    res.json({ success: true, message: 'Message sent successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to send message' });
  }
});

// HOSTING PATCH (Muse, 2026-10-12): alias for the `botapi` new-feature command.
// POST /api/bot/send { to, text } — same as /api/send, alternate field name.
app.post('/api/bot/send', async (req, res) => {
  const to = req.body.to;
  const text = req.body.text ?? req.body.message;
  if (!to || !text) {
    return res.status(400).json({ error: 'Fields "to" and "text" are required' });
  }
  let jid = String(to).trim();
  if (!jid.includes('@')) {
    jid = `${jid.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
  }
  try {
    await botInstance.sendMessage(jid, String(text));
    res.json({ success: true, to: jid });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to send message' });
  }
});

// All Video Downloader Endpoints
app.post('/api/download', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Please provide a video URL.' });
  }
  try {
    const videoData = await downloadVideo(url);
    res.json({ success: true, ...videoData });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to download video.' });
  }
});

app.post('/api/send-video', async (req, res) => {
  const { to, url } = req.body;
  if (!to || !url) {
    return res.status(400).json({ error: 'Recipient phone number and video URL are required.' });
  }

  let jid = to.trim();
  if (!jid.includes('@')) {
    const cleanNumber = jid.replace(/[^0-9]/g, '');
    jid = `${cleanNumber}@s.whatsapp.net`;
  }

  try {
    const videoData = await downloadVideo(url);
    await botInstance.sendVideoFromUrl(jid, videoData);
    res.json({ success: true, message: `Video successfully sent to ${to}!`, video: videoData });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to download and send video.' });
  }
});

// Direct MP4 Attachment File Downloader (Direct to Disk as .mp4)
app.get('/api/download-file', async (req, res) => {
  const { url, title } = req.query;
  if (!url) return res.status(400).send('Video URL is required');

  try {
    const fetchRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'video/mp4,video/*,*/*;q=0.9',
        'Referer': url
      }
    });

    if (!fetchRes.ok) {
      return res.status(fetchRes.status).send('Failed to fetch remote MP4 stream.');
    }

    const safeTitle = (title || 'video')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 50) || 'video';

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.mp4"`);

    const { Readable } = await import('stream');
    Readable.fromWeb(fetchRes.body).pipe(res);
  } catch (err) {
    console.error('Direct MP4 download error:', err.message);
    if (!res.headersSent) res.status(500).send(err.message);
  }
});

// Direct MP4 Video Stream Proxy (Removes CORS / Hotlink restrictions for instant player display)
app.get('/api/video-proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('Video URL is required');

  try {
    const fetchRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'video/mp4,video/*,*/*;q=0.9',
        'Referer': url
      }
    });

    res.setHeader('Content-Type', fetchRes.headers.get('content-type') || 'video/mp4');
    const { Readable } = await import('stream');
    Readable.fromWeb(fetchRes.body).pipe(res);
  } catch (err) {
    if (!res.headersSent) res.status(500).send(err.message);
  }
});

// ─── Group Detail Page APIs (2026-10-14) ───
// Full group info for dedicated group pages: members, admins, settings,
// recent activity, active automations.
app.get('/api/groups/:id/detail', async (req, res) => {
  try {
    const groupId = req.params.id;
    const { getGroupSettings } = await import('./lib/access.js');
    const { readData } = await import('./lib/batch-helpers.js');

    // Group metadata from WhatsApp (with timeout guard — never hang the dashboard)
    let meta = null;
    try {
      if (botInstance.sock) {
        meta = await Promise.race([
          botInstance.sock.groupMetadata(groupId),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
        ]);
      }
    } catch (e) { /* group may not exist or WA disconnected */ }

    const settings = getGroupSettings(groupId);

    // Automations scoped to this group
    const auto = readData('batch4-auto.json', {});
    const groupAuto = auto[groupId] || {};
    const scheduled = (readData('scheduled-tasks.json', []) || [])
      .filter(t => (t.target || '').includes(groupId) || t.targetType === 'group');

    res.json({
      id: groupId,
      subject: meta?.subject || 'Unknown Group',
      creation: meta?.creation || null,
      owner: meta?.owner || null,
      totalMembers: (meta?.participants || []).length,
      admins: (meta?.participants || []).filter(p => p.admin).map(p => ({
        id: p.id, admin: p.admin,
      })),
      participants: (meta?.participants || []).slice(0, 100).map(p => ({
        id: p.id, admin: p.admin || null,
      })),
      settings,
      automations: {
        antilink: !!groupAuto.antilink,
        antispam: !!groupAuto.antispam,
        slowmode: groupAuto.slowmode || null,
        welcome: !!groupAuto.welcome,
        goodbye: !!groupAuto.goodbye,
        keywordAlerts: groupAuto.keyword || [],
        autoForward: groupAuto.fwd || null,
        recurring: groupAuto.rmsgs || [],
        birthdays: groupAuto.bday || [],
        scheduled: scheduled.map(t => ({ id: t.id, message: (t.message || '').slice(0, 60), schedule: t.schedule })),
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Group activity feed (from message logs)
app.get('/api/groups/:id/activity', (req, res) => {
  try {
    const groupId = req.params.id;
    const logs = Store.getRecentLogs() || [];
    const activity = logs.filter(l => {
      const to = l.to || l.chat || l.groupId || '';
      const from = l.from || '';
      return to === groupId || from === groupId || to.includes(groupId) || from.includes(groupId);
    }).slice(0, 50);
    res.json({ groupId, activity });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Monitor: live message feed across all groups ───
app.get('/api/monitor', (req, res) => {
  try {
    const logs = Store.getRecentLogs() || [];
    const { limit = 100, groupId } = req.query;
    let feed = logs;
    if (groupId) {
      feed = logs.filter(l => {
        const to = l.to || l.chat || l.groupId || '';
        const from = l.from || '';
        return to === groupId || from === groupId;
      });
    }
    res.json({ feed: feed.slice(0, parseInt(limit) || 100) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Monitoring Stats ───
app.get('/api/monitor/stats', async (req, res) => {
  try {
    const logs = Store.getRecentLogs() || [];
    const now = Date.now();
    const hour = now - 3600000, day = now - 86400000;

    const parseTime = (l) => { try { return new Date(l.timestamp || l.at || 0).getTime(); } catch { return 0; } };

    const lastHour = logs.filter(l => parseTime(l) >= hour);
    const lastDay = logs.filter(l => parseTime(l) >= day);

    // Most active groups/chats
    const byChat = {};
    for (const l of lastDay) {
      const chat = l.to || l.from || l.chat || 'unknown';
      byChat[chat] = (byChat[chat] || 0) + 1;
    }
    const topChats = Object.entries(byChat).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([chat, count]) => ({ chat, count }));

    // Most used commands (from command-stats.json)
    let cmdStats = {};
    try {
      const { readData } = await import('./lib/batch-helpers.js');
      cmdStats = readData('command-stats.json', {});
    } catch {}
    const topCommands = Object.entries(cmdStats).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([cmd, uses]) => ({ cmd, uses }));

    // Bot actions (deletes, warns, kicks, etc.)
    const botActions = lastDay.filter(l => l.type === 'bot-action' || (l.text || '').includes('[Bot Action]')).length;

    res.json({
      messagesLastHour: lastHour.length,
      messagesLastDay: lastDay.length,
      botActionsLastDay: botActions,
      topChats, topCommands,
      totalLogged: logs.length,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Automation Builder APIs ───
// List all automation-capable features with their config schemas
app.get('/api/automation/types', async (req, res) => {
  res.json({
    types: [
      {
        id: 'autoreply', title: 'Keyword Auto-Reply (ManyChat)',
        desc: 'Reply automatically when someone sends a keyword',
        fields: [
          { name: 'keyword', label: 'Keyword', type: 'text', required: true, placeholder: 'price' },
          { name: 'reply', label: 'Reply text', type: 'textarea', required: true, placeholder: 'Our prices start at...' },
          { name: 'scope', label: 'Scope', type: 'select', options: ['global', 'group', 'chat'], default: 'global' },
          { name: 'target', label: 'Target Group/Chat (if scoped)', type: 'group-select', required: false },
        ],
      },
      {
        id: 'scheduled', title: 'Scheduled Message',
        desc: 'Send a message at a specific time',
        fields: [
          { name: 'message', label: 'Message', type: 'textarea', required: true },
          { name: 'schedule', label: 'Schedule (cron or "10m", "2h", "9:00")', type: 'text', required: true, placeholder: '0 9 * * *' },
          { name: 'target', label: 'Target (number or group)', type: 'group-select', required: true },
        ],
      },
      {
        id: 'keyword', title: 'Keyword Alert',
        desc: 'Get notified when a keyword appears in chat',
        fields: [
          { name: 'keyword', label: 'Keyword', type: 'text', required: true },
          { name: 'scope', label: 'Scope', type: 'select', options: ['global', 'group'], default: 'global' },
          { name: 'target', label: 'Target Group (if scoped)', type: 'group-select', required: false },
        ],
      },
      {
        id: 'welcome', title: 'Welcome Message',
        desc: 'Greet new members joining a group',
        fields: [
          { name: 'target', label: 'Target Group', type: 'group-select', required: true },
          { name: 'message', label: 'Welcome message (use {name} for member)', type: 'textarea', required: true },
        ],
      },
      {
        id: 'goodbye', title: 'Goodbye Message',
        desc: 'Farewell when members leave a group',
        fields: [
          { name: 'target', label: 'Target Group', type: 'group-select', required: true },
          { name: 'message', label: 'Goodbye message', type: 'textarea', required: true },
        ],
      },
      {
        id: 'antilink', title: 'Anti-Link',
        desc: 'Auto-delete messages containing links',
        fields: [
          { name: 'target', label: 'Target Group', type: 'group-select', required: true },
          { name: 'action', label: 'Action', type: 'select', options: ['delete', 'delete+warn', 'delete+kick'], default: 'delete' },
        ],
      },
      {
        id: 'antispam', title: 'Anti-Spam',
        desc: 'Detect and act on spam messages',
        fields: [
          { name: 'target', label: 'Target Group', type: 'group-select', required: true },
          { name: 'maxMessages', label: 'Max messages per minute', type: 'number', default: 5 },
        ],
      },
      {
        id: 'slowmode', title: 'Slow Mode',
        desc: 'Limit how often members can send messages',
        fields: [
          { name: 'target', label: 'Target Group', type: 'group-select', required: true },
          { name: 'seconds', label: 'Seconds between messages', type: 'number', required: true, default: 30 },
        ],
      },
      {
        id: 'recurring', title: 'Recurring Message',
        desc: 'Repeat a message on an interval',
        fields: [
          { name: 'target', label: 'Target Group/Chat', type: 'group-select', required: true },
          { name: 'message', label: 'Message', type: 'textarea', required: true },
          { name: 'interval', label: 'Interval (e.g. "1h", "30m", "1d")', type: 'text', required: true },
        ],
      },
      {
        id: 'birthday', title: 'Birthday Reminder',
        desc: 'Remind about member birthdays',
        fields: [
          { name: 'target', label: 'Target Group', type: 'group-select', required: true },
          { name: 'name', label: 'Person name', type: 'text', required: true },
          { name: 'date', label: 'Date (MM-DD)', type: 'text', required: true, placeholder: '12-25' },
        ],
      },
      {
        id: 'rss', title: 'RSS Watch',
        desc: 'Post new items from an RSS feed to a group',
        fields: [
          { name: 'target', label: 'Target Group', type: 'group-select', required: true },
          { name: 'url', label: 'RSS feed URL', type: 'text', required: true },
        ],
      },
      {
        id: 'autoforward', title: 'Auto-Forward',
        desc: 'Forward messages from one chat to another',
        fields: [
          { name: 'from', label: 'Source chat JID', type: 'text', required: true },
          { name: 'to', label: 'Destination chat JID', type: 'text', required: true },
        ],
      },
      {
        id: 'autostatus', title: 'Auto Status Post',
        desc: 'Automatically post status updates on a schedule',
        fields: [
          { name: 'message', label: 'Status text', type: 'textarea', required: true },
          { name: 'media', label: 'Media URL (optional)', type: 'text', required: false },
          { name: 'schedule', label: 'Schedule (cron or "9:00", "daily")', type: 'text', required: true, placeholder: '0 9 * * *' },
        ],
      },
      {
        id: 'autopost', title: 'Auto Post to Groups',
        desc: 'Automatically post a message to multiple groups on schedule',
        fields: [
          { name: 'message', label: 'Message', type: 'textarea', required: true },
          { name: 'targets', label: 'Target Groups (comma-separated)', type: 'group-select-multi', required: true },
          { name: 'schedule', label: 'Schedule (cron or "9:00")', type: 'text', required: true, placeholder: '0 9 * * *' },
          { name: 'silent', label: 'Silent (no command shown in chat)', type: 'select', options: ['yes', 'no'], default: 'yes' },
        ],
      },
      {
        id: 'bulkmessage', title: 'Bulk Message to Contacts',
        desc: 'Send a message to multiple contacts (choose how many)',
        fields: [
          { name: 'message', label: 'Message', type: 'textarea', required: true },
          { name: 'contacts', label: 'Contacts (comma-separated numbers)', type: 'textarea', required: true, placeholder: '923001234567, 923007654321' },
          { name: 'delay', label: 'Delay between sends (seconds)', type: 'number', default: 5 },
          { name: 'silent', label: 'Silent mode', type: 'select', options: ['yes', 'no'], default: 'yes' },
        ],
      },
    ],
  });
});

// ─── Automation Templates (2026-10-17 per Hudson) ───
// Pre-built templates the user can select, edit, and deploy
app.get('/api/automation/templates', async (req, res) => {
  res.json({
    templates: [
      {
        id: 'tpl-morning-status', name: 'Morning Status Update',
        desc: 'Post a good-morning status every day at 8 AM',
        type: 'autostatus',
        defaults: { message: '🌅 Good morning! Have a blessed day! 🤲', schedule: '0 8 * * *' },
      },
      {
        id: 'tpl-group-reminder', name: 'Daily Group Reminder',
        desc: 'Send a daily reminder to your group at 9 AM',
        type: 'autopost',
        defaults: { message: '📢 Daily reminder: ...', schedule: '0 9 * * *', silent: 'yes' },
      },
      {
        id: 'tpl-welcome-new', name: 'Welcome New Members',
        desc: 'Auto-welcome when someone joins',
        type: 'welcome',
        defaults: { message: 'Welcome {name}! 🎉 Glad to have you here.' },
      },
      {
        id: 'tpl-keyword-reply', name: 'Price Inquiry Auto-Reply',
        desc: 'Reply automatically when someone asks about price',
        type: 'autoreply',
        defaults: { keyword: 'price', reply: 'Our prices start at... Contact us for details!', scope: 'global' },
      },
      {
        id: 'tpl-bulk-announce', name: 'Bulk Announcement',
        desc: 'Send an announcement to multiple contacts',
        type: 'bulkmessage',
        defaults: { message: '📢 Important announcement: ...', delay: 5, silent: 'yes' },
      },
    ],
  });
});

// Create a new automation
app.post('/api/automation/create', async (req, res) => {
  try {
    const { readData, writeData } = await import('./lib/batch-helpers.js');
    const { type, ...params } = req.body || {};
    if (!type) return res.status(400).json({ error: 'type is required' });

    const id = 'auto-' + Date.now().toString(36);

    if (type === 'autoreply') {
      // ManyChat-style: batch8-autoreply.json keyed by chat
      const scope = params.scope || 'global';
      const key = scope === 'global' ? '__global__' : (params.target || '__global__');
      const data = readData('batch8-autoreply.json', {});
      if (!data[key]) data[key] = [];
      data[key].push({ keyword: params.keyword, reply: params.reply, id, enabled: true });
      writeData('batch8-autoreply.json', data);
    } else if (type === 'scheduled') {
      const list = readData('scheduled-tasks.json', []);
      list.push({ id, message: params.message, schedule: params.schedule, target: params.target, enabled: true, createdAt: new Date().toISOString() });
      writeData('scheduled-tasks.json', list);
    } else if (type === 'keyword' || type === 'welcome' || type === 'goodbye' ||
               type === 'antilink' || type === 'antispam' || type === 'slowmode' ||
               type === 'recurring' || type === 'birthday' || type === 'rss' ||
               type === 'autoforward') {
      // batch4-auto.json keyed by chat JID
      const data = readData('batch4-auto.json', {});
      const chatKey = params.target || params.from || '__global__';
      if (!data[chatKey]) data[chatKey] = {};
      const g = data[chatKey];
      switch (type) {
        case 'keyword':
          if (!Array.isArray(g.keyword)) g.keyword = [];
          g.keyword.push(params.keyword); break;
        case 'welcome': g.welcome = params.message; break;
        case 'goodbye': g.goodbye = params.message; break;
        case 'antilink': g.antilink = { action: params.action || 'delete' }; break;
        case 'antispam': g.antispam = { maxMessages: parseInt(params.maxMessages) || 5 }; break;
        case 'slowmode': g.slowmode = { seconds: parseInt(params.seconds) || 30 }; break;
        case 'recurring':
          if (!Array.isArray(g.rmsgs)) g.rmsgs = [];
          g.rmsgs.push({ id, message: params.message, interval: params.interval, enabled: true }); break;
        case 'birthday':
          if (!Array.isArray(g.bday)) g.bday = [];
          g.bday.push({ id, name: params.name, date: params.date }); break;
        case 'rss':
          if (!Array.isArray(g.rss)) g.rss = [];
          g.rss.push({ id, url: params.url, enabled: true }); break;
        case 'autoforward':
          g.fwd = { from: params.from, to: params.to, enabled: true }; break;
      }
      writeData('batch4-auto.json', data);
    } else {
      return res.status(400).json({ error: 'Unknown automation type: ' + type });
    }

    res.status(201).json({ ok: true, id, type });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete an automation
app.delete('/api/automation/:type/:id', async (req, res) => {
  try {
    const { readData, writeData } = await import('./lib/batch-helpers.js');
    const { type, id } = req.params;
    let found = false;

    if (type === 'autoreply') {
      const data = readData('batch8-autoreply.json', {});
      for (const key of Object.keys(data)) {
        const before = (data[key] || []).length;
        data[key] = (data[key] || []).filter(r => String(r.id) !== String(id) && r.keyword !== id);
        if (data[key].length < before) found = true;
      }
      writeData('batch8-autoreply.json', data);
    } else if (type === 'scheduled') {
      const list = readData('scheduled-tasks.json', []);
      const filtered = list.filter(t => String(t.id) !== String(id));
      if (filtered.length < list.length) { found = true; writeData('scheduled-tasks.json', filtered); }
    } else {
      const data = readData('batch4-auto.json', {});
      for (const key of Object.keys(data)) {
        const g = data[key];
        let changed = false;
        for (const arrKey of ['rmsgs', 'bday', 'rss']) {
          if (Array.isArray(g[arrKey])) {
            const before = g[arrKey].length;
            g[arrKey] = g[arrKey].filter(x => String(x.id) !== String(id));
            if (g[arrKey].length < before) { changed = true; found = true; }
          }
        }
        if (Array.isArray(g.keyword)) {
          const before = g.keyword.length;
          g.keyword = g.keyword.filter(k => k !== id && String(k) !== String(id));
          if (g.keyword.length < before) { changed = true; found = true; }
        }
        if (changed) { /* will save below */ }
      }
      writeData('batch4-auto.json', data);
    }

    if (!found) return res.status(404).json({ error: 'Automation not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Silent Command Execution (2026-10-17 per Hudson) ───
// Execute a bot command from the dashboard WITHOUT any output appearing
// in WhatsApp chat. The command runs in the background; output returns
// to the dashboard only. Use for: tagall, status post, group management, etc.
app.post('/api/command/exec', async (req, res) => {
  try {
    const { command, target, sender } = req.body || {};
    if (!command || !target) {
      return res.status(400).json({ error: 'command and target required' });
    }
    const bot = getBot();
    if (!bot) return res.status(503).json({ error: 'Bot not initialized' });
    // Sender defaults to owner for dashboard commands
    const { getOwnerConfig } = await import('./lib/access.js');
    const cfg = getOwnerConfig();
    const senderJid = sender || (cfg.owner ? cfg.owner + '@s.whatsapp.net' : 'dashboard@silent');
    const result = await bot.executeSilent(command, target, senderJid);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Command Browser: all 605 menu commands ───
// Scope inference: which commands work where (2026-10-14)
const GROUP_CATEGORY_TITLES = ['group tools', 'group control', 'group admin'];
const OWNER_COMMANDS = new Set(['restart', 'shutdown', 'eval', 'exec', 'bcast', 'broadcast', 'setowner', 'pair', 'qrcode', 'code', 'getcode', 'msgcode', 'try', 're', 'repo']);
function inferCommandScope(cmdName, categoryTitle) {
  const n = (cmdName || '').toLowerCase();
  const t = (categoryTitle || '').toLowerCase();
  if (OWNER_COMMANDS.has(n)) return 'owner';
  if (GROUP_CATEGORY_TITLES.some(g => t.includes(g))) return 'group';
  return 'both';
}

app.get('/api/commands/all', async (req, res) => {
  try {
    const { MENU_CATEGORIES } = await import('./lib/menu-data.js');
    const { category = '', q = '' } = req.query;
    let cats = MENU_CATEGORIES.map(c => ({
      num: c.num, icon: c.icon, title: c.title,
      cmds: (c.cmds || []).map(cmd => ({
        name: cmd.name,
        desc: cmd.desc || '',
        usage: cmd.usage || ('!' + cmd.name),
        primary: !!cmd.primary,
        scope: inferCommandScope(cmd.name, c.title),
      })),
    }));
    if (category) {
      cats = cats.filter(c => String(c.num) === String(category) || c.title.toLowerCase().includes(category.toLowerCase()));
    }
    if (q) {
      const needle = q.toLowerCase();
      cats = cats.map(c => ({
        ...c,
        cmds: c.cmds.filter(cmd =>
          cmd.name.toLowerCase().includes(needle) ||
          (cmd.desc || '').toLowerCase().includes(needle)),
      })).filter(c => c.cmds.length > 0);
    }
    const total = cats.reduce((n, c) => n + c.cmds.length, 0);
    res.json({ total, categories: cats });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Group quick actions ───
app.post('/api/groups/:id/quick-action', async (req, res) => {
  try {
    const groupId = req.params.id;
    const { action, text, options } = req.body || {};
    if (!action) return res.status(400).json({ error: 'action is required' });

    if (action === 'send') {
      if (!text) return res.status(400).json({ error: 'text is required' });
      await botInstance.sendMessage(groupId, text);
      res.json({ ok: true, action: 'send' });
    } else if (action === 'status') {
      if (!text) return res.status(400).json({ error: 'text is required' });
      await botInstance.postGroupStatus(groupId, text, options || {});
      res.json({ ok: true, action: 'status' });
    } else if (action === 'poll') {
      const { question, choices } = req.body;
      if (!question || !Array.isArray(choices) || !choices.length) {
        return res.status(400).json({ error: 'question and choices[] are required' });
      }
      await botInstance.sock.sendMessage(groupId, {
        poll: { name: question, values: choices, selectableCount: 1 },
      });
      res.json({ ok: true, action: 'poll' });
    } else if (action === 'mute' || action === 'unmute') {
      await botInstance.setGroupMute(groupId, action === 'mute');
      res.json({ ok: true, action });
    } else if (action === 'tagall') {
      const meta = await botInstance.sock.groupMetadata(groupId);
      const participants = (meta.participants || []).map(p => p.id);
      const mentions = participants.map(jid => '@' + jid.split('@')[0]).join(' ');
      await botInstance.sock.sendMessage(groupId, { text: `📢 *Tag All*\n\n${mentions}`, mentions: participants });
      res.json({ ok: true, action });
    } else if (action === 'invite') {
      const code = await botInstance.sock.groupInviteCode(groupId);
      res.json({ ok: true, action, inviteLink: `https://chat.whatsapp.com/${code}` });
    } else if (action === 'setname') {
      if (!text) return res.status(400).json({ error: 'text (new name) is required' });
      await botInstance.sock.groupUpdateSubject(groupId, text);
      res.json({ ok: true, action });
    } else if (action === 'setdesc') {
      if (!text) return res.status(400).json({ error: 'text (new description) is required' });
      await botInstance.sock.groupUpdateDescription(groupId, text);
      res.json({ ok: true, action });
    } else if (action === 'pin') {
      // Pin: needs a message to pin — for now, send and pin a message
      if (!text) return res.status(400).json({ error: 'text is required' });
      const sent = await botInstance.sock.sendMessage(groupId, { text: `📌 *Pinned:*\n${text}` });
      // Note: Baileys pin requires message key; we store it for reference
      res.json({ ok: true, action, messageId: sent.key?.id });
    } else if (action === 'promote' || action === 'demote' || action === 'remove') {
      const { userJid } = req.body;
      if (!userJid) return res.status(400).json({ error: 'userJid is required' });
      await botInstance.sock.groupParticipantsUpdate(groupId, [userJid], action);
      res.json({ ok: true, action, user: userJid });
    } else {
      res.status(400).json({ error: 'Unknown action. Use: send, status, poll, mute, unmute, tagall, invite, setname, setdesc, pin, promote, demote, remove' });
    }
  } catch (e) {
    let msg = e.message || 'Action failed';
    if (/bad-request/i.test(msg)) msg = 'WhatsApp rejected this — the bot probably needs to be a group admin for this action.';
    else if (/not-authorized|forbidden/i.test(msg)) msg = 'Not authorized — the bot needs admin rights in this group.';
    else if (/not connected/i.test(msg)) msg = 'Bot is not connected to WhatsApp.';
    res.status(500).json({ error: msg });
  }
});

// Session Actions
app.post('/api/restart', async (req, res) => {
  await botInstance.restart();
  res.json({ success: true, message: 'Bot restart initiated' });
});

app.post('/api/logout', async (req, res) => {
  await botInstance.logout();
  res.json({ success: true, message: 'Logged out. New QR code being generated.' });
});

// Start Server and Bot
server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 WhatsApp SuperBot Dashboard: http://localhost:${PORT}`);
  console.log(`==================================================\n`);
  
  // Launch Bot
  botInstance.init();
});

process.on('uncaughtException', (err) => {
  console.error('Unhandled process exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled process rejection:', reason);
});

