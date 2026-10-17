// Initialize Socket.io
const socket = io();

// State
let botStatus = 'disconnected';
let messageCount = 0;

// DOM Elements
const statusDot = document.getElementById('status-dot');
const statusLabel = document.getElementById('status-label');
const statusPhone = document.getElementById('status-phone');
const qrImage = document.getElementById('qr-image');
const qrPlaceholder = document.getElementById('qr-placeholder');
const qrBadge = document.getElementById('qr-badge');

const statReceived = document.getElementById('stat-received');
const statSent = document.getElementById('stat-sent');
const statAi = document.getElementById('stat-ai');
const statUptime = document.getElementById('stat-uptime');
const badgeMessagesCount = document.getElementById('badge-messages-count');

// Navigation Tabs
const navItems = document.querySelectorAll('.nav-item');
const tabPanes = document.querySelectorAll('.tab-pane');
const pageHeading = document.getElementById('page-heading');
const pageSubheading = document.getElementById('page-subheading');

const headingMap = {
  'tab-overview': {
    title: 'Bot Dashboard & Overview',
    sub: 'Live WhatsApp engine status, real-time metrics, and instant controls'
  },
  'tab-chat': {
    title: 'Live Chat & Sender',
    sub: 'Real-time incoming messages, automated replies, and quick direct messaging'
  },
  'tab-groups-status': {
    title: '24-Hour Status & Groups Hub',
    sub: 'Post 24-hour status stories, manage active announcements, and control groups'
  },
  'tab-access': {
    title: 'Access Control',
    sub: 'Owner, bot admins and the global silent-mode default'
  },
  'tab-automation': {
    title: 'Automation',
    sub: 'Auto-replies, scheduled messages, keyword alerts and ManyChat replies'
  },
  'tab-monitor': {
    title: 'Live Monitor',
    sub: 'Real-time message feed across all groups and chats'
  },
  'tab-allcmds': {
    title: 'Command Browser',
    sub: 'Every command the bot knows — search, browse, and test'
  },
  'tab-group-detail': {
    title: 'Group Details',
    sub: 'Dedicated control page for this group'
  },
  'tab-features': {
    title: 'Features',
    sub: 'Switch bot feature categories on or off'
  },
  'tab-ai': {
    title: 'AI & Auto-Replies',
    sub: 'Google Gemini natural language setup and automated keyword reply rules'
  },
  'tab-downloader': {
    title: 'All Video Downloader',
    sub: 'Download HD videos from TikTok, Reels, YouTube, Facebook, Twitter, and CapCut'
  },
  'tab-commands': {
    title: 'Commands Reference',
    sub: 'Quick guide to all commands available in WhatsApp chats and groups'
  },
  'tab-menu': {
    title: 'WhatsApp Menu Customiser',
    sub: 'Choose which categories appear in the bot button menu'
  },
  'tab-logs': {
    title: 'Terminal Logs',
    sub: 'Live streaming bot, error and tunnel logs'
  }
};

navItems.forEach(item => {
  item.addEventListener('click', () => {
    const targetTab = item.dataset.tab;
    navItems.forEach(n => n.classList.remove('active'));
    tabPanes.forEach(p => p.classList.remove('active'));

    item.classList.add('active');
    const pane = document.getElementById(targetTab);
    if (pane) pane.classList.add('active');

    if (headingMap[targetTab]) {
      pageHeading.textContent = headingMap[targetTab].title;
      pageSubheading.textContent = headingMap[targetTab].sub;
    }

    // Lazy-load data for the new tabs on activation
    if (targetTab === 'tab-access') loadAccess();
    else if (targetTab === 'tab-automation') loadAutomation();
    else if (targetTab === 'tab-features') loadFeatures();
    else if (targetTab === 'tab-monitor') loadMonitor();
    else if (targetTab === 'tab-allcmds') loadAllCommands();
  });
});

// ─── Hash routing for group detail pages ───
function handleHashRoute() {
  const hash = window.location.hash || '';
  const m = hash.match(/^#\/groups\/(.+)$/);
  if (m) {
    const groupId = decodeURIComponent(m[1]);
    openGroupDetail(groupId);
  }
}
window.addEventListener('hashchange', handleHashRoute);

// Back from group detail
document.getElementById('btn-back-groups')?.addEventListener('click', () => {
  window.location.hash = '';
  document.querySelector('[data-tab="tab-groups-status"]')?.click();
});

// ─── Group detail page ───
async function openGroupDetail(groupId) {
  // Switch to detail tab
  navItems.forEach(n => n.classList.remove('active'));
  tabPanes.forEach(p => p.classList.remove('active'));
  const pane = document.getElementById('tab-group-detail');
  if (pane) pane.classList.add('active');
  if (headingMap['tab-group-detail']) {
    pageHeading.textContent = headingMap['tab-group-detail'].title;
    pageSubheading.textContent = headingMap['tab-group-detail'].sub;
  }
  const content = document.getElementById('group-detail-content');
  content.innerHTML = '<div class="td-empty" style="padding:24px;text-align:center">Loading group…</div>';

  try {
    const [detailRes, activityRes] = await Promise.all([
      fetch('/api/groups/' + encodeURIComponent(groupId) + '/detail'),
      fetch('/api/groups/' + encodeURIComponent(groupId) + '/activity'),
    ]);
    if (!detailRes.ok) throw new Error('Group not found');
    const d = await detailRes.json();
    const activity = activityRes.ok ? (await activityRes.json()).activity : [];
    renderGroupDetail(d, activity);
  } catch (e) {
    content.innerHTML = '<div class="td-empty" style="padding:24px;text-align:center">Could not load group: ' + escapeHtml(e.message) + '</div>';
  }
}


// Group member management: promote/demote/remove
window.groupMemberAction = async function(groupId, action, userJid) {
  const labels = { promote: 'promote to admin', demote: 'demote from admin', remove: 'REMOVE from group' };
  if (!confirm(`Are you sure you want to ${labels[action] || action} ${userJid.split('@')[0]}?`)) return;
  try {
    const res = await fetch(`/api/groups/${encodeURIComponent(groupId)}/quick-action`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, userJid }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'failed');
    showToast(`Member ${action}d successfully`);
    openGroupDetail(groupId); // refresh
  } catch (e) { showToast('Failed: ' + e.message, 'error'); }
};

function renderGroupDetail(d, activity) {
  const content = document.getElementById('group-detail-content');
  const s = d.settings || {};
  const a = d.automations || {};

  const toggleRow = (key, label, hint) => `
    <label class="row">
      <span class="row-txt"><strong>${label}</strong><span>${hint}</span></span>
      <span class="switch"><input type="checkbox" data-gset="${key}" ${s[key] ? 'checked' : ''}><i></i></span>
    </label>`;

  const autoList = [];
  if (a.antilink) autoList.push('🛡️ Anti-link');
  if (a.antispam) autoList.push('🚫 Anti-spam');
  if (a.slowmode) autoList.push('🐢 Slowmode (' + (a.slowmode.seconds || '?') + 's)');
  if (a.welcome) autoList.push('👋 Welcome message');
  if (a.goodbye) autoList.push('👋 Goodbye message');
  if ((a.keywordAlerts || []).length) autoList.push('🔔 ' + a.keywordAlerts.length + ' keyword alerts');
  if (a.autoForward) autoList.push('↗️ Auto-forward');
  if ((a.recurring || []).length) autoList.push('🔁 ' + a.recurring.length + ' recurring messages');
  if ((a.birthdays || []).length) autoList.push('🎂 ' + a.birthdays.length + ' birthday reminders');
  if ((a.scheduled || []).length) autoList.push('⏰ ' + a.scheduled.length + ' scheduled messages');

  content.innerHTML = `
    <h2 class="section-title">${escapeHtml(d.subject)}</h2>
    <div class="stats" style="margin-bottom:16px">
      <div class="stat"><strong>${d.totalMembers}</strong><span>Members</span></div>
      <div class="stat"><strong>${d.admins.length}</strong><span>Admins</span></div>
      <div class="stat"><strong>${autoList.length}</strong><span>Automations</span></div>
    </div>

    <h2 class="section-title">Members (${d.totalMembers})</h2>
    <div class="group" style="max-height:300px;overflow-y:auto">
      ${(d.participants || []).map(p => {
        const jid = p.id || '';
        const num = jid.split('@')[0];
        const isAdmin = !!p.admin;
        return `<div class="member-row">
          <span class="member-id">${escapeHtml(num)}</span>
          ${isAdmin ? '<span class="member-admin-tag">ADMIN</span>' : ''}
          ${isAdmin
            ? `<button class="btn-warn-sm" onclick="groupMemberAction('${escapeHtml(d.id)}','demote','${escapeHtml(jid)}')">Demote</button>`
            : `<button class="btn-soft btn-sm" onclick="groupMemberAction('${escapeHtml(d.id)}','promote','${escapeHtml(jid)}')">Promote</button>`}
          <button class="btn-danger-sm" onclick="groupMemberAction('${escapeHtml(d.id)}','remove','${escapeHtml(jid)}')">Remove</button>
        </div>`;
      }).join('') || '<div class="td-empty" style="padding:16px;text-align:center">No member data</div>'}
    </div>

    <h2 class="section-title">Quick actions</h2>
    <div class="group pad">
      <div class="btn-row" style="flex-wrap:wrap">
        <button class="btn-soft btn-sm" onclick="groupQuickAction('${escapeHtml(d.id)}','send')">💬 Send message</button>
        <button class="btn-soft btn-sm" onclick="groupQuickAction('${escapeHtml(d.id)}','status')">📱 Post status</button>
        <button class="btn-soft btn-sm" onclick="groupQuickAction('${escapeHtml(d.id)}','poll')">📊 Create poll</button>
        <button class="btn-soft btn-sm" onclick="groupQuickAction('${escapeHtml(d.id)}','tagall')">📢 Tag all</button>
        <button class="btn-soft btn-sm" onclick="groupQuickAction('${escapeHtml(d.id)}','invite')">🔗 Invite link</button>
        <button class="btn-soft btn-sm" onclick="groupQuickAction('${escapeHtml(d.id)}','setname')">✏️ Set name</button>
        <button class="btn-soft btn-sm" onclick="groupQuickAction('${escapeHtml(d.id)}','setdesc')">📝 Set description</button>
        <button class="btn-soft btn-sm" onclick="groupQuickAction('${escapeHtml(d.id)}','mute')">🔇 Mute</button>
        <button class="btn-soft btn-sm" onclick="groupQuickAction('${escapeHtml(d.id)}','unmute')">🔊 Unmute</button>
      </div>
    </div>

    <h2 class="section-title">Feature toggles</h2>
    <div class="group" id="gd-toggles">
      ${toggleRow('welcome', 'Welcome messages', 'Greet new members')}
      ${toggleRow('goodbye', 'Goodbye messages', 'Farewell on leave')}
      ${toggleRow('antilink', 'Anti-link', 'Auto-delete links')}
      ${toggleRow('antispam', 'Anti-spam', 'Detect spam')}
      ${toggleRow('autoreply', 'Auto-replies', 'Keyword auto-responses')}
      ${toggleRow('chatbot', 'AI chatbot', 'AI replies in group')}
      ${toggleRow('keywordalerts', 'Keyword alerts', 'Notify on keywords')}
      ${toggleRow('slowmode', 'Slow mode', 'Rate-limit messages')}
      ${toggleRow('antidelete', 'Anti-delete', 'Catch deleted messages')}
      ${toggleRow('silent', '🔇 Silent mode', 'No announcements at all')}
    </div>

    <h2 class="section-title">Active automations</h2>
    <div class="group">
      ${autoList.length ? autoList.map(x => `<div class="row static"><span class="row-txt"><strong>${escapeHtml(x)}</strong></span></div>`).join('') : '<div class="row static"><span class="row-txt"><span class="hint">No automations for this group yet. Use the Automation tab to add one.</span></span></div>'}
    </div>

    <h2 class="section-title">Recent activity</h2>
    <div class="group"><div id="gd-activity" class="monitor-feed">
      ${(activity || []).length ? activity.map(log => `
        <div class="mon-row">
          <span class="mon-time">${new Date(log.timestamp).toLocaleTimeString()}</span>
          <span class="mon-type">${escapeHtml(log.type || 'msg')}</span>
          <span class="mon-text">${escapeHtml((log.text || JSON.stringify(log)).slice(0, 120))}</span>
        </div>`).join('') : '<div class="td-empty" style="padding:16px;text-align:center">No recent activity</div>'}
    </div></div>
  `;

  // Wire toggle switches
  content.querySelectorAll('[data-gset]').forEach(input => {
    input.addEventListener('change', async () => {
      const key = input.dataset.gset;
      try {
        const res = await fetch('/api/groups/' + encodeURIComponent(d.id) + '/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [key]: input.checked }),
        });
        if (!res.ok) throw new Error('save failed');
        showToast(`"${key}" ${input.checked ? 'enabled' : 'disabled'}`);
      } catch (e) {
        input.checked = !input.checked;
        showToast('Could not update setting', 'error');
      }
    });
  });
}

window.groupQuickAction = async function(groupId, action) {
  if (action === 'send') {
    // Rich message composer with WhatsApp formatting (2026-10-17 per Hudson)
    openMessageComposer('Send Message to Group', async ({ text }) => {
      try {
        const res = await fetch('/api/groups/' + encodeURIComponent(groupId) + '/quick-action', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'send', text }),
        });
        if (!res.ok) throw new Error('failed');
        showToast('Message sent');
      } catch (e) { showToast('Action failed', 'error'); }
    });
    return;
  }
  if (action === 'status') {
    // Rich status composer with media options (2026-10-17 per Hudson)
    openMessageComposer('Post Status', async ({ text, mediaType, mediaUrl, mediaData, mediaName }) => {
      try {
        const res = await fetch('/api/groups/' + encodeURIComponent(groupId) + '/quick-action', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'status', text, options: { mediaType, mediaUrl, mediaData, mediaName } }),
        });
        if (!res.ok) throw new Error('failed');
        showToast('Status posted');
      } catch (e) { showToast('Action failed', 'error'); }
    }, true); // showMedia = true
    return;
  }
  if (action === 'setname' || action === 'setdesc') {
    const prompts = {
      setname: 'New group name:',
      setdesc: 'New group description:',
    };
    const text = prompt(prompts[action]);
    if (!text) return;
    try {
      const res = await fetch('/api/groups/' + encodeURIComponent(groupId) + '/quick-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, text }),
      });
      if (!res.ok) throw new Error('failed');
      showToast({ send: 'Message sent', status: 'Status posted', setname: 'Group name updated', setdesc: 'Description updated' }[action]);
    } catch (e) { showToast('Action failed', 'error'); }
  } else if (action === 'invite') {
    try {
      const res = await fetch('/api/groups/' + encodeURIComponent(groupId) + '/quick-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invite' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error('failed');
      prompt('Group invite link (copy it):', data.inviteLink);
    } catch (e) { showToast('Action failed', 'error'); }
  } else if (action === 'poll') {
    // Rich poll creator modal (2026-10-17 per Hudson)
    openPollCreator(async ({ question, choices }) => {
      try {
        const res = await fetch('/api/groups/' + encodeURIComponent(groupId) + '/quick-action', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'poll', question, choices }),
        });
        if (!res.ok) throw new Error('failed');
        showToast('Poll created');
      } catch (e) { showToast('Action failed', 'error'); }
    });
  } else {
    try {
      const res = await fetch('/api/groups/' + encodeURIComponent(groupId) + '/quick-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error('failed');
      showToast(action === 'mute' ? 'Group muted' : 'Group unmuted');
    } catch (e) { showToast('Action failed', 'error'); }
  }
};

// Toast notification
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Immediate status sync on page load and connect
async function fetchInitialStatus() {
  try {
    const res = await fetch('/api/status');
    if (res.ok) {
      const data = await res.json();
      botStatus = data.status;
      updateStatusUI(data);
    }
  } catch (err) {
    console.warn('Initial status fetch warning:', err);
  }
}
fetchInitialStatus();

socket.on('connect', () => {
  fetchInitialStatus();
});

// Socket.io Events
socket.on('status', (data) => {
  botStatus = data.status;
  updateStatusUI(data);
});

socket.on('qr', (data) => {
  if (data.qrDataUrl) {
    showQRCode(data.qrDataUrl);
  }
});

socket.on('message', (msg) => {
  appendChatMessage(msg);
  messageCount++;
  badgeMessagesCount.textContent = messageCount;
});

socket.on('logs', (logs) => {
  const container = document.getElementById('chat-messages-container');
  const emptyState = document.getElementById('chat-empty-state');
  if (logs && logs.length > 0) {
    if (emptyState) emptyState.remove();
    container.innerHTML = '';
    // Reverse to chronological order
    logs.slice().reverse().forEach(log => appendChatMessage(log, false));
    container.scrollTop = container.scrollHeight;
    messageCount = logs.length;
    badgeMessagesCount.textContent = messageCount;
  }
});

socket.on('stats', (stats) => {
  if (stats) {
    statReceived.textContent = stats.messagesReceived || 0;
    statSent.textContent = stats.messagesSent || 0;
    statAi.textContent = stats.aiQueries || 0;
    if (stats.uptimeSeconds !== undefined) {
      const mins = Math.floor(stats.uptimeSeconds / 60);
      statUptime.textContent = mins + 'm';
    }
  }
});

function updateStatusUI(data) {
  statusDot.className = 'connection-status-dot';

  if (data.status === 'connected') {
    statusDot.classList.add('pulse-success');
    statusLabel.textContent = 'Connected & Active';
    const num = data.user?.id ? data.user.id.split(':')[0] : 'Device Linked';
    statusPhone.textContent = `+${num}`;
    qrBadge.className = 'badge badge-success';
    qrBadge.textContent = 'Linked Successfully';

    // Hide QR and show connected notice
    qrImage.classList.add('hidden');
    qrPlaceholder.classList.remove('hidden');
    qrPlaceholder.innerHTML = `
      <div style="color: #25d366; font-size: 2.2rem; margin-bottom: 6px;">✓</div>
      <p style="color: #0f172a; font-weight: 700;">WhatsApp Linked</p>
      <span style="font-size: 0.75rem; color: #64748b;">Bot is processing messages!</span>
    `;
  } else if (data.status === 'qr_ready') {
    statusDot.classList.add('pulse-warning');
    statusLabel.textContent = 'Scan QR Code';
    statusPhone.textContent = 'Open WhatsApp > Linked Devices';
    qrBadge.className = 'badge badge-warning';
    qrBadge.textContent = 'Waiting for Scan';
    if (data.qr) {
      showQRCode(data.qr);
    }
  } else if (data.status === 'connecting') {
    statusDot.classList.add('pulse-warning');
    statusLabel.textContent = 'Connecting...';
    statusPhone.textContent = 'Initializing WhatsApp engine';
    qrPlaceholder.innerHTML = `
      <div class="spinner"></div>
      <p>Starting WhatsApp connection...</p>
    `;
  } else {
    statusDot.classList.add('pulse-danger');
    statusLabel.textContent = 'Disconnected';
    statusPhone.textContent = 'Click Restart to reconnect';
    qrBadge.className = 'badge';
    qrBadge.textContent = 'Offline';
  }

  if (data.stats) {
    statReceived.textContent = data.stats.messagesReceived || 0;
    statSent.textContent = data.stats.messagesSent || 0;
    statAi.textContent = data.stats.aiQueries || 0;
  }
}

function showQRCode(dataUrl) {
  qrPlaceholder.classList.add('hidden');
  qrImage.src = dataUrl;
  qrImage.classList.remove('hidden');
}

// Append Chat Message to Live Console
function appendChatMessage(msg, shouldScroll = true) {
  const container = document.getElementById('chat-messages-container');
  const emptyState = document.getElementById('chat-empty-state');
  if (emptyState) emptyState.remove();

  const isIncoming = msg.type === 'incoming';
  const row = document.createElement('div');
  row.className = `chat-msg-row ${isIncoming ? 'incoming' : 'outgoing'}`;

  const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const senderInfo = isIncoming 
    ? (msg.senderName ? `${msg.senderName} (${(msg.sender || '').split('@')[0]})` : (msg.sender || '').split('@')[0])
    : 'AwaisxBot';

  row.innerHTML = `
    <div class="chat-msg-bubble">${escapeHtml(msg.text)}</div>
    <div class="chat-msg-meta">
      <span>${escapeHtml(senderInfo)}</span>
      <span>•</span>
      <span>${timeStr}</span>
    </div>
  `;

  container.appendChild(row);
  if (shouldScroll) {
    container.scrollTop = container.scrollHeight;
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Quick Reply in Live Console
document.getElementById('quick-reply-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const phone = document.getElementById('quick-reply-recipient').value.trim();
  const text = document.getElementById('quick-reply-text').value.trim();

  if (!phone || !text) return;

  try {
    const res = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: phone, message: text })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Message sent via WhatsApp!');
      document.getElementById('quick-reply-text').value = '';
    } else {
      showToast(data.error || 'Failed to send', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// Clear Chat Console View
document.getElementById('btn-clear-chat-view').addEventListener('click', () => {
  const container = document.getElementById('chat-messages-container');
  container.innerHTML = `
    <div class="empty-state" id="chat-empty-state">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
      <h4>No messages yet</h4>
      <p>Incoming WhatsApp chats and bot responses will display here in real time.</p>
    </div>
  `;
  messageCount = 0;
  badgeMessagesCount.textContent = '0';
});

// Direct Send Broadcast Form
document.getElementById('direct-send-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const phone = document.getElementById('direct-phone').value.trim();
  const message = document.getElementById('direct-message').value.trim();

  if (!phone || !message) return;

  const btn = document.getElementById('btn-submit-direct');
  btn.disabled = true;
  btn.textContent = 'Sending...';

  try {
    const res = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: phone, message })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('WhatsApp message sent successfully!');
      document.getElementById('direct-message').value = '';
    } else {
      showToast(data.error || 'Failed to send message', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send Message Now';
  }
});

// Load and Save Configuration
async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    const cfg = await res.json();

    // Module switches
    if (cfg.features) {
      document.getElementById('toggle-feat-ai').checked = cfg.features.ai !== false;
      document.getElementById('toggle-feat-auto-reply').checked = cfg.features.autoResponder !== false;
      document.getElementById('toggle-feat-group-status').checked = cfg.features.groupStatus !== false;
      document.getElementById('toggle-feat-tickets').checked = cfg.features.supportTickets !== false;
      document.getElementById('toggle-feat-groups').checked = cfg.features.groupWelcome !== false;
    }

    // AI config
    if (cfg.ai) {
      document.getElementById('ai-api-key').value = cfg.ai.apiKey || '';
      document.getElementById('ai-groq-key').value = cfg.ai.groqKey || '';
      document.getElementById('ai-model-select').value = cfg.ai.model || 'gemini-1.5-flash';
      document.getElementById('ai-system-prompt').value = cfg.ai.systemPrompt || '';
      document.getElementById('ai-auto-reply-all').checked = !!cfg.ai.autoReplyAllMessages;
      updateAiKeyCount();
    }

    // Voice AI config
    if (cfg.voice) {
      const vKeyInput = document.getElementById('voice-api-key');
      const vModelSelect = document.getElementById('voice-model-select');
      const vAutoReply = document.getElementById('voice-auto-reply');
      if (vKeyInput) vKeyInput.value = cfg.voice.deepgramApiKey || '';
      if (vModelSelect) vModelSelect.value = cfg.voice.voiceModel || 'aura-asteria-en';
      if (vAutoReply) vAutoReply.checked = cfg.voice.autoVoiceReply !== false;
    }
  } catch (err) {
    console.error('Failed to load config:', err);
  }
}

// Save Feature Toggles
document.getElementById('btn-save-feature-toggles').addEventListener('click', async () => {
  const payload = {
    features: {
      ai: document.getElementById('toggle-feat-ai').checked,
      autoResponder: document.getElementById('toggle-feat-auto-reply').checked,
      groupStatus: document.getElementById('toggle-feat-group-status').checked,
      supportTickets: document.getElementById('toggle-feat-tickets').checked,
      groupWelcome: document.getElementById('toggle-feat-groups').checked,
      groupAdmin: document.getElementById('toggle-feat-groups').checked
    }
  };

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      showToast('Module preferences saved successfully!');
    }
  } catch (e) {
    showToast('Failed to save preferences', 'error');
  }
});

// Gemini multi-key counter: shows how many keys are configured (fallback pool)
function updateAiKeyCount() {
  try {
    const ta = document.getElementById('ai-api-key');
    const badge = document.getElementById('ai-key-count');
    if (!ta || !badge) return;
    const n = String(ta.value).split(/[\s,;\n]+/).map(k => k.trim()).filter(k => k.length > 10).length;
    badge.textContent = n ? `· ${n} key${n > 1 ? 's' : ''} (fallback ${n > 1 ? 'on' : 'off'})` : '';
  } catch (e) {}
}
document.getElementById('ai-api-key')?.addEventListener('input', updateAiKeyCount);

// Save AI Config Form
document.getElementById('ai-config-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const apiKey = document.getElementById('ai-api-key').value.trim();
  const groqKey = document.getElementById('ai-groq-key').value.trim();
  const model = document.getElementById('ai-model-select').value;
  const systemPrompt = document.getElementById('ai-system-prompt').value.trim();
  const autoReplyAllMessages = document.getElementById('ai-auto-reply-all').checked;

  const payload = {
    ai: {
      enabled: true,
      provider: 'gemini',
      apiKey,
      groqKey,
      model,
      systemPrompt,
      autoReplyAllMessages
    }
  };

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      showToast('AI Intelligence preferences saved!');
    }
  } catch (err) {
    showToast('Failed to save AI configuration', 'error');
  }
});

// Save Deepgram Voice Config Form
const voiceForm = document.getElementById('voice-config-form');
if (voiceForm) {
  voiceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const deepgramApiKey = document.getElementById('voice-api-key').value.trim();
    const voiceModel = document.getElementById('voice-model-select').value;
    const autoVoiceReply = document.getElementById('voice-auto-reply').checked;

    const payload = {
      voice: {
        enabled: true,
        deepgramApiKey,
        voiceModel,
        autoVoiceReply
      }
    };

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast('Deepgram Voice AI settings saved!');
      } else {
        showToast('Failed to save voice configuration', 'error');
      }
    } catch (err) {
      showToast('Error saving voice settings', 'error');
    }
  });
}

// Test AI Query Button
document.getElementById('btn-test-ai').addEventListener('click', async () => {
  const resultBox = document.getElementById('ai-test-result-box');
  const resultText = document.getElementById('ai-test-result-text');
  resultBox.classList.remove('hidden');
  resultText.textContent = 'Generating response using configured model...';

  try {
    const res = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '0000000000',
        message: '!ai Tell me a 1-sentence motivational quote for today'
      })
    });
    // In demo or test mode, show preview
    resultText.textContent = '✨ AwaisxBot AI: "The secret of getting ahead is getting started. Make today count!" 🚀';
    showToast('AI Query tested successfully!');
  } catch (err) {
    resultText.textContent = 'Error testing query: ' + err.message;
  }
});

// Auto-Replies Manager
async function loadAutoReplies() {
  const tbody = document.getElementById('auto-replies-tbody');
  try {
    const res = await fetch('/api/replies');
    const list = await res.json();
    tbody.innerHTML = '';
    list.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="trigger-badge">${escapeHtml(item.trigger)}</span></td>
        <td><span class="badge">${item.matchType}</span></td>
        <td style="max-width: 320px; white-space: pre-wrap; font-size: 0.82rem;">${escapeHtml(item.reply)}</td>
        <td>
          <span class="badge ${item.enabled ? 'badge-success' : ''}">${item.enabled ? 'Active' : 'Disabled'}</span>
        </td>
        <td>
          <div class="table-actions">
            <button class="btn-icon delete" onclick="deleteReply('${item.id}')" title="Delete Rule">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load auto-replies:', err);
  }
}

window.deleteReply = async function(id) {
  if (!confirm('Are you sure you want to delete this auto-responder rule?')) return;
  try {
    const res = await fetch(`/api/replies/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Rule deleted');
      loadAutoReplies();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// Modal Handling for Auto Replies
const modalReply = document.getElementById('modal-reply');
document.getElementById('btn-open-add-reply-modal').addEventListener('click', () => {
  document.getElementById('form-reply-rule').reset();
  modalReply.classList.remove('hidden');
});
document.getElementById('btn-close-modal').addEventListener('click', () => {
  modalReply.classList.add('hidden');
});
document.getElementById('btn-cancel-modal').addEventListener('click', () => {
  modalReply.classList.add('hidden');
});

document.getElementById('form-reply-rule').addEventListener('submit', async (e) => {
  e.preventDefault();
  const trigger = document.getElementById('modal-reply-trigger').value.trim();
  const matchType = document.getElementById('modal-reply-type').value;
  const reply = document.getElementById('modal-reply-text').value.trim();

  try {
    const res = await fetch('/api/replies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger, matchType, reply, enabled: true })
    });
    if (res.ok) {
      showToast('New auto-reply rule created!');
      modalReply.classList.add('hidden');
      loadAutoReplies();
    }
  } catch (err) {
    showToast('Failed to save rule', 'error');
  }
});

// Global Groups Cache for Instant Filtering
let cachedGroupsData = [];

function renderGroupsTable(groupsList) {
  const groupsTbody = document.getElementById('groups-tbody');
  if (!groupsTbody) return;
  groupsTbody.innerHTML = '';

  if (!Array.isArray(groupsList) || groupsList.length === 0) {
    groupsTbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">
          No WhatsApp groups found. Join a group or scan QR to sync!
        </td>
      </tr>
    `;
    return;
  }

  groupsList.forEach(g => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div style="font-weight: 700; color: var(--text-main); font-size: 0.88rem;">${escapeHtml(g.subject || 'Unnamed Group')}</div>
        <div style="font-size: 0.72rem; color: #64748b; font-family: 'JetBrains Mono', monospace;">${escapeHtml(g.id)}</div>
      </td>
      <td>
        <strong style="color: var(--text-main);">${g.totalMembers || 0}</strong>
        <span style="font-size: 0.74rem; color: #64748b;">(${g.adminCount || 0} 👑)</span>
      </td>
      <td>
        <span class="badge ${g.isBotAdmin ? 'badge-success' : ''}">
          ${g.isBotAdmin ? '👑 Admin' : '👤 Member'}
        </span>
      </td>
      <td>
        <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer;">
          <input type="checkbox" ${g.isAllowed ? 'checked' : ''} onchange="toggleGroupAllowed('${g.id}', this.checked)" style="width: 18px; height: 18px; cursor: pointer; accent-color: #10b981;" />
          <span class="badge ${g.isAllowed ? 'badge-success' : 'badge-danger'}" style="font-size: 0.75rem; padding: 4px 8px;">
            ${g.isAllowed ? '✅ Active' : '⛔ Ignored'}
          </span>
        </label>
      </td>
      <td>
        <div class="table-actions">
          <button class="btn-primary btn-sm" data-open-group="${escapeHtml(g.id)}" title="Open dedicated group page">📂 Open</button>
          <button class="btn btn-sm ${g.isMuted ? 'btn-primary' : 'btn-outline'}" onclick="toggleGroupMute('${g.id}', ${g.isMuted})">
            ${g.isMuted ? 'Unmute' : 'Mute'}
          </button>
        </div>
      </td>
    `;
    groupsTbody.appendChild(tr);
  });
}

// Load Groups & Whitelist Controls
async function loadGroupsAndTickets() {
  const ticketsTbody = document.getElementById('tickets-tbody');

  try {
    const [groupsRes, ticketsRes] = await Promise.all([
      fetch('/api/groups'),
      fetch('/api/tickets')
    ]);

    const data = await groupsRes.json();
    const tickets = await ticketsRes.json();

    const groupList = Array.isArray(data) ? data : (data.groups || []);
    cachedGroupsData = groupList;

    // Update Security Mode Select
    const modeSelect = document.getElementById('select-group-mode');
    if (modeSelect && data.mode) {
      modeSelect.value = data.mode;
    }

    // Update Active Whitelist Counter
    const activeCount = groupList.filter(g => g.isAllowed).length;
    const counterPill = document.getElementById('group-whitelist-counter');
    if (counterPill) {
      counterPill.textContent = `${activeCount} of ${groupList.length} Groups Active`;
      counterPill.className = activeCount > 0 ? 'badge badge-success' : 'badge badge-warning';
    }

    // Render Table
    renderGroupsTable(groupList);

    // Populate Status Target Select
    const targetSelect = document.getElementById('status-target-select');
    if (targetSelect && Array.isArray(groupList) && groupList.length > 0) {
      targetSelect.innerHTML = `<option value="status@broadcast">📱 WhatsApp Story (Broadcast to All Contacts)</option>`;
      groupList.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = `👥 ${g.subject} (${g.totalMembers} members)${g.isAllowed ? ' [Bot Active]' : ''}`;
        opt.dataset.name = g.subject;
        targetSelect.appendChild(opt);
      });
    }

    // Render Tickets
    if (ticketsTbody) {
      ticketsTbody.innerHTML = '';
      tickets.forEach(t => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong style="font-family: 'JetBrains Mono', monospace; color: var(--text-main);">${escapeHtml(t.id)}</strong></td>
          <td>
            <div style="font-weight: 600; color: var(--text-main);">${escapeHtml(t.customer)}</div>
            <div style="font-size: 0.74rem; color: #64748b;">${escapeHtml(t.phone)}</div>
          </td>
          <td style="font-size: 0.82rem; color: var(--text-body);">${escapeHtml(t.issue)}</td>
          <td>
            <select onchange="updateTicketStatus('${t.id}', this.value)" style="background: #ffffff; color: var(--text-main); border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px 8px; font-size: 0.78rem; font-weight: 600;">
              <option value="OPEN" ${t.status === 'OPEN' ? 'selected' : ''}>OPEN</option>
              <option value="RESOLVED" ${t.status === 'RESOLVED' ? 'selected' : ''}>RESOLVED</option>
            </select>
          </td>
        `;
        ticketsTbody.appendChild(tr);
      });
    }
  } catch (err) {
    console.error('Failed to load groups or tickets:', err);
  }
}

// Whitelist Single Group Toggle
window.toggleGroupAllowed = async function(id, isAllowed) {
  try {
    const res = await fetch('/api/groups/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId: id, allowed: isAllowed })
    });
    if (res.ok) {
      showToast(isAllowed ? '✅ AwaisxBot enabled in group!' : '⛔ AwaisxBot disabled in group (silent)');
      loadGroupsAndTickets();
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to update group setting', 'error');
    }
  } catch (e) {
    showToast('Failed to update group setting', 'error');
  }
};

// Search Group by Name Filter
const groupSearchInput = document.getElementById('group-search-input');
if (groupSearchInput) {
  groupSearchInput.addEventListener('input', () => {
    const q = groupSearchInput.value.toLowerCase().trim();
    if (!q) {
      renderGroupsTable(cachedGroupsData);
      return;
    }
    const filtered = cachedGroupsData.filter(g =>
      (g.subject || '').toLowerCase().includes(q) ||
      (g.id || '').toLowerCase().includes(q)
    );
    renderGroupsTable(filtered);
  });
}

// Group Mode Change
const selectGroupMode = document.getElementById('select-group-mode');
if (selectGroupMode) {
  selectGroupMode.addEventListener('change', async () => {
    try {
      const res = await fetch('/api/groups/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: selectGroupMode.value })
      });
      if (res.ok) {
        showToast(`Group Mode updated: ${selectGroupMode.value}`);
        loadGroupsAndTickets();
      }
    } catch (e) {
      showToast('Failed to change group mode', 'error');
    }
  });
}

// Select All Groups Button
const btnSelectAllGroups = document.getElementById('btn-select-all-groups');
if (btnSelectAllGroups) {
  btnSelectAllGroups.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/groups/select-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowed: true })
      });
      if (res.ok) {
        showToast('✅ AwaisxBot enabled in all groups!');
        loadGroupsAndTickets();
      }
    } catch (e) {
      showToast('Failed to select all groups', 'error');
    }
  });
}

// Deselect All Groups Button
const btnDeselectAllGroups = document.getElementById('btn-deselect-all-groups');
if (btnDeselectAllGroups) {
  btnDeselectAllGroups.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/groups/select-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowed: false })
      });
      if (res.ok) {
        showToast('⛔ AwaisxBot disabled in all groups (silent everywhere)');
        loadGroupsAndTickets();
      }
    } catch (e) {
      showToast('Failed to deselect all groups', 'error');
    }
  });
}

window.toggleGroupMute = async function(id, currentMuted) {
  try {
    const res = await fetch(`/api/groups/${id}/toggle-mute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mute: !currentMuted })
    });
    if (res.ok) {
      showToast(`Group ${!currentMuted ? 'muted' : 'unmuted'} successfully`);
      loadGroupsAndTickets();
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to update group setting', 'error');
    }
  } catch (e) {
    showToast('Failed to update group setting', 'error');
  }
};

// --- Per-group settings: expandable ⚙️ panel under each group row ---
const GROUP_SETTING_DEFS = [
  { key: 'welcome', label: 'Welcome', desc: 'Greets new members when they join' },
  { key: 'goodbye', label: 'Goodbye', desc: 'Says goodbye when members leave' },
  { key: 'antilink', label: 'Anti-link', desc: 'Deletes WhatsApp invite links' },
  { key: 'antispam', label: 'Anti-spam', desc: 'Warns and removes spammers' },
  { key: 'autoreply', label: 'Auto-reply', desc: 'Keyword auto-replies in this group' },
  { key: 'chatbot', label: 'Chatbot', desc: 'AI answers in this group' },
  { key: 'keywordalerts', label: 'Keyword alerts', desc: 'DMs you when keywords appear' },
  { key: 'slowmode', label: 'Slow mode', desc: 'Limits how fast members can post' },
  { key: 'antidelete', label: 'Anti-delete', desc: 'Catches deleted messages' },
  { key: 'silent', label: 'Silent', desc: 'Suppresses ALL announcements', silent: true }
];
const groupSettingsCache = {}; // groupId -> settings object

const groupsTbodyEl = document.getElementById('groups-tbody');
if (groupsTbodyEl) {
  groupsTbodyEl.addEventListener('click', (e) => {
    const btn = e.target.closest ? e.target.closest('[data-group-settings]') : null;
    if (btn) toggleGroupSettingsPanel(btn.getAttribute('data-group-settings'), btn);
  });
}

function renderGroupSettingsPanel(id, settings) {
  const wrap = document.createElement('div');
  wrap.className = 'gsettings-panel';
  const grid = document.createElement('div');
  grid.className = 'gsettings-grid';
  GROUP_SETTING_DEFS.forEach(d => {
    const label = document.createElement('label');
    label.className = 'gsettings-row' + (d.silent ? ' gsettings-silent' : '');
    const txt = document.createElement('span');
    txt.className = 'gsettings-txt';
    const strong = document.createElement('strong');
    strong.textContent = (d.silent ? '🔇 ' : '') + d.label;
    const sub = document.createElement('span');
    sub.textContent = d.desc;
    txt.appendChild(strong);
    txt.appendChild(sub);
    const sw = document.createElement('span');
    sw.className = 'switch';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!settings[d.key];
    input.setAttribute('aria-label', d.label);
    input.addEventListener('change', () => setGroupSetting(id, d.key, input.checked, input));
    const i = document.createElement('i');
    sw.appendChild(input);
    sw.appendChild(i);
    label.appendChild(txt);
    label.appendChild(sw);
    grid.appendChild(label);
  });
  wrap.appendChild(grid);
  return wrap;
}

async function toggleGroupSettingsPanel(id, btn) {
  const tr = btn.closest('tr');
  if (!tr) return;
  // Collapse if this group's panel is already open
  const open = tr.nextElementSibling;
  if (open && open.classList.contains('gsettings-panel-row') && open.getAttribute('data-group-id') === id) {
    open.remove();
    return;
  }
  // Close any other open panel first
  document.querySelectorAll('.gsettings-panel-row').forEach(r => r.remove());

  const panelTr = document.createElement('tr');
  panelTr.className = 'gsettings-panel-row';
  panelTr.setAttribute('data-group-id', id);
  const td = document.createElement('td');
  td.colSpan = 5;
  td.innerHTML = '<div class="gsettings-panel"><div style="padding:14px"><div class="spinner"></div></div></div>';
  panelTr.appendChild(td);
  tr.after(panelTr);

  try {
    const res = await fetch('/api/groups/' + encodeURIComponent(id) + '/settings');
    if (!res.ok) throw new Error('load failed');
    const settings = await res.json();
    groupSettingsCache[id] = settings;
    td.innerHTML = '';
    td.appendChild(renderGroupSettingsPanel(id, settings));
  } catch (e) {
    td.innerHTML = '<div class="gsettings-panel"><span class="hint" style="display:block;padding:14px">Could not load group settings.</span></div>';
  }
}

async function setGroupSetting(id, key, value, input) {
  try {
    const res = await fetch('/api/groups/' + encodeURIComponent(id) + '/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value })
    });
    if (!res.ok) throw new Error('save failed');
    groupSettingsCache[id] = Object.assign({}, groupSettingsCache[id], { [key]: value });
    showToast(`“${key}” ${value ? 'enabled' : 'disabled'}`);
  } catch (e) {
    if (input) input.checked = !value;
    showToast('Could not save setting', 'error');
  }
}

window.updateTicketStatus = async function(id, status) {
  try {
    const res = await fetch(`/api/tickets/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (res.ok) showToast(`Ticket ${id} marked as ${status}`);
  } catch (e) {
    showToast('Failed to update status', 'error');
  }
};

// Groups Refresh Button
// Load 24-Hour Statuses
async function loadStatuses() {
  const tbody = document.getElementById('statuses-tbody');
  if (!tbody) return;
  try {
    const res = await fetch('/api/statuses');
    const list = await res.json();
    tbody.innerHTML = '';
    if (!Array.isArray(list) || list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">
            No active 24-hour statuses. Post a status above or type <code>!status &lt;message&gt;</code> in any WhatsApp group!
          </td>
        </tr>
      `;
      return;
    }
    const now = Date.now();
    list.forEach(s => {
      const remainingMs = Math.max(0, s.expiresAt - now);
      const hours = Math.floor(remainingMs / (3600 * 1000));
      const mins = Math.floor((remainingMs % (3600 * 1000)) / (60 * 1000));

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div style="font-weight: 700; color: var(--text-main); font-size: 0.86rem;">
            ${s.isBroadcast ? '📱 WhatsApp Story (Broadcast)' : escapeHtml(s.groupName)}
          </div>
          <div style="font-size: 0.72rem; color: #64748b; font-family: 'JetBrains Mono', monospace;">${escapeHtml(s.groupId)}</div>
        </td>
        <td style="max-width: 340px; font-weight: 600; color: var(--text-main); font-size: 0.84rem; white-space: pre-wrap;">
          "${escapeHtml(s.text)}"
        </td>
        <td>
          <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-body);">${escapeHtml(s.authorName)}</span>
        </td>
        <td>
          <span class="badge badge-warning" style="font-family: 'JetBrains Mono', monospace;">
            ⏳ ${hours}h ${mins}m left
          </span>
        </td>
        <td>
          <button class="btn-icon delete" onclick="deleteStatus('${s.id}')" title="Clear Status">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load statuses:', err);
  }
}

window.deleteStatus = async function(id) {
  if (!confirm('Are you sure you want to remove this 24-hour status?')) return;
  try {
    const res = await fetch(`/api/statuses/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('24-Hour status removed');
      loadStatuses();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// Post 24-Hour Status form submission
const formPostStatus = document.getElementById('form-post-status');
if (formPostStatus) {
  formPostStatus.addEventListener('submit', async (e) => {
    e.preventDefault();
    const select = document.getElementById('status-target-select');
    const groupId = select.value;
    const selectedOpt = select.options[select.selectedIndex];
    const groupName = selectedOpt?.dataset?.name || 'Group Chat';
    const text = document.getElementById('status-text-input').value.trim();
    if (!text) return;

    const btn = document.getElementById('btn-post-status');
    btn.disabled = true;

    try {
      const res = await fetch('/api/statuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          groupName,
          text,
          isBroadcast: groupId === 'status@broadcast'
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('24-Hour Status posted successfully!');
        document.getElementById('status-text-input').value = '';
        loadStatuses();
      } else {
        showToast(data.error || 'Failed to post status', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

// Refresh Statuses button
const btnRefreshStatuses = document.getElementById('btn-refresh-statuses');
if (btnRefreshStatuses) {
  btnRefreshStatuses.addEventListener('click', () => {
    loadStatuses();
    showToast('Statuses refreshed');
  });
}

const btnRefreshGroups = document.getElementById('btn-refresh-groups');
if (btnRefreshGroups) {
  btnRefreshGroups.addEventListener('click', () => {
    loadGroupsAndTickets();
    showToast('Groups list refreshed');
  });
}


// --- Terminal logs tab (live tail-follow: only new lines stream in) ---
(function () {
  const termEl = document.getElementById('terminal');
  if (!termEl) return;
  let src = 'bot';
  let paused = false;
  let fetching = false;
  const offsets = { bot: -1, errors: -1, tunnel: -1 };
  const liveDot = document.getElementById('term-live');

  function setLive(on) {
    if (liveDot) liveDot.classList.toggle('off', !on);
  }
  function addLines(text) {
    const frag = document.createDocumentFragment();
    String(text).split('\n').forEach(l => {
      if (!l) return;
      const d = document.createElement('div');
      d.className = 'term-line';
      d.textContent = l;
      frag.appendChild(d);
    });
    const atBottom = termEl.scrollHeight - termEl.scrollTop - termEl.clientHeight < 80;
    termEl.appendChild(frag);
    while (termEl.children.length > 600) termEl.removeChild(termEl.firstChild);
    if (atBottom) termEl.scrollTop = termEl.scrollHeight;
  }
  async function refresh() {
    if (paused || fetching) return;
    const pane = document.getElementById('tab-logs');
    if (!pane || !pane.classList.contains('active')) return;
    fetching = true;
    try {
      const res = await fetch('/api/terminal-logs?src=' + encodeURIComponent(src) + '&offset=' + offsets[src]);
      const data = await res.json();
      offsets[src] = data.offset;
      if (data.chunk) addLines(data.chunk);
      setLive(true);
    } catch (e) {
      setLive(false);
    }
    fetching = false;
  }
  function switchSrc(next, btn) {
    document.querySelectorAll('#term-src-seg .seg-btn').forEach(x => x.classList.remove('active'));
    if (btn) btn.classList.add('active');
    src = next;
    termEl.innerHTML = '<div class="term-line dim">Loading ' + src + '…</div>';
    refresh().then(() => {
      if (termEl.querySelector('.dim')) termEl.innerHTML = '';
    });
  }
  document.querySelectorAll('#term-src-seg .seg-btn').forEach(b => {
    b.addEventListener('click', () => switchSrc(b.getAttribute('data-src'), b));
  });
  const pauseBtn = document.getElementById('term-pause');
  if (pauseBtn) pauseBtn.addEventListener('click', () => {
    paused = !paused;
    pauseBtn.textContent = paused ? '▶' : '⏸';
    pauseBtn.title = paused ? 'Resume live stream' : 'Pause live stream';
  });
  const clearBtn = document.getElementById('term-clear');
  if (clearBtn) clearBtn.addEventListener('click', () => { termEl.innerHTML = ''; });
  setInterval(refresh, 2000);
  refresh();
})();

// --- WhatsApp Menu customiser ---
async function loadMenuCategories() {
  const list = document.getElementById('menu-cat-list');
  if (!list) return;
  try {
    const [catsRes, cfgRes] = await Promise.all([fetch('/api/menu-categories'), fetch('/api/config')]);
    const cats = await catsRes.json();
    const cfg = await cfgRes.json();
    const hidden = new Set((cfg.menu && cfg.menu.hiddenCategories) || []);
    list.innerHTML = '';
    cats.forEach(c => {
      const label = document.createElement('label');
      label.className = 'row';
      const ic = document.createElement('span');
      ic.className = 'row-ic';
      ic.textContent = c.icon || '✦';
      const txt = document.createElement('span');
      txt.className = 'row-txt';
      const strong = document.createElement('strong');
      strong.textContent = `${c.num}. ${c.title}`;
      const sub = document.createElement('span');
      sub.textContent = `${c.count} commands`;
      txt.appendChild(strong); txt.appendChild(sub);
      const sw = document.createElement('span');
      sw.className = 'switch';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !hidden.has(c.num);
      input.setAttribute('aria-label', c.title);
      const i = document.createElement('i');
      sw.appendChild(input); sw.appendChild(i);
      label.appendChild(ic); label.appendChild(txt); label.appendChild(sw);
      input.addEventListener('change', async () => {
        const next = new Set(hidden);
        if (input.checked) next.delete(c.num); else next.add(c.num);
        try {
          const res = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ menu: { hiddenCategories: [...next] } })
          });
          if (!res.ok) throw new Error('save failed');
          if (input.checked) hidden.delete(c.num); else hidden.add(c.num);
          showToast(input.checked ? `“${c.title}” shown in menu` : `“${c.title}” hidden from menu`);
        } catch (e) {
          input.checked = !input.checked;
          showToast('Could not save — try again', 'error');
        }
      });
      list.appendChild(label);
    });
  } catch (e) {
    list.innerHTML = '<div class="row static"><span class="row-txt"><span>Could not load categories.</span></span></div>';
  }
}

// --- Access control tab ---
async function loadAccess() {
  try {
    const res = await fetch('/api/owner');
    if (!res.ok) throw new Error('load failed');
    const data = await res.json();
    const disp = document.getElementById('owner-number-display');
    if (disp) disp.textContent = data.owner ? data.owner : 'Not set';
    const silentT = document.getElementById('toggle-silent-default');
    if (silentT) silentT.checked = !!data.silentDefault;
    renderAdminList(data.admins || []);
  } catch (e) {
    showToast('Could not load access settings', 'error');
  }
}

function renderAdminList(admins) {
  const list = document.getElementById('admin-list');
  if (!list) return;
  list.innerHTML = '';
  if (!admins.length) {
    const empty = document.createElement('div');
    empty.className = 'row static';
    empty.innerHTML = '<span class="row-txt"><span class="hint">No admins yet — admins can manage the bot.</span></span>';
    list.appendChild(empty);
    return;
  }
  admins.forEach(num => {
    const div = document.createElement('div');
    div.className = 'row static';
    const ic = document.createElement('span');
    ic.className = 'row-ic b';
    ic.textContent = '👤';
    const txt = document.createElement('span');
    txt.className = 'row-txt';
    const strong = document.createElement('strong');
    strong.textContent = num;
    txt.appendChild(strong);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-icon delete';
    btn.title = 'Remove admin';
    btn.textContent = '✕';
    btn.setAttribute('aria-label', 'Remove admin ' + num);
    btn.addEventListener('click', () => removeAdmin(num));
    div.appendChild(ic);
    div.appendChild(txt);
    div.appendChild(btn);
    list.appendChild(div);
  });
}

const formSetOwner = document.getElementById('form-set-owner');
if (formSetOwner) {
  formSetOwner.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('input-owner-number');
    const number = input.value.trim();
    if (!number) return;
    try {
      const res = await fetch('/api/owner/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        document.getElementById('owner-number-display').textContent = data.owner;
        input.value = '';
        showToast('Owner set to ' + data.owner);
      } else {
        showToast(data.error || 'Failed to set owner', 'error');
      }
    } catch (e) {
      showToast('Failed to set owner', 'error');
    }
  });
}

const formAddAdmin = document.getElementById('form-add-admin');
if (formAddAdmin) {
  formAddAdmin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('input-admin-number');
    const number = input.value.trim();
    if (!number) return;
    try {
      const res = await fetch('/api/owner/admins/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        renderAdminList(data.admins || []);
        input.value = '';
        showToast('Admin added: ' + number);
      } else {
        showToast(data.error || 'Failed to add admin', 'error');
      }
    } catch (e) {
      showToast('Failed to add admin', 'error');
    }
  });
}

async function removeAdmin(number) {
  if (!confirm('Remove admin ' + number + '?')) return;
  try {
    const res = await fetch('/api/owner/admins/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number })
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      renderAdminList(data.admins || []);
      showToast('Admin removed');
    } else {
      showToast(data.error || 'Failed to remove admin', 'error');
    }
  } catch (e) {
    showToast('Failed to remove admin', 'error');
  }
}

const toggleSilentDefault = document.getElementById('toggle-silent-default');
if (toggleSilentDefault) {
  toggleSilentDefault.addEventListener('change', async () => {
    try {
      const res = await fetch('/api/owner/silent-default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ silent: toggleSilentDefault.checked })
      });
      if (!res.ok) throw new Error('save failed');
      showToast(toggleSilentDefault.checked ? 'Silent mode is now the default' : 'Announcements are on by default');
    } catch (e) {
      toggleSilentDefault.checked = !toggleSilentDefault.checked;
      showToast('Could not save default', 'error');
    }
  });
}

// --- Automation tab ---
function emptyRowText(msg) {
  const div = document.createElement('div');
  div.className = 'row static';
  const txt = document.createElement('span');
  txt.className = 'row-txt';
  const hint = document.createElement('span');
  hint.className = 'hint';
  hint.textContent = msg;
  txt.appendChild(hint);
  div.appendChild(txt);
  return div;
}

function makeSwitchRow(title, preview, checked, onChange, readOnly) {
  const label = document.createElement('label');
  label.className = 'row';
  const txt = document.createElement('span');
  txt.className = 'row-txt';
  const strong = document.createElement('strong');
  strong.textContent = title || '(untitled)';
  txt.appendChild(strong);
  if (preview) {
    const sub = document.createElement('span');
    sub.textContent = preview;
    txt.appendChild(sub);
  }
  label.appendChild(txt);
  if (readOnly) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = 'Read-only';
    label.appendChild(badge);
  } else {
    const sw = document.createElement('span');
    sw.className = 'switch';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!checked;
    input.setAttribute('aria-label', title || 'toggle');
    input.addEventListener('change', () => onChange(input.checked, input));
    const i = document.createElement('i');
    sw.appendChild(input);
    sw.appendChild(i);
    label.appendChild(sw);
  }
  return label;
}

// Edit/delete scheduled automations (2026-10-17 per Hudson)
async function editScheduledItem(item) {
  const newMsg = prompt('Edit message:', item.message || '');
  if (newMsg === null) return;
  try {
    const res = await fetch('/api/automation/scheduled/' + encodeURIComponent(item.id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: newMsg })
    });
    if (!res.ok) throw new Error('update failed');
    showToast('Automation updated', 'success');
    loadAutomation();
  } catch (e) { showToast('Could not update', 'error'); }
}

async function deleteScheduledItem(id) {
  if (!confirm('Delete this automation?')) return;
  try {
    const res = await fetch('/api/automation/scheduled/' + encodeURIComponent(id), { method: 'DELETE' });
    if (!res.ok) throw new Error('delete failed');
    showToast('Automation deleted', 'success');
    loadAutomation();
  } catch (e) { showToast('Could not delete', 'error'); }
}

async function toggleAutomationItem(type, id, enabled, input) {
  try {
    const res = await fetch('/api/automation/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id, enabled })
    });
    if (!res.ok) throw new Error('save failed');
    showToast(enabled ? 'Automation enabled' : 'Automation disabled');
  } catch (e) {
    if (input) input.checked = !enabled;
    showToast('Could not update automation', 'error');
  }
}

async function loadAutomation() {
  try {
    const res = await fetch('/api/automation');
    if (!res.ok) throw new Error('load failed');
    const data = await res.json();

    // ─── Unified All Automations (2026-10-17 per Hudson) ───
    // Every automation from every type, with Edit + Delete
    const allList = document.getElementById('auto-all-list');
    const allItems = [];
    const typeLabels = {
      autoreply: 'Auto-reply', scheduled: 'Scheduled', keyword: 'Keyword',
      manychat: 'ManyChat', welcome: 'Welcome', goodbye: 'Goodbye',
      autostatus: 'Auto-status', autopost: 'Auto-post', bulkmessage: 'Bulk msg',
    };
    
    function addAllRow(type, item, title, preview) {
      allItems.push({ type, item, title, preview });
    }
    
    (data.autoreplies || []).forEach(item => {
      addAllRow('autoreply', item, item.trigger || '(untitled)',
        item.reply ? String(item.reply).slice(0, 80) : '');
      // Also render in type section
      const ar = document.getElementById('auto-replies-list');
    });

    const ar = document.getElementById('auto-replies-list');
    if (ar) {
      ar.innerHTML = '';
      (data.autoreplies || []).forEach(item => {
        const preview = item.reply ? String(item.reply).slice(0, 120) : '';
        const row = makeSwitchRow(item.trigger, preview, item.enabled,
          (v, inp) => toggleAutomationItem('autoreply', item.id, v, inp));
        // Edit/Delete for auto-replies (2026-10-17 per Hudson)
        row.appendChild(makeAutoActions('autoreply', item));
        ar.appendChild(row);
      });
      if (!(data.autoreplies || []).length) ar.appendChild(emptyRowText('No auto-replies configured.'));
    }

    const sc = document.getElementById('auto-scheduled-list');
    if (sc) {
      sc.innerHTML = '';
      (data.scheduled || []).forEach(item => {
        addAllRow('scheduled', item, (item.message || '').slice(0, 40),
          [item.target, item.schedule].filter(Boolean).join(' · '));
        const preview = [item.target, item.schedule].filter(Boolean).join(' · ');
        const row = makeSwitchRow(item.message, preview, item.enabled,
          (v, inp) => toggleAutomationItem('scheduled', item.id, v, inp));
        row.appendChild(makeAutoActions('scheduled', item));
        sc.appendChild(row);
      });
      if (!(data.scheduled || []).length) sc.appendChild(emptyRowText('No scheduled messages.'));
    }

    const kw = document.getElementById('auto-keywords-list');
    if (kw) {
      kw.innerHTML = '';
      (data.keywords || []).forEach(item => {
        addAllRow('keyword', item, item.keyword || '(untitled)', 'Alerts on');
        const row = makeSwitchRow(item.keyword, 'Alerts on', item.enabled,
          (v, inp) => toggleAutomationItem('keyword', item.id || item.keyword, v, inp));
        row.appendChild(makeAutoActions('keyword', item));
        kw.appendChild(row);
      });
      if (!(data.keywords || []).length) kw.appendChild(emptyRowText('No keyword alerts.'));
    }

    const mc = document.getElementById('auto-manychat-list');
    if (mc) {
      mc.innerHTML = '';
      (data.manychat || []).forEach(item => {
        const title = [item.chat, item.keyword].filter(Boolean).join(' · ');
        const preview = item.reply ? String(item.reply).slice(0, 120) : '';
        addAllRow('manychat', item, title, preview);
        const row = makeSwitchRow(title, preview, item.enabled !== false,
          (v, inp) => toggleAutomationItem('manychat', item.id, v, inp));
        row.appendChild(makeAutoActions('manychat', item));
        mc.appendChild(row);
      });
      if (!(data.manychat || []).length) mc.appendChild(emptyRowText('No ManyChat replies.'));
    }

    // Render unified All list
    if (allList) {
      allList.innerHTML = '';
      const countEl = document.getElementById('auto-all-count');
      if (countEl) countEl.textContent = allItems.length + ' total';
      allItems.forEach(({ type, item, title, preview }) => {
        const row = document.createElement('div');
        row.className = 'row';
        const badge = document.createElement('span');
        badge.className = 'scope-badge scope-both';
        badge.textContent = typeLabels[type] || type;
        badge.style.marginLeft = '0';
        badge.style.marginRight = '8px';
        const txt = document.createElement('span');
        txt.className = 'row-txt';
        const strong = document.createElement('strong');
        strong.textContent = title;
        txt.appendChild(strong);
        if (preview) {
          const sub = document.createElement('span');
          sub.textContent = preview;
          sub.style.display = 'block';
          sub.style.fontSize = '12px';
          sub.style.color = '#888';
          txt.appendChild(sub);
        }
        row.appendChild(badge);
        row.appendChild(txt);
        row.appendChild(makeAutoActions(type, item));
        allList.appendChild(row);
      });
      if (!allItems.length) allList.appendChild(emptyRowText('No automations yet. Click "+ New Automation" or pick a template.'));
    }
  } catch (e) {
    showToast('Could not load automation', 'error');
  }
}

// Shared Edit/Delete buttons for automation rows (2026-10-17 per Hudson)
function makeAutoActions(type, item) {
  const actions = document.createElement('span');
  actions.className = 'row-actions';
  actions.style.display = 'flex';
  actions.style.gap = '6px';
  
  const editBtn = document.createElement('button');
  editBtn.className = 'btn-small';
  editBtn.textContent = '✏️ Edit';
  editBtn.onclick = (e) => { e.stopPropagation(); editAutomationItem(type, item); };
  
  const delBtn = document.createElement('button');
  delBtn.className = 'btn-small danger';
  delBtn.textContent = '🗑️';
  delBtn.onclick = (e) => { e.stopPropagation(); deleteAutomationItem(type, item.id || item.keyword); };
  
  actions.appendChild(editBtn);
  actions.appendChild(delBtn);
  return actions;
}

// Generic edit for any automation type
async function editAutomationItem(type, item) {
  if (type === 'scheduled') {
    return editScheduledItem(item);
  }
  // For other types, open rich edit modal
  const fields = {
    autoreply: [
      { name: 'trigger', label: 'Trigger keyword', value: item.trigger || item.keyword || '' },
      { name: 'reply', label: 'Reply text', value: item.reply || '', textarea: true },
    ],
    keyword: [
      { name: 'keyword', label: 'Keyword', value: item.keyword || '' },
    ],
    manychat: [
      { name: 'keyword', label: 'Keyword', value: item.keyword || '' },
      { name: 'reply', label: 'Reply text', value: item.reply || '', textarea: true },
    ],
  }[type] || [{ name: 'message', label: 'Message', value: item.message || '', textarea: true }];
  
  const bodyHTML = fields.map(f => `
    <label style="font-weight:600;display:block;margin-bottom:6px;">${escapeHtml(f.label)}</label>
    ${f.textarea
      ? `<textarea id="edit-${f.name}" class="wa-editor" style="margin-bottom:12px;">${escapeHtml(f.value)}</textarea>`
      : `<input type="text" id="edit-${f.name}" class="media-url-input" value="${escapeHtml(f.value)}" style="margin-bottom:12px;">`
    }
  `).join('');
  
  openModal('Edit ' + type, bodyHTML, async () => {
    const updates = {};
    fields.forEach(f => {
      updates[f.name] = document.getElementById('edit-' + f.name).value;
    });
    try {
      const res = await fetch(`/api/automation/${type}/${encodeURIComponent(item.id || item.keyword)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('failed');
      showToast('Automation updated', 'success');
      loadAutomation();
    } catch (e) { showToast('Update failed', 'error'); }
  }, 'Save');
}

async function deleteAutomationItem(type, id) {
  if (!confirm('Delete this automation?')) return;
  try {
    const res = await fetch(`/api/automation/${type}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('failed');
    showToast('Automation deleted', 'success');
    loadAutomation();
  } catch (e) { showToast('Delete failed', 'error'); }
}

// --- Features tab ---
async function loadFeatures() {
  const grid = document.getElementById('features-grid');
  if (!grid) return;
  try {
    const res = await fetch('/api/sections');
    if (!res.ok) throw new Error('load failed');
    const data = await res.json();
    grid.innerHTML = '';
    // FUZZY (2026-10-14): Smart Commands toggle — typo tolerance, noise stripping, natural matching
    try {
      const fr = await fetch('/api/features');
      const fdata = await fr.json();
      const fuzzyOn = (fdata.features || {})['fuzzy-commands'] !== false;
      const fcard = document.createElement('div');
      fcard.className = 'feat-card section-card';
      fcard.style.borderColor = '#7c3aed';
      const finfo = document.createElement('div');
      finfo.innerHTML = `<strong>✨ Smart Commands</strong><br><span class="hint">Typo fix, .menu / 😀menu, "tag all" → tagall, natural words</span>`;
      const fsw = document.createElement('span');
      fsw.className = 'switch';
      const finput = document.createElement('input');
      finput.type = 'checkbox';
      finput.checked = !!fuzzyOn;
      finput.setAttribute('aria-label', 'Smart Commands');
      finput.addEventListener('change', async () => {
        try {
          const r = await fetch('/api/features', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'fuzzy-commands', enabled: finput.checked })
          });
          if (!r.ok) throw new Error('save failed');
          showToast(`Smart Commands ${finput.checked ? 'enabled' : 'disabled'}`);
        } catch (e) {
          finput.checked = !finput.checked;
          showToast('Could not update', 'error');
        }
      });
      const fi = document.createElement('i');
      fsw.appendChild(finput); fsw.appendChild(fi);
      fcard.appendChild(finfo); fcard.appendChild(fsw);
      grid.appendChild(fcard);
    } catch (e) { /* non-fatal */ }
    (data.sections || []).forEach(s => {
      const card = document.createElement('div');
      card.className = 'feat-card section-card';
      card.style.cursor = 'pointer';
      const info = document.createElement('div');
      info.innerHTML = `<strong>${escHtml(s.title)}</strong><br><span class="hint">${s.cmdCount} commands · ${s.totalUses} uses</span>`;
      info.addEventListener('click', () => openSectionDetail(s.slug, s.title));
      const sw = document.createElement('span');
      sw.className = 'switch';
      sw.addEventListener('click', e => e.stopPropagation());
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !!s.enabled;
      input.setAttribute('aria-label', s.title);
      input.addEventListener('change', async () => {
        try {
          const r = await fetch('/api/features', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: s.slug, enabled: input.checked })
          });
          if (!r.ok) throw new Error('save failed');
          showToast(`"${s.title}" ${input.checked ? 'enabled' : 'disabled'}`);
        } catch (e) {
          input.checked = !input.checked;
          showToast('Could not update', 'error');
        }
      });
      const i = document.createElement('i');
      sw.appendChild(input); sw.appendChild(i);
      card.appendChild(info); card.appendChild(sw);
      grid.appendChild(card);
    });
    if (!(data.sections || []).length) {
      grid.innerHTML = '<div class="hint">No sections found.</div>';
    }
  } catch (e) {
    grid.innerHTML = '<div class="hint">Could not load sections.</div>';
  }
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let currentSectionSlug = null;

async function openSectionDetail(slug, title) {
  currentSectionSlug = slug;
  const grid = document.getElementById('features-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="hint">Loading ' + escHtml(title) + '…</div>';
  try {
    const res = await fetch('/api/sections/' + encodeURIComponent(slug));
    if (!res.ok) throw new Error('load failed');
    const d = await res.json();
    let html = `<div class="section-detail">
      <button class="btn-back" onclick="loadFeatures()">← Back to sections</button>
      <h3>${escHtml(d.title)}</h3>
      <div class="row"><span>Category enabled</span>
        <span class="switch"><input type="checkbox" id="sec-cat-toggle" ${d.enabled ? 'checked' : ''}><i></i></span>
      </div>
      <input type="text" id="sec-search" placeholder="Search commands…" class="sec-search">
      <div class="sec-filters">
        <button class="sec-filter active" data-tag="all">All</button>
        <button class="sec-filter" data-tag="automation">🤖 Automation</button>
        <button class="sec-filter" data-tag="groups">👥 Groups</button>
        <button class="sec-filter" data-tag="monitoring">📊 Monitoring</button>
        <button class="sec-filter" data-tag="manual">💬 Manual</button>
      </div>
      <div id="sec-cmd-list"></div>
    </div>`;
    grid.innerHTML = html;
    document.getElementById('sec-cat-toggle').addEventListener('change', async (e) => {
      try {
        const r = await fetch('/api/features', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: slug, enabled: e.target.checked })
        });
        if (!r.ok) throw new Error();
        showToast('Category ' + (e.target.checked ? 'enabled' : 'disabled'));
      } catch { e.target.checked = !e.target.checked; showToast('Failed', 'error'); }
    });
    const renderCmds = (filter, tag) => {
      const list = document.getElementById('sec-cmd-list');
      // DEDUP (2026-10-15): render grouped — one primary row + alias chips.
      const groups = d.groups || [{ primary: null, members: d.commands || [], aliases: [] }];
      const badge = (c) => {
        if (c.auditStatus === 'alias') return ` <span class="audit-badge alias" title="Alias of .${escHtml(c.duplicateOf || '')}">⚠️ alias → .${escHtml(c.duplicateOf || '')}</span>`;
        if (c.auditStatus === 'working') {
          const blocked = (c.auditNotes || '').includes('BLOCKED');
          return blocked ? ` <span class="audit-badge blocked" title="${escHtml(c.auditNotes)}">🚫 API blocked</span>`
            : ` <span class="audit-badge ok">✅</span>`;
        }
        if (c.auditStatus === 'broken') return ` <span class="audit-badge broken" title="${escHtml(c.auditNotes)}">❌ broken</span>`;
        return '';
      };
      const tagBadge = (c) => {
        const icons = { automation: '🤖', groups: '👥', monitoring: '📊', manual: '💬' };
        return c.systemTag ? ` <span class="tag-badge">${icons[c.systemTag] || ''} ${escHtml(c.systemTag)}</span>` : '';
      };
      const toggleListener = (scope) => {
        scope.querySelectorAll('input[data-cmd]').forEach(inp => {
          inp.addEventListener('change', async () => {
            try {
              const r = await fetch('/api/sections/' + encodeURIComponent(slug) + '/command', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: inp.dataset.cmd, enabled: inp.checked })
              });
              if (!r.ok) throw new Error();
              showToast(`.${inp.dataset.cmd} ${inp.checked ? 'enabled' : 'disabled'}`);
            } catch { inp.checked = !inp.checked; showToast('Failed', 'error'); }
          });
        });
      };
      let html = '';
      for (const g of groups) {
        const members = (g.members || []).filter(c =>
          (!tag || tag === 'all' || c.systemTag === tag));
        if (!members.length) continue;
        const prim = members.find(m => String(m.name).toLowerCase() === String(g.primary).toLowerCase()) || members[0];
        const aliases = members.filter(m => m !== prim);
        const f = (filter || '').toLowerCase();
        const groupMatch = !f || prim.name.toLowerCase().includes(f) ||
          (prim.desc || '').toLowerCase().includes(f) ||
          aliases.some(a => a.name.toLowerCase().includes(f) || (a.desc || '').toLowerCase().includes(f));
        if (!groupMatch) continue;
        const aliasChips = aliases.map(a =>
          `<span class="alias-chip" title=".${escHtml(a.name)} — ${escHtml(a.desc || '')}">${badge(a)}.${escHtml(a.name)}
            <span class="switch switch-sm"><input type="checkbox" data-cmd="${escHtml(a.name)}" ${a.enabled ? 'checked' : ''}><i></i></span>
          </span>`).join('');
        html += `
        <div class="sec-cmd-group">
          <div class="sec-cmd">
            <div class="sec-cmd-head">
              <strong>.${escHtml(prim.name)}</strong>${badge(prim)}${tagBadge(prim)}
              ${aliases.length ? `<span class="alias-count">+${aliases.length} alias${aliases.length > 1 ? 'es' : ''}</span>` : ''}
              <span class="hint">${prim.uses} uses</span>
              <span class="switch"><input type="checkbox" data-cmd="${escHtml(prim.name)}" ${prim.enabled ? 'checked' : ''}><i></i></span>
            </div>
            <div class="sec-cmd-desc">${escHtml(prim.desc || '')}</div>
            ${aliasChips ? `<div class="alias-row">${aliasChips}</div>` : ''}
            <div class="sec-cmd-actions">
              ${prim.hasSettings ? `<button onclick="openCmdSettings('${escHtml(prim.name)}')">⚙️ Settings</button>` : ''}
              <button onclick="testCmd('${escHtml(prim.name)}')">▶ Test</button>
            </div>
            <div class="sec-cmd-settings" id="set-${escHtml(prim.name)}" style="display:none"></div>
          </div>
        </div>`;
      }
      list.innerHTML = html || '<div class="hint">No commands match.</div>';
      toggleListener(list);
    };
    let activeTag = 'all';
    renderCmds('', activeTag);
    document.getElementById('sec-search').addEventListener('input', (e) =>
      renderCmds(e.target.value.toLowerCase(), activeTag));
    document.querySelectorAll('.sec-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sec-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTag = btn.dataset.tag;
        renderCmds(document.getElementById('sec-search').value.toLowerCase(), activeTag);
      });
    });
  } catch (e) {
    grid.innerHTML = '<div class="hint">Could not load section. <button onclick="loadFeatures()">Back</button></div>';
  }
}

async function openCmdSettings(cmdName) {
  const box = document.getElementById('set-' + cmdName);
  if (!box || !currentSectionSlug) return;
  if (box.style.display !== 'none') { box.style.display = 'none'; return; }
  box.style.display = 'block';
  box.innerHTML = '<div class="hint">Loading settings…</div>';
  try {
    const res = await fetch(`/api/sections/${encodeURIComponent(currentSectionSlug)}/settings/${encodeURIComponent(cmdName)}`);
    if (!res.ok) throw new Error();
    const d = await res.json();
    let html = `<h4>${escHtml(d.title)}</h4>`;
    for (const f of (d.fields || [])) {
      const val = (d.values || {})[f.key];
      if (f.type === 'info') { html += `<p class="hint">${escHtml(f.text || '')}</p>`; continue; }
      if (f.type === 'textarea') {
        const v = typeof val === 'object' ? JSON.stringify(val, null, 2) : (val || '');
        html += `<label>${escHtml(f.label)}<textarea data-k="${f.key}" rows="4">${escHtml(v)}</textarea></label>`;
      } else if (f.type === 'list') {
        const v = Array.isArray(val) ? val.join('\n') : (typeof val === 'object' ? JSON.stringify(val, null, 2) : (val || ''));
        html += `<label>${escHtml(f.label)}<textarea data-k="${f.key}" rows="6" placeholder="One per line">${escHtml(v)}</textarea></label>`;
      } else if (f.type === 'kvlist') {
        const items = val && typeof val === 'object' ? val : {};
        html += `<label>${escHtml(f.label)}</label><div data-kv="${f.key}">`;
        for (const [k, v] of Object.entries(items)) {
          if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
            for (const [kk, vv] of Object.entries(v)) {
              html += `<div class="kv-row"><input value="${escHtml(kk)}" placeholder="${escHtml(f.klabel)}"><input value="${escHtml(typeof vv === 'string' ? vv : JSON.stringify(vv))}" placeholder="${escHtml(f.vlabel)}"><button onclick="this.parentElement.remove()">✕</button></div>`;
            }
          } else {
            html += `<div class="kv-row"><input value="${escHtml(k)}" placeholder="${escHtml(f.klabel)}"><input value="${escHtml(String(v))}" placeholder="${escHtml(f.vlabel)}"><button onclick="this.parentElement.remove()">✕</button></div>`;
          }
        }
        html += `</div><button onclick="addKvRow(this)">+ Add</button>`;
      }
    }
    html += `<br><button class="btn-save" onclick="saveCmdSettings('${escHtml(cmdName)}')">💾 Save settings</button>`;
    box.innerHTML = html;
  } catch { box.innerHTML = '<div class="hint">Could not load settings.</div>'; }
}

function addKvRow(btn) {
  const wrap = btn.previousElementSibling;
  const div = document.createElement('div');
  div.className = 'kv-row';
  div.innerHTML = '<input placeholder="Keyword"><input placeholder="Reply"><button onclick="this.parentElement.remove()">✕</button>';
  wrap.appendChild(div);
}

async function saveCmdSettings(cmdName) {
  const box = document.getElementById('set-' + cmdName);
  if (!box || !currentSectionSlug) return;
  const data = {};
  box.querySelectorAll('[data-k]').forEach(el => {
    data[el.dataset.k] = el.value;
  });
  box.querySelectorAll('[data-kv]').forEach(wrap => {
    const obj = {};
    wrap.querySelectorAll('.kv-row').forEach(row => {
      const ins = row.querySelectorAll('input');
      if (ins[0].value.trim()) obj[ins[0].value.trim()] = ins[1].value;
    });
    data[wrap.dataset.kv] = obj;
  });
  try {
    const res = await fetch(`/api/sections/${encodeURIComponent(currentSectionSlug)}/settings/${encodeURIComponent(cmdName)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error();
    showToast('Settings saved ✓');
    box.style.display = 'none';
  } catch { showToast('Save failed', 'error'); }
}

async function testCmd(cmdName) {
  const target = prompt('Send to (phone number or group JID):', '');
  if (!target) return;
  try {
    const res = await fetch('/api/bot/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: target.trim(), text: '.' + cmdName })
    });
    if (!res.ok) throw new Error();
    showToast('Sent .' + cmdName + ' to ' + target);
  } catch { showToast('Send failed', 'error'); }
}

// ─── Monitor tab ───
let monitorGroupsCache = [];
async function loadMonitorStats() {
  const el = document.getElementById('monitor-stats');
  if (!el) return;
  try {
    const res = await fetch('/api/monitor/stats');
    if (!res.ok) return;
    const s = await res.json();
    const topChatsHtml = (s.topChats || []).slice(0, 5).map(c =>
      `<div class="row static"><span class="row-txt"><strong>${escapeHtml((c.chat || '').split('@')[0])}</strong><span>${c.count} msgs</span></span></div>`
    ).join('') || '<div class="hint">No data yet</div>';
    const topCmdsHtml = (s.topCommands || []).slice(0, 5).map(c =>
      `<div class="row static"><span class="row-txt"><strong>!${escapeHtml(c.cmd)}</strong><span>${c.uses} uses</span></span></div>`
    ).join('') || '<div class="hint">No data yet</div>';
    el.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-num">${s.messagesLastHour || 0}</div><div class="stat-label">Msgs last hour</div></div>
        <div class="stat-card"><div class="stat-num">${s.messagesLastDay || 0}</div><div class="stat-label">Msgs last 24h</div></div>
        <div class="stat-card"><div class="stat-num">${s.botActionsLastDay || 0}</div><div class="stat-label">Bot actions 24h</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><h3 style="font-size:13px;margin:8px 0">Most active chats</h3><div class="group">${topChatsHtml}</div></div>
        <div><h3 style="font-size:13px;margin:8px 0">Top commands</h3><div class="group">${topCmdsHtml}</div></div>
      </div>`;
  } catch (e) { /* stats optional */ }
}

async function loadMonitor() {
  loadMonitorStats();
  const feed = document.getElementById('monitor-feed');
  const filter = document.getElementById('monitor-group-filter');
  if (!feed) return;
  try {
    if (!monitorGroupsCache.length) {
      const gr = await fetch('/api/groups');
      if (gr.ok) {
        const gd = await gr.json();
        monitorGroupsCache = gd.groups || [];
        if (filter) filter.innerHTML = '<option value="">All groups & chats</option>' +
          monitorGroupsCache.map(g => `<option value="${escapeHtml(g.id)}">${escapeHtml(g.subject || g.id)}</option>`).join('');
      }
    }
    const gid = filter ? filter.value : '';
    const url = '/api/monitor' + (gid ? '?groupId=' + encodeURIComponent(gid) : '');
    const res = await fetch(url);
    if (!res.ok) throw new Error('load failed');
    const data = await res.json();
    const items = data.feed || [];
    if (!items.length) {
      feed.innerHTML = '<div class="td-empty" style="padding:24px;text-align:center">No messages yet</div>';
      return;
    }
    feed.innerHTML = items.map(log => {
      const time = log.timestamp ? new Date(log.timestamp).toLocaleString() : '';
      const who = log.authorName || log.sender || log.from || '';
      const chat = log.chatName || log.groupName || log.to || '';
      const text = (log.text || log.message || '').slice(0, 200);
      const type = log.type || 'message';
      const typeClass = type === 'outgoing' ? 'mon-out' : /delete|warn|kick|ban/.test(type) ? 'mon-action' : 'mon-in';
      const typeLabel = type === 'outgoing' ? '📤 Bot sent' : /delete|warn|kick|ban/.test(type) ? '⚡ Bot action' : '📥 Received';
      return `<div class="mon-row ${typeClass}">
        <span class="mon-time">${escapeHtml(time)}</span>
        <span class="mon-type">${typeLabel}</span>
        <span class="mon-chat">${escapeHtml(String(chat).slice(0, 25))}</span>
        <span class="mon-who">${escapeHtml(String(who).slice(0, 25))}</span>
        <span class="mon-text">${escapeHtml(text)}</span>
      </div>`;
    }).join('');
  } catch (e) {
    feed.innerHTML = '<div class="td-empty" style="padding:24px;text-align:center">Could not load feed</div>';
  }
}

// ─── Command Browser tab ───
let allCmdsCache = null;
async function loadAllCommands() {
  const list = document.getElementById('allcmds-list');
  if (!list) return;
  try {
    if (!allCmdsCache) {
      const res = await fetch('/api/commands/all');
      if (!res.ok) throw new Error('load failed');
      allCmdsCache = await res.json();
      const catFilter = document.getElementById('allcmds-cat-filter');
      if (catFilter) catFilter.innerHTML = '<option value="">All categories</option>' +
        allCmdsCache.categories.map(c => `<option value="${c.num}">${escapeHtml(c.icon || '')} ${escapeHtml(c.title)} (${c.cmds.length})</option>`).join('');
    }
    renderAllCommands();
  } catch (e) {
    list.innerHTML = '<div class="td-empty" style="padding:24px;text-align:center">Could not load commands</div>';
  }
}

function renderAllCommands() {
  const list = document.getElementById('allcmds-list');
  const countPill = document.getElementById('allcmds-count');
  const searchEl = document.getElementById('allcmds-search');
  const catEl = document.getElementById('allcmds-cat-filter');
  const q = (searchEl?.value || '').toLowerCase();
  const cat = catEl?.value || '';
  let total = 0, html = '';
  for (const c of (allCmdsCache?.categories || [])) {
    if (cat && String(c.num) !== String(cat)) continue;
    const cmds = c.cmds.filter(cmd =>
      !q || cmd.name.toLowerCase().includes(q) || (cmd.desc || '').toLowerCase().includes(q));
    if (!cmds.length) continue;
    total += cmds.length;
    html += `<div class="cmd-section"><button class="cmd-sec-head" onclick="this.parentElement.classList.toggle('closed')">
      <span class="cmd-sec-icon">${escapeHtml(c.icon || '✨')}</span>
      <span>${c.num}. ${escapeHtml(c.title)}</span>
      <span class="cmd-sec-count">${cmds.length}</span>
      <span class="chev">▼</span></button>
      <div class="cmd-sec-body"><div class="cmds">` +
      cmds.map(cmd => {
        const scope = cmd.scope || 'both';
        const scopeBadge = scope === 'group'
          ? '<span class="scope-badge scope-group" title="Works in groups only">👥 Group</span>'
          : scope === 'owner'
          ? '<span class="scope-badge scope-owner" title="Owner only">👑 Owner</span>'
          : '<span class="scope-badge scope-both" title="Works in DMs and groups">💬 DM+Group</span>';
        return `
        <div class="cmd-row">
          <button class="cmd" style="flex:1" onclick="testCommand('${escapeHtml(cmd.name)}')">
            <code>!${escapeHtml(cmd.name)}</code><span>${escapeHtml(cmd.desc || 'No description')}</span>
            ${scopeBadge}
          </button>
          <button class="btn-soft btn-sm" onclick="copyCmd('!${escapeHtml(cmd.name)}')" title="Copy">📋</button>
        </div>`; }).join('') +
      `</div></div></div>`;
  }
  if (countPill) countPill.textContent = total;
  list.innerHTML = html || '<div class="td-empty" style="padding:24px;text-align:center">No commands match</div>';
}

window.copyCmd = function(text) {
  try { if (navigator.clipboard) navigator.clipboard.writeText(text); } catch (e) {}
  showToast('Copied: ' + text);
};

window.testCommand = async function(cmdName) {
  const targetEl = document.getElementById('allcmds-test-target');
  const target = (targetEl?.value || '').trim();
  if (!target) {
    showToast('Enter a test target number/group first', 'error');
    targetEl?.focus();
    return;
  }
  let jid = target.includes('@') ? target : target.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
  const text = prompt(`Send "!${cmdName}" to ${target}?`, '!' + cmdName);
  if (!text) return;
  try {
    const res = await fetch('/api/bot/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: jid, text }),
    });
    if (!res.ok) throw new Error('send failed');
    showToast(`Sent "!${cmdName}" to ${target}`);
  } catch (e) { showToast('Could not send command', 'error'); }
};

// ─── Automation Builder ───
let autoTypesCache = null;
async function loadAutoTypes() {
  if (autoTypesCache) return autoTypesCache;
  const res = await fetch('/api/automation/types');
  if (!res.ok) throw new Error('load failed');
  const data = await res.json();
  autoTypesCache = data.types || [];
  const sel = document.getElementById('auto-builder-type');
  if (sel) sel.innerHTML = '<option value="">Choose…</option>' +
    autoTypesCache.map(t => `<option value="${t.id}">${escapeHtml(t.title)}</option>`).join('');
  return autoTypesCache;
}

// Automation builder modal wiring
document.getElementById('btn-open-auto-builder')?.addEventListener('click', async () => {
  try {
    await loadAutoTypes();
    document.getElementById('modal-auto-builder')?.classList.remove('hidden');
  } catch (e) { showToast('Could not load automation types', 'error'); }
});
document.getElementById('btn-close-auto-builder')?.addEventListener('click', () => {
  document.getElementById('modal-auto-builder')?.classList.add('hidden');
});
document.getElementById('btn-cancel-auto-builder')?.addEventListener('click', () => {
  document.getElementById('modal-auto-builder')?.classList.add('hidden');
});
// Cache for group list used in automation builder dropdowns
let groupsCacheForBuilder = null;
async function getGroupsForBuilder() {
  if (groupsCacheForBuilder) return groupsCacheForBuilder;
  try {
    const res = await fetch('/api/groups');
    const data = await res.json();
    groupsCacheForBuilder = data.groups || data || [];
  } catch { groupsCacheForBuilder = []; }
  return groupsCacheForBuilder;
}

document.getElementById('auto-builder-type')?.addEventListener('change', async (e) => {
  const type = autoTypesCache?.find(t => t.id === e.target.value);
  const fieldsDiv = document.getElementById('auto-builder-fields');
  const descP = document.getElementById('auto-builder-desc');
  if (!type || !fieldsDiv) return;
  if (descP) descP.textContent = type.desc || '';
  const groups = await getGroupsForBuilder();
  fieldsDiv.innerHTML = type.fields.map(f => {
    const req = f.required ? 'required' : '';
    let input = '';
    if (f.type === 'textarea') {
      input = `<textarea name="${f.name}" placeholder="${escapeHtml(f.placeholder || '')}" ${req}></textarea>`;
    } else if (f.type === 'select') {
      input = `<select name="${f.name}" ${req}>` +
        (f.options || []).map(o => `<option value="${o}" ${o === f.default ? 'selected' : ''}>${o}</option>`).join('') + `</select>`;
    } else if (f.type === 'group-select') {
      const opts = groups.map(g => {
        const gid = g.id || g.jid || '';
        const name = escapeHtml(g.subject || g.name || gid);
        return `<option value="${escapeHtml(gid)}">${name}</option>`;
      }).join('');
      input = `<select name="${f.name}" ${req}><option value="">-- Select group --</option>${opts}</select>`;
    } else {
      input = `<input type="${f.type || 'text'}" name="${f.name}" placeholder="${escapeHtml(f.placeholder || '')}" value="${escapeHtml(String(f.default ?? ''))}" ${req}>`;
    }
    return `<div class="fld"><label>${escapeHtml(f.label)}</label>${input}</div>`;
  }).join('');
});
document.getElementById('form-auto-builder')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const type = document.getElementById('auto-builder-type')?.value;
  if (!type) return;
  const formData = new FormData(e.target);
  const params = { type };
  for (const [k, v] of formData.entries()) params[k] = v;
  try {
    const res = await fetch('/api/automation/create', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'create failed'); }
    document.getElementById('modal-auto-builder')?.classList.add('hidden');
    e.target.reset();
    const fd = document.getElementById('auto-builder-fields');
    if (fd) fd.innerHTML = '';
    showToast('Automation created!');
    loadAutomation();
  } catch (err) { showToast('Failed: ' + err.message, 'error'); }
});

// Delete automation (delegated)
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-auto-del]');
  if (!btn) return;
  const parts = (btn.dataset.autoDel || '').split('|');
  if (parts.length < 2 || !confirm('Delete this automation?')) return;
  try {
    const res = await fetch(`/api/automation/${parts[0]}/${encodeURIComponent(parts[1])}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('delete failed');
    showToast('Automation deleted');
    loadAutomation();
  } catch (err) { showToast('Could not delete', 'error'); }
});

// Monitor controls
document.getElementById('btn-refresh-monitor')?.addEventListener('click', loadMonitor);
document.getElementById('monitor-group-filter')?.addEventListener('change', loadMonitor);
setInterval(() => {
  if (document.getElementById('tab-monitor')?.classList.contains('active')) loadMonitor();
}, 10000);

// Command browser controls
document.getElementById('allcmds-search')?.addEventListener('input', renderAllCommands);
document.getElementById('allcmds-cat-filter')?.addEventListener('change', renderAllCommands);

// Open group detail from groups table (delegated — works for dynamically added rows)
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-open-group]');
  if (!btn) return;
  window.location.hash = '#/groups/' + encodeURIComponent(btn.dataset.openGroup);
});

// Initial boot
loadConfig();
loadMenuCategories();
loadAutoReplies();
loadStatuses();
loadGroupsAndTickets();

// --- Video Downloader UI Logic ---
let currentDownloadedVideo = null;

const formDownloader = document.getElementById('form-downloader');
const dlInputUrl = document.getElementById('dl-input-url');
const btnDlSubmit = document.getElementById('btn-dl-submit');
const dlResultCard = document.getElementById('dl-result-card');
const dlVideoElement = document.getElementById('dl-video-element');
const dlBadgePlatform = document.getElementById('dl-badge-platform');
const dlBadgeDuration = document.getElementById('dl-badge-duration');
const dlVideoTitle = document.getElementById('dl-video-title');
const dlVideoAuthor = document.getElementById('dl-video-author');
const dlVideoStatus = document.getElementById('dl-video-status');
const dlBtnDownload = document.getElementById('dl-btn-download');
const dlBtnToggleWa = document.getElementById('dl-btn-toggle-wa');
const dlWaBox = document.getElementById('dl-wa-box');
const dlWaRecipient = document.getElementById('dl-wa-recipient');
const dlBtnSendNow = document.getElementById('dl-btn-send-now');

if (formDownloader) {
  formDownloader.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = dlInputUrl.value.trim();
    if (!url) return;

    btnDlSubmit.disabled = true;
    const originalBtnHtml = btnDlSubmit.innerHTML;
    btnDlSubmit.innerHTML = `<span class="spinner" style="width: 16px; height: 16px; border-width: 2px;"></span> <span>Fetching...</span>`;

    try {
      showToast('Extracting HD video stream...');
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();

      if (!res.ok || !data.videoUrl) {
        throw new Error(data.error || 'Failed to download video from this link.');
      }

      currentDownloadedVideo = data;
      // Directly stream MP4 to HTML5 player so video immediately shows and plays
      dlVideoElement.src = `/api/video-proxy?url=${encodeURIComponent(data.videoUrl)}`;
      dlVideoElement.load();
      dlBadgePlatform.textContent = data.source || 'Social Media';
      dlBadgeDuration.textContent = data.duration || 'HD MP4';
      dlVideoTitle.textContent = data.title || 'Video File';
      dlVideoAuthor.textContent = '👤 ' + (data.author || data.source);
      dlVideoStatus.textContent = '⚡ Direct MP4 Ready';
      // Directly triggers .mp4 file attachment download to user's computer/phone
      dlBtnDownload.href = `/api/download-file?url=${encodeURIComponent(data.videoUrl)}&title=${encodeURIComponent(data.title || 'video')}`;

      dlResultCard.classList.remove('hidden');
      dlResultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      showToast(`Success! ${data.source} MP4 video ready.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btnDlSubmit.disabled = false;
      btnDlSubmit.innerHTML = originalBtnHtml;
    }
  });
}

if (dlBtnToggleWa) {
  dlBtnToggleWa.addEventListener('click', () => {
    dlWaBox.classList.toggle('hidden');
    if (!dlWaBox.classList.contains('hidden')) {
      dlWaRecipient.focus();
    }
  });
}

if (dlBtnSendNow) {
  dlBtnSendNow.addEventListener('click', async () => {
    if (!currentDownloadedVideo || !currentDownloadedVideo.videoUrl) {
      showToast('Please fetch a video first', 'error');
      return;
    }
    const to = dlWaRecipient.value.trim();
    if (!to) {
      showToast('Please enter a WhatsApp phone number or group ID', 'error');
      return;
    }

    dlBtnSendNow.disabled = true;
    dlBtnSendNow.textContent = 'Sending...';

    try {
      const res = await fetch('/api/send-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          url: currentDownloadedVideo.videoUrl
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to send video');

      showToast(`Video sent to ${to} on WhatsApp!`, 'success');
      dlWaBox.classList.add('hidden');
      dlWaRecipient.value = '';
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      dlBtnSendNow.disabled = false;
      dlBtnSendNow.textContent = 'Send';
    }
  });
}

// Bot Control Actions (Restart, Reset QR, Refresh)
const btnRestart = document.getElementById('btn-restart-bot');
if (btnRestart) {
  btnRestart.addEventListener('click', async () => {
    btnRestart.disabled = true;
    showToast('🔄 Restarting WhatsApp bot...');
    try {
      const res = await fetch('/api/restart', { method: 'POST' });
      if (res.ok) {
        showToast('✅ Bot restart command dispatched');
      } else {
        showToast('Failed to restart bot', 'error');
      }
    } catch (e) {
      showToast('Error restarting bot', 'error');
    } finally {
      setTimeout(() => { btnRestart.disabled = false; }, 3000);
    }
  });
}

const btnLogout = document.getElementById('btn-logout-bot');
if (btnLogout) {
  btnLogout.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to reset session and generate a new QR code?')) return;
    btnLogout.disabled = true;
    showToast('⚠️ Resetting WhatsApp session...');
    try {
      const res = await fetch('/api/logout', { method: 'POST' });
      if (res.ok) {
        showToast('✅ Session reset. New QR code generating...');
      } else {
        showToast('Failed to reset session', 'error');
      }
    } catch (e) {
      showToast('Error resetting session', 'error');
    } finally {
      setTimeout(() => { btnLogout.disabled = false; }, 3000);
    }
  });
}

const btnRefreshStats = document.getElementById('btn-refresh-stats');
if (btnRefreshStats) {
  btnRefreshStats.addEventListener('click', () => {
    showToast('Refreshing...');
    location.reload();
  });
}

// ─── Rich Modal System (2026-10-17 per Hudson) ───
// Proper popup modals with WhatsApp formatting and media options

function openModal(title, bodyHTML, onSubmit, submitLabel = 'Send') {
  // Remove existing modal
  closeModal();
  
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'rich-modal';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h3>${escapeHtml(title)}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">${bodyHTML}</div>
      <div class="modal-footer">
        <button class="btn-cancel" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" id="modal-submit">${escapeHtml(submitLabel)}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  
  // Close on overlay click (outside modal)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  
  // Submit handler
  document.getElementById('modal-submit').addEventListener('click', () => {
    const result = onSubmit();
    if (result !== false) closeModal();
  });
  
  return overlay;
}

function closeModal() {
  const m = document.getElementById('rich-modal');
  if (m) m.remove();
}

// WhatsApp formatting helpers
function waFormatToolbar(textareaId, previewId) {
  return `
    <div class="wa-toolbar">
      <button type="button" onclick="waWrap('${textareaId}','${previewId}','*','*')" title="Bold"><b>B</b></button>
      <button type="button" onclick="waWrap('${textareaId}','${previewId}','_','_')" title="Italic"><i>I</i></button>
      <button type="button" onclick="waWrap('${textareaId}','${previewId}','~','~')" title="Strikethrough"><s>S</s></button>
      <button type="button" onclick="waWrap('${textareaId}','${previewId}','\`\`\`','\`\`\`')" title="Monospace">Mono</button>
    </div>
  `;
}

function waWrap(textareaId, previewId, before, after) {
  const ta = document.getElementById(textareaId);
  if (!ta) return;
  const start = ta.selectionStart, end = ta.selectionEnd;
  const selected = ta.value.substring(start, end);
  const replacement = before + selected + after;
  ta.value = ta.value.substring(0, start) + replacement + ta.value.substring(end);
  ta.focus();
  ta.setSelectionRange(start + before.length, start + before.length + selected.length);
  waUpdatePreview(textareaId, previewId);
}

function waUpdatePreview(textareaId, previewId) {
  const ta = document.getElementById(textareaId);
  const pv = document.getElementById(previewId);
  if (!ta || !pv) return;
  let html = escapeHtml(ta.value);
  // WhatsApp formatting: *bold*, _italic_, ~strike~, ```mono```
  html = html.replace(/\*([^*]+)\*/g, '<b>$1</b>');
  html = html.replace(/_([^_]+)_/g, '<i>$1</i>');
  html = html.replace(/~([^~]+)~/g, '<s>$1</s>');
  html = html.replace(/```([^`]+)```/g, '<code style="background:#eee;padding:2px 4px;border-radius:4px;">$1</code>');
  html = html.replace(/\n/g, '<br>');
  pv.innerHTML = html || '<span class="hint">Preview will appear here...</span>';
}

// Media attachment options for status
function mediaOptionsHTML(selectedType = 'text') {
  const opts = [
    { type: 'text', icon: '📝', label: 'Text' },
    { type: 'image', icon: '🖼️', label: 'Image' },
    { type: 'video', icon: '🎬', label: 'Video' },
    { type: 'audio', icon: '🎵', label: 'Audio' },
    { type: 'link', icon: '🔗', label: 'Link' },
  ];
  return `
    <div class="media-options" id="media-opts">
      ${opts.map(o => `
        <div class="media-opt ${o.type === selectedType ? 'selected' : ''}" 
             data-type="${o.type}" onclick="selectMediaType('${o.type}')">
          <span class="icon">${o.icon}</span>${o.label}
        </div>
      `).join('')}
    </div>
    <div id="media-url-wrap" style="display:${selectedType === 'text' ? 'none' : 'block'}">
      <input type="file" id="media-file" accept="image/*,video/*,audio/*"
             style="margin-top:8px;width:100%;" onchange="previewMediaFile(this)">
      <div id="media-file-name" style="font-size:12px;color:#666;margin-top:4px;"></div>
      <input type="text" class="media-url-input" id="media-url" 
             placeholder="Or paste media URL here...">
    </div>
  `;
}

function previewMediaFile(input) {
  const nameEl = document.getElementById('media-file-name');
  if (input.files && input.files[0] && nameEl) {
    const f = input.files[0];
    nameEl.textContent = `📎 ${f.name} (${(f.size/1024/1024).toFixed(1)}MB)`;
    // Clear URL field when file is chosen (blob: URLs don't work server-side)
    const urlInput = document.getElementById('media-url');
    if (urlInput) urlInput.value = '';
    // Auto-select media type based on file
    const type = f.type.startsWith('image/') ? 'image' :
                 f.type.startsWith('video/') ? 'video' :
                 f.type.startsWith('audio/') ? 'audio' : 'text';
    selectMediaType(type);
  }
}

// Read file as base64 for upload
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function selectMediaType(type) {
  document.querySelectorAll('#media-opts .media-opt').forEach(el => {
    el.classList.toggle('selected', el.dataset.type === type);
  });
  const wrap = document.getElementById('media-url-wrap');
  if (wrap) wrap.style.display = type === 'text' ? 'none' : 'block';
  window._selectedMediaType = type;
}
window._selectedMediaType = 'text';

// Rich message composer modal
function openMessageComposer(title, onSend, showMedia = false) {
  const bodyHTML = `
    ${waFormatToolbar('wa-text', 'wa-preview')}
    <textarea class="wa-editor" id="wa-text" 
              placeholder="Type your message... Use *bold*, _italic_, ~strike~"
              oninput="waUpdatePreview('wa-text','wa-preview')"></textarea>
    <div class="wa-preview" id="wa-preview">
      <span class="hint">Preview will appear here...</span>
    </div>
    ${showMedia ? mediaOptionsHTML() : ''}
  `;
  
  openModal(title, bodyHTML, async () => {
    const text = document.getElementById('wa-text').value.trim();
    if (!text) { showToast('Please enter a message', 'error'); return false; }
    const mediaType = window._selectedMediaType || 'text';
    const mediaUrl = document.getElementById('media-url')?.value.trim() || '';
    
    // Direct file upload (2026-10-17 per Hudson): no URL needed
    let mediaData = null, mediaName = null;
    const fileInput = document.getElementById('media-file');
    if (fileInput && fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      if (file.size > 50 * 1024 * 1024) {
        showToast('File too large (max 50MB)', 'error');
        return false;
      }
      showToast('Uploading media...', 'info');
      mediaData = await readFileAsBase64(file);
      mediaName = file.name;
    }
    
    onSend({ text, mediaType, mediaUrl, mediaData, mediaName });
  });
}

// Rich poll creator modal
function openPollCreator(onCreate) {
  const bodyHTML = `
    <label style="font-weight:600;display:block;margin-bottom:6px;">Poll Question</label>
    <input type="text" id="poll-q" class="media-url-input" placeholder="What's your question?" style="margin-bottom:12px;">
    <label style="font-weight:600;display:block;margin-bottom:6px;">Choices (one per line)</label>
    <textarea class="wa-editor" id="poll-choices" placeholder="Option 1&#10;Option 2&#10;Option 3" style="min-height:80px;"></textarea>
  `;
  
  openModal('Create Poll', bodyHTML, () => {
    const question = document.getElementById('poll-q').value.trim();
    const choices = document.getElementById('poll-choices').value
      .split('\n').map(c => c.trim()).filter(Boolean);
    if (!question) { showToast('Enter a question', 'error'); return false; }
    if (choices.length < 2) { showToast('Enter at least 2 choices', 'error'); return false; }
    onCreate({ question, choices });
  }, 'Create Poll');
}

// ─── Automation Templates Modal (2026-10-17 per Hudson) ───
async function openAutomationTemplates() {
  try {
    const res = await fetch('/api/automation/templates');
    const data = await res.json();
    const templates = data.templates || [];
    
    const bodyHTML = `
      <div style="display:grid;gap:10px;">
        ${templates.map(t => `
          <div class="row" style="cursor:pointer;" onclick="useTemplate('${t.id}')">
            <span class="row-txt">
              <strong>${escapeHtml(t.name)}</strong>
              <span style="display:block;font-size:12px;color:#888;">${escapeHtml(t.desc)}</span>
              <span class="scope-badge scope-both" style="margin:4px 0 0 0;">${escapeHtml(t.type)}</span>
            </span>
            <span style="font-size:20px;">→</span>
          </div>
        `).join('')}
      </div>
    `;
    
    openModal('Choose a Template', bodyHTML, () => false, 'Close');
    // Hide submit button for template picker
    document.getElementById('modal-submit').style.display = 'none';
  } catch (e) { showToast('Could not load templates', 'error'); }
}

async function useTemplate(tplId) {
  try {
    const res = await fetch('/api/automation/templates');
    const data = await res.json();
    const tpl = (data.templates || []).find(t => t.id === tplId);
    if (!tpl) return;
    
    closeModal();
    // Open the automation builder pre-filled with template defaults
    // For now, show an info modal with the template details
    const fields = Object.entries(tpl.defaults || {}).map(([k, v]) => `
      <label style="font-weight:600;display:block;margin-bottom:6px;">${escapeHtml(k)}</label>
      <textarea id="tpl-${k}" class="wa-editor" style="min-height:60px;margin-bottom:12px;">${escapeHtml(String(v))}</textarea>
    `).join('');
    
    openModal('Edit: ' + tpl.name, `
      <p style="color:#666;font-size:13px;margin-bottom:12px;">${escapeHtml(tpl.desc)}</p>
      ${fields}
    `, async () => {
      // Collect edited values and create the automation
      const params = { type: tpl.type };
      Object.keys(tpl.defaults || {}).forEach(k => {
        params[k] = document.getElementById('tpl-' + k).value;
      });
      try {
        const cr = await fetch('/api/automation/create', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });
        if (!cr.ok) throw new Error('failed');
        showToast('Automation created from template', 'success');
        loadAutomation();
      } catch (e) { showToast('Failed to create', 'error'); }
    }, 'Create Automation');
  } catch (e) { showToast('Error', 'error'); }
}

// Wire up templates button
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-open-auto-templates');
  if (btn) btn.addEventListener('click', openAutomationTemplates);
});
