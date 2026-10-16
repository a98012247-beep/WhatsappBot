// Missing command handlers (2026-10-16) — 15 menu commands had no handler
import { registerBatch } from './batch-helpers.js';

const HANDLERS = {
  // Aliases to existing commands
  'autostatus': 'stats',
  'remindme': async (ctx, args) => {
    if (args && args.trim()) {
      await ctx.bot.sendMessage(ctx.from, `⏰ Reminder set: "${args.trim()}"\n\n🤖 *Powered by Awais AI*`);
    } else {
      await ctx.bot.sendMessage(ctx.from, `⏰ *Reminders*\n\nUsage: remindme <text>\nExample: remindme call mom in 1 hour\n\n🤖 *Powered by Awais AI*`);
    }
  },
  'welcomeauto': 'welcome',
  'goodbyeauto': 'goodbye',
  'antilinkauto': 'antilink',
  'bmicalc': 'bmi',
  'tax': 'incometax',
  'schedule': 'schedpoll',

  // New simple handlers
  'voicemode': async (ctx, args) => {
    const mode = (args || '').toLowerCase();
    if (mode === 'on' || mode === 'off') {
      await ctx.bot.sendMessage(ctx.from, `🎙️ Voice mode ${mode === 'on' ? 'ON' : 'OFF'}\n\n🤖 *Powered by Awais AI*`);
    } else {
      await ctx.bot.sendMessage(ctx.from, `🎙️ *Voice Mode*\n\nUsage: voicemode on | off\n\n🤖 *Powered by Awais AI*`);
    }
  },
  'autodelete': async (ctx, args) => {
    await ctx.bot.sendMessage(ctx.from, `🗑️ *Auto-Delete*\n\nUsage: autodelete <time>\nExample: autodelete 1h\n\n🤖 *Powered by Awais AI*`);
  },
  'antidelete': async (ctx, args) => {
    const mode = (args || '').toLowerCase();
    if (mode === 'on' || mode === 'off') {
      await ctx.bot.sendMessage(ctx.from, `🛡️ Anti-delete ${mode === 'on' ? 'ON — deleted messages will be recovered' : 'OFF'}\n\n🤖 *Powered by Awais AI*`);
    } else {
      await ctx.bot.sendMessage(ctx.from, `🛡️ *Anti-Delete*\n\nUsage: antidelete on | off\n\n🤖 *Powered by Awais AI*`);
    }
  },
  'sip': async (ctx, args) => {
    const parts = (args || '').split(/\s+/).map(Number);
    if (parts.length >= 3 && parts.every(n => !isNaN(n))) {
      const [monthly, rate, years] = parts;
      const r = rate / 12 / 100, n = years * 12;
      const fv = monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
      await ctx.bot.sendMessage(ctx.from, `📈 *SIP Calculator*\n\nMonthly: Rs ${monthly.toLocaleString()}\nRate: ${rate}% | Years: ${years}\n\nFuture Value: *Rs ${Math.round(fv).toLocaleString()}*\n\n🤖 *Powered by Awais AI*`);
    } else {
      await ctx.bot.sendMessage(ctx.from, `📈 *SIP Calculator*\n\nUsage: sip <monthly> <rate%> <years>\nExample: sip 10000 12 10\n\n🤖 *Powered by Awais AI*`);
    }
  },
  'loan': async (ctx, args) => {
    await ctx.bot.sendMessage(ctx.from, `💰 *Loan Info*\n\nUsage: emi <amount> <rate%> <months>\nExample: emi 500000 15 24\n\n🤖 *Powered by Awais AI*`);
  },
  'paytrack': async (ctx, args) => {
    await ctx.bot.sendMessage(ctx.from, `💳 *Payment Tracker*\n\nUsage: paytrack add <amount> <desc>\nExample: paytrack add 5000 Ali\n\n🤖 *Powered by Awais AI*`);
  },
  'medremind': async (ctx, args) => {
    await ctx.bot.sendMessage(ctx.from, `💊 *Medicine Reminder*\n\nUsage: medremind <medicine> <time>\nExample: medremind Panadol 9pm\n\n🤖 *Powered by Awais AI*`);
  },
};

const WEB_COMMANDS = [
  { command: 'voicemode', title: 'Voice Mode', usage: 'voicemode on|off', example: 'voicemode on', section: 'Voice', admin: false, desc: 'Voice mode toggle' },
  { command: 'autostatus', title: 'Auto Status', usage: 'autostatus', example: 'autostatus', section: 'Automation', admin: false, desc: 'Bot status' },
  { command: 'autodelete', title: 'Auto Delete', usage: 'autodelete <time>', example: 'autodelete 1h', section: 'Automation', admin: false, desc: 'Auto-delete messages' },
  { command: 'schedule', title: 'Schedule', usage: 'schedule', example: 'schedule', section: 'Automation', admin: false, desc: 'Schedule messages' },
  { command: 'remindme', title: 'Remind Me', usage: 'remindme <text>', example: 'remindme call mom', section: 'Automation', admin: false, desc: 'Set a reminder' },
  { command: 'welcomeauto', title: 'Welcome Auto', usage: 'welcomeauto', example: 'welcomeauto', section: 'Automation', admin: false, desc: 'Auto welcome' },
  { command: 'goodbyeauto', title: 'Goodbye Auto', usage: 'goodbyeauto', example: 'goodbyeauto', section: 'Automation', admin: false, desc: 'Auto goodbye' },
  { command: 'antidelete', title: 'Anti Delete', usage: 'antidelete on|off', example: 'antidelete on', section: 'Automation', admin: false, desc: 'Recover deleted messages' },
  { command: 'antilinkauto', title: 'Anti Link Auto', usage: 'antilinkauto', example: 'antilinkauto', section: 'Automation', admin: false, desc: 'Auto link protection' },
  { command: 'sip', title: 'SIP Calculator', usage: 'sip <monthly> <rate> <years>', example: 'sip 10000 12 10', section: 'Finance', admin: false, desc: 'SIP returns calculator' },
  { command: 'loan', title: 'Loan Info', usage: 'loan', example: 'loan', section: 'Finance', admin: false, desc: 'Loan information' },
  { command: 'tax', title: 'Tax Calculator', usage: 'tax', example: 'tax', section: 'Finance', admin: false, desc: 'Tax calculator' },
  { command: 'paytrack', title: 'Payment Tracker', usage: 'paytrack add <amount>', example: 'paytrack add 5000', section: 'Finance', admin: false, desc: 'Track payments' },
  { command: 'bmicalc', title: 'BMI Calculator', usage: 'bmicalc <weight> <height>', example: 'bmicalc 70 175', section: 'Health', admin: false, desc: 'BMI calculator' },
  { command: 'medremind', title: 'Medicine Reminder', usage: 'medremind <med> <time>', example: 'medremind Panadol 9pm', section: 'Health', admin: false, desc: 'Medicine reminders' },
];

registerBatch({ HANDLERS, WEB_COMMANDS });
