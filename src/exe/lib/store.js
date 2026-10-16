import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(filename, defaultValue) {
  const filePath = path.join(DATA_DIR, filename);
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf-8');
      return defaultValue;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${filename}:`, err.message);
    return defaultValue;
  }
}

function writeJson(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`Error writing ${filename}:`, err.message);
    return false;
  }
}

export const Store = {
  // Config
  getConfig() {
    return readJson('config.json', {
      botName: 'AwaisxBot',
      prefix: '!',
      adminPhone: '',
      ai: {
        enabled: true,
        provider: 'gemini',
        apiKey: '',
        model: 'gemini-3.6-flash',
        systemPrompt: 'Aap AwaisxBot hain — ek bohot pyare, friendly aur mazahiya dost jo WhatsApp pe baat karta hai. Zyadatar Roman Urdu mein baat karein (agar user English bole to English mein). Baat cheet aam, natural, dilchasp aur mazahiya honi chahiye jaise ek Desi dost baat karta hai. Har qisam ke rozmarra ke topics (dosti, parhai, zindagi, khana peena, funny baatein aur latifay) pe baat karein — sirf programming ya tech tak mehdood na rahein. Kabhi robotic mat banein, choti aur asaan baatein karein.',
        autoReplyAllMessages: false
      },
      features: {
        autoResponder: true,
        supportTickets: true,
        groupPosting: false,
        groupWelcome: false,
        groupAdmin: false,
        groupStatus: false
      }
    });
  },
  updateConfig(newConfig) {
    const current = this.getConfig();
    const merged = { ...current, ...newConfig };
    writeJson('config.json', merged);
    return merged;
  },

  // Group Access Control (Strict Whitelist by Selection)
  getGroupSettings() {
    const config = this.getConfig();
    return config.groupSettings || {
      mode: 'whitelist', // 'whitelist' (only selected) | 'all' (all groups) | 'disabled' (no groups)
      allowedGroups: [] // Array of group JIDs string[]
    };
  },
  getAllowedGroups() {
    const settings = this.getGroupSettings();
    return Array.isArray(settings.allowedGroups) ? settings.allowedGroups : [];
  },
  isGroupAllowed(groupId) {
    if (!groupId) return false;
    const settings = this.getGroupSettings();
    const mode = settings.mode || 'whitelist';
    if (mode === 'disabled') return false;
    if (mode === 'all') return true;
    const allowed = Array.isArray(settings.allowedGroups) ? settings.allowedGroups : [];
    return allowed.includes(groupId);
  },
  setGroupMode(mode) {
    const config = this.getConfig();
    const current = config.groupSettings || { mode: 'whitelist', allowedGroups: [] };
    config.groupSettings = { ...current, mode };
    this.updateConfig(config);
    return config.groupSettings;
  },
  setAllowedGroups(allowedGroups) {
    const config = this.getConfig();
    const current = config.groupSettings || { mode: 'whitelist', allowedGroups: [] };
    config.groupSettings = { ...current, allowedGroups: Array.isArray(allowedGroups) ? allowedGroups : [] };
    this.updateConfig(config);
    return config.groupSettings;
  },
  toggleGroupAllowed(groupId, enable) {
    const config = this.getConfig();
    const current = config.groupSettings || { mode: 'whitelist', allowedGroups: [] };
    let list = Array.isArray(current.allowedGroups) ? [...current.allowedGroups] : [];
    const exists = list.includes(groupId);

    if (enable === true || (enable === undefined && !exists)) {
      if (!exists) list.push(groupId);
    } else {
      list = list.filter(id => id !== groupId);
    }

    config.groupSettings = { ...current, allowedGroups: list };
    this.updateConfig(config);
    return {
      groupId,
      isAllowed: list.includes(groupId),
      allowedGroups: list
    };
  },

  // Auto Replies
  getAutoReplies() {
    return readJson('autoReplies.json', []);
  },
  addAutoReply(reply) {
    const list = this.getAutoReplies();
    const item = {
      id: 'reply-' + Date.now(),
      trigger: reply.trigger.trim().toLowerCase(),
      matchType: reply.matchType || 'contains',
      reply: reply.reply,
      enabled: reply.enabled !== false
    };
    list.push(item);
    writeJson('autoReplies.json', list);
    return item;
  },
  updateAutoReply(id, updated) {
    const list = this.getAutoReplies();
    const idx = list.findIndex(r => r.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updated };
      writeJson('autoReplies.json', list);
      return list[idx];
    }
    return null;
  },
  deleteAutoReply(id) {
    let list = this.getAutoReplies();
    list = list.filter(r => r.id !== id);
    writeJson('autoReplies.json', list);
    return true;
  },

  // Support Tickets
  getTickets() {
    return readJson('tickets.json', []);
  },
  addTicket(ticket) {
    const list = this.getTickets();
    const newTicket = {
      id: 'TICK-' + Math.floor(100 + Math.random() * 900),
      customer: ticket.customer || 'WhatsApp User',
      phone: ticket.phone || 'Unknown',
      issue: ticket.issue,
      status: 'OPEN',
      priority: ticket.priority || 'MEDIUM',
      date: new Date().toISOString()
    };
    list.unshift(newTicket);
    writeJson('tickets.json', list);
    return newTicket;
  },
  updateTicketStatus(id, status) {
    const list = this.getTickets();
    const item = list.find(t => t.id.toLowerCase() === id.toLowerCase());
    if (item) {
      item.status = status;
      writeJson('tickets.json', list);
      return item;
    }
    return null;
  },

  // 24-Hour Group Statuses (Disappear after 24 hours)
  getStatuses() {
    const list = readJson('statuses.json', []);
    const now = Date.now();
    // Filter out expired statuses
    const active = list.filter(s => s.expiresAt > now);
    if (active.length !== list.length) {
      writeJson('statuses.json', active);
    }
    return active;
  },
  getGroupStatus(groupId) {
    const active = this.getStatuses();
    return active.find(s => s.groupId === groupId) || null;
  },
  setGroupStatus({ groupId, groupName, text, author, authorName, isBroadcast = false }) {
    let list = this.getStatuses();
    // Remove previous status for this target
    list = list.filter(s => s.groupId !== groupId);

    const now = Date.now();
    const duration = 24 * 60 * 60 * 1000; // 24 hours
    const newStatus = {
      id: 'stat-' + Date.now(),
      groupId: groupId || 'status@broadcast',
      groupName: groupName || (isBroadcast ? 'WhatsApp Story Broadcast' : 'Group Chat'),
      text: text.trim(),
      author: author || 'Admin',
      authorName: authorName || 'Admin',
      isBroadcast: !!isBroadcast,
      createdAt: now,
      expiresAt: now + duration
    };

    list.unshift(newStatus);
    writeJson('statuses.json', list);
    return newStatus;
  },
  deleteStatus(id) {
    let list = this.getStatuses();
    const beforeLen = list.length;
    list = list.filter(s => s.id !== id && s.groupId !== id);
    writeJson('statuses.json', list);
    return list.length < beforeLen;
  },

  // Message Logs (in-memory with maximum capacity)
  _recentLogs: [],
  addLog(entry) {
    this._recentLogs.unshift({
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      ...entry
    });
    if (this._recentLogs.length > 200) {
      this._recentLogs.pop();
    }
  },
  getRecentLogs() {
    return this._recentLogs;
  },

  // User Profiles (2026-10-13: onboarding + personalization)
  // Each user gets a profile: name, what they do, preferences, onboarding state
  getUserProfile(userId) {
    const profiles = readJson('user-profiles.json', {});
    return profiles[userId] || null;
  },
  saveUserProfile(userId, profile) {
    const profiles = readJson('user-profiles.json', {});
    profiles[userId] = { ...(profiles[userId] || {}), ...profile, updatedAt: new Date().toISOString() };
    writeJson('user-profiles.json', profiles);
    return profiles[userId];
  },
  isOnboarded(userId) {
    const p = this.getUserProfile(userId);
    return !!(p && p.onboarded);
  },
};
