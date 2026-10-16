// ============================================================================
// AwaisxBot Dashboard — Extra Commands: BATCH 4 (Group Control + Automation)
// Standalone ESM. Safe in browsers (no Node APIs, no network at load).
// The dashboard can consume BATCH4_WEB_COMMANDS directly, or merge it via
// window.EXTRA_COMMANDS (auto-merged below for convenience).
// ============================================================================

export const BATCH4_SECTION = 'Batch 4 — Group Control & Automation';

export const BATCH4_WEB_COMMANDS = [
  { command: 'antilink', title: 'Anti-Link', usage: 'antilink on|off', example: 'antilink on', section: 'Group Control', admin: true, desc: 'Group mein links auto-delete (admin ke ilawa)' },
  { command: 'antispam', title: 'Anti-Spam', usage: 'antispam on|off', example: 'antispam on', section: 'Group Control', admin: true, desc: '10 sec mein 5+ messages par flood control' },
  { command: 'welcome', title: 'Welcome Card', usage: 'welcome set <text>', example: 'welcome set Khush aamdeed @user! 🎉', section: 'Group Control', admin: true, desc: 'Naye member ke liye custom welcome (@user = naam)' },
  { command: 'goodbye', title: 'Goodbye Message', usage: 'goodbye set <text>', example: 'goodbye set Allah Hafiz! 👋', section: 'Group Control', admin: true, desc: 'Member ke janay par auto goodbye' },
  { command: 'afk', title: 'AFK Mode', usage: 'afk <wajah>', example: 'afk namaz parh raha hun', section: 'Group Control', admin: false, desc: 'Door hon to auto-reply; mention par wajah bataye' },
  { command: 'autoreact', title: 'Auto-React', usage: 'autoreact on|off', example: 'autoreact on', section: 'Group Control', admin: true, desc: 'Har message par random emoji react' },
  { command: 'slowmode', title: 'Slow Mode', usage: 'slowmode <seconds>', example: 'slowmode 30', section: 'Group Control', admin: true, desc: 'Members ke darmiyan waqfa lazmi (admin exempt)' },
  { command: 'nightmode', title: 'Night Mode', usage: 'nightmode <band> <khula>', example: 'nightmode 22 7', section: 'Group Control', admin: true, desc: 'Raat ko group auto-mute, subah auto-open (bot admin lazmi)' },
  { command: 'groupstats', title: 'Group Stats', usage: 'groupstats', example: 'groupstats', section: 'Group Control', admin: false, desc: 'Aaj ke messages, joins aur leaves' },
  { command: 'inactive', title: 'Inactive Members', usage: 'inactive <days>', example: 'inactive 7', section: 'Group Control', admin: true, desc: 'Khamosh members ki list' },
  { command: 'birthday', title: 'Birthday Alerts', usage: 'bday add <naam> <DD-MM>', example: 'bday add Ali 15-08', section: 'Group Control', admin: false, desc: 'Subah 9 baje birthday alert' },
  { command: 'pinmsg', title: 'Pin Message', usage: 'pin (reply karke)', example: 'pin', section: 'Group Control', admin: true, desc: 'Reply kiye gaye message ko pin karein (unpin se hatayein)' },
  { command: 'pollsched', title: 'Scheduled Poll', usage: 'pollsched <10m|2h|1d> <Q> | <A> | <B>', example: 'pollsched 10m Chai ya coffee? | Chai | Coffee', section: 'Group Control', admin: true, desc: 'Muqarrar waqt baad poll bhejein' },
  { command: 'rsswatch', title: 'RSS Watch', usage: 'rss add <url>', example: 'rss add https://feeds.bbci.co.uk/news/rss.xml', section: 'Automation', admin: false, desc: 'Har 15 min mein nayi khabrein auto-post' },
  { command: 'keywordalert', title: 'Keyword Alerts', usage: 'keyword add <lafz>', example: 'keyword add match', section: 'Automation', admin: false, desc: 'Lafz kahin aaye to foran alert' },
  { command: 'fwd', title: 'Auto-Forward', usage: 'fwd set <number>', example: 'fwd set 03001234567', section: 'Automation', admin: false, desc: 'Is chat ke messages doosre number par bhejein' },
  { command: 'rmsgs', title: 'Recurring Messages', usage: 'rmsgs <30m|1h|1d> <text>', example: 'rmsgs 1h Pani peete rahein! 💧', section: 'Automation', admin: false, desc: 'Har muqarrar waqt baad message dohrayein' },
  { command: 'welcomebiz', title: 'Business Welcome', usage: 'welcomebiz send <num>', example: 'welcomebiz send 03001234567', section: 'Automation', admin: false, desc: 'Naye customer ko welcome DM bhejein' },
  { command: 'persona', title: 'Bot Persona', usage: 'persona <funny|formal|teacher|poet>', example: 'persona funny', section: 'Automation', admin: false, desc: 'Bot ke baat karne ka andaz badlein' },
  { command: 'myusage', title: 'My Usage', usage: 'myusage', example: 'myusage', section: 'Automation', admin: false, desc: 'Aapke messages ki tadad aur rank' },
  { command: 'exportchat', title: 'Export Chat Data', usage: 'exportchat', example: 'exportchat', section: 'Automation', admin: false, desc: 'Apna sara bot data .txt file mein download karein' },
  { command: 'botapi', title: 'Bot HTTP API', usage: 'botapi', example: 'botapi', section: 'Automation', admin: false, desc: 'POST /api/bot/send ka istemal tareeqa' },
];

// Auto-merge for dashboards that read window.EXTRA_COMMANDS
if (typeof window !== 'undefined') {
  window.EXTRA_COMMANDS = (window.EXTRA_COMMANDS || []).concat(BATCH4_WEB_COMMANDS);
  window.EXTRA_SECTIONS = window.EXTRA_SECTIONS || {};
  window.EXTRA_SECTIONS.batch4 = BATCH4_SECTION;
}
