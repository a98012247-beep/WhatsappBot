// Batch 8d: Fun & Utility commands (2026-10-14)
// Compliments, flirt lines, pickup lines, quotes, praise, dares,
// GitHub lookup, movie info (TVmaze), owner broadcast, pairing codes,
// Quran verse lookup, WhatsApp number check.
import { registerBatch, readData, writeData } from './batch-helpers.js';

const MENU_SECTION = {
  title: 'Fun & Utilities',
  commands: [
    { cmd: 'compliment', desc: 'Send a compliment (to someone: compliment <name>)' },
    { cmd: 'flirt', desc: 'A playful, tasteful flirt line' },
    { cmd: 'pickup', desc: 'A funny, cheesy pickup line' },
    { cmd: 'inspire', desc: 'An inspirational quote' },
    { cmd: 'praise', desc: 'Praise someone (praise <name>)' },
    { cmd: 'dare', desc: 'A random safe dare' },
    { cmd: 'github', desc: 'GitHub user info (github <username>)' },
    { cmd: 'movie', desc: 'Show/movie info (movie <title>)' },
    { cmd: 'bcast', desc: 'Owner-only: broadcast to all groups' },
    { cmd: 'pair', desc: 'Get a WhatsApp pairing code (pair <number>)' },
    { cmd: 'verse', desc: 'Quran verse (verse 2:255)' },
    { cmd: 'checknum', desc: 'Check if a number is on WhatsApp' },
    { cmd: 'postchannel', desc: 'Post to your WhatsApp Channel (postchannel set <link> first)' },
  ],
};

const WEB_COMMANDS = [];

// ─── Small helpers ───
function safe(fn) {
  return async (ctx, q) => {
    try { await fn(ctx, q || ''); }
    catch (e) {
      console.error('[batch8d]', e.message);
      try { await ctx.bot.sendMessage(ctx.from, '❌ Something went wrong, please try again.'); } catch {}
    }
  };
}
const say = (ctx, text) => ctx.bot.sendMessage(ctx.from, text);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const cleanName = (s) => String(s || '').replace(/^@/, '').trim();

// ─── Built-in lists ───
const COMPLIMENTS = [
  "You have a way of making ordinary moments feel special.",
  "Your energy is the best part of any room you walk into.",
  "You are smarter than you give yourself credit for.",
  "You handle tough situations with so much grace — it's inspiring.",
  "Your kindness has a bigger impact on people than you will ever know.",
  "You have great instincts. Trust them more often.",
  "The way you laugh makes everyone around you want to laugh too.",
  "You are the friend everyone wishes they had.",
  "You bring out the best in people just by being yourself.",
  "Your creativity is honestly on another level.",
  "You make hard things look easy, and that's a real talent.",
  "People feel safe and valued around you — that's rare.",
  "You have a gift for making others feel important.",
  "Your dedication to the people you love is remarkable.",
  "You ask the kind of questions that make people think deeper.",
  "You turn problems into solutions faster than anyone I know.",
  "Your positivity is genuinely contagious.",
  "You are proof that good people still exist.",
  "You never give up, and that says everything about your character.",
  "Your sense of humor can fix even the worst days.",
  "You have the courage to be exactly who you are — never change.",
  "You make generosity look effortless.",
  "Your hard work is quietly building something great.",
  "You listen like you actually care, because you do.",
  "You are stronger than your toughest day.",
  "Your smile should be on a billboard.",
  "You have this calm confidence that draws people in.",
  "You inspire people without even trying.",
  "Your ideas are always worth hearing.",
  "You are doing better than you think — keep going.",
  "The world is genuinely better with you in it.",
  "You have excellent taste — in everything.",
];

const FLIRT_LINES = [
  "Are you a magician? Because every time I look at you, everyone else disappears.",
  "Do you believe in love at first sight, or should I walk by again?",
  "You must be tired, because you've been running through my mind all day.",
  "Is your name Google? Because you have everything I've been searching for.",
  "Are you made of copper and tellurium? Because you're Cu-Te.",
  "Do you have a map? I keep getting lost in your eyes.",
  "If you were a vegetable, you'd be a cute-cumber.",
  "You must be a parking ticket, because you've got FINE written all over you.",
  "Are you Wi-Fi? Because I'm really feeling the connection.",
  "Do you like raisins? How do you feel about a date?",
  "I was blinded by your beauty — so I'm going to need your name and number for insurance purposes.",
  "Is it hot in here, or is it just you?",
  "You look so familiar... did we meet in my dreams?",
  "I don't believe in luck, but then I met you.",
  "Are you a bank loan? Because you have my interest.",
  "Your smile just made my day a whole lot better.",
  "I must be a snowflake, because I've fallen for you.",
  "Do you have a Band-Aid? I scraped my knee falling for you.",
  "You + me + coffee = the best idea I've had all week.",
  "Are you a time traveler? Because I see you in my future.",
  "If kisses were snowflakes, I'd send you a blizzard.",
  "You had me at hello — everything since has just been a bonus.",
];

const PICKUP_LINES = [
  "Are you French? Because Eiffel for you.",
  "Do you have a name, or can I call you mine?",
  "Are you a camera? Because every time I look at you, I smile.",
  "If you were a triangle, you'd be acute one.",
  "Are you from Tennessee? Because you're the only ten I see.",
  "Do you work at Starbucks? Because I like you a latte.",
  "Are you a broom? Because you just swept me off my feet.",
  "Is your dad a boxer? Because you're a knockout.",
  "Are you a loan? Because you sure have my interest... and my attention.",
  "Do you believe in fate? Or should we give it a nudge?",
  "Are you Netflix? Because I could watch you for hours.",
  "Is your name Ariel? Because we mermaid for each other.",
  "Are you a campfire? Because you're hot and I want s'more.",
  "Do you play soccer? Because you're a keeper.",
  "Are you a dictionary? Because you're adding meaning to my life.",
  "If beauty were time, you'd be eternity.",
  "Are you a light switch? Because you just turned me on... to conversation.",
  "Do you have a pencil? Because I want to erase your past and write our future.",
  "Are you an alien? Because you just abducted my heart.",
  "Is there an airport nearby, or is that just my heart taking off?",
  "Are you a beaver? Because daaaaam.",
  "Do you like science? Because I've got my ion you.",
  "Are you a keyboard? Because you're just my type.",
  "Is your name Wi-Fi? Because we have a strong connection.",
  "Are you a magician? Because alakazam, you're amazing.",
  "Do you have a sunburn, or are you always this hot?",
  "Are you a thief? Because you just stole my heart.",
];

const QUOTES_FALLBACK = [
  ["The best way to predict the future is to create it.", "Peter Drucker"],
  ["It always seems impossible until it's done.", "Nelson Mandela"],
  ["Don't watch the clock; do what it does. Keep going.", "Sam Levenson"],
  ["Success is not final, failure is not fatal: it is the courage to continue that counts.", "Winston Churchill"],
  ["Believe you can and you're halfway there.", "Theodore Roosevelt"],
  ["The only way to do great work is to love what you do.", "Steve Jobs"],
  ["Dream big and dare to fail.", "Norman Vaughan"],
  ["What lies behind us and what lies before us are tiny matters compared to what lies within us.", "Ralph Waldo Emerson"],
  ["Act as if what you do makes a difference. It does.", "William James"],
  ["You are never too old to set another goal or to dream a new dream.", "C.S. Lewis"],
  ["The future belongs to those who believe in the beauty of their dreams.", "Eleanor Roosevelt"],
  ["Hardships often prepare ordinary people for an extraordinary destiny.", "C.S. Lewis"],
  ["Do what you can, with what you have, where you are.", "Theodore Roosevelt"],
  ["Everything you've ever wanted is on the other side of fear.", "George Addair"],
  ["Start where you are. Use what you have. Do what you can.", "Arthur Ashe"],
];

const PRAISE_TEMPLATES = [
  (n) => `${n}, your consistency is what separates you from everyone else — you show up even when it's hard.`,
  (n) => `${n}, you explain complicated things so simply that even a beginner feels smart. That's a real gift.`,
  (n) => `${n}, your attention to detail is on another level — nothing gets past you.`,
  (n) => `${n}, you have this rare mix of ambition and patience. Big goals, steady steps.`,
  (n) => `${n}, the way you stayed calm under pressure last time was honestly impressive.`,
  (n) => `${n}, your work ethic speaks louder than words — people notice, even if they don't say it.`,
  (n) => `${n}, you make people around you better. That's leadership, whether you have the title or not.`,
  (n) => `${n}, your creativity turns boring problems into interesting challenges.`,
  (n) => `${n}, you remember the small things about people — that's why everyone trusts you.`,
  (n) => `${n}, the progress you've made in such a short time is genuinely remarkable.`,
  (n) => `${n}, you take feedback like a champion and come back stronger every single time.`,
  (n) => `${n}, your honesty is refreshing — people always know where they stand with you.`,
  (n) => `${n}, you have a talent for finishing what you start. Most people don't.`,
  (n) => `${n}, your positive attitude changes the mood of the whole room.`,
  (n) => `${n}, you ask the questions nobody else dares to ask — and that's how you get ahead.`,
];

const DARES = [
  "Send a voice note singing your favorite song's chorus.",
  "Text your best friend 'I need to tell you something important' and then reply with '...you're awesome.'",
  "Do 10 push-ups right now.",
  "Take a selfie with the funniest face you can make and send it to the group.",
  "Speak in a movie-trailer voice for the next 3 messages.",
  "Compliment the next person who messages you — no matter who it is.",
  "Draw a doodle of yourself and share it here.",
  "Say the alphabet backwards as fast as you can (voice note).",
  "Post a status saying 'I just learned to juggle' (you don't have to actually juggle).",
  "Call someone you haven't talked to in a while and tell them you're thinking of them.",
  "Eat a spoonful of peanut butter with no water and report back.",
  "Do your best impression of a famous actor in a voice note.",
  "Wear your socks on your hands for the next 10 minutes.",
  "Write a 2-line poem about the person who sent you this dare.",
  "Dance for 30 seconds to the first song on your playlist and describe it.",
  "Change your profile picture to something silly for 1 hour.",
  "Try to lick your elbow (report the result).",
  "Send the last photo in your camera roll to the chat (keep it decent!).",
  "Speak only in rhymes for your next 3 messages.",
  "Hold a plank for 60 seconds and send proof.",
  "Tell a joke so bad it's good.",
  "Balance a book on your head and walk across the room.",
  "Send a voice note whispering like you're in a library.",
  "Do 15 jumping jacks and tell us how it went.",
  "Compliment a stranger online today and screenshot it (hide their name).",
  "Try to say 'toy boat' five times fast in a voice note.",
  "Send a message to the group using only emojis.",
];

const OWNER_FILE = 'batch8d-owner.json';

// ─── Handlers ───
const HANDLERS = {

  // 1. compliment
  compliment: safe(async (ctx, query) => {
    const target = cleanName(query) || ctx.senderName || 'you';
    const line = pick(COMPLIMENTS);
    await say(ctx,
      `💛 *Compliment*\n\n` +
      `Hey ${target} — ${line}\n\n` +
      `_Usage: *compliment <name>* to compliment someone._`
    );
  }),

  // 2. flirt
  flirt: safe(async (ctx, query) => {
    await say(ctx,
      `😉 *Flirt line*\n\n${pick(FLIRT_LINES)}\n\n` +
      `_Usage: *flirt* sends a playful line. Keep it classy!_`
    );
  }),

  // 3. pickup (alias: pickupline)
  pickup: safe(async (ctx, query) => {
    await say(ctx,
      `😄 *Pickup line*\n\n${pick(PICKUP_LINES)}\n\n` +
      `_Usage: *pickup* for a random cheesy line._`
    );
  }),

  // 4. inspire
  inspire: safe(async (ctx, query) => {
    let quote, author;
    try {
      const { fetchJsonRetry } = await import('./api-helper.js');
      const data = await fetchJsonRetry('https://api.quotable.io/random');
      quote = data.content; author = data.author;
    } catch (e) {
      console.error('[batch8d] inspire API failed, using fallback:', e.message);
      [quote, author] = pick(QUOTES_FALLBACK);
    }
    await say(ctx, `✨ *Inspiration*\n\n_"${quote}"_\n\n— ${author}`);
  }),

  // 5. praise
  praise: safe(async (ctx, query) => {
    const name = cleanName(query) || ctx.senderName || 'you';
    const templates = [...PRAISE_TEMPLATES].sort(() => Math.random() - 0.5).slice(0, 3);
    const lines = templates.map((t, i) => `${i + 1}. ${t(name)}`).join('\n\n');
    await say(ctx,
      `🏆 *Praise for ${name}*\n\n${lines}\n\n` +
      `_Usage: *praise <name>* to praise someone._`
    );
  }),

  // 6. dare
  dare: safe(async (ctx, query) => {
    await say(ctx,
      `🎲 *Dare*\n\n${pick(DARES)}\n\n` +
      `_All dares are safe and fun. Skip anything you're not comfortable with!_\n` +
      `_Usage: *dare* for another one._`
    );
  }),

  // 7. github
  github: safe(async (ctx, query) => {
    const username = cleanName(query);
    if (!username) {
      await say(ctx, `🐙 *GitHub lookup*\n\nUsage: *github <username>*\nExample: *github torvalds*`);
      return;
    }
    if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(username)) {
      await say(ctx, `❌ "*${username}*" is not a valid GitHub username.`);
      return;
    }
    const { fetchJsonRetry } = await import('./api-helper.js');
    let u;
    try {
      u = await fetchJsonRetry(`https://api.github.com/users/${encodeURIComponent(username)}`);
    } catch (e) {
      await say(ctx, `❌ GitHub user "${username}" not found or the API is down.`);
      return;
    }
    const caption =
      `🐙 *${u.login}*${u.name ? ` (${u.name})` : ''}\n\n` +
      (u.bio ? `📝 ${u.bio}\n\n` : '') +
      `📦 Repos: *${u.public_repos ?? 0}*\n` +
      `👥 Followers: *${u.followers ?? 0}* | Following: *${u.following ?? 0}*\n` +
      (u.location ? `📍 ${u.location}\n` : '') +
      (u.blog ? `🔗 ${u.blog}\n` : '') +
      `\n🔗 https://github.com/${u.login}`;
    try {
      if (u.avatar_url) {
        await ctx.bot.sock.sendMessage(ctx.from, { image: { url: u.avatar_url }, caption });
        return;
      }
    } catch (e) {
      console.error('[batch8d] github avatar send failed:', e.message);
    }
    await say(ctx, caption);
  }),

  // 8. movie (aliases: film, mv)
  movie: safe(async (ctx, query) => {
    const title = query.trim();
    if (!title) {
      await say(ctx, `🎬 *Movie / Show info*\n\nUsage: *movie <title>*\nExample: *movie interstellar*`);
      return;
    }
    const { fetchJsonRetry } = await import('./api-helper.js');
    let results;
    try {
      results = await fetchJsonRetry(
        `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(title)}`
      );
    } catch (e) {
      await say(ctx, `❌ Couldn't reach the movie database. Try again in a bit.`);
      return;
    }
    if (!Array.isArray(results) || !results.length) {
      await say(ctx, `❌ Nothing found for "*${title}*". Try a different title.`);
      return;
    }
    const s = results[0].show || {};
    const year = s.premiered ? s.premiered.slice(0, 4) : 'N/A';
    const rating = s.rating?.average ?? 'N/A';
    const genres = (s.genres || []).join(', ') || 'N/A';
    const summary = (s.summary || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'No summary available.';
    const net = s.network?.name || s.webChannel?.name || '';
    await say(ctx,
      `🎬 *${s.name || title}* (${year})\n\n` +
      `⭐ Rating: *${rating}*\n` +
      `🎭 Genres: ${genres}\n` +
      (net ? `📺 ${net}\n` : '') +
      (s.status ? `📌 Status: ${s.status}\n` : '') +
      `\n📖 ${summary.length > 600 ? summary.slice(0, 600) + '…' : summary}\n\n` +
      `_Usage: *movie <title>*_`
    );
  }),

  // 9. bcast (alias: broadcast) — owner-only
  bcast: safe(async (ctx, query) => {
    const data = readData(OWNER_FILE, {});
    const q = query.trim();

    // bcast setowner — no owner yet: anyone can claim once, afterwards only owner can change
    if (/^setowner$/i.test(q)) {
      if (data.owner && data.owner !== ctx.sender) {
        await say(ctx, `🔒 An owner is already set. Only the current owner can change it (message the owner to update).`);
        return;
      }
      data.owner = ctx.sender;
      writeData(OWNER_FILE, data);
      await say(ctx, `✅ You are now registered as the bot owner.\n\nYou can now use *bcast <message>* to broadcast to all groups.`);
      return;
    }

    if (!data.owner) {
      await say(ctx,
        `🔒 *Broadcast is owner-only.*\n\n` +
        `No owner is registered yet.\n` +
        `The bot owner should run: *bcast setowner*`
      );
      return;
    }
    // Owner check via access.js (2026-10-14) with legacy fallback
    let _isOwner = false;
    try {
      const { isOwner } = await import('./access.js');
      _isOwner = isOwner(ctx.sender);
    } catch {}
    if (!_isOwner && ctx.sender !== data.owner) {
      await say(ctx, `🔒 *Broadcast is owner-only.* You're not the registered owner.`);
      return;
    }

    const message = q;
    if (!message) {
      await say(ctx,
        `📢 *Broadcast*\n\n` +
        `Usage: *bcast <message>*\n` +
        `Sends your message to *all groups* the bot is in.\n\n` +
        `Example: *bcast Hello everyone!*`
      );
      return;
    }

    let groups = [];
    try {
      const all = await ctx.bot.sock.groupFetchAllParticipating();
      groups = Object.values(all || {});
    } catch (e) {
      await say(ctx, `❌ Couldn't fetch the group list. Try again later.`);
      return;
    }
    if (!groups.length) {
      await say(ctx, `📭 The bot is not in any groups — nothing to broadcast to.`);
      return;
    }

    await say(ctx, `📢 Broadcasting to *${groups.length}* groups...`);
    let ok = 0, fail = 0;
    for (const g of groups) {
      try {
        await ctx.bot.sendMessage(g.id, `📢 *Broadcast*\n\n${message}`);
        ok++;
        await new Promise(r => setTimeout(r, 800)); // small gap to avoid flooding
      } catch (e) { fail++; }
    }
    await say(ctx, `✅ Broadcast done: sent to *${ok}* groups${fail ? `, failed for ${fail}` : ''}.`);
  }),

  // 10. pair
  pair: safe(async (ctx, query) => {
    if (typeof ctx.bot.requestPairingCode !== 'function') {
      await say(ctx,
        `📱 *Pairing*\n\n` +
        `This bot doesn't support chat-based pairing.\n` +
        `Link a new device via the *dashboard* (scan the QR code there).`
      );
      return;
    }
    const number = query.replace(/[^0-9]/g, '');
    if (!number) {
      await say(ctx,
        `📱 *Pairing code*\n\n` +
        `Usage: *pair <phone number with country code>*\n` +
        `Example: *pair 923001234567*\n\n` +
        `You'll get an 8-digit code — enter it on your phone:\n` +
        `WhatsApp > Linked Devices > Link a Device > Link with phone number.`
      );
      return;
    }
    try {
      const code = await ctx.bot.requestPairingCode(number);
      await say(ctx,
        `📱 *Pairing code for ${number}*\n\n` +
        `*${code}*\n\n` +
        `On your phone: WhatsApp > Linked Devices > Link a Device > Link with phone number, then type this code.`
      );
    } catch (e) {
      await say(ctx, `❌ ${e.message || 'Could not generate a pairing code right now.'}`);
    }
  }),

  // 11. verse
  verse: safe(async (ctx, query) => {
    const ref = query.trim();
    if (!/^\d{1,3}:\d{1,3}$/.test(ref)) {
      await say(ctx,
        `📖 *Quran verse*\n\n` +
        `Usage: *verse <surah:ayah>*\n` +
        `Example: *verse 2:255*`
      );
      return;
    }
    const { fetchJsonRetry } = await import('./api-helper.js');
    let data;
    try {
      // quran-uthmani = Arabic text, en.asad = English (Muhammad Asad) translation
      data = await fetchJsonRetry(
        `https://api.alquran.cloud/v1/ayah/${encodeURIComponent(ref)}/editions/quran-uthmani,en.asad`
      );
    } catch (e) {
      await say(ctx, `❌ Couldn't fetch the verse. Check the reference and try again (e.g. *verse 2:255*).`);
      return;
    }
    const editions = data?.data;
    if (!Array.isArray(editions) || editions.length < 2) {
      await say(ctx, `❌ That reference didn't return a verse. Check it (e.g. *verse 2:255*).`);
      return;
    }
    const arabic = editions[0]?.text || '';
    const translation = editions[1]?.text || '';
    const sName = editions[1]?.surah?.englishName || editions[0]?.surah?.englishName || '';
    const sNum = editions[0]?.surah?.number ?? ref.split(':')[0];
    const aNum = editions[0]?.numberInSurah ?? ref.split(':')[1];
    await say(ctx,
      `📖 *Quran ${sNum}:${aNum}*${sName ? ` — Surah ${sName}` : ''}\n\n` +
      `${arabic}\n\n` +
      `_"${translation}"_\n\n` +
      `_Usage: *verse <surah:ayah>*_`
    );
  }),

  // 12. checknum
  checknum: safe(async (ctx, query) => {
    const digits = query.replace(/[^0-9]/g, '');
    if (!digits) {
      await say(ctx,
        `📞 *WhatsApp number check*\n\n` +
        `Usage: *checknum <number with country code>*\n` +
        `Example: *checknum 923001234567*`
      );
      return;
    }
    if (digits.length < 9 || digits.length > 15) {
      await say(ctx, `❌ "*${query}*" doesn't look like a valid phone number (9–15 digits with country code).`);
      return;
    }
    let results;
    try {
      results = await ctx.bot.sock.onWhatsApp(`${digits}@s.whatsapp.net`);
    } catch (e) {
      await say(ctx, `❌ Couldn't check the number right now. Try again later.`);
      return;
    }
    const list = Array.isArray(results) ? results : (results ? [results] : []);
    const hit = list.find(r => r && r.exists) || list[0];
    const onWa = !!(hit && hit.exists);
    const jid = hit?.jid || `${digits}@s.whatsapp.net`;
    const pretty = jid.split('@')[0];
    await say(ctx,
      `📞 *Number check*\n\n` +
      `Number: *${pretty}*\n` +
      `WhatsApp: ${onWa ? '✅ *Yes — this number is on WhatsApp*' : '❌ *No — not registered on WhatsApp*'}\n\n` +
      `_Usage: *checknum <number>*_`
    );
  }),
};

// Aliases (resolved by newfeatures.js)
HANDLERS['pickupline'] = 'pickup';
HANDLERS['film'] = 'movie';
HANDLERS['mv'] = 'movie';
HANDLERS['broadcast'] = 'bcast';

// ─── Post to WhatsApp Channel (2026-10-14, Hudson's request) ───
// Requires the bot's number to be an admin of the channel.
HANDLERS['postchannel'] = safe(async (ctx, q) => {
  const query = (q || '').trim();
  const data = readData('batch8d-channel.json', {});

  // Set the target channel: postchannel set <channel-link-or-jid>
  const setMatch = /^set\s+(.+)$/i.exec(query);
  if (setMatch) {
    let jid = setMatch[1].trim();
    // Extract from whatsapp.com/channel/ link
    const linkMatch = /whatsapp\.com\/channel\/([A-Za-z0-9]+)/.exec(jid);
    if (linkMatch) jid = linkMatch[1] + '@newsletter';
    if (!jid.includes('@')) jid = jid + '@newsletter';
    data[ctx.from] = { channelJid: jid };
    writeData('batch8d-channel.json', data);
    await say(ctx, `📢 *Channel set!*\n\nAb *postchannel <message>* se is channel par post hoga.\n\nChannel: ${jid}`);
    return;
  }

  const cfg = data[ctx.from];
  if (!cfg?.channelJid) {
    await say(ctx,
      `📢 *Post to WhatsApp Channel*\n\n` +
      `Pehle channel set karein:\n*postchannel set <channel-link>*\n\n` +
      `Misaal: *postchannel set https://whatsapp.com/channel/0029Vb5aiit1NCrdTWQDXP3g*\n\n` +
      `Phir post karein: *postchannel <message>*\n\n` +
      `⚠️ Zaroori: bot ka number us channel ka admin hona chahiye.`
    );
    return;
  }

  if (!query) {
    await say(ctx, `📢 *Post to Channel*\n\nIstamal: *postchannel <message>*\nMisaal: *postchannel New video out now!*`);
    return;
  }

  try {
    await ctx.bot.sock.sendMessage(cfg.channelJid, { text: query });
    await say(ctx, `✅ *Channel par post ho gaya!* 📢`);
  } catch (e) {
    console.error('[postchannel]', e.message);
    await say(ctx,
      `❌ Post nahi ho saka.\n\n` +
      `Wajuhat:\n` +
      `• Bot ka number channel ka admin nahi hai\n` +
      `• Channel ka link ghalat hai\n\n` +
      `Channel par jayein → Admins → bot ka number admin banayein, phir dobara try karein.`
    );
  }
});
HANDLERS['channelpost'] = 'postchannel';
HANDLERS['sendchannel'] = 'postchannel';
HANDLERS['sendch'] = 'postchannel';

registerBatch({ MENU_SECTION, WEB_COMMANDS, HANDLERS });
