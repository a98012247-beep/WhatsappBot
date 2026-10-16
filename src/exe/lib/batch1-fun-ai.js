// BATCH 1 — Fun & AI (27 primary commands + aliases).
// Self-registers with newfeatures.js via registerBatch() at load time.
// Contract: HANDLERS[name] = async (ctx, query) => {} | alias string.
// ctx = { bot, msg, from, sender, senderName, isGroup, prefix }.
// Handlers NEVER throw: everything is wrapped in try/catch (wrap()).
import { registerBatch, readData, writeData, getMediaBuffer, fmtNum, makeStateStore } from './batch-helpers.js';
import { askAI, callGemini } from './ai.js';
import { Store } from './store.js';
import { getViralMeme } from './memes.js';

export const MENU_SECTION = `🤖 *10. AI Smart Tools*
• *imggen <prompt>* ➔ AI se image banayein
• *editphoto <prompt>* ➔ Photo ka AI stylized version (photo reply karein)
• *summarize <text>* ➔ Lambi text ka khulasa
• *askdoc <sawal>* ➔ Reply kiye message se sawal poochein
• *tr <lang> <text>* ➔ Translator (Misaal: tr en Salam)
• *grammar <text>* ➔ Grammar theek karein
• *letter <topic>* ➔ Application/letter likhein
• *codehelp <code>* ➔ Code samjhein ya fix karein
• *cv <details>* ➔ CV banayein
• *brandname <business>* ➔ Naam + slogans
• *kahani <topic>* ➔ Bachon ki kahani
• *horoscope <star>* ➔ Daily sitara (fun)
• *khwab <khwab>* ➔ Khwab ki tabeer
• *personality* ➔ 5 sawal personality quiz

🎮 *11. Games*
• *tictactoe* ➔ Bot se XO khelein
• *hangman* ➔ Lafz guess karein
• *quiz* ➔ GK quiz + scoreboard
• *truthdare <truth|dare>* ➔ Truth ya dare
• *8ball <sawal>* ➔ Magic jawab
• *rps <rock|paper|scissors>* ➔ Pathar kaichi khelein
• *guessnum* ➔ Number guess (1-100)
• *wordchain <lafz>* ➔ Word chain game
• *emojimovie* ➔ Emoji se movie guess
• *scramble* ➔ Ulte lafz seedhe karein
• *mathduel* ➔ Speed maths challenge
• *gameboard* ➔ Top gamers
• *memecaption <caption>* ➔ Caption ka funny score`;

export const WEB_COMMANDS = [
  { cmd: '!imggen flying cat', desc: 'AI image generator' },
  { cmd: '!editphoto cyberpunk style', desc: 'AI photo editor (photo pe reply karein)' },
  { cmd: '!summarize <lambi text>', desc: 'Text ka khulasa' },
  { cmd: '!askdoc yeh kis bare mein hai?', desc: 'Reply kiye message se sawal' },
  { cmd: '!tr en Salam kya haal hai', desc: 'Translator' },
  { cmd: '!grammar He go to school', desc: 'Grammar fixer' },
  { cmd: '!letter 3 din ki chutti', desc: 'Application/letter writer' },
  { cmd: '!codehelp for loop samjhao', desc: 'Code explainer' },
  { cmd: '!cv Ali, driver, 3 saal tajurba', desc: 'CV builder' },
  { cmd: '!brandname chai ka dhaba', desc: 'Business names + slogans' },
  { cmd: '!kahani bahadur billa', desc: 'Bachon ki kahani' },
  { cmd: '!horoscope aries', desc: 'Daily sitara (fun)' },
  { cmd: '!khwab maine samandar dekha', desc: 'Khwab ki tabeer' },
  { cmd: '!personality', desc: 'Personality quiz' },
  { cmd: '!tictactoe', desc: 'Tic-tac-toe vs bot' },
  { cmd: '!hangman', desc: 'Hangman word game' },
  { cmd: '!quiz', desc: 'GK quiz + scoreboard' },
  { cmd: '!truthdare truth', desc: 'Truth ya dare' },
  { cmd: '!8ball kya main ameer banunga?', desc: 'Magic 8-ball jawab' },
  { cmd: '!rps rock', desc: 'Pathar kaichi kagaz' },
  { cmd: '!guessnum', desc: 'Number guess (1-100)' },
  { cmd: '!wordchain apple', desc: 'Word chain game' },
  { cmd: '!emojimovie', desc: 'Emoji se movie guess' },
  { cmd: '!scramble', desc: 'Ulte lafz seedhe karein' },
  { cmd: '!mathduel', desc: 'Speed maths challenge' },
  { cmd: '!gameboard', desc: 'Top gamers leaderboard' },
  { cmd: '!memecaption jab bijli chali jaye', desc: 'Caption ka funny score' },
];

// ---------- shared helpers ----------
const gameStore = makeStateStore(10 * 60 * 1000);
const SCORE_FILE = 'batch1-games.json';

function wrap(fn) {
  return async (ctx, query) => {
    try {
      await fn(ctx, (query || '').trim());
    } catch (e) {
      console.error('[batch1] handler error:', e.message);
      try { await ctx.bot.sendMessage(ctx.from, '😅 Kuch ghalat ho gaya, dobara try karein!'); } catch {}
    }
  };
}

async function send(ctx, text) {
  try { await ctx.bot.sendMessage(ctx.from, text); } catch {}
}

async function react(ctx, emoji) {
  try {
    await ctx.bot.sock.sendMessage(ctx.from, { react: { text: emoji, key: ctx.msg.key } });
  } catch {}
}

function quotedText(ctx) {
  try {
    const qm = ctx.msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!qm) return '';
    return qm.conversation || qm.extendedTextMessage?.text || '';
  } catch { return ''; }
}

// Cross-batch persona (data/batch-persona.json: chatId -> funny|teacher|formal|poet)
function personaPrefix(from) {
  try {
    const map = readData('batch-persona.json', null);
    const style = map && map[from];
    const lines = {
      funny: 'Jawab mazahiya aur funny andaaz mein do.',
      teacher: 'Ek ustad ki tarah wazeh aur tafseel se samjhao.',
      formal: 'Formal aur tehzeeb-yafta lehje mein jawab do.',
      poet: 'Shayarana lehje mein jawab do.',
    };
    return (style && lines[style]) ? lines[style] + ' ' : '';
  } catch { return ''; }
}

async function askAIp(prompt, ctx) {
  return askAI(personaPrefix(ctx.from) + prompt, ctx.senderName || 'Friend');
}

function loadScores() {
  const s = readData(SCORE_FILE, { quiz: {}, mathduel: {}, guessnum: {} });
  s.quiz = s.quiz || {}; s.mathduel = s.mathduel || {}; s.guessnum = s.guessnum || {};
  return s;
}

const rnd = (n) => Math.floor(Math.random() * n);

// ---------- static data ----------
const HORO_TEMPLATES = [
  'Aaj kismat aap ke sath hai! Koi purani rukawat door hogi. Paison ke mamle mein ehtiyat rakhein. ⭐',
  'Aaj dil khush rahega, doston se mulaqat hogi. Sehat ka khayal rakhein, zyada meetha na khayein. 😊',
  'Kaam mein kamyabi milegi! Boss ya ustad khush honge. Shaam ko achi khabar mil sakti hai. 💼',
  'Aaj sabar ka din hai, jaldbazi nuqsan de sakti hai. Kisi buzurg ki dua lein. 🤲',
  'Mohabbat ke sitaare chamak rahe hain! Koi khaas shakhs aap ko yaad karega. 💕',
  'Safar ka yog hai — chhota safar faida dega. Naye logon se mulaqat hogi. 🧳',
  'Paison ka din hai! Koi ruka hua paisa mil sakta hai. Lekin fazool kharchi se bachein. 💰',
  'Sehat behtar hogi, purani thakan door hogi. Walk ya exercise zaroor karein. 🏃',
  'Aaj aapki baat mein wazan hoga, log sunenge. Koi zaroori faisla le sakte hain. 🗣️',
  'Ghar mein khushiyan! Family ke sath waqt guzarein, koi mehmaan aa sakta hai. 🏠',
  'Parhai ya naye hunar ke liye behtreen din. Dimagh tez chalega. 📚',
  'Aaj muskurahat baantein — kisi ajnabi ki madad karein, dil ko sukoon milega. 😄',
];

const PQ = [
  'Weekend pe sab se zyada kya pasand hai?\n(a) Doston ke sath hangout (b) Akele movie/series (c) Family ke sath waqt (d) Kaam ya parhai',
  'Mushkil waqt mein pehla reaction kya hota hai?\n(a) Dost se baat karta hoon (b) Akele sochta hoon (c) Foran hal nikalta hoon (d) Dua karta hoon',
  'Party mein aap kaise hote hain?\n(a) Center of attention (b) Ek kone mein chill (c) Sab se ghul mil jata hoon (d) Party mein jata hi nahi',
  'Sab se zyada khushi kis mein milti hai?\n(a) Logon ki madad karke (b) Kuch naya seekh ke (c) Kamyabi haasil karke (d) Sukoon se waqt guzar ke',
  'Agar 1 crore mil jaye to kya karenge?\n(a) Business shuru karunga (b) Duniya ghoomunga (c) Ghar walon pe kharch karunga (d) Bacha ke rakhunga',
];

const HW = ('pakistan cricket mango school mobile laptop chai biryani lahore karachi islamabad quetta peshawar ' +
  'multan faisalabad rawalpindi sialkot hyderabad sukkur gujranwala football hockey kabaddi tennis badminton ' +
  'squash boxing swimming racing wrestling book pen pencil paper teacher student exam class lesson homework ' +
  'doctor hospital medicine nurse patient health apple banana orange grapes watermelon peach cherry potato ' +
  'tomato onion carrot bread rice sugar').split(' ');

const SW = ('tiger garden river mountain desert ocean cloud storm thunder rainbow flower tree leaf forest jungle ' +
  'lion elephant monkey zebra camel horse donkey goat sheep cow buffalo chicken duck fish whale shark snake ' +
  'spider butterfly honey sugar salt pepper bread butter cheese milk egg rice wheat chair table window door ' +
  'roof wall light fan bulb mirror clock watch phone radio keyboard').split(' ');

const WC = [...new Set((
  'apple ant aeroplane alarm angel anchor arrow actor area april apron atlas award awake axis anger agree ahead ankle answer artist autumn avocado aisle ' +
  'ball bat boat book baby bird box bell beach boy bus bread brush button banana bench basket belt bicycle blanket board bottle brain brave break ' +
  'cat car cake cup cloud chair clock camel cow crown candy camera candle castle chain cheese chest chicken city coast color comic coral cotton ' +
  'dog door duck drum dance dear deep desk dawn deer dream doctor diamond doll donkey dusk diary dragon daisy ' +
  'elephant egg eagle engine earth east eleven end enjoy envelope elbow eager early echo elder ' +
  'fish fan frog food fox fire five flag flower forest friend fruit frame finger farmer frost ' +
  'goat girl game grape glass garden gate gift gold guitar guest globe grace grade grain green ' +
  'hat house horse hen honey happy heart hero hill hotel hunter harbor hammer habit hail ' +
  'ice igloo ink island iron insect ivory idea image index inner ivy input ' +
  'juice jug jet joker jam jungle jewel jacket jelly job jolly ' +
  'kite king key kitchen knife kitten kettle kind keeper koala kayak ' +
  'lion lemon lamp lake leaf light ladder lady land letter lucky lunch loyal logic ' +
  'mango monkey moon milk map magic melon metal mirror mother mountain mouse music market medal march marble master match ' +
  'nest nose night nail nine north nurse noble noise novel napkin needle ' +
  'orange owl ocean ox office oil onion opera olive orbit organ owner ' +
  'pen pencil parrot pizza plane park peacock peach pearl penny phone photo piano pilot pipe plant plate ' +
  'queen quilt quiz quest quiet quail ' +
  'rabbit rat rose road ring rain river rocket robot radio ready razor record relax ' +
  'sun star snake ship sand soap sugar salt sea shell smile stone storm sweet ' +
  'tiger tree table ten top train tent tower town toast track trade ' +
  'umbrella uncle unicorn uniform unit upset urban used under ' +
  'van violin vote vase value video visit voice vapor ' +
  'whale window water watch woman world wind wheat wheel white winter ' +
  'xerox xray xenon yak yarn yellow yoyo yogurt yummy zebra zoo zone zip zero zest'
).split(/\s+/))];

const QQ = [
  { q: 'Pakistan ka dar-ul-hukumat kaun sa hai?', o: ['Lahore', 'Karachi', 'Islamabad', 'Peshawar'], a: 'c' },
  { q: 'Duniya ka sab se bara samandar kaun sa hai?', o: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], a: 'd' },
  { q: 'Quran ki pehli surah kaun si hai?', o: ['Al-Baqarah', 'Al-Fatiha', 'Al-Ikhlas', 'Yasin'], a: 'b' },
  { q: 'Pakistan ki qomi zaban kaun si hai?', o: ['Punjabi', 'Urdu', 'English', 'Sindhi'], a: 'b' },
  { q: '2 + 2 × 2 = ?', o: ['8', '6', '4', '10'], a: 'b' },
  { q: 'Taj Mahal kahan hai?', o: ['Delhi', 'Agra', 'Jaipur', 'Lucknow'], a: 'b' },
  { q: 'Duniya ki sab se lambi nadi kaun si hai?', o: ['Amazon', 'Nile', 'Ganga', 'Indus'], a: 'b' },
  { q: 'Pakistan ka qomi khel kaun sa hai?', o: ['Cricket', 'Hockey', 'Football', 'Kabaddi'], a: 'b' },
  { q: 'Chand pe pehla qadam kis ne rakha?', o: ['Buzz Aldrin', 'Neil Armstrong', 'Yuri Gagarin', 'Michael Collins'], a: 'b' },
  { q: 'Islam ke pehle khalifa kaun the?', o: ['Hazrat Umar', 'Hazrat Usman', 'Hazrat Ali', 'Hazrat Abu Bakr'], a: 'd' },
  { q: 'K2 ki bulandi kitni hai?', o: ['8611m', '8848m', '8000m', '8125m'], a: 'a' },
  { q: 'Computer ka "dimagh" kya kehlata hai?', o: ['RAM', 'CPU', 'Monitor', 'Keyboard'], a: 'b' },
  { q: 'Sab se tez dorne wala janwar kaun sa hai?', o: ['Sher', 'Cheetah', 'Ghora', 'Hiran'], a: 'b' },
  { q: 'Pakistan ne aazadi kab hasil ki?', o: ['1946', '1947', '1948', '1950'], a: 'b' },
  { q: 'Suraj ke gird zameen ka chakkar kitne din mein poora hota hai?', o: ['360', '364', '365', '366'], a: 'c' },
  { q: '"Allama" ke laqab se kaun mashhoor hai?', o: ['Ghalib', 'Iqbal', 'Faiz', 'Mir'], a: 'b' },
  { q: 'Pani ka chemical formula kya hai?', o: ['CO2', 'H2O', 'O2', 'NaCl'], a: 'b' },
  { q: 'Raqbey ke lihaz se duniya ka sab se bara mulk?', o: ['China', 'USA', 'Russia', 'Canada'], a: 'c' },
  { q: 'Khana Kaaba kis sheher mein hai?', o: ['Madina', 'Jeddah', 'Makkah', 'Taif'], a: 'c' },
  { q: 'Insani jism mein kul kitni haddiyan hoti hain?', o: ['196', '206', '216', '226'], a: 'b' },
  { q: 'Pakistan ka qomi phool kaun sa hai?', o: ['Gulab', 'Chambeli', 'Genda', 'Lotus'], a: 'b' },
  { q: 'Mount Everest ki bulandi kitni hai?', o: ['8848m', '8611m', '8000m', '9000m'], a: 'a' },
  { q: 'Cricket ke ek over mein kitni balls hoti hain?', o: ['5', '6', '8', '10'], a: 'b' },
  { q: 'Telephone kis ne ijad kiya?', o: ['Edison', 'Graham Bell', 'Tesla', 'Newton'], a: 'b' },
  { q: 'Pakistan ki sab se bari masjid kaun si hai?', o: ['Badshahi', 'Faisal', 'Shah Jahan', 'Wazir Khan'], a: 'b' },
  { q: 'Duniya mein sab se zyada boli jane wali zaban?', o: ['English', 'Hindi', 'Mandarin', 'Spanish'], a: 'c' },
  { q: 'Roze kis Islami mahine mein rakhe jate hain?', o: ['Shawwal', 'Ramadan', 'Zil Hajj', 'Muharram'], a: 'b' },
  { q: '15 × 4 = ?', o: ['45', '50', '60', '70'], a: 'c' },
  { q: 'Statue of Liberty kahan hai?', o: ['London', 'Paris', 'New York', 'Rome'], a: 'c' },
  { q: 'Lahore ka mashhoor qila kaun sa hai?', o: ['Rohtas', 'Shahi Qila', 'Bala Hisar', 'Attock'], a: 'b' },
  { q: 'Insani dil mein kitne khane (chambers) hote hain?', o: ['2', '3', '4', '5'], a: 'c' },
  { q: 'Quaid-e-Azam ka poora naam kya tha?', o: ['Muhammad Ali Jinnah', 'Ali Jinnah', 'Muhammad Jinnah', 'Jinnah Khan'], a: 'a' },
  { q: 'Bijli ki taqat (power) ka unit kya hai?', o: ['Watt', 'Volt', 'Ampere', 'Ohm'], a: 'a' },
  { q: 'Pakistan ka qomi darakht kaun sa hai?', o: ['Neem', 'Deodar', 'Peepal', 'Sheesham'], a: 'b' },
  { q: 'Olympic games kitne saal baad hote hain?', o: ['2', '3', '4', '5'], a: 'c' },
  { q: 'Madina mein Nabi ﷺ ki masjid ka naam?', o: ['Masjid Quba', 'Masjid Nabawi', 'Masjid Haram', 'Masjid Aqsa'], a: 'b' },
  { q: 'Zameen ke sab se qareeb sayyara kaun sa hai?', o: ['Mars', 'Venus', 'Mercury', 'Jupiter'], a: 'b' },
  { q: '"Shahnama" kis ne likhi?', o: ['Rumi', 'Firdausi', 'Saadi', 'Hafiz'], a: 'b' },
  { q: '1000 gram barabar kitne kilogram?', o: ['1 kg', '10 kg', '100 kg', '0.1 kg'], a: 'a' },
  { q: 'Abadi ke lihaz se Pakistan ka sab se bara sheher?', o: ['Lahore', 'Karachi', 'Faisalabad', 'Islamabad'], a: 'b' },
];

const TRUTHS = [
  'Apki sab se bari khwahish kya hai?', 'Bachpan ki sab se mazedar yaad kya hai?',
  'Kis cheez se sab se zyada dar lagta hai?', 'School ka sab se funny waqia kya tha?',
  'Konsa khana bilkul nahi kha sakte?', 'Agar ek din ke liye ameer hote to kya karte?',
  'Apka favorite ustad kaun tha aur kyun?', 'Konsi aadat chhorna chahte hain?',
  'Pehli tankhwah pe kya khareeda tha?', 'Sab se zyada pyaar kis se karte hain?',
  'Konsa gaana sun ke mood theek ho jata hai?', 'Agar kahin ghoomne ja sakte to kahan jate?',
  'Zindagi ka sab se bara sabak kya seekha?', 'Subah uth ke sab se pehle kya karte hain?',
  'Konsi movie 10 baar dekh sakte hain?', 'Apne bare mein ek achi baat batayein.',
  'Bachpan mein bare ho ke kya banna chahte the?', 'Konsa kaam sab se mushkil lagta hai?',
  'Eid pe sab se zyada eidi kis se mili?', 'Agar superpower milti to konsi lete?',
  'Sab se ache dost ka naam batayein.', 'Konsa season sab se pasand hai?',
  'Mobile mein sab se zyada konsi app use karte hain?', 'Wo khwab jo abhi tak poora nahi hua?',
  'Apni zindagi ka sab se fakhr wala lamha kaun sa tha?',
];

const DARES = [
  'Apni gallery ki aakhri photo group mein bhejein 📸', '10 pushups lagayein 💪',
  'Apne favorite gaane ki 2 lines likhein 🎵', 'Agle 5 minute tak sirf emojis mein baat karein 😎',
  'Apna sab se funny selfie bhejein 🤳', 'Ulte haath se apna naam likh ke photo bhejein ✍️',
  '30 second tak ek taang pe khare rahein 🦵', 'Apni pasand ka ek sher likhein 📝',
  'Bot ko ek tareef bhejein 😄', 'Apne naam ka matlab Google karke batayein 🔍',
  '"S" se shuru hone wale 5 lafz likhein ⚡', 'Apne sheher ki ek achi baat batayein 🏙️',
  'Ek minute mein 10 janwaron ke naam likhein 🦁', 'Apne dost ko abhi "miss you" ka message bhejein 💌',
  'Pani ka ek glass ek saans mein piyein 💧', 'Apni zubaan se naak chhune ki koshish karein 😜',
  '3 baar tez tez "kachcha papad pakka papad" bolein 🗣️', 'Apne bachpan ki photo dhoond ke bhejein 👶',
  'Agli baat mein khud ko teesre shakhs mein introduce karein 🎤', 'Ek nayi achi aadat ka waada karein 🤝',
  'Apne favorite khane ki recipe 2 lines mein likhein 🍛', 'Bina haathon ke ek biscuit khayein 🍪',
  'Apne phone ka wallpaper dikhayein 📱', '20 se 1 tak ulti ginti likhein 🔢',
  'Group mein sab ko ek dua dein 🤲',
];

const BALL8 = [
  'Bilkul haan! ✅', 'Mushkil lagta hai... 🤔', 'Haan, lekin thoda sabar karo ⏳',
  'Bilkul nahi! ❌', 'Sitare keh rahe hain HAAN 🌟', 'Abhi waqt theek nahi hai 🕐',
  '50-50 chance hai 🎲', 'Mehnat karo, ho jayega 💪', 'Dua maango, phir dekho 🤲',
  'Haan, aur bohot jald! 🎉', 'Shayad... dobara poochho 🔮', 'Iska jawab tum khud jante ho 😉',
  'Nahi, is baar nahi 🙅', 'Haan, bas himmat rakho 🦁', 'Koshish jari rakho, Allah behtar karega 🤲',
  'Bilkul sahi soch rahe ho 👍', 'Thoda risk hai, soch samajh ke ⚠️', 'Haan! Khush khabri qareeb hai 📯',
  'Abhi focus parhai/kaam pe rakho 📚', 'Poochhne ki baat hi nahi, HAAN! 😄',
];

const EM = [
  { e: '🦁👑', m: 'the lion king', t: 'The Lion King' },
  { e: '🚢🧊💔', m: 'titanic', t: 'Titanic' },
  { e: '🕷️🧑', m: 'spiderman', t: 'Spiderman' },
  { e: '🦇🌃', m: 'batman', t: 'Batman' },
  { e: '🧙⚡', m: 'harry potter', t: 'Harry Potter' },
  { e: '🚗💨', m: 'fast and furious', t: 'Fast and Furious' },
  { e: '🦖🏝️', m: 'jurassic park', t: 'Jurassic Park' },
  { e: '❄️👸', m: 'frozen', t: 'Frozen' },
  { e: '🏴‍☠️🦜', m: 'pirates of the caribbean', t: 'Pirates of the Caribbean' },
  { e: '🐼🥋', m: 'kung fu panda', t: 'Kung Fu Panda' },
  { e: '💍🌋', m: 'lord of the rings', t: 'Lord of the Rings' },
  { e: '🚀🌌', m: 'interstellar', t: 'Interstellar' },
  { e: '🎈🏠', m: 'up', t: 'Up' },
  { e: '🐭🧀', m: 'ratatouille', t: 'Ratatouille' },
  { e: '🤖💙', m: 'robot', t: 'Robot' },
  { e: '🧜‍♀️🌊', m: 'the little mermaid', t: 'The Little Mermaid' },
  { e: '👻🚫', m: 'ghostbusters', t: 'Ghostbusters' },
  { e: '🦸🛡️', m: 'captain america', t: 'Captain America' },
  { e: '🐵🌍', m: 'planet of the apes', t: 'Planet of the Apes' },
  { e: '👽🚲', m: 'et', t: 'E.T.' },
];

// ---------- 1-14: AI & SMART TOOLS ----------
const imggen = wrap(async (ctx, q) => {
  if (!q) return send(ctx, '🎨 Misaal: *!imggen flying cat in space*');
  await react(ctx, '🎨');
  try { await ctx.bot.sendPresence(ctx.from, 'composing'); } catch {}
  await send(ctx, '🎨 Image ban rahi hai, thoda sabar karein...');
  const seed = rnd(999999);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(q)}?width=1024&height=1024&nologo=true&seed=${seed}`;
  try {
    await ctx.bot.sock.sendMessage(ctx.from,
      { image: { url }, caption: `🎨 *AwaisxBot AI Image*\nPrompt: ${q}` },
      { quoted: ctx.msg });
  } catch {
    await send(ctx, '😅 Image nahi ban saki, prompt chota karke dobara try karein.');
  }
});

const editphoto = wrap(async (ctx, q) => {
  if (!q) return send(ctx, '🖼️ Kisi photo pe reply karke likhein: *!editphoto cyberpunk style*');
  const media = await getMediaBuffer(ctx.msg, 'image');
  if (!media) return send(ctx, '❌ Koi photo nahi mili! Pehle photo bhejein, phir us pe reply karke *!editphoto <prompt>* likhein.');
  await react(ctx, '🖼️');
  await send(ctx, '🖼️ Photo samajh raha hoon, thoda sabar karein...');
  let desc = '';
  try {
    const { data } = await callGemini(':generateContent', {
      contents: [{ parts: [
        { inlineData: { mimeType: media.mimetype || 'image/jpeg', data: media.buffer.toString('base64') } },
        { text: 'Describe this image in one detailed English sentence.' },
      ] }],
    }, { timeoutMs: 15000 });
    desc = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (e) { console.error('[batch1] editphoto vision:', e.message); }
  if (!desc) return send(ctx, '😅 Photo samajh nahi aayi, dobara try karein.');
  const seed = rnd(999999);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(desc + ', ' + q)}?width=1024&height=1024&nologo=true&seed=${seed}`;
  try {
    await ctx.bot.sock.sendMessage(ctx.from,
      { image: { url }, caption: `📝 Photo pehchani: ${desc}\n🎨 Style: ${q}` },
      { quoted: ctx.msg });
  } catch {
    await send(ctx, '😅 Nayi image nahi ban saki, dobara try karein.');
  }
});

const summarize = wrap(async (ctx, q) => {
  const text = q || quotedText(ctx);
  if (!text) return send(ctx, '📝 Misaal: *!summarize <lambi text>*\nYa kisi message pe reply karke *!summarize* likhein.');
  try { await ctx.bot.sendPresence(ctx.from, 'composing'); } catch {}
  const out = await askAIp('Is text ka mukhtasar khulasa Roman Urdu mein do:\n\n' + text.slice(0, 4000), ctx);
  await send(ctx, '📝 *Khulasa:*\n' + out);
});

const askdoc = wrap(async (ctx, q) => {
  if (!q) return send(ctx, '📄 Kisi text message ya document pe reply karke likhein:\n*!askdoc yeh kis bare mein hai?*');
  let text = quotedText(ctx);
  if (!text) {
    const media = await getMediaBuffer(ctx.msg, 'document');
    if (media && /text|plain/i.test(media.mimetype || '')) {
      try { text = media.buffer.toString('utf8'); } catch {}
    }
  }
  if (!text) return send(ctx, '❌ Reply mein koi text ya document nahi mila!');
  try { await ctx.bot.sendPresence(ctx.from, 'composing'); } catch {}
  const out = await askAIp(`Neeche diye gaye text ki bunyad par is sawal ka jawab do: ${q}\n\nTEXT:\n${text.slice(0, 6000)}`, ctx);
  await send(ctx, '📄 ' + out);
});

const translate = wrap(async (ctx, q) => {
  if (!q) return send(ctx, '🌐 Misaal: *!tr en Salam kya haal hai*\n(en = English, ur = Urdu, ar = Arabic...)');
  // Parse formats: "hello to urdu" | "ur hello" | "en|ur hello" | plain text (default en->ur)
  let target = 'ur', source = 'en', text = q;
  const langNames = { english: 'en', urdu: 'ur', arabic: 'ar', hindi: 'hi', french: 'fr', german: 'de', spanish: 'es', turkish: 'tr', chinese: 'zh', punjabi: 'pa' };
  const toMatch = /^(.+?)\s+to\s+([a-z]+)\s*$/i.exec(q);
  if (toMatch) {
    text = toMatch[1].trim();
    const tName = toMatch[2].toLowerCase();
    target = langNames[tName] || (/^[a-z]{2}$/i.test(tName) ? tName.toLowerCase() : 'ur');
  } else {
    const parts = q.split(/\s+/);
    if (parts.length > 1 && /^[a-z]{2}(-[a-z]{2})?$/i.test(parts[0])) {
      target = parts[0].toLowerCase(); text = parts.slice(1).join(' ');
    }
  }
  // Auto-detect Urdu-script input (2026-10-15): MyMemory free API rejects
  // "auto" source, so detect from script. Urdu text defaults to en target.
  if (/[؀-ۿ]/.test(text)) {
    source = 'ur';
    if (target === 'ur') target = 'en';
  }
  if (!text) return send(ctx, '🌐 Text bhi likhein: *!tr en Salam*');
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source}|${target}`,
      { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error('api ' + res.status);
    const d = await res.json();
    const t = d?.responseData?.translatedText;
    if (!t || /MYMEMORY WARNING/i.test(t)) throw new Error('quota');
    await send(ctx, `🌐 *${target.toUpperCase()}:*\n${t}`);
  } catch (e) {
    console.error('[batch1] translate:', e.message);
    // Fallback (2026-10-15): MyMemory free quota is tiny and rate-limits fast.
    // Use the bot's AI as backup before giving up.
    try {
      const out = await askAIp(`Translate the following text to ${target}. Reply with ONLY the translation, nothing else:\n${text.slice(0, 900)}`, ctx);
      if (!out) throw new Error('empty');
      await send(ctx, `🌐 *${target.toUpperCase()}:*\n${out}`);
    } catch (e2) {
      console.error('[batch1] translate fallback:', e2.message);
      await send(ctx, '😅 Translate nahi ho saka, dobara try karein.');
    }
  }
});

const grammar = wrap(async (ctx, q) => {
  const text = q || quotedText(ctx);
  if (!text) return send(ctx, '✍️ Misaal: *!grammar He go to school yesterday*');
  try { await ctx.bot.sendPresence(ctx.from, 'composing'); } catch {}
  const out = await askAIp('Fix the grammar and spelling, keep the same language, reply only corrected text:\n' + text, ctx);
  await send(ctx, '✍️ *Theek:*\n' + out);
});

const letter = wrap(async (ctx, q) => {
  if (!q) return send(ctx, '💌 Misaal: *!letter 3 din ki chutti ki darkhwast*');
  try { await ctx.bot.sendPresence(ctx.from, 'composing'); } catch {}
  const out = await askAIp('Write a short formal application/letter in English about: ' + q + ' — then a 2-line Roman Urdu summary.', ctx);
  await send(ctx, '💌 *Application:*\n' + out);
});

const codehelp = wrap(async (ctx, q) => {
  if (!q) return send(ctx, '💻 Misaal: *!codehelp for loop kaise kaam karta hai*');
  try { await ctx.bot.sendPresence(ctx.from, 'composing'); } catch {}
  const out = await askAIp('Explain/fix this simply in Roman Urdu:\n' + q, ctx);
  await send(ctx, '💻 ' + out);
});

const cv = wrap(async (ctx, q) => {
  if (!q) return send(ctx, '📋 Misaal: *!cv Ali, driver, 3 saal tajurba, Lahore*');
  try { await ctx.bot.sendPresence(ctx.from, 'composing'); } catch {}
  const out = await askAIp('Is info se ek neat professional CV banao (English, simple WhatsApp-friendly format): ' + q, ctx);
  await send(ctx, '📋 *CV:*\n' + out);
});

const brandname = wrap(async (ctx, q) => {
  if (!q) return send(ctx, '🏷️ Misaal: *!brandname chai ka dhaba*');
  try { await ctx.bot.sendPresence(ctx.from, 'composing'); } catch {}
  const out = await askAIp('Is business ke liye 10 catchy business names aur 5 slogans do (Roman Urdu/English mix allowed): ' + q, ctx);
  await send(ctx, '🏷️ ' + out);
});

const kahani = wrap(async (ctx, q) => {
  if (!q) return send(ctx, '📖 Misaal: *!kahani bahadur billa*');
  try { await ctx.bot.sendPresence(ctx.from, 'composing'); } catch {}
  const out = await askAIp('Bachon ke liye ek chhoti pyari bedtime story likho Roman Urdu mein, achi seekh ke sath. Topic: ' + q, ctx);
  await send(ctx, '📖 *Kahani:*\n' + out);
});

const horoscope = wrap(async (ctx, q) => {
  const stars = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
  if (!q) return send(ctx, '⭐ Misaal: *!horoscope aries*\n(aries, taurus, gemini, cancer, leo, virgo, libra, scorpio, sagittarius, capricorn, aquarius, pisces)');
  const star = q.toLowerCase();
  if (!stars.includes(star)) return send(ctx, '⭐ Star ka naam theek likhein: aries, taurus, gemini... pisces');
  const today = new Date().toISOString().slice(0, 10);
  let seed = 0;
  for (const c of star + today) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  const pick = HORO_TEMPLATES[seed % HORO_TEMPLATES.length];
  await send(ctx, `⭐ *${star.toUpperCase()} — Aaj ka sitara:*\n${pick}\n\n(fun — serious na lein 😄)`);
});

const khwab = wrap(async (ctx, q) => {
  if (!q) return send(ctx, '🌙 Misaal: *!khwab maine samandar dekha*');
  try { await ctx.bot.sendPresence(ctx.from, 'composing'); } catch {}
  const out = await askAIp('Is khwab ki Islami tabeer Roman Urdu mein mukhtasar batao:\n' + q, ctx);
  await send(ctx, '🌙 *Tabeer:*\n' + out);
});

const personality = wrap(async (ctx, q) => {
  const key = (ctx.sender || ctx.from) + ':personality';
  let st = gameStore.get(key);
  if (!st) {
    st = { i: 0, answers: [] };
    gameStore.set(key, st);
    return send(ctx, '🧠 *Personality Quiz!* 5 sawalon ke jawab dein (a/b/c/d).\n\n*Sawal 1/5:*\n' + PQ[0] + '\n\nJawab: *!personality a*');
  }
  if (!q) return send(ctx, `🧠 Jawab dein: *!personality a* (ya b/c/d)\n\n*Sawal ${st.i + 1}/5:*\n` + PQ[st.i]);
  st.answers.push(q.slice(0, 60));
  st.i++;
  if (st.i < PQ.length) {
    gameStore.set(key, st);
    return send(ctx, `*Sawal ${st.i + 1}/5:*\n` + PQ[st.i] + '\n\nJawab: *!personality a*');
  }
  gameStore.del(key);
  try { await ctx.bot.sendPresence(ctx.from, 'composing'); } catch {}
  const out = await askAIp('Is shakhs ke 5 jawabon ki bunyad par uski personality ka fun aur pyara tajziya karo Roman Urdu mein:\n' +
    st.answers.map((a, i) => `Q${i + 1} (${PQ[i].split('\n')[0]}): ${a}`).join('\n'), ctx);
  await send(ctx, '🧠 *Aapki Personality:*\n' + out);
});

// ---------- 15-27: GAMES ----------
function tttRender(b) {
  const e = b.map(c => c || '⬜');
  return `${e[0]}${e[1]}${e[2]}\n${e[3]}${e[4]}${e[5]}\n${e[6]}${e[7]}${e[8]}`;
}
function tttWin(b) {
  const L = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const [a, c, d] of L) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  return b.every(x => x) ? 'draw' : null;
}
const tictactoe = wrap(async (ctx, q) => {
  const key = (ctx.sender || ctx.from) + ':ttt';
  let st = gameStore.get(key);
  if (!st) {
    st = { b: Array(9).fill('') };
    if (!/^[1-9]$/.test(q)) {
      gameStore.set(key, st);
      return send(ctx, '❌⭕ *TicTacToe!* Aap ❌, Bot ⭕\n' + tttRender(st.b) + '\n\nKhelein: *!ttt <1-9>* (cell number)');
    }
  }
  if (!/^[1-9]$/.test(q)) return send(ctx, '1 se 9 tak number dein: *!ttt 5*\n' + tttRender(st.b));
  const i = parseInt(q, 10) - 1;
  if (st.b[i]) return send(ctx, 'Woh khaana bhar gaya hai! Koi aur chunein:\n' + tttRender(st.b));
  st.b[i] = '❌';
  let w = tttWin(st.b);
  if (w) {
    gameStore.del(key);
    return send(ctx, tttRender(st.b) + '\n' + (w === 'draw' ? '🤝 Draw ho gaya!' : '🎉 Aap jeet gaye! Mubarak! 🥳'));
  }
  const empty = st.b.map((v, idx) => (v ? null : idx)).filter(v => v !== null);
  st.b[empty[rnd(empty.length)]] = '⭕';
  w = tttWin(st.b);
  if (w) {
    gameStore.del(key);
    return send(ctx, tttRender(st.b) + '\n' + (w === 'draw' ? '🤝 Draw ho gaya!' : '🤖 Bot jeet gaya! Phir try karein 😎'));
  }
  gameStore.set(key, st);
  return send(ctx, tttRender(st.b) + '\n\nAapki baari: *!ttt <1-9>*');
});

function hmRender(st) {
  const prog = st.word.split('').map(c => (st.guessed.includes(c) ? c : '_')).join(' ');
  return `🔤 ${prog}\n❤️ Lives: ${'❤️'.repeat(Math.max(st.lives, 0)) || '—'}\n📝 Guessed: ${st.guessed.join(', ') || '-'}`;
}
const hangman = wrap(async (ctx, q) => {
  const key = (ctx.sender || ctx.from) + ':hangman';
  let st = gameStore.get(key);
  if (!st) {
    st = { word: HW[rnd(HW.length)], guessed: [], lives: 6 };
    gameStore.set(key, st);
    return send(ctx, '🎯 *Hangman!* Lafz guess karein, 6 zindagiyan.\n' + hmRender(st) + '\n\nGuess: *!hangman <letter>*');
  }
  const letter = (q.toLowerCase().match(/[a-z]/) || [])[0];
  if (!letter) return send(ctx, 'Ek English letter guess karein: *!hangman a*\n' + hmRender(st));
  if (st.guessed.includes(letter)) return send(ctx, `'${letter}' pehle guess ho chuka hai!\n` + hmRender(st));
  st.guessed.push(letter);
  if (!st.word.includes(letter)) st.lives--;
  if (st.word.split('').every(c => st.guessed.includes(c))) {
    gameStore.del(key);
    return send(ctx, `🎉 *Jeet gaye!* Lafz tha: *${st.word.toUpperCase()}* 🥳`);
  }
  if (st.lives <= 0) {
    gameStore.del(key);
    return send(ctx, `💀 *Haar gaye!* Lafz tha: *${st.word.toUpperCase()}*\nPhir try karein: *!hangman*`);
  }
  gameStore.set(key, st);
  return send(ctx, hmRender(st) + '\n\nGuess: *!hangman <letter>*');
});

const quizgame = wrap(async (ctx, q) => {
  const key = (ctx.sender || ctx.from) + ':quiz';
  let st = gameStore.get(key);
  if (!st) {
    const item = QQ[rnd(QQ.length)];
    st = { item };
    gameStore.set(key, st);
    return send(ctx, `❓ *Quiz:*\n${item.q}\nA) ${item.o[0]}\nB) ${item.o[1]}\nC) ${item.o[2]}\nD) ${item.o[3]}\n\nJawab: *!quiz b*`);
  }
  const ans = (q.toLowerCase()[0] || '');
  if (!['a', 'b', 'c', 'd'].includes(ans)) return send(ctx, 'a, b, c ya d mein jawab dein: *!quiz b*');
  gameStore.del(key);
  const correct = ans === st.item.a;
  const scores = loadScores();
  const id = ctx.sender;
  scores.quiz[id] = scores.quiz[id] || { name: ctx.senderName || 'Player', score: 0 };
  if (scores.quiz[id].name === 'Player' && ctx.senderName) scores.quiz[id].name = ctx.senderName;
  if (correct) scores.quiz[id].score++;
  writeData(SCORE_FILE, scores);
  return send(ctx, correct
    ? `✅ *Sahi jawab!* 🎉 (Aapka score: ${scores.quiz[id].score})`
    : `❌ Ghalat! Sahi jawab tha: *${st.item.a.toUpperCase()}* (${st.item.o['abcd'.indexOf(st.item.a)]})`);
});

const truthdare = wrap(async (ctx, q) => {
  const c = q.toLowerCase();
  if (c !== 'truth' && c !== 'dare') {
    return send(ctx, '😏 Likhein: *!truthdare truth* ya *!truthdare dare*');
  }
  const pick = c === 'truth' ? TRUTHS[rnd(TRUTHS.length)] : DARES[rnd(DARES.length)];
  return send(ctx, (c === 'truth' ? '🙊 *Truth:*\n' : '🔥 *Dare:*\n') + pick);
});

const eightball = wrap(async (ctx, q) => {
  if (!q) return send(ctx, '🔮 Misaal: *!8ball kya main ameer banunga?*');
  await send(ctx, `🔮 *${q}*\n\n${BALL8[rnd(BALL8.length)]}`);
});

const rps = wrap(async (ctx, q) => {
  const map = { rock: 'rock', r: 'rock', pathar: 'rock', paper: 'paper', p: 'paper', kagaz: 'paper', scissors: 'scissors', s: 'scissors', kaichi: 'scissors', kainchi: 'scissors' };
  const c = map[q.toLowerCase()];
  if (!c) return send(ctx, '✊✋✌️ Likhein: *!rps rock* / *paper* / *scissors*\n(ya: r/p/s, pathar/kagaz/kaichi)');
  const bot = ['rock', 'paper', 'scissors'][rnd(3)];
  const EMO = { rock: '✊', paper: '✋', scissors: '✌️' };
  const NAME = { rock: 'Pathar', paper: 'Kagaz', scissors: 'Kaichi' };
  let res;
  if (c === bot) res = '🤝 Draw!';
  else if ((c === 'rock' && bot === 'scissors') || (c === 'paper' && bot === 'rock') || (c === 'scissors' && bot === 'paper')) res = '🎉 Aap jeet gaye!';
  else res = '🤖 Bot jeet gaya!';
  await send(ctx, `Aap: ${EMO[c]} ${NAME[c]}  vs  Bot: ${EMO[bot]} ${NAME[bot]}\n${res}`);
});

const guessnum = wrap(async (ctx, q) => {
  const key = (ctx.sender || ctx.from) + ':guessnum';
  let st = gameStore.get(key);
  if (!st) {
    st = { n: 1 + rnd(100), tries: 0 };
    gameStore.set(key, st);
    return send(ctx, '🔢 *Guess the Number!* 1 se 100 tak socha hai.\nAndaza lagayein: *!guessnum 50*');
  }
  const g = parseInt(q, 10);
  if (!g || g < 1 || g > 100) return send(ctx, '1 se 100 tak number likhein: *!guessnum 50*');
  st.tries++;
  if (g === st.n) {
    gameStore.del(key);
    const scores = loadScores();
    const id = ctx.sender;
    const prev = scores.guessnum[id]?.best ?? 999;
    scores.guessnum[id] = { name: ctx.senderName || 'Player', best: Math.min(prev, st.tries) };
    writeData(SCORE_FILE, scores);
    return send(ctx, `🎉 *Sahi!* Number *${st.n}* tha — ${st.tries} koshishon mein! 🥳`);
  }
  gameStore.set(key, st);
  return send(ctx, g < st.n ? `📈 Aur *bara* sochiye! (koshish ${st.tries})` : `📉 Aur *chhota* sochiye! (koshish ${st.tries})`);
});

const wordchain = wrap(async (ctx, q) => {
  const key = (ctx.sender || ctx.from) + ':wordchain';
  const w = q.toLowerCase().replace(/[^a-z]/g, '');
  let st = gameStore.get(key);
  const botReply = (usedList, fromLetter) => {
    const cand = WC.filter(x => x[0] === fromLetter && !usedList.includes(x));
    return cand.length ? cand[rnd(cand.length)] : null;
  };
  if (!st) {
    if (!w) return send(ctx, '🔗 Koi English lafz likhein shuru karne ke liye: *!wordchain apple*');
    const bw = botReply([w], w[w.length - 1]);
    if (!bw) return send(ctx, `😅 '${w}' ke baad koi lafz nahi mila — aap jeet gaye! 🎉`);
    gameStore.set(key, { last: bw, used: [w, bw] });
    return send(ctx, `🔗 Aap: *${w}* → Bot: *${bw}*\nAapki baari ('${bw[bw.length - 1]}' se shuru ho): *!wordchain <lafz>*`);
  }
  if (!w) return send(ctx, `🔗 '${st.last[st.last.length - 1]}' se shuru hone wala lafz likhein: *!wordchain <lafz>*`);
  if (w[0] !== st.last[st.last.length - 1]) return send(ctx, `❌ Lafz *'${st.last[st.last.length - 1]}'* se shuru hona chahiye! Dobara: *!wordchain <lafz>*`);
  if (st.used.includes(w)) return send(ctx, '❌ Yeh lafz pehle aa chuka hai! Koi naya lafz likhein.');
  st.used.push(w);
  const bw = botReply(st.used, w[w.length - 1]);
  if (!bw) {
    gameStore.del(key);
    return send(ctx, '🎉 *Kamaal!* Bot ke paas jawab nahi — aap jeet gaye! 🥳');
  }
  st.used.push(bw);
  st.last = bw;
  gameStore.set(key, st);
  return send(ctx, `🔗 Aap: *${w}* → Bot: *${bw}*\nAapki baari ('${bw[bw.length - 1]}' se): *!wordchain <lafz>*`);
});

const emojimovie = wrap(async (ctx, q) => {
  const key = (ctx.sender || ctx.from) + ':emojimovie';
  let st = gameStore.get(key);
  if (!st) {
    const item = EM[rnd(EM.length)];
    st = { item };
    gameStore.set(key, st);
    return send(ctx, `🎬 *Emoji Movie!* In emojis se movie pehchanein:\n\n${item.e}\n\nGuess: *!emojimovie <movie ka naam>*`);
  }
  const g = q.toLowerCase().replace(/[^a-z ]/g, '').trim();
  if (!g) return send(ctx, `🎬 ${st.item.e}\n\nGuess karein: *!emojimovie <movie>*`);
  const target = st.item.m;
  if (g === target || (g.length > 3 && (target.includes(g) || g.includes(target)))) {
    gameStore.del(key);
    return send(ctx, `🎉 *Sahi!* Movie thi: *${st.item.t}* 🥳`);
  }
  return send(ctx, '❌ Ghalat! Phir try karein. 🍿');
});

function scrambledWord(w) {
  const a = w.split('');
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  const s = a.join('');
  return s === w ? scrambledWord(w) : s;
}
const scramble = wrap(async (ctx, q) => {
  const key = (ctx.sender || ctx.from) + ':scramble';
  let st = gameStore.get(key);
  if (!st) {
    const word = SW[rnd(SW.length)];
    st = { word };
    gameStore.set(key, st);
    return send(ctx, `🔀 *Unscramble!* In bikhre huroof ko seedha karein:\n\n*${scrambledWord(word).toUpperCase().split('').join(' ')}*\n\nJawab: *!scramble <lafz>*`);
  }
  const g = q.toLowerCase().replace(/[^a-z]/g, '');
  if (!g) return send(ctx, 'Lafz likhein: *!scramble tiger*');
  if (g === st.word) {
    gameStore.del(key);
    return send(ctx, `🎉 *Sahi!* Lafz tha: *${st.word.toUpperCase()}* 🥳`);
  }
  return send(ctx, '❌ Ghalat! Phir try karein. 🔀');
});

const mathduel = wrap(async (ctx, q) => {
  const key = (ctx.sender || ctx.from) + ':mathduel';
  let st = gameStore.get(key);
  if (!st) {
    const ops = ['+', '-', '×'];
    const op = ops[rnd(ops.length)];
    const a = 2 + rnd(48), b = 2 + rnd(48);
    const ans = op === '+' ? a + b : op === '-' ? a - b : a * b;
    st = { ans, t: Date.now() };
    gameStore.set(key, st);
    return send(ctx, `⚡ *Math Duel!* 60 second mein jawab dein:\n\n*${a} ${op} ${b} = ?*\n\nJawab: *!mathduel <answer>*`);
  }
  if (Date.now() - st.t > 60000) {
    gameStore.del(key);
    return send(ctx, `⏰ *Time khatam!* Jawab tha *${st.ans}*.\nDobara: *!mathduel*`);
  }
  const g = parseInt(q, 10);
  if (isNaN(g)) return send(ctx, 'Number mein jawab dein: *!mathduel 42*');
  if (g === st.ans) {
    const secs = Math.round((Date.now() - st.t) / 1000);
    gameStore.del(key);
    const scores = loadScores();
    const id = ctx.sender;
    scores.mathduel[id] = scores.mathduel[id] || { name: ctx.senderName || 'Player', wins: 0, best: 999 };
    if (scores.mathduel[id].name === 'Player' && ctx.senderName) scores.mathduel[id].name = ctx.senderName;
    scores.mathduel[id].wins++;
    scores.mathduel[id].best = Math.min(scores.mathduel[id].best, secs);
    writeData(SCORE_FILE, scores);
    return send(ctx, `🎉 *Sahi!* Sirf ${secs}s mein! ⚡ (Jeet: ${scores.mathduel[id].wins})`);
  }
  return send(ctx, '❌ Ghalat! Phir try karein. ⚡');
});

const gameboard = wrap(async (ctx) => {
  const scores = loadScores();
  const agg = {};
  const add = (id, name, pts) => {
    if (!pts) return;
    agg[id] = agg[id] || { name: name || 'Player', pts: 0 };
    if (agg[id].name === 'Player' && name) agg[id].name = name;
    agg[id].pts += pts;
  };
  for (const [id, s] of Object.entries(scores.quiz)) add(id, s.name, (s.score || 0) * 10);
  for (const [id, s] of Object.entries(scores.mathduel)) add(id, s.name, (s.wins || 0) * 10);
  for (const [id, s] of Object.entries(scores.guessnum)) add(id, s.name, s.best < 999 ? Math.max(1, 20 - s.best) : 0);
  const top = Object.entries(agg).sort((a, b) => b[1].pts - a[1].pts).slice(0, 10);
  if (!top.length) return send(ctx, '🏆 Abhi koi score nahi!\n*!quiz*, *!mathduel* ya *!guessnum* khelein aur score banayein.');
  let out = '🏆 *Top Gamers:*\n';
  top.forEach(([id, s], i) => { out += `${i + 1}. ${s.name} — ${fmtNum(s.pts)} pts\n`; });
  await send(ctx, out);
});

const memecaption = wrap(async (ctx, q) => {
  if (!q) return send(ctx, '😂 Misaal: *!memecaption jab bijli chali jaye aur mobile 1% ho*');
  try { await ctx.bot.sendPresence(ctx.from, 'composing'); } catch {}
  try {
    const meme = await getViralMeme();
    if (meme?.url) {
      try {
        const mcap = '😂 *Meme of the moment!*\nAb is pe apki caption ka score...';
        // GIFs need gifPlayback to animate on mobile (2026-10-15).
        const mpayload = /\.gif(\?|$)/i.test(meme.url || '')
          ? { video: { url: meme.url }, caption: mcap, gifPlayback: true }
          : { image: { url: meme.url }, caption: mcap };
        await ctx.bot.sock.sendMessage(ctx.from, mpayload,
          { quoted: ctx.msg });
      } catch {}
    }
  } catch (e) { console.error('[batch1] memecaption meme:', e.message); }
  const out = await askAIp(`Is meme caption ko 1 se 10 tak funny score do aur ek mazahiya comment bhi likho (Roman Urdu, mukhtasar): "${q.slice(0, 200)}"`, ctx);
  await send(ctx, '😂 *Caption Score:*\n' + out);
});

// ---------- registry ----------
export const HANDLERS = {
  imggen, imagegen: 'imggen', aiphoto: 'imggen',
  editphoto, aiedit: 'editphoto',
  summarize, sum: 'summarize', khulasa: 'summarize',
  askdoc, pdfask: 'askdoc',
  translate, tr: 'translate', tarjuma: 'translate',
  grammar, fixgrammar: 'grammar',
  letter, darkhwast: 'letter', application: 'letter',
  codehelp, code: 'codehelp',
  cv, resume: 'cv',
  brandname, slogan: 'brandname',
  kahani,
  horoscope, sitara: 'horoscope',
  khwab, dream: 'khwab',
  personality, personalityquiz: 'personality', quizme: 'personality',
  tictactoe, ttt: 'tictactoe',
  hangman, phansi: 'hangman',
  quizgame, quiz: 'quizgame',
  truthdare, td: 'truthdare',
  '8ball': eightball, magic8: '8ball',
  rps, mora: 'rps',
  guessnum, guess: 'guessnum',
  wordchain, wordlink: 'wordchain',
  emojimovie, movieemoji: 'emojimovie',
  scramble, ultapulta: 'scramble',
  mathduel, mathfight: 'mathduel',
  gameboard, topgamers: 'gameboard',
  memecaption, captioncontest: 'memecaption',
};

registerBatch({ MENU_SECTION, WEB_COMMANDS, HANDLERS });
