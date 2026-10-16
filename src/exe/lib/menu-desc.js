// Menu description cleanup (2026-10-14, Hudson's order: menu was cluttered).
// Clean English titles + short descriptions (max 6 words) for every command.
// Usage: cleanDesc(name, desc) -> English string; cleanTitle(title) -> English string.

// Clean English titles for the 16 categories (menu display only).
export const TITLE_EN = {
  'Voice AI & Bolne Wala Bot': 'Voice AI',
  'Memes & Fun': 'Memes & Fun',
  'Songs & Music': 'Music',
  'Downloader': 'Downloader',
  'Photos & Stickers': 'Photos & Stickers',
  'Islamic': 'Islamic',
  'Tools': 'Tools',
  'Group Tools': 'Group Tools',
  'AI Assistant': 'AI Assistant',
  'Games': 'Games',
  'Education': 'Education',
  'Automation': 'Automation',
  'Business': 'Business',
  'Money & Finance': 'Money',
  'Health': 'Health',
  'News & Info': 'News',
};

// Translations for non-English descriptions (exact match on menu-data.js desc).
export const DESC_EN = {
  'Bol kar sunayein': 'Read text aloud',
  'Tareef bhejein': 'Send a compliment',
  'Tareef karein': 'Give a compliment',
  'Video se audio nikalein (reply)': 'Extract audio from video',
  'Photo collage banayein': 'Make photo collage',
  'Do emoji mix karein': 'Mix two emojis',
  'Profile picture dekhein': 'View profile picture',
  'QR code banayein': 'Create QR code',
  'Photo → sticker (reply)': 'Photo to sticker',
  'Hmm sticker': 'Hmm sticker',
  'OK sticker': 'OK sticker',
  'View-once dobara dekhein (reply)': 'Reopen view-once media',
  'Bot zinda hai?': 'Check bot is online',
  'Number WhatsApp par hai?': 'Check WhatsApp number',
  'Bot ki DP badlein (photo reply)': 'Change bot profile photo',
  'Bot restart (owner)': 'Restart the bot',
  'Broadcast (owner)': 'Broadcast message',
  'Sab ko bhejein (owner)': 'Broadcast to everyone',
  'Member add karein': 'Add group member',
  'Group icon badlein (admin)': 'Change group icon',
  'AI photo editor (photo pe reply karein)': 'AI photo editor',
  '8-ball jawab': 'Magic 8-ball answers',
  'Magic 8-ball jawab': 'Magic 8-ball answers',
  'Emoji se movie guess': 'Guess movie from emojis',
  'Audio ka hissa kaat lein, misal 0:10-0:30 (reply)': 'Trim audio clip',
  'Audio ki speed change karein (reply)': 'Change audio speed',
  'Audio se ringtone banayein (reply)': 'Make ringtone from audio',
  'Photo compress — size kam (reply)': 'Compress photo',
  'Photo enhance — 2x quality (reply)': 'Enhance photo quality',
  'Photo filters: grey, sepia, blur, bright, invert (reply)': 'Apply photo filters',
  'Photo se text (reply)': 'Extract text from photo',
  'Photo se text nikalein': 'Extract text from photo',
  'Photo text scan (reply)': 'Scan text in photo',
  'QR code wali photo scan karein (reply)': 'Scan QR from photo',
  'Video compress — size kam (reply)': 'Compress video',
  'Video se GIF banayein (reply)': 'Make GIF from video',
  'Umar calculator + agli birthday': 'Age and birthday calculator',
  'Text se barcode image banayein': 'Create barcode image',
  'Media save karein (reply)': 'Save media',
  'Upload aur link hasil karein (reply)': 'Upload and get link',
  'Khabrein': 'News headlines',
  'Lamba link chhota karein': 'Shorten long links',
  'Link chota karein': 'Shorten links',
  'Quran mein lafz search': 'Search word in Quran',
  'Masnoon duas': 'Daily duas',
  'Hazri lagayein': 'Mark attendance',
  'Namaz alerts (5 min pehle)': 'Prayer time alerts',
  'Namaz timings': 'Prayer timings',
  'Namaz waqt': 'Prayer times',
  'Neend tracker': 'Sleep tracker',
  'Dawai reminders': 'Medicine reminders',
  'Pani reminders (hourly 9am-10pm)': 'Hourly water reminders',
  'Calories andaza': 'Estimate calories',
  'Income tax andaza': 'Estimate income tax',
  'Sona rate (andaza)': 'Gold rate estimate',
  'Barish alert (24h)': 'Rain alerts',
  'Bijli schedule': 'Power outage schedule',
  'Pakistani SIM ka carrier maloom karein': 'Check SIM carrier',
  'Bachon ki kahani': 'Kids story',
  'Khwab ki tabeer': 'Dream interpretation',
  'Daily sitara (fun)': 'Daily horoscope',
  'Kisi website ka screenshot': 'Website screenshot',
  'Text ka khulasa': 'Summarize text',
  'Ulte lafz seedhe karein': 'Unscramble words',
  'Pathar kaichi kagaz': 'Rock paper scissors',
  'Feedback jama karein': 'Submit feedback',
  'Kaun hai?': 'Who is this?',
  'Ban khatam karein': 'Unban user',
  'User ban karein': 'Ban user',
  'User block karein': 'Block user',
  'Unblock karein': 'Unblock user',
  'Warn karein': 'Warn user',
  'Warnings dekhein': 'View warnings',
  'Kharcha hisab': 'Track expenses',
  'Mazboot random password (default 16)': 'Strong random password',
  'Time dekhein': 'Check current time',
  'Recipe banayein': 'Get a recipe',
  'Unit converter — lambai, wazan, garmi, raqba': 'Convert units',
  'View-once message dekhein': 'Open view-once message',
  'View-once save karein': 'Save view-once media',
  '7-din workout plan': '7-day workout plan',
  'Islamic date &amp; events': 'Islamic date and events',
  'Apki info': 'Your info',
  'Website up hai ya down?': 'Check website status',
  'Reply kiye message se sawal': 'Ask about replied message',
  'Caption ka funny score': 'Funny caption score',
  'Spotify track se MP3': 'Spotify track to MP3',
  'YouTube playlist ke pehle 3 songs': 'First 3 playlist songs',
  'Invoice banayein': 'Create invoice',
  'Sticker pack banayein': 'Create sticker pack',
  'BTC · ETH · SOL · BNB': 'Crypto prices',
};

// Descriptions for commands that had no description in menu-data.js.
export const NAME_EN = {
  // Voice AI
  bol: 'Convert text to voice', speak: 'Text to speech', tts: 'Text to speech',
  // Memes & Jokes
  chutkula: 'Desi joke', joke: 'Random joke', latifa: 'Funny joke',
  memeimage: 'Meme image', memepic: 'Meme picture', picmeme: 'Picture meme',
  roast: 'Roast someone', soundboard: 'Meme soundboard',
  // Music
  gana: 'Play a song', mp3: 'Download MP3', music: 'Play music',
  // Video Downloader
  fb: 'Facebook video download', insta: 'Instagram download', reel: 'Reels download',
  tiktok: 'TikTok download', yt: 'YouTube download', ytdl: 'YouTube video download',
  // Photos & Stickers
  sticker: 'Make a sticker',
  // Islamic
  ayat: 'Quran verse', qibla: 'Qibla direction', qibladir: 'Qibla direction',
  // Daily Tools
  hisaab: 'Calculator', khabrain: 'News headlines', mosam: 'Weather update',
  news: 'Latest news', qr: 'QR code maker',
  // Group Tools
  kick: 'Remove member', pin: 'Pin message', unmute: 'Unmute group',
  pinmsg: 'Pin message', unpin: 'Unpin message',
  // AI Chat
  help: 'Show help', info: 'Bot info', start: 'Start the bot',
  // AI Tools
  aiedit: 'AI photo edit', aiphoto: 'AI photo tools', application: 'Write application',
  code: 'Code helper', darkhwast: 'Write request letter', dream: 'Dream meaning',
  fixgrammar: 'Fix grammar', imagegen: 'Generate image', khulasa: 'Summarize text',
  pdfask: 'Ask about a PDF', personalityquiz: 'Personality quiz', quizme: 'Quiz me',
  resume: 'Resume builder', sitara: 'Horoscope', slogan: 'Slogan maker',
  sum: 'Summarize text', tarjuma: 'Translate text', translate: 'Translate text',
  // Games
  captioncontest: 'Caption contest', guess: 'Guessing game', magic8: 'Magic 8-ball',
  mathfight: 'Math battle', mora: 'Mora game', movieemoji: 'Movie emoji quiz',
  phansi: 'Hangman game', quizgame: 'Quiz game', td: 'Truth or dare',
  topgamers: 'Top players', ttt: 'Tic tac toe', ultapulta: 'Word scramble',
  wordlink: 'Word link game',
  // Media Tools
  compress: 'Compress file', cutaudio: 'Cut audio', enhance: 'Enhance quality',
  gif: 'Make a GIF', ring: 'Make ringtone', speedaudio: 'Change audio speed',
  vidcompress: 'Compress video',
  // Utilities
  agecalc: 'Age calculator', convertfile: 'Convert file', emicalc: 'EMI calculator',
  fakemail: 'Temporary email', isdown: 'Check site status', mkbarcode: 'Make barcode',
  newpass: 'Generate password', pkrate: 'PKR exchange rate', scanqr: 'Scan QR code',
  siminfo: 'SIM info', sitepic: 'Website screenshot', timezone: 'Time zone converter',
  tinyurl: 'Shorten URL',
  // Islamic Plus
  dailyhadith: 'Daily hadith', dateconvert: 'Date converter', dhikr: 'Dhikr counter',
  ghusl: 'Ghusl guide', hadithday: 'Hadith of the day', hajj: 'Hajj guide',
  hifz: 'Quran memorization', hijrical: 'Hijri calendar', memorize: 'Memorize tracker',
  ramadan: 'Ramadan guide', ramzan: 'Ramadan guide', seerah: "Seerah stories",
  seerahquiz: 'Seerah quiz', umrah: 'Umrah guide', wudu: 'Wudu guide',
  zakat: 'Zakat guide', zakatcalc: 'Zakat calculator', zikr: 'Zikr counter',
  // Education
  dailyword: 'Word of the day', dict: 'Dictionary', dictionary: 'Dictionary',
  exam: 'Exam prep', examcount: 'Exam countdown', flash: 'Flashcards',
  flashcards: 'Flashcards', ganit: 'Math practice', history: 'History facts',
  lughat: 'Dictionary', mathquiz: 'Math quiz', onthisday: 'On this day',
  science: 'Science facts', sciencefact: 'Science fact', spelling: 'Spelling check',
  spellquiz: 'Spelling quiz', timetable: 'Timetable', ttable: 'Timetable',
  wordday: 'Word of the day',
  // Group Control
  afk: 'Set AFK status', antilink: 'Block links', antispam: 'Block spam',
  autoreact: 'Auto reactions', bday: 'Birthday reminder', birthday: 'Birthday reminder',
  byemsg: 'Goodbye message', goodbye: 'Goodbye message', groupstats: 'Group statistics',
  gstats: 'Group stats', inactive: 'Inactive members', night: 'Night mode',
  nightmode: 'Night mode', nolink: 'No links mode', nospam: 'No spam mode',
  pollsched: 'Schedule a poll', reactall: 'React to all', schedpoll: 'Scheduled poll',
  sleepers: 'Inactive members', slow: 'Slow mode', slowmode: 'Slow mode',
  welcome: 'Welcome message', welcomecard: 'Welcome card',
  // Automation
  apiinfo: 'API info', autoforward: 'Auto forward', bizwelcome: 'Business welcome',
  botapi: 'Bot API', botstyle: 'Bot style', chatbackup: 'Chat backup',
  exportchat: 'Export chat', fwd: 'Forward message', keyword: 'Keyword alert',
  keywordalert: 'Keyword alerts', mystats: 'My stats', myusage: 'My usage',
  persona: 'Bot personality', recurringmsg: 'Recurring message', rmsgs: 'Recurring messages',
  rss: 'RSS feed', rsswatch: 'RSS watcher', welcomebiz: 'Business welcome',
  // Business
  attend: 'Attendance', bill: 'Make a bill', hazri: 'Attendance', kharcha: 'Expense tracker',
  later: 'Remind me later', mail: 'Email draft', meet: 'Schedule meeting',
  note: 'Save a note', notes: 'My notes', order: 'New order', orders: 'My orders',
  quickreply: 'Quick replies', rating: 'Rate us', sheetlog: 'Sheet log',
  task: 'Add a task', vcard: 'Visiting card',
  // Money
  alertcrypto: 'Crypto price alerts', goal: 'Savings goal', incometax: 'Income tax',
  shareprice: 'Share price', sona: 'Gold rate', splitbill: 'Split a bill',
  usdpkr: 'USD to PKR rate',
  // Health
  cal: 'Calorie counter', dawai: 'Medicine reminder', exercise: 'Exercise plan',
  kasrat: 'Workout plan', khana: 'Meal plan', medicine: 'Medicine info',
  neend: 'Sleep tracker', pani: 'Water reminder', sleeplog: 'Sleep log',
  stepchallenge: 'Step challenge',
  // News
  barish: 'Rain alert', bijli: 'Power schedule', fbscore: 'Football score',
  livescore: 'Live score', namazalert: 'Prayer alert', naukri: 'Job alerts',
  railway: 'Train timings',
  // AI Media
  aiavatar: 'AI avatar', geetlyrics: 'Song lyrics', imagetranslate: 'Translate image text',
  mememaker: 'Meme maker', readtext: 'Read text aloud', shortsdl: 'Shorts downloader',
  spack: 'Sticker pack', tocartoon: 'Cartoon effect',
  // Deen
  namazmonth: 'Monthly prayer times', qsearch: 'Quran search',
  // Group Admin
  activeboard: 'Active members board', gdesc: 'Group description', gicon: 'Group icon',
  glink: 'Group invite link', revoke: 'Revoke invite link', vkick: 'Vote kick',
  // More Tools
  chand: 'Moon phase', countto: 'Countdown', dns: 'DNS lookup',
  iplookup: 'IP lookup', moon: 'Moon phase', pickone: 'Pick one',
  randnum: 'Random number', stylish: 'Stylish text', wifishare: 'Share WiFi QR',
  // Business Plus
  diet: 'Diet plan', khata: 'Ledger book', mazmoon: 'Essay writer',
  portfolio: 'Portfolio', ppt: 'Presentation outline', qt: 'Quotation',
  raseed: 'Receipt', stockmgr: 'Stock manager',
  // Fun
  antak: 'Antakshari game', nhie: 'Never have I ever', wouldyourather: 'Would you rather',
  // Info
  airquality: 'Air quality', uvindex: 'UV index',
};

// Suffixes to strip: any trailing parenthetical like (reply), (owner), (wazan kg, qad cm), etc.
const TAG_RE = /\s*\([^)]*\)\s*$/;

export function cleanTitle(title) {
  return TITLE_EN[title] || title;
}

export function cleanDesc(name, desc) {
  const safeName = String(name || 'command');
  // 1. Exact translation match
  if (desc && DESC_EN[desc]) return DESC_EN[desc];
  // 2. Name-based description (preferred — curated English)
  if (NAME_EN[safeName]) return NAME_EN[safeName];
  // 3. Existing desc: strip tags, trim to 6 words
  if (desc && desc.trim()) {
    let d = desc.replace(TAG_RE, '').replace(/&amp;/g, '&').trim();
    const words = d.split(/\s+/);
    if (words.length > 6) d = words.slice(0, 6).join(' ');
    return d;
  }
  // 4. Fallback: humanize the command name
  return safeName.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ');
}

// BEAUTIFUL MENU (2026-10-15): one-line descriptions for each of the 28
// categories, shown under the category name in the main menu.
export const CAT_DESC = {
  1: 'Turn any text into natural voice notes',
  2: 'Fresh memes, roasts and desi humor',
  3: 'Download songs and audio in seconds',
  4: 'Save videos from YouTube, TikTok and more',
  5: 'Make stickers and edit photos easily',
  6: 'Quran, hadith, prayer times and duas',
  7: 'Calculator, weather, QR and everyday helpers',
  8: 'Anti-spam, welcome messages, manage groups',
  9: 'Chat with AI, generate images and text',
  10: 'Fun games to play alone or with friends',
  11: 'Learn: facts, meanings and study help',
  12: 'Auto-replies, reminders and scheduled messages',
  13: 'Attendance, billing and business helpers',
  14: 'Currency converter and finance tools',
  15: 'BMI, diet, health tips and wellness',
  16: 'Latest headlines, sports and updates',
};

export function catDesc(num) {
  return CAT_DESC[num] || '';
}
