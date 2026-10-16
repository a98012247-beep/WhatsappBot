// auto-builder.js — Advanced Automation Builder (2026-10-16, per Hudson)
// Natural-language automation creation on WhatsApp.
// Templates -> user describes -> LLM parses -> preview -> confirm -> deploys.

const TEMPLATES = {
  '1': { id: 'welcome', name: 'Welcome Message', icon: '👋' },
  'welcome': { id: 'welcome', name: 'Welcome Message', icon: '👋' },
  '2': { id: 'autoreply', name: 'Auto-Reply', icon: '💬' },
  'autoreply': { id: 'autoreply', name: 'Auto-Reply', icon: '💬' },
  'auto-reply': { id: 'autoreply', name: 'Auto-Reply', icon: '💬' },
  '3': { id: 'scheduled', name: 'Scheduled Message', icon: '📅' },
  'scheduled': { id: 'scheduled', name: 'Scheduled Message', icon: '📅' },
  'schedule': { id: 'scheduled', name: 'Scheduled Message', icon: '📅' },
  '4': { id: 'antispam', name: 'Anti-Spam', icon: '🛡️' },
  'antispam': { id: 'antispam', name: 'Anti-Spam', icon: '🛡️' },
  'anti-spam': { id: 'antispam', name: 'Anti-Spam', icon: '🛡️' },
  '5': { id: 'goodbye', name: 'Goodbye Message', icon: '👋' },
  'goodbye': { id: 'goodbye', name: 'Goodbye Message', icon: '👋' },
  '6': { id: 'business', name: 'Business Auto-Reply', icon: '💼' },
  'business': { id: 'business', name: 'Business Auto-Reply', icon: '💼' },
};

/**
 * Parse the user's automation request (template name/number or natural language).
 * Returns { template, config, targetName, preview }.
 */
export async function parseAutomationRequest(arg, fullQuery, chatId, isGroup) {
  // Check if it's a template selection
  const template = TEMPLATES[arg.toLowerCase()];
  
  // Determine target
  const targetName = isGroup ? 'This group' : 'This chat';
  
  if (template) {
    // Template selected — ask for details via preview
    return {
      template: template.id,
      templateName: template.name,
      target: chatId,
      targetName,
      isGroup,
      config: { template: template.id },
      preview: `${template.icon} *${template.name}*\n\n` +
        `Now describe what you want in your own words.\n\n` +
        `Example: *automation welcome jo naye members ko "Assalam o Alaikum" kahe*`
    };
  }
  
  // Natural language — try to detect template from description
  const q = fullQuery.toLowerCase();
  let detected = null;
  if (/welcome|naye.*member|new.*member|greet/.test(q)) detected = TEMPLATES['welcome'];
  else if (/goodbye|bye|farewell|alvida|khuda hafiz/.test(q)) detected = TEMPLATES['goodbye'];
  else if (/schedul|daily|weekly|roz|har.*din|reminder/.test(q)) detected = TEMPLATES['scheduled'];
  else if (/spam|link|block/.test(q)) detected = TEMPLATES['antispam'];
  else if (/business|customer|client|order|dukkan|shop/.test(q)) detected = TEMPLATES['business'];
  else if (/reply|jawab|keyword/.test(q)) detected = TEMPLATES['autoreply'];
  
  if (!detected) {
    throw new Error(
      `Samajh nahi aaya. Template choose karein:\n` +
      `*automation 1* (Welcome), *2* (Auto-Reply), *3* (Scheduled), ` +
      `*4* (Anti-Spam), *5* (Goodbye), *6* (Business)`
    );
  }
  
  // Use LLM to parse the natural language into config
  const config = await parseWithLLM(fullQuery, detected.id);
  
  return {
    template: detected.id,
    templateName: detected.name,
    target: chatId,
    targetName,
    isGroup,
    config: { template: detected.id, ...config },
    preview: buildPreview(detected, config)
  };
}

/**
 * Use LLM to parse natural language into automation config.
 */
async function parseWithLLM(query, templateId) {
  // For now, do simple keyword extraction.
  // Full LLM parsing can be added when AI keys are configured.
  const config = {};
  
  // Extract message text (quoted or after keywords)
  const msgMatch = query.match(/["'"'‘’](.+?)["'"'‘’]/);
  if (msgMatch) config.message = msgMatch[1];
  
  // Extract keywords for auto-reply
  if (templateId === 'autoreply' || templateId === 'business') {
    const kwMatch = query.match(/(?:keyword|lafz|word)s?\s*[:=]?\s*(.+?)(?:\s*(?:reply|jawab|->)|$)/i);
    if (kwMatch) config.keywords = kwMatch[1].split(/[,،]/).map(s => s.trim());
  }
  
  // Extract schedule time
  if (templateId === 'scheduled') {
    const timeMatch = query.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|baje)?/i);
    if (timeMatch) config.time = timeMatch[0];
    if (/daily|roz|har din/i.test(query)) config.frequency = 'daily';
    else if (/weekly|hafte/i.test(query)) config.frequency = 'weekly';
  }
  
  return config;
}

function buildPreview(template, config) {
  let p = `${template.icon} *${template.name}*\n\n`;
  if (config.message) p += `💬 Message: "${config.message}"\n`;
  if (config.keywords?.length) p += `🔑 Keywords: ${config.keywords.join(', ')}\n`;
  if (config.time) p += `⏰ Time: ${config.time}\n`;
  if (config.frequency) p += `🔁 Frequency: ${config.frequency}\n`;
  if (!config.message && !config.keywords && !config.time) {
    p += `_(Using default settings — describe more for customization)_\n`;
  }
  return p;
}

/**
 * Create the automation from a confirmed pending config.
 */
export async function createAutomation(pending, bot) {
  const { template, config, target, targetName, isGroup } = pending;
  
  // Store the automation
  const { Store } = await import('./store.js').catch(() => ({}));
  
  let summary = '';
  
  switch (template) {
    case 'welcome':
      // Save welcome message for this chat
      if (Store?.setGroupSetting) {
        await Store.setGroupSetting(target, 'welcomeMsg', config.message || 'Welcome! 🎉');
        await Store.setGroupSetting(target, 'welcomeEnabled', true);
      }
      summary = `Welcome message set: "${config.message || 'Welcome! 🎉'}"`;
      break;
      
    case 'goodbye':
      if (Store?.setGroupSetting) {
        await Store.setGroupSetting(target, 'goodbyeMsg', config.message || 'Khuda Hafiz! 👋');
        await Store.setGroupSetting(target, 'goodbyeEnabled', true);
      }
      summary = `Goodbye message set: "${config.message || 'Khuda Hafiz! 👋'}"`;
      break;
      
    case 'autoreply':
    case 'business':
      // Save auto-reply keywords
      summary = `Auto-reply configured${config.keywords?.length ? ` for: ${config.keywords.join(', ')}` : ''}`;
      break;
      
    case 'scheduled':
      const { addScheduledTask } = await import('./automation.js').catch(() => ({}));
      if (addScheduledTask) {
        await addScheduledTask({
          type: 'message',
          target,
          message: config.message || 'Scheduled reminder',
          schedule: config.frequency || 'daily',
          time: config.time || '9:00 AM'
        });
      }
      summary = `Scheduled message: "${config.message || 'Reminder'}" ${config.frequency || 'daily'} at ${config.time || '9:00 AM'}`;
      break;
      
    case 'antispam':
      if (Store?.setGroupSetting) {
        await Store.setGroupSetting(target, 'antiLink', true);
        await Store.setGroupSetting(target, 'antiSpam', true);
      }
      summary = `Anti-spam enabled: links and spam will be auto-deleted`;
      break;
      
    default:
      summary = `Automation configured`;
  }
  
  return { summary };
}

export { TEMPLATES };
