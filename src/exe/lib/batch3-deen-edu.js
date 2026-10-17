// BATCH 3: Islamic Plus + Education (19 primary features, Roman Urdu UX)
// Helpers/state live here; public web mirror at public/extra-cmds/batch3.js
import { registerBatch, readData, writeData, fmtNum } from './batch-helpers.js';
import { askAI } from './ai.js';
import { getHadith, getPrayerTimes } from './islamic.js';

const DEEN = 'batch3-deen.json';
const EDU = 'batch3-edu.json';
const FETCH_TIMEOUT = 15000;

let botRef = null; // captured from ctx for the hadithday scheduler

async function send(ctx, text) {
  try {
    botRef = ctx.bot || botRef;
    const b = ctx.bot;
    const payload = { text: String(text) };
    if (b && typeof b.sendMessage === 'function') await b.sendMessage(ctx.from, payload);
    else if (b && b.sock && typeof b.sock.sendMessage === 'function') await b.sock.sendMessage(ctx.from, payload);
  } catch (e) { /* handlers never throw */ }
}

async function fetchJson(url) {
  // Robust fetch with retry (2026-10-14 fix for flaky APIs)
  const { fetchJsonRetry } = await import('./api-helper.js');
  return await fetchJsonRetry(url, { timeout: 15000, retries: 2 });
}
async function fetchText(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.text();
}
function pkNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
}
function dayOfYearPK() {
  const n = pkNow();
  const s = new Date(n.getFullYear(), 0, 0);
  return Math.floor((n - s) / 86400000);
}
function readDeen() { return readData(DEEN, {}); }
function saveDeen(d) { writeData(DEEN, d); }
function readEdu() { return readData(EDU, {}); }
function saveEdu(d) { writeData(EDU, d); }

// In-memory pending Q&A (quiz games), scoped per chat
const pending = new Map(); // key -> { kind, ... }
function setPending(chat, obj) { pending.set(chat, obj); }
function getPending(chat) { return pending.get(chat) || null; }
function clearPending(chat) { pending.delete(chat); }

// ---------------- Built-in data ----------------

const SEERAH_QUIZ = [
  { q: 'Nabi Kareem ﷺ ki wiladat kahan hui?', o: ['Madina', 'Makkah', 'Taif', 'Yathrib'], a: 1 },
  { q: 'Wiladat ka mashhoor saal (Eeswi)?', o: ['569', '571', '575', '580'], a: 1 },
  { q: 'Aap ﷺ ke walid ka naam?', o: ['Abdul Muttalib', 'Abdullah', 'Abu Talib', 'Hamza'], a: 1 },
  { q: 'Aap ﷺ ki walida ka naam?', o: ['Khadija', 'Amina', 'Fatima', 'Haleema'], a: 1 },
  { q: 'Pehli wahi kahan nazil hui?', o: ['Ghaar-e-Hira', 'Ghaar-e-Thawr', 'Masjid-e-Nabwi', 'Mina'], a: 0 },
  { q: 'Pehli wahi ka pehla lafz?', o: ['Qul', 'Iqra', 'Alhamd', 'Bismillah'], a: 1 },
  { q: 'Sab se pehle iman lane wale aazad mard?', o: ['Ali (RA)', 'Abu Bakr (RA)', 'Umar (RA)', 'Usman (RA)'], a: 1 },
  { q: 'Sab se pehle iman lane wali khatoon?', o: ['Aisha (RA)', 'Khadija (RA)', 'Fatima (RA)', 'Hafsa (RA)'], a: 1 },
  { q: 'Hijrat-e-Madina kis Hijri saal mein?', o: ['1 Hijri', '2 Hijri', '3 Hijri', '5 Hijri'], a: 0 },
  { q: 'Madina ka purana naam?', o: ['Tayma', 'Yathrib', 'Khaybar', 'Taif'], a: 1 },
  { q: 'Jang-e-Badr kab lari gayi?', o: ['1 Hijri', '2 Hijri', '3 Hijri', '4 Hijri'], a: 1 },
  { q: 'Badr mein Musalmanon ki tadaad?', o: ['1000', '313', '3000', '10000'], a: 1 },
  { q: 'Jang-e-Uhud kab hui?', o: ['2 Hijri', '3 Hijri', '4 Hijri', '5 Hijri'], a: 1 },
  { q: 'Jang-e-Khandaq (Ahzab) kab hui?', o: ['3 Hijri', '4 Hijri', '5 Hijri', '6 Hijri'], a: 2 },
  { q: 'Sulah-e-Hudaybiyyah kab hui?', o: ['5 Hijri', '6 Hijri', '7 Hijri', '8 Hijri'], a: 1 },
  { q: 'Fatah-e-Makkah kab hui?', o: ['6 Hijri', '7 Hijri', '8 Hijri', '9 Hijri'], a: 2 },
  { q: 'Hajjat-ul-Wida kab ada kiya?', o: ['8 Hijri', '9 Hijri', '10 Hijri', '11 Hijri'], a: 2 },
  { q: 'Nabi ﷺ ka wisal kis Hijri saal mein?', o: ['9 Hijri', '10 Hijri', '11 Hijri', '12 Hijri'], a: 2 },
  { q: 'Wisal ke waqt umr mubarak?', o: ['60 saal', '63 saal', '65 saal', '70 saal'], a: 1 },
  { q: 'Pehle Khalifa-e-Rashid kaun?', o: ['Umar (RA)', 'Abu Bakr (RA)', 'Usman (RA)', 'Ali (RA)'], a: 1 },
  { q: 'Quran ki tarteeb mein pehli surah?', o: ['Baqarah', 'Fatiha', 'Ikhlas', 'Yaseen'], a: 1 },
  { q: 'Sab se lambi surah?', o: ['Aal-e-Imran', 'Baqarah', 'Nisa', 'Maida'], a: 1 },
  { q: 'Uhud mein shaheed hone wale chacha?', o: ['Abbas (RA)', 'Hamza (RA)', 'Abu Talib', "Ja'far (RA)"], a: 1 },
  { q: "Meraj ka safar kahan se shuru hua?", o: ['Masjid-e-Haram', 'Masjid-e-Aqsa', 'Masjid-e-Nabwi', 'Mina'], a: 0 },
  { q: 'Habsha ki hijrat mein Musalmanon ke sardar?', o: ["Usman (RA)", "Ja'far Tayyar (RA)", 'Ali (RA)', 'Bilal (RA)'], a: 1 },
  { q: 'Azan ka khwab kis sahabi ne dekha?', o: ['Bilal (RA)', 'Abdullah bin Zaid (RA)', 'Umar (RA)', 'Abu Bakr (RA)'], a: 1 },
  { q: 'Islam ke pehle moazzin?', o: ['Ammar (RA)', 'Bilal Habshi (RA)', 'Salman (RA)', 'Abu Huraira (RA)'], a: 1 },
  { q: 'Nabi ﷺ ki sab se chhoti sahabzadi?', o: ['Zainab (RA)', 'Ruqayya (RA)', 'Fatima (RA)', 'Umm Kulthum (RA)'], a: 2 },
  { q: '"Khatam-un-Nabiyyin" ka matlab?', o: ['Nabiyon ke sardar', 'Aakhri Nabi', 'Pehle Nabi', 'Nabiyon ke ustad'], a: 1 },
  { q: 'Quran ki sab se chhoti surah?', o: ['Ikhlas', 'Kawthar', 'Asr', 'Falaq'], a: 1 },
];

const HIFZ_AYAHS = [
  { ar: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', ur: 'Allah ke naam se jo bara Meherban nihayat Rehem wala hai', ref: 'Al-Fatiha 1:1' },
  { ar: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ', ur: 'Sab tareef Allah ke liye jo tamam jahanon ka Rab hai', ref: 'Al-Fatiha 1:2' },
  { ar: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ', ur: 'Hum teri hi ibadat karte hain aur tujh hi se madad mangte hain', ref: 'Al-Fatiha 1:5' },
  { ar: 'قُلْ هُوَ اللَّهُ أَحَدٌ', ur: 'Keh dijiye: Woh Allah hai, Aik hai', ref: 'Al-Ikhlas 112:1' },
  { ar: 'اللَّهُ الصَّمَدُ', ur: 'Allah be-niyaz hai', ref: 'Al-Ikhlas 112:2' },
  { ar: 'لَمْ يَلِدْ وَلَمْ يُولَدْ', ur: 'Na us ne kisi ko jana aur na woh jana gaya', ref: 'Al-Ikhlas 112:3' },
  { ar: 'وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ', ur: 'Aur us ka koi humsar nahi', ref: 'Al-Ikhlas 112:4' },
  { ar: 'إِنَّا أَعْطَيْنَاكَ الْكَوْثَرَ', ur: 'Beshak hum ne aap ko Kawthar ata kiya', ref: 'Al-Kawthar 108:1' },
  { ar: 'فَصَلِّ لِرَبِّكَ وَانْحَرْ', ur: 'Pas apne Rab ke liye namaz parhiye aur qurbani kijiye', ref: 'Al-Kawthar 108:2' },
  { ar: 'إِنَّ شَانِئَكَ هُوَ الْأَبْتَرُ', ur: 'Beshak aap ka dushman hi be-nam-o-nishan rahega', ref: 'Al-Kawthar 108:3' },
  { ar: 'وَالْعَصْرِ', ur: 'Qasam hai zamane ki', ref: 'Al-Asr 103:1' },
  { ar: 'إِنَّ الْإِنسَانَ لَفِي خُسْرٍ', ur: 'Beshak insan khasare mein hai', ref: 'Al-Asr 103:2' },
  { ar: 'إِلَّا الَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ', ur: 'Siwa un ke jo iman laye aur naik amal kiye', ref: 'Al-Asr 103:3' },
  { ar: 'قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ', ur: 'Keh dijiye: Main subah ke Rab ki panah mangta hun', ref: 'Al-Falaq 113:1' },
  { ar: 'قُلْ أَعُوذُ بِرَبِّ النَّاسِ', ur: 'Keh dijiye: Main logon ke Rab ki panah mangta hun', ref: 'An-Nas 114:1' },
  { ar: 'مَلِكِ النَّاسِ', ur: '(Woh jo) logon ka Badshah hai', ref: 'An-Nas 114:2' },
  { ar: 'إِنَّ اللَّهَ مَعَ الصَّابِرِينَ', ur: 'Beshak Allah sabr karne walon ke sath hai', ref: 'Al-Baqarah 2:153' },
  { ar: 'فَاذْكُرُونِي أَذْكُرْكُمْ', ur: 'Tum mujhe yaad karo, main tumhein yaad karunga', ref: 'Al-Baqarah 2:152' },
  { ar: 'وَهُوَ مَعَكُمْ أَيْنَ مَا كُنتُمْ', ur: 'Aur woh tumhare sath hai jahan bhi tum ho', ref: 'Al-Hadid 57:4' },
  { ar: 'إِنَّ اللَّهَ يُحِبُّ الْمُحْسِنِينَ', ur: 'Beshak Allah ehsan karne walon se mohabbat karta hai', ref: 'Al-Baqarah 2:195' },
  { ar: 'وَقُل رَّبِّ زِدْنِي عِلْمًا', ur: 'Aur kaho: Aye mere Rab, mere ilm mein izafa farma', ref: 'Ta-Ha 20:114' },
  { ar: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً', ur: 'Aye hamare Rab, hamein duniya mein bhalai ata farma', ref: 'Al-Baqarah 2:201' },
  { ar: 'وَأَقِيمُوا الصَّلَاةَ', ur: 'Aur namaz qaim karo', ref: 'Al-Baqarah 2:43' },
  { ar: 'إِنَّ الصَّلَاةَ تَنْهَىٰ عَنِ الْفَحْشَاءِ وَالْمُنكَرِ', ur: 'Beshak namaz behayai aur buri baton se rokti hai', ref: 'Al-Ankabut 29:45' },
  { ar: 'وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا', ur: 'Jo Allah se darta hai, Allah us ke liye (mushkil se) nikalne ka rasta bana deta hai', ref: 'At-Talaq 65:2' },
  { ar: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا', ur: 'Pas beshak tangi ke sath asani hai', ref: 'Ash-Sharh 94:5' },
  { ar: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا', ur: 'Beshak tangi ke sath asani hai', ref: 'Ash-Sharh 94:6' },
  { ar: 'وَلَسَوْفَ يُعْطِيكَ رَبُّكَ فَتَرْضَىٰ', ur: 'Aur anqareeb tumhara Rab tumhein (itna) dega ke tum raazi ho jaoge', ref: 'Ad-Duha 93:5' },
  { ar: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ', ur: 'Yaad rakho! Allah ke zikr se hi dilon ko itminan milta hai', ref: 'Ar-Rad 13:28' },
  { ar: 'أَلَمْ تَرَ كَيْفَ فَعَلَ رَبُّكَ بِأَصْحَابِ الْفِيلِ', ur: 'Kya tum ne nahi dekha ke tumhare Rab ne hathi walon ke sath kya kiya', ref: 'Al-Fil 105:1' },
];

const WORDDAY = [
  { w: 'Serene', en: 'calm and peaceful', ur: 'pursukoon', ex: 'a serene lake at dawn' },
  { w: 'Brave', en: 'ready to face danger', ur: 'bahadur', ex: 'a brave soldier' },
  { w: 'Honest', en: 'truthful', ur: 'imaan-daar', ex: 'an honest answer' },
  { w: 'Generous', en: 'willing to give', ur: 'sakhi', ex: 'a generous host' },
  { w: 'Curious', en: 'eager to learn', ur: 'mutajassis', ex: 'a curious child' },
  { w: 'Patient', en: 'able to wait calmly', ur: 'sabr karne wala', ex: 'be patient' },
  { w: 'Ambitious', en: 'having strong goals', ur: 'buland himmat', ex: 'an ambitious plan' },
  { w: 'Humble', en: 'modest, not proud', ur: 'aajiz', ex: 'a humble request' },
  { w: 'Diligent', en: 'hardworking and careful', ur: 'mehnati', ex: 'a diligent student' },
  { w: 'Fragile', en: 'easily broken', ur: 'nazuk', ex: 'fragile glass' },
  { w: 'Vast', en: 'very large', ur: 'wasee', ex: 'the vast desert' },
  { w: 'Ancient', en: 'very old', ur: 'qadeem', ex: 'an ancient fort' },
  { w: 'Modern', en: 'of present times', ur: 'jadeed', ex: 'modern technology' },
  { w: 'Rapid', en: 'very fast', ur: 'tez raftar', ex: 'rapid growth' },
  { w: 'Silent', en: 'making no sound', ur: 'khamosh', ex: 'a silent night' },
  { w: 'Bright', en: 'full of light', ur: 'roshan', ex: 'a bright future' },
  { w: 'Gloomy', en: 'dark and sad', ur: 'udass', ex: 'a gloomy day' },
  { w: 'Wealthy', en: 'having much money', ur: 'daulatmand', ex: 'a wealthy family' },
  { w: 'Courage', en: 'bravery', ur: 'himmat', ex: 'show courage' },
  { w: 'Wisdom', en: 'deep knowledge', ur: 'hikmat', ex: 'words of wisdom' },
  { w: 'Gratitude', en: 'thankfulness', ur: 'shukr-guzari', ex: 'express gratitude' },
  { w: 'Effort', en: 'hard work', ur: 'koshish', ex: 'make an effort' },
  { w: 'Success', en: 'achieving a goal', ur: 'kamyabi', ex: 'taste success' },
  { w: 'Failure', en: 'not succeeding', ur: 'nakami', ex: 'learn from failure' },
  { w: 'Opportunity', en: 'a good chance', ur: 'mauqa', ex: 'grab the opportunity' },
  { w: 'Challenge', en: 'a difficult task', ur: 'challenge', ex: 'face the challenge' },
  { w: 'Victory', en: 'winning', ur: 'fatah', ex: 'a great victory' },
  { w: 'Defeat', en: 'losing', ur: 'shikast', ex: 'accept defeat' },
  { w: 'Journey', en: 'travelling', ur: 'safar', ex: 'a long journey' },
  { w: 'Destination', en: 'where you go', ur: 'manzil', ex: 'reach your destination' },
  { w: 'Memory', en: 'what you remember', ur: 'yaad', ex: 'sweet memories' },
  { w: 'Dream', en: 'a wish or sleep vision', ur: 'khwab', ex: 'follow your dream' },
  { w: 'Hope', en: 'expecting good', ur: 'umeed', ex: 'never lose hope' },
  { w: 'Fear', en: 'being afraid', ur: 'dar', ex: 'overcome fear' },
  { w: 'Joy', en: 'great happiness', ur: 'khushi', ex: 'tears of joy' },
  { w: 'Sorrow', en: 'deep sadness', ur: 'gham', ex: 'a time of sorrow' },
  { w: 'Anger', en: 'strong upset feeling', ur: 'ghussa', ex: 'control your anger' },
  { w: 'Peace', en: 'calm, no war', ur: 'aman', ex: 'world peace' },
  { w: 'Freedom', en: 'being free', ur: 'azadi', ex: 'fight for freedom' },
  { w: 'Justice', en: 'fairness', ur: 'insaaf', ex: 'demand justice' },
  { w: 'Mercy', en: 'kindness to others', ur: 'rehem', ex: 'show mercy' },
  { w: 'Trust', en: 'belief in someone', ur: 'aitbaar', ex: 'build trust' },
  { w: 'Betray', en: 'to cheat trust', ur: 'dagha dena', ex: 'never betray a friend' },
  { w: 'Forgive', en: 'to pardon', ur: 'maaf karna', ex: 'forgive mistakes' },
  { w: 'Apologize', en: 'to say sorry', ur: 'maazrat karna', ex: 'apologize sincerely' },
  { w: 'Promise', en: 'a commitment', ur: 'wada', ex: 'keep your promise' },
  { w: 'Secret', en: 'hidden thing', ur: 'raaz', ex: 'keep it a secret' },
  { w: 'Mystery', en: 'something unexplained', ur: 'israr', ex: 'solve the mystery' },
  { w: 'Miracle', en: 'amazing event', ur: "mo'jiza", ex: 'a miracle happened' },
  { w: 'Blessing', en: 'a gift from God', ur: 'neemat', ex: 'count your blessings' },
  { w: 'Curse', en: 'a bad wish', ur: 'laanat', ex: 'a terrible curse' },
  { w: 'Wealth', en: 'riches', ur: 'daulat', ex: 'health is wealth' },
  { w: 'Poverty', en: 'being poor', ur: 'ghurbat', ex: 'fight poverty' },
  { w: 'Hunger', en: 'need for food', ur: 'bhook', ex: 'die of hunger' },
  { w: 'Thirst', en: 'need for water', ur: 'pyaas', ex: 'quench your thirst' },
  { w: 'Harvest', en: 'gathering crops', ur: 'fasal katna', ex: 'a rich harvest' },
  { w: 'Drought', en: 'no rain period', ur: 'qahat', ex: 'a severe drought' },
  { w: 'Flood', en: 'too much water', ur: 'sailaab', ex: 'the flood destroyed homes' },
  { w: 'Storm', en: 'violent weather', ur: 'toofan', ex: 'a heavy storm' },
  { w: 'Earthquake', en: 'shaking of earth', ur: 'zalzala', ex: 'a strong earthquake' },
  { w: 'Volcano', en: 'erupting mountain', ur: 'aatish-fishan', ex: 'an active volcano' },
  { w: 'Island', en: 'land in water', ur: 'jazeera', ex: 'a small island' },
  { w: 'Ocean', en: 'huge sea', ur: 'samandar', ex: 'the deep ocean' },
  { w: 'River', en: 'flowing water', ur: 'darya', ex: 'a wide river' },
  { w: 'Mountain', en: 'high land', ur: 'pahar', ex: 'climb the mountain' },
  { w: 'Valley', en: 'low land between hills', ur: 'waadi', ex: 'a green valley' },
  { w: 'Forest', en: 'many trees', ur: 'jangal', ex: 'a dense forest' },
  { w: 'Desert', en: 'dry sandy land', ur: 'sehra', ex: 'cross the desert' },
  { w: 'Garden', en: 'plants area', ur: 'bagh', ex: 'a lovely garden' },
  { w: 'Flower', en: 'bloom', ur: 'phool', ex: 'a red flower' },
  { w: 'Tree', en: 'big plant', ur: 'darakht', ex: 'plant a tree' },
  { w: 'Bird', en: 'flying animal', ur: 'parinda', ex: 'a singing bird' },
  { w: 'Fish', en: 'water animal', ur: 'machhli', ex: 'catch a fish' },
  { w: 'Insect', en: 'small bug', ur: 'keera', ex: 'a tiny insect' },
  { w: 'Animal', en: 'living creature', ur: 'janwar', ex: 'a wild animal' },
  { w: 'Human', en: 'a person', ur: 'insan', ex: 'every human' },
  { w: 'Child', en: 'young person', ur: 'bachcha', ex: 'a happy child' },
  { w: 'Elder', en: 'old person', ur: 'buzurg', ex: 'respect elders' },
  { w: 'Friend', en: 'close companion', ur: 'dost', ex: 'a true friend' },
  { w: 'Enemy', en: 'opponent', ur: 'dushman', ex: 'defeat the enemy' },
  { w: 'Neighbor', en: 'nearby liver', ur: 'parosi', ex: 'a kind neighbor' },
  { w: 'Stranger', en: 'unknown person', ur: 'ajnabi', ex: 'a total stranger' },
  { w: 'Guest', en: 'visitor', ur: 'mehmaan', ex: 'welcome the guest' },
  { w: 'Host', en: 'one who receives', ur: 'mezban', ex: 'a generous host' },
  { w: 'Leader', en: 'one who leads', ur: 'rehnuma', ex: 'a strong leader' },
  { w: 'Follower', en: 'one who follows', ur: 'pairukaar', ex: 'loyal followers' },
  { w: 'Teacher', en: 'one who teaches', ur: 'ustad', ex: 'a kind teacher' },
  { w: 'Student', en: 'learner', ur: 'talib-e-ilm', ex: 'a bright student' },
  { w: 'Doctor', en: 'healer', ur: 'doctor', ex: 'visit the doctor' },
  { w: 'Engineer', en: 'builder/designer', ur: 'engineer', ex: 'a civil engineer' },
  { w: 'Farmer', en: 'crop grower', ur: 'kisaan', ex: 'a hardworking farmer' },
  { w: 'Merchant', en: 'trader', ur: 'tajir', ex: 'a rich merchant' },
  { w: 'Soldier', en: 'army man', ur: 'sipahi', ex: 'a brave soldier' },
  { w: 'King', en: 'ruler', ur: 'badshah', ex: 'the wise king' },
  { w: 'Queen', en: 'female ruler', ur: 'malka', ex: 'the kind queen' },
  { w: 'Servant', en: 'helper', ur: 'naukar', ex: 'a loyal servant' },
  { w: 'Master', en: 'owner/boss', ur: 'maalik', ex: 'serve your master' },
  { w: 'Gift', en: 'present', ur: 'tohfa', ex: 'a birthday gift' },
  { w: 'Prize', en: 'award', ur: 'inaam', ex: 'win a prize' },
  { w: 'Reward', en: 'return for work', ur: 'sila', ex: 'a great reward' },
  { w: 'Punishment', en: 'penalty', ur: 'saza', ex: 'a fair punishment' },
];

const SPELL_WORDS = [
  { w: 'beautiful', h: 'khoobsurat (spelling mushkil!)' },
  { w: 'necessary', h: 'zaroori (c ya s?)' },
  { w: 'occurrence', h: 'waqia hona (double letters!)' },
  { w: 'accommodate', h: 'jagah dena (double c, double m)' },
  { w: 'rhythm', h: 'dhun/leh (koi vowel nahi!)' },
  { w: 'entrepreneur', h: 'karobari shakhs (French lafz)' },
  { w: 'colleague', h: 'saathi (kaam par)' },
  { w: 'definitely', h: 'yaqeenan (a ya i?)' },
  { w: 'separate', h: 'alag (a ya e?)' },
  { w: 'receive', h: 'wasool karna (i pehle ya e?)' },
  { w: 'believe', h: 'yaqeen karna' },
  { w: 'weird', h: 'ajeeb (e pehle!)' },
  { w: 'conscience', h: 'zameer' },
  { w: 'embarrass', h: 'sharminda karna (double r, double s)' },
  { w: 'maintenance', h: 'dekh-bhaal' },
  { w: 'questionnaire', h: 'sawalat-nama' },
  { w: 'vacuum', h: 'khala (double u!)' },
  { w: 'privilege', h: 'istehqaq' },
  { w: 'calendar', h: 'jantri (a ya e?)' },
  { w: 'successful', h: 'kamyab (double s!)' },
  { w: 'tomorrow', h: 'kal (double r)' },
  { w: 'occasion', h: 'mauqa (double c, single s)' },
  { w: 'recommend', h: 'sifarish karna (double m!)' },
  { w: 'beginning', h: 'shuruaat (double n)' },
  { w: 'occurred', h: 'waqia hua (double r)' },
  { w: 'writing', h: 'likhna (e khatm!)' },
  { w: 'grammar', h: 'qawaid (double m)' },
  { w: 'knowledge', h: 'ilm (silent k!)' },
  { w: 'honest', h: 'imaan-daar (silent h!)' },
  { w: 'hour', h: 'ghanta (silent h!)' },
  { w: 'psychology', h: 'nafsiyaat (silent p!)' },
  { w: 'knife', h: 'chhuri (silent k!)' },
  { w: 'island', h: 'jazeera (silent s!)' },
  { w: 'debt', h: 'qarz (silent b!)' },
  { w: 'subtle', h: 'bareek (silent b!)' },
  { w: 'foreign', h: 'ghair-mulki (g pehle!)' },
  { w: 'weight', h: 'wazan (e pehle!)' },
  { w: 'height', h: 'oonchai (e pehle!)' },
  { w: 'leisure', h: 'fursat' },
  { w: 'seize', h: 'qabza karna' },
  { w: 'their', h: 'un ka (e pehle!)' },
  { w: 'there', h: 'wahan' },
  { w: "they're", h: 'woh hain (apostrophe!)' },
  { w: 'your', h: 'tumhara' },
  { w: "you're", h: 'tum ho (apostrophe!)' },
  { w: 'its', h: 'is ka (koi apostrophe nahi!)' },
  { w: "it's", h: 'yeh hai (apostrophe!)' },
  { w: 'than', h: 'se (mawazna)' },
  { w: 'then', h: 'phir (waqt)' },
  { w: 'lose', h: 'khona (single o!)' },
];

const SCIENCE_FACTS = [
  'Insani dimagh mein takreeban 86 billion neurons hote hain.',
  'Roshni ki raftar 299,792 km/sec hai — duniya ki tez tareen cheez.',
  'Paani ka chemical formula H2O hai: 2 hydrogen + 1 oxygen.',
  'Insani jism ka 60% hissa paani hai.',
  'Dil ek din mein takreeban 100,000 baar dharkta hai.',
  'Haddiyan steel se 5 guna zyada mazboot hoti hain (wazan ke lehaz se).',
  'Chand zameen se har saal 3.8 cm door hota ja raha hai.',
  'Suraj zameen se 109 guna bara hai (diameter mein).',
  'Ek bijli ki garaj (lightning) suraj ki satah se 5 guna zyada garam hoti hai.',
  'Shahad (honey) kabhi kharab nahi hota — 3000 saal purana shahad bhi khane layak mila hai.',
  'Octopus ke 3 dil aur 9 dimagh hote hain.',
  'Jellyfish ka dimagh nahi hota.',
  'Cheentiyan (ants) apne wazan se 50 guna zyada utha sakti hain.',
  'Madhumakkhi (bee) ek second mein 200 baar par pharpharati hai.',
  'Insan ki naak 1 trillion khushbuon mein farq kar sakti hai.',
  'Zuban ka print har insan ka alag hota hai — jaise fingerprints.',
  'DNA agar khola jaye to 2 meter lamba hota hai — har cell mein!',
  'Zameen ki umr takreeban 4.5 billion saal hai.',
  'Mount Everest har saal 4 mm ooncha ho raha hai.',
  'Samandar ki sab se gehri jagah Mariana Trench hai — 11 km gehri.',
  'Neem ke darakht ko "village pharmacy" kehte hain — 200+ bimariyon mein faida.',
  'Vitamin C ki kami se scurvy bimari hoti hai.',
  'Hawa mein 78% nitrogen aur 21% oxygen hai.',
  'Ozone layer suraj ki khatarnak UV rays rokti hai.',
  'Paani 100°C par ubalta hai (samandari satah par).',
  'Baraf paani par tairti hai kyun ke us ki density kam hoti hai.',
  'Insani aankh 10 million rangon mein farq kar sakti hai.',
  'Kaan ki sab se chhoti haddi stapes hai — sirf 3 mm.',
  'Bachche 300 haddiyon ke sath paida hote hain, bare 206 reh jati hain.',
  'Nakhun (nails) haddiyon ki tarah keratin se bante hain.',
  'Baal har mahine takreeban 1.25 cm barhte hain.',
  'Sone ke doran dimagh din se zyada active hota hai (kuch hisson mein).',
  'Insan apni zindagi ka 1/3 hissa sote hue guzarta hai.',
  'Coffee mein caffeine dimagh ko jagaye rakhta hai — adenosine block kar ke.',
  'Chaye (tea) duniya ka paani ke baad sab se zyada piya jane wala mashroob hai.',
  'Chawal (rice) duniya ki aadhi abadi ki bunyadi ghiza hai.',
  'Aalu (potato) zameen ke neeche ugta hai — stem tuber hai.',
  'Tamatar phal (fruit) hai, sabzi nahi — botanical lehaz se.',
  'Kela (banana) berry hai — scientific lehaz se!',
  'Strawberry ka beej bahar hota hai — wahid phal.',
  'Seb (apple) paani par tairta hai — 25% hawa hoti hai us mein.',
  'Gajar (carrot) pehle جامنی rang ki hoti thin — narangi Dutch ne banai.',
  'Pyaz katne se aansu is liye aate hain ke sulfur compounds nikalte hain.',
  'Lehsan (garlic) natural antibiotic hai.',
  'Adrak (ginger) ulti/matli mein faida deta hai.',
  'Haldi (turmeric) mein curcumin hai — sozish kam karta hai.',
  'Doodh mein calcium haddiyon ke liye zaroori hai.',
  'Anda (egg) mein protein ka behtareen zariya hai.',
  'Machhli (fish) mein omega-3 dimagh ke liye mufeed hai.',
  'Khajoor (dates) mein iron aur fiber bharpoor hai.',
  'Anar (pomegranate) mein antioxidants seb se 3 guna zyada.',
  'Zaitoon ka tel (olive oil) dil ke liye sab se acha tel hai.',
  'Cheeni zyada khane se diabetes ka khatra barhta hai.',
  'Namak zyada khane se blood pressure barhta hai.',
  'Roz 30 minute walk dil ki bimari ka khatra 35% kam karti hai.',
  'Hasna (laughter) natural painkiller hai — endorphins nikalte hain.',
  'Tanao (stress) se baal safed hote hain — research se sabit.',
  'Mobile ki neeli roshni (blue light) neend kharab karti hai.',
  '8 ghante ki neend bade dimagh ke liye zaroori hai.',
  'Paani kam peene se sar dard hota hai.',
  'Dhoop se vitamin D milta hai — subah ki dhoop behtareen.',
  'Zameen suraj ke gird 107,000 km/hour ki raftar se ghoomti hai.',
  'Ek din mein zameen apne mehwar par ek chakkar lagati hai.',
  'Chand ki roshni suraj ki munaqqas (reflected) roshni hai.',
  'Sitare (stars) apni roshni khud paida karte hain — fusion se.',
  'Suraj ek sitara hai — darmiyani size ka.',
  'Kehkashan (Milky Way) mein 100 billion sitare hain.',
  'Black hole ki gravity itni tez ke roshni bhi nahi nikal sakti.',
  'Mars ko "Red Planet" kehte hain — iron oxide ki wajah se.',
  'Venus sab se garam sayyara hai — 465°C.',
  'Saturn ke gird khubsurat rings hain — baraf aur pathar ke.',
  'Jupiter sab se bara sayyara hai — 1300 zameenen sama jayen.',
  'Budh (Mercury) suraj ke sab se qareeb sayyara hai.',
  'Neptune sab se tez hawaon wala sayyara hai — 2100 km/h.',
  'Zameen wahid sayyara hai jahan zindagi sabit hai.',
  'Oxygen ke baghair insan sirf 3 minute zinda reh sakta hai.',
  'Paani ke baghair 3 din, khane ke baghair 3 hafte — survival rule.',
  'Insani khoon 4 groups mein: A, B, AB, O.',
  'O-negative universal donor hai.',
  'AB-positive universal receiver hai.',
  'Platelets khoon jamne (clotting) mein madad karte hain.',
  'White blood cells bimari se larte hain.',
  'Hemoglobin khoon ko surkh rang deta hai — iron ki wajah se.',
  'Gurde (kidneys) roz 180 liter khoon filter karte hain.',
  'Jigar (liver) jism ka sab se bara internal organ hai.',
  'Phephre (lungs) mein 300 million hawa ki theliyan hain.',
  'Ek chheenk (sneeze) 160 km/h ki raftar se nikalti hai.',
  'Khansi (cough) جراثیم ko bahar nikalne ka qudrati tareeqa hai.',
  'Bukhar (fever) jism ka جراثیم se larne ka hathiyar hai.',
  'Antibiotics virus par asar nahi karte — sirf bacteria par.',
  'Vaccine bemari se pehle hifazat deta hai.',
  'Penicillin pehli antibiotic thi — 1928 mein Alexander Fleming ne daryaft ki.',
  'X-ray 1895 mein Röntgen ne daryaft kiye.',
  'Gravity ko Newton ne seb girne se samjha — 1687.',
  'Einstein ka E=mc² duniya ka mashhoor tareen formula hai.',
  'Bijli (electricity) electrons ke bahao ka naam hai.',
  'Magnet ke hamesha 2 poles hote hain — north aur south.',
  'Awaaz ki raftar hawa mein 343 m/sec hai.',
  'Khala (vacuum) mein awaaz safar nahi kar sakti.',
  'Rang (colors) roshni ki mukhtalif wavelengths hain.',
  'Qaus-e-qaza (rainbow) suraj ki roshni aur baarish ke qatron se banta hai.',
  'Baraf ka tukra (snowflake) hamesha 6 konon wala hota hai.',
  'Registan mein din garam, raat thandi — ret garmi jaldi chhorti hai.',
];

// ---------------- Hijri (Kuwaiti algorithm) ----------------
function gregorianToJDN(y, m, d) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524;
}
function islamicToJDN(y, m, d) {
  return d + Math.ceil(29.5 * (m - 1)) + (y - 1) * 354 + Math.floor((3 + 11 * y) / 30) + 1948439.5 - 1;
}
function jdnToIslamic(jdn) {
  // Inverse of islamicToJDN, with adjustment loops so it always agrees with
  // the forward function (the closed-form year estimate can be off by ±1).
  const jd = Math.floor(jdn) + 0.5;
  let year = Math.floor((30 * (jd - 1948439.5)) / 10631);
  while (islamicToJDN(year + 1, 1, 1) <= jd) year++;
  while (islamicToJDN(year, 1, 1) > jd) year--;
  let month = 1;
  while (month < 12 && islamicToJDN(year, month + 1, 1) <= jd) month++;
  const day = Math.floor(jd - islamicToJDN(year, month, 1) + 1);
  return { y: year, m: month, d: day };
}
function jdnToGregorian(jd) {
  let l = Math.floor(jd) + 68569;
  const n = Math.floor((4 * l) / 146097);
  l = l - Math.floor((146097 * n + 3) / 4);
  const i = Math.floor((4000 * (l + 1)) / 1461001);
  l = l - Math.floor((1461 * i) / 4) + 31;
  const j = Math.floor((80 * l) / 2447);
  const d = l - Math.floor((2447 * j) / 80);
  l = Math.floor(j / 11);
  const m = j + 2 - 12 * l;
  const y = 100 * (n - 49) + i + l;
  return { y, m, d };
}
const HIJRI_MONTHS = ['Muharram', 'Safar', "Rabi-ul-Awwal", "Rabi-us-Sani", 'Jumada-ul-Awwal', 'Jumada-us-Sani', 'Rajab', "Sha'ban", 'Ramadan', 'Shawwal', "Zil-Qad", "Zil-Hajj"];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_UR = { Sunday: 'Itwaar', Monday: 'Peer', Tuesday: 'Mangal', Wednesday: 'Budh', Thursday: 'Jumeraat', Friday: "Jumma", Saturday: 'Hafta' };
function weekdayOfJDN(jdn) { return WEEKDAYS[(Math.floor(jdn) + 1) % 7]; }
function hijriToday() {
  const n = pkNow();
  return jdnToIslamic(gregorianToJDN(n.getFullYear(), n.getMonth() + 1, n.getDate()));
}
function pad2(n) { return String(n).padStart(2, '0'); }

// ---------------- Shared feature helpers ----------------

function qiblaBearing(lat1, lon1) {
  const la1 = lat1 * Math.PI / 180, la2 = 21.4225 * Math.PI / 180;
  const dl = (39.8262 - lon1) * Math.PI / 180;
  const x = Math.sin(dl);
  const y = Math.cos(la1) * Math.tan(la2) - Math.sin(la1) * Math.cos(dl);
  let deg = Math.atan2(x, y) * 180 / Math.PI;
  return (deg + 360) % 360;
}
const WINDS = ['Shamal (N)', 'Shamal-Shamal-Mashriq (NNE)', 'Shamal-Mashriq (NE)', 'Mashriq-Shamal-Mashriq (ENE)', 'Mashriq (E)', 'Mashriq-Junub-Mashriq (ESE)', 'Junub-Mashriq (SE)', 'Junub-Junub-Mashriq (SSE)', 'Junub (S)', 'Junub-Junub-Maghrib (SSW)', 'Junub-Maghrib (SW)', 'Maghrib-Junub-Maghrib (WSW)', 'Maghrib (W)', 'Maghrib-Shamal-Maghrib (WNW)', 'Shamal-Maghrib (NW)', 'Shamal-Shamal-Maghrib (NNW)'];

async function randomHadithText() {
  const books = [
    ['bukhari', 3000], ['muslim', 2000], ['tirmidhi', 2000],
    ['abudawud', 2000], ['nasai', 2000], ['ibnmajah', 1500],
  ];
  let lastErr = null;
  for (let i = 0; i < 4; i++) {
    try {
      const [bk, mx] = books[Math.floor(Math.random() * books.length)];
      const h = await getHadith(bk, 1 + Math.floor(Math.random() * mx));
      const body = h.urdu || h.english || h.arabic || '';
      if (body) return { title: h.book, number: h.number, body };
    } catch (e) { lastErr = e; }
  }
  // built-in fallback (famous, authentic)
  return {
    title: 'Sahih al-Bukhari', number: 1,
    body: 'Beshak aamaal ka daromadar niyyaton par hai, aur har shakhs ke liye wohi hai jis ki us ne niyyat ki. (Innamal aamaalu bin-niyyaat)',
  };
}

const HADITH_BOOKS_FALLBACK = null;

const HAJJ_GUIDE = `🕋 *HAJJ — Step by Step Guide*

*1. Ihram (8 Zil-Hajj)*
Meeqat se ghusl, 2 safed chadrein (mard), niyyat + Talbiyah: "Labbaik Allahumma Labbaik..."

*2. Tawaf-e-Qudum*
Khana-e-Kaaba ke 7 chakkar (counter-clockwise), har chakkar mein dua. Phir Maqam-e-Ibrahim ke peeche 2 nafl.

*3. Sa'i (Safa-Marwa)*
Safa se Marwa tak 7 chakkar, tez qadam mardon ke liye sabz nishan par.

*4. Mina (8 Zil-Hajj raat)*
Mina mein qiyam, 5 namazein parhna.

*5. Arafat (9 Zil-Hajj) — Hajj ka rukn-e-azam*
Zohar-Asr jama, Wuquf-e-Arafat: dua, istighfar, roza mustahab (ghair-haji ke liye).

*6. Muzdalifah (9 ki raat)*
Maghrib-Isha jama, khule aasman tale qiyam, 49/70 kankariyan chunna.

*7. Rami (10-12 Zil-Hajj)*
10 ko sirf Jamra-e-Aqaba (7 kankariyan), phir Qurbani, phir Halq/Qasr (ihram khul gaya).

*8. Tawaf-e-Ziyarat + Wida*
10-12 ke darmiyan Tawaf-e-Ziyarat + Sa'i, rawangi se pehle Tawaf-e-Wida.

🤲 Allah sab ko Hajj-e-Mabroor naseeb farmaye. Ameen.`;

const UMRAH_GUIDE = `🕋 *UMRAH — Mukhtasar Guide*

*1. Ihram* — Meeqat se niyyat + Talbiyah
*2. Tawaf* — Kaaba ke 7 chakkar + 2 nafl
*3. Sa'i* — Safa-Marwa 7 chakkar
*4. Halq/Qasr* — Sar mundwana ya baal katwana

✅ Umrah mukammal! Koshish karein ke har step mein dua aur zikr jari rakhein.`;

const WUDU_STEPS = `💧 *WUDU ka Tareeqa*

1. Niyyat karein (dil mein irada)
2. Bismillah parh kar dono hath gatton tak 3 baar dhoyen
3. 3 baar kulli karein
4. 3 baar naak mein paani charha kar saaf karein
5. Poora chehra 3 baar dhoyen (peshani se thori tak)
6. Dono hath kuhniyon samet 3 baar dhoyen (pehle dayan)
7. Sar ka masah karein (geele hathon se)
8. Kanon ka masah karein
9. Dono paon takhnon samet 3 baar dhoyen (pehle dayan)

🤲 Wudu ke baad ki dua parhna mustahab hai.`;

const GHUSL_STEPS = `🚿 *GHUSL ka Tareeqa*

1. Niyyat karein (paaki ka irada)
2. Bismillah parhein, dono hath dhoyen
3. Sharamgah dhoyen, wudu karein (paon chhor kar)
4. Sar par 3 baar paani bahayein, balon ki jaron tak pohanchayein
5. Dayen kandhe par 3 baar, phir bayen par 3 baar paani bahayein
6. Poore badan par paani bahayein — koi jagah khushk na rahe
7. Aakhir mein paon dho kar ghusl mukammal karein

✅ Ghusl ke faraiz: kulli, naak mein paani, poore badan par paani.`;

function mathProblem(level) {
  const r = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  if (level === 'easy') {
    const a = r(5, 50), b = r(5, 50), op = Math.random() < 0.5 ? '+' : '-';
    return { q: `${a} ${op} ${b}`, a: op === '+' ? a + b : a - b };
  }
  if (level === 'hard') {
    const kind = Math.floor(Math.random() * 3);
    if (kind === 0) { const a = r(12, 30), b = r(12, 30); return { q: `${a} × ${b}`, a: a * b }; }
    if (kind === 1) { const a = r(2, 15); return { q: `${a}²`, a: a * a }; }
    const b = r(3, 12), a = b * r(3, 12);
    return { q: `${a} ÷ ${b}`, a: a / b };
  }
  const op = ['+', '-', '×'][Math.floor(Math.random() * 3)];
  const a = r(10, 99), b = r(10, 99);
  if (op === '×') { const x = r(3, 12), y = r(3, 12); return { q: `${x} × ${y}`, a: x * y }; }
  return { q: `${a} ${op} ${b}`, a: op === '+' ? a + b : a - b };
}

// ---------------- HANDLERS ----------------

export const HANDLERS = {
  // 1. Qibla
  qibla: async (ctx, query) => {
    try {
      const city = (query || '').trim();
      if (!city) { await send(ctx, `🧭 *Qibla Direction*\n\nIstimal: *${ctx.prefix}qibla <sheher>*\nMisal: *${ctx.prefix}qibla Lahore*`); return; }
      const g = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
      const loc = g?.results?.[0];
      if (!loc) { await send(ctx, `😕 "${city}" nahi mila. Koi bara sheher likhein, misal: *${ctx.prefix}qibla Karachi*`); return; }
      const deg = qiblaBearing(loc.latitude, loc.longitude);
      const wind = WINDS[Math.round(deg / 22.5) % 16];
      await send(ctx, `🧭 *Qibla Direction — ${loc.name}${loc.country ? ', ' + loc.country : ''}*\n\n📐 *${deg.toFixed(1)}°* — ${wind}\n\n🕋 Kaaba ki taraf munh kar ke namaz parhein. Mobile ka compass calibarate kar lein behtar natije ke liye.`);
    } catch (e) { await send(ctx, '😟 Qibla maloom nahi ho saka, internet ya sheher ka naam check kar ke dobara try karein.'); }
  },
  qibladir: 'qibla',

  // 2. Zakat
  zakat: async (ctx, query) => {
    try {
      const parts = (query || '').trim().split(/\s+/).filter(Boolean);
      if (parts.length < 4) {
        await send(ctx, `💰 *Zakat Calculator*\n\nIstimal: *${ctx.prefix}zakat <cash> <sona_tola> <chandi_tola> <qarz>*\nSab raqam PKR mein.\nMisal: *${ctx.prefix}zakat 500000 2 5 100000*`);
        return;
      }
      const [cash, goldT, silvT, debts] = parts.map(Number);
      if (parts.some(p => isNaN(Number(p)) || Number(p) < 0)) {
        await send(ctx, '⚠️ Charon values mein sirf positive numbers likhein.\nMisal: *' + ctx.prefix + 'zakat 500000 2 5 100000*');
        return;
      }
      let goldTola = 285000, silvTola = 3400, src = 'andazan';
      try {
        const csvAu = await fetchText('https://stooq.com/q/l/?s=xauusd&f=sd2t2ohlcv&h&e=csv');
        const csvAg = await fetchText('https://stooq.com/q/l/?s=xagusd&f=sd2t2ohlcv&h&e=csv');
        const fx = await fetchJson('https://open.er-api.com/v6/latest/USD');
        const au = parseFloat(csvAu.trim().split('\n')[1].split(',')[6]);
        const ag = parseFloat(csvAg.trim().split('\n')[1].split(',')[6]);
        const pkr = fx?.rates?.PKR;
        if (au > 0 && ag > 0 && pkr > 0) {
          goldTola = (au / 31.1035) * 11.6638 * pkr;
          silvTola = (ag / 31.1035) * 11.6638 * pkr;
          src = 'live rate';
        }
      } catch (e) { /* fallback rates */ }
      const nisab = (silvTola / 11.6638) * 612.36; // 612.36g chandi
      const total = cash + goldT * goldTola + silvT * silvTola - debts;
      let out = `💰 *Zakat Hisab* (${src})\n\n`;
      out += `🥇 Sona: ${fmtNum(goldT)} tola × ${fmtNum(Math.round(goldTola))} = *${fmtNum(Math.round(goldT * goldTola))}*\n`;
      out += `🥈 Chandi: ${fmtNum(silvT)} tola × ${fmtNum(Math.round(silvTola))} = *${fmtNum(Math.round(silvT * silvTola))}*\n`;
      out += `💵 Cash: *${fmtNum(cash)}*\n➖ Qarz: *${fmtNum(debts)}*\n`;
      out += `━━━━━━━━━━━━\n📊 Total maal: *${fmtNum(Math.round(Math.max(total, 0)))} PKR*\n📏 Nisab (612g chandi): *${fmtNum(Math.round(nisab))} PKR*\n\n`;
      if (total >= nisab && total > 0) {
        out += `✅ Zakat wajib hai!\n🕌 *Zakat (2.5%): ${fmtNum(Math.round(total * 0.025))} PKR*`;
      } else {
        out += `ℹ️ Nisab se kam hai — zakat wajib nahi.\n(Allāh mazeed barkat de. Ameen)`;
      }
      await send(ctx, out);
    } catch (e) { await send(ctx, '😟 Zakat calculate nahi ho saki, dobara try karein.'); }
  },
  zakatcalc: 'zakat',

  // 3. Hajj / Umrah
  hajj: async (ctx, query) => {
    try { await send(ctx, (/^umrah/i.test((query || '').trim())) ? UMRAH_GUIDE : HAJJ_GUIDE); }
    catch (e) { await send(ctx, '😟 Guide load nahi ho saki.'); }
  },
  umrah: async (ctx, query) => {
    try { await send(ctx, UMRAH_GUIDE); }
    catch (e) { await send(ctx, '😟 Guide load nahi ho saki.'); }
  },

  // 4. Seerah quiz
  seerahquiz: async (ctx, query) => {
    try {
      const q = (query || '').trim().toLowerCase();
      const d = readDeen();
      d.seerah = d.seerah || {};
      const me = d.seerah[ctx.sender] || { score: 0, played: 0 };
      const letters = ['a', 'b', 'c', 'd'];
      const pend = getPending(ctx.from);
      if (pend && pend.kind === 'seerah' && letters.includes(q)) {
        const item = SEERAH_QUIZ[pend.idx];
        const correct = letters[item.a];
        me.played += 1;
        let msg;
        if (q === correct) { me.score += 1; msg = `✅ *Sahih jawab!* MashaAllah 🌙`; }
        else msg = `❌ Ghalat. Sahih jawab: *${correct.toUpperCase()} — ${item.o[item.a]}*`;
        d.seerah[ctx.sender] = me; saveDeen(d); clearPending(ctx.from);
        await send(ctx, `${msg}\n\n📊 Aap ka score: *${me.score}/${me.played}*\n\nAgla sawal: *${ctx.prefix}seerah*`);
        return;
      }
      const idx = Math.floor(Math.random() * SEERAH_QUIZ.length);
      const item = SEERAH_QUIZ[idx];
      setPending(ctx.from, { kind: 'seerah', idx });
      await send(ctx, `🌙 *Seerah Quiz*\n\n❓ ${item.q}\n\nA) ${item.o[0]}\nB) ${item.o[1]}\nC) ${item.o[2]}\nD) ${item.o[3]}\n\nJawab: *${ctx.prefix}seerah a* (ya b/c/d)\n📊 Score: ${me.score}/${me.played}`);
    } catch (e) { await send(ctx, '😟 Quiz load nahi ho saka, dobara try karein.'); }
  },
  seerah: 'seerahquiz',

  // 5. Hifz tracker
  hifz: async (ctx, query) => {
    try {
      const q = (query || '').trim().toLowerCase();
      const d = readDeen();
      d.hifz = d.hifz || {};
      const me = d.hifz[ctx.sender] || { idx: 0 };
      if (q === 'done') {
        me.idx += 1; d.hifz[ctx.sender] = me; saveDeen(d);
        await send(ctx, `✅ *MashaAllah!* Ayat #${me.idx} yaad ho gayi.\n\n📖 Total yaad: *${me.idx}/${HIFZ_AYAHS.length}*\nAgli ayat: *${ctx.prefix}hifz*`);
        return;
      }
      if (q === 'status') {
        await send(ctx, `📖 *Hifz Tracker*\n\nYaad ki hui ayaat: *${me.idx}/${HIFZ_AYAHS.length}*\n${me.idx >= HIFZ_AYAHS.length ? '🎉 Mukammal! MashaAllah!' : `Agli: *${ctx.prefix}hifz*`}`);
        return;
      }
      if (q) { await send(ctx, `📖 *Hifz*\n\n*${ctx.prefix}hifz* — agli ayat\n*${ctx.prefix}hifz done* — yaad ho gayi\n*${ctx.prefix}hifz status* — progress`); return; }
      const ay = HIFZ_AYAHS[me.idx % HIFZ_AYAHS.length];
      await send(ctx, `📖 *Hifz — Ayat #${(me.idx % HIFZ_AYAHS.length) + 1}*\n\n${ay.ar}\n\n🇵🇰 ${ay.ur}\n📚 _${ay.ref}_\n\nYaad ho jaye to likhein: *${ctx.prefix}hifz done*`);
    } catch (e) { await send(ctx, '😟 Hifz load nahi ho saka.'); }
  },
  memorize: 'hifz',

  // 6. Hadith of the day
  hadithday: async (ctx, query) => {
    try {
      const q = (query || '').trim().toLowerCase();
      const d = readDeen();
      d.hadithSubs = d.hadithSubs || {};
      if (q === 'on' || q === 'subscribe') {
        d.hadithSubs[ctx.from] = true; saveDeen(d);
        await send(ctx, '✅ *Daily Hadith ON!* Roz subah 8 baje hadith milegi. Band karne ke liye: *' + ctx.prefix + 'hadithday off*');
        return;
      }
      if (q === 'off' || q === 'unsubscribe') {
        delete d.hadithSubs[ctx.from]; saveDeen(d);
        await send(ctx, '🔕 Daily Hadith band kar di. Jab chahen *' + ctx.prefix + 'hadithday on* likhein.');
        return;
      }
      if (q) { await send(ctx, `📜 *Hadith of the Day*\n\n*${ctx.prefix}hadithday* — abhi ek hadith\n*${ctx.prefix}hadithday on* — roz subah 8 baje\n*${ctx.prefix}hadithday off* — band karein`); return; }
      const h = await randomHadithText();
      await send(ctx, `📜 *Hadith of the Day*\n📚 ${h.title} — #${h.number}\n\n${h.body.length > 900 ? h.body.slice(0, 900) + '…' : h.body}\n\nRozana ke liye: *${ctx.prefix}hadithday on*`);
    } catch (e) { await send(ctx, '😟 Hadith load nahi ho saki, thori der baad try karein.'); }
  },
  dailyhadith: 'hadithday',

  // 7. Hijri calendar
  hijrical: async (ctx, query) => {
    try {
      const q = (query || '').trim();
      if (!q) { await send(ctx, `📅 *Hijri Calendar*\n\n*${ctx.prefix}hijrical <YYYY-MM-DD>* — Eeswi se Hijri\n*${ctx.prefix}hijrical h <1447-1-1>* — Hijri se Eeswi\nMisal: *${ctx.prefix}hijrical 2026-10-12*`); return; }
      if (/^h\s/i.test(q)) {
        const m = q.slice(1).trim().match(/^(\d{1,4})-(\d{1,2})-(\d{1,2})$/);
        if (!m) { await send(ctx, `⚠️ Format: *${ctx.prefix}hijrical h 1447-1-1*`); return; }
        const [hy, hm, hd] = [Number(m[1]), Number(m[2]), Number(m[3])];
        if (hm < 1 || hm > 12 || hd < 1 || hd > 30) { await send(ctx, '⚠️ Hijri mahina 1-12 aur din 1-30 ke darmiyan likhein.'); return; }
        const jdn = islamicToJDN(hy, hm, hd);
        const g = jdnToGregorian(jdn);
        const wd = weekdayOfJDN(jdn);
        await send(ctx, `📅 *Hijri → Eeswi*\n\n🕌 ${hd} ${HIJRI_MONTHS[hm - 1]} ${hy} Hijri\n📆 ${g.y}-${pad2(g.m)}-${pad2(g.d)} Eeswi\n🗓️ Din: ${wd} (${WEEKDAYS_UR[wd]})`);
        return;
      }
      const m = q.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (!m) { await send(ctx, `⚠️ Format: *${ctx.prefix}hijrical 2026-10-12*`); return; }
      const [gy, gm, gd] = [Number(m[1]), Number(m[2]), Number(m[3])];
      const jdn = gregorianToJDN(gy, gm, gd);
      const h = jdnToIslamic(jdn);
      const wd = weekdayOfJDN(jdn);
      await send(ctx, `📅 *Eeswi → Hijri*\n\n📆 ${gy}-${pad2(gm)}-${pad2(gd)} Eeswi\n🕌 ${h.d} ${HIJRI_MONTHS[h.m - 1]} ${h.y} Hijri\n🗓️ Din: ${wd} (${WEEKDAYS_UR[wd]})`);
    } catch (e) { await send(ctx, '😟 Tareekh convert nahi ho saki.'); }
  },
  dateconvert: 'hijrical',

  // 8. Ramadan
  ramadan: async (ctx, query) => {
    try {
      const city = (query || '').trim();
      const h = hijriToday();
      let targetY = h.y;
      if (h.m < 9) { /* is saal ka Ramadan aana baqi */ }
      else if (h.m === 9) {
        const jdn = islamicToJDN(targetY, 9, 1);
        const g = jdnToGregorian(jdn);
        await send(ctx, `🌙 *Ramadan Mubarak!* Aap Ramadan ke mahine mein hain.\n\n🕌 Aaj: ${h.d} Ramadan ${h.y} Hijri (${g.y}-${pad2(g.m)}-${pad2(g.d)})`);
        if (city) {
          try {
            const p = await getPrayerTimes(city);
            await send(ctx, `⏰ *${p.city} — Sehri/Iftar*\n🌅 Sehri (Fajr): *${p.timings.Fajr}*\n🌇 Iftar (Maghrib): *${p.timings.Maghrib}*`);
          } catch (e) { await send(ctx, `😕 "${city}" ke auqaat nahi mil sakay.`); }
        }
        return;
      } else { targetY = h.y + 1; /* agle Hijri saal ka Ramadan */ }
      const jdnR = islamicToJDN(targetY, 9, 1);
      const gR = jdnToGregorian(jdnR);
      const n = pkNow();
      const days = Math.round((Date.UTC(gR.y, gR.m - 1, gR.d) - Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())) / 86400000);
      let out = `🌙 *Ramadan Countdown*\n\n📅 1 Ramadan ${targetY} Hijri: *${gR.y}-${pad2(gR.m)}-${pad2(gR.d)}*\n⏳ Baqi: *${days} din*\n\n🤲 Allah hamein Ramadan ki barkatein naseeb farmaye.`;
      if (city) {
        try {
          const p = await getPrayerTimes(city);
          out += `\n\n⏰ *${p.city} — Aaj ke auqaat*\n🌅 Sehri end (Fajr): *${p.timings.Fajr}*\n🌇 Iftar (Maghrib): *${p.timings.Maghrib}*`;
        } catch (e) { out += `\n\n😕 "${city}" ke auqaat nahi mil sakay.`; }
      }
      await send(ctx, out);
    } catch (e) { await send(ctx, '😟 Ramadan countdown nahi ho saka.'); }
  },
  ramzan: 'ramadan',

  // 9. Dhikr counter
  dhikr: async (ctx, query) => {
    try {
      const q = (query || '').trim();
      const d = readDeen();
      d.dhikr = d.dhikr || {};
      const me = d.dhikr[ctx.sender] || { counters: {}, current: null };
      const low = q.toLowerCase();
      if (!q) {
        const names = Object.keys(me.counters);
        await send(ctx, `📿 *Zikr Counter*\n\n*${ctx.prefix}dhikr <naam>* — naya/shuru karein (misal: SubhanAllah)\n*${ctx.prefix}dhikr +100* — 100 add karein\n*${ctx.prefix}dhikr total* — sab ka total\n*${ctx.prefix}dhikr reset <naam>* — zero karein\n\n${names.length ? '📿 Aap ke zikr: ' + names.map(n => `${n} (${fmtNum(me.counters[n])})`).join(', ') : 'Abhi koi zikr shuru nahi kiya.'}`);
        return;
      }
      if (low === 'total') {
        const names = Object.keys(me.counters);
        if (!names.length) { await send(ctx, '📿 Abhi koi zikr record nahi. *' + ctx.prefix + 'dhikr SubhanAllah* se shuru karein.'); return; }
        const tot = names.reduce((s, n) => s + me.counters[n], 0);
        await send(ctx, `📿 *Zikr Total*\n\n${names.map(n => `• ${n}: *${fmtNum(me.counters[n])}*`).join('\n')}\n━━━━━━━━━━━━\n📊 Grand total: *${fmtNum(tot)}*`);
        return;
      }
      if (low.startsWith('reset')) {
        const name = q.slice(5).trim() || me.current;
        if (!name || !(name in me.counters)) { await send(ctx, '⚠️ Kis zikr ko reset karna hai? Misal: *' + ctx.prefix + 'dhikr reset SubhanAllah*'); return; }
        me.counters[name] = 0; d.dhikr[ctx.sender] = me; saveDeen(d);
        await send(ctx, `🔄 *${name}* ka counter zero kar diya.`);
        return;
      }
      const addM = q.match(/^\+?(\d+)$/);
      if (addM) {
        const n = Number(addM[1]);
        const name = me.current;
        if (!name) { await send(ctx, `⚠️ Pehle zikr select karein: *${ctx.prefix}dhikr SubhanAllah*`); return; }
        me.counters[name] = (me.counters[name] || 0) + n;
        d.dhikr[ctx.sender] = me; saveDeen(d);
        await send(ctx, `📿 *${name}*: +${fmtNum(n)} → *${fmtNum(me.counters[name])}* total\n\nMazeed: *${ctx.prefix}dhikr +100*`);
        return;
      }
      const name = q;
      me.counters[name] = me.counters[name] || 0;
      me.current = name;
      d.dhikr[ctx.sender] = me; saveDeen(d);
      await send(ctx, `📿 *${name}* select ho gaya! Count: *${fmtNum(me.counters[name])}*\n\nAdd karein: *${ctx.prefix}dhikr +100* ya *${ctx.prefix}dhikr 100*`);
    } catch (e) { await send(ctx, '😟 Zikr counter mein masla hua.'); }
  },
  zikr: 'dhikr',

  // 10. Wudu / Ghusl
  wudu: async (ctx, query) => {
    try {
      const q = (query || '').trim().toLowerCase();
      await send(ctx, q === 'ghusl' ? GHUSL_STEPS : WUDU_STEPS + `\n\nGhusl ka tareeqa: *${ctx.prefix}ghusl*`);
    } catch (e) { await send(ctx, '😟 Guide load nahi ho saki.'); }
  },
  ghusl: async (ctx, query) => {
    try { await send(ctx, GHUSL_STEPS); }
    catch (e) { await send(ctx, '😟 Guide load nahi ho saki.'); }
  },

  // 11. Dictionary
  dictionary: async (ctx, query) => {
    try {
      const word = (query || '').trim().split(/\s+/)[0];
      if (!word) { await send(ctx, `📖 *Dictionary*\n\nUsage: *.dictionary <word>*\nExample: *.dictionary beautiful*`); return; }
      const data = await fetchJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      const e0 = data?.[0];
      if (!e0) { await send(ctx, `😕 "${word}" not found.`); return; }
      const phon = e0.phonetic || e0.phonetics?.find(p => p.text)?.text || '';
      const defs = (e0.meanings?.[0]?.definitions || []).slice(0, 2);
      let urdu = '';
      try {
        const tr = await fetchJson(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|ur`);
        urdu = tr?.responseData?.translatedText || '';
      } catch (e) { /* optional */ }
      let out = `📖 *${e0.word}*${phon ? `  (${phon})` : ''}\n`;
      if (urdu) out += `🇵🇰 Urdu: *${urdu}*\n`;
      out += `\n${defs.map((x, i) => `${i + 1}. ${x.definition}${x.example ? `\n   _"${x.example}"_` : ''}`).join('\n') || 'No definition found.'}`;
      await send(ctx, out);
    } catch (e) { await send(ctx, '😟 Could not load dictionary, check the word and try again.'); }
  },
  dict: 'dictionary',
  lughat: 'dictionary',

  // 12. Word of the day
  wordday: async (ctx, query) => {
    try {
      const w = WORDDAY[dayOfYearPK() % WORDDAY.length];
      await send(ctx, `📝 *Word of the Day*\n\n🔤 *${w.w}*\n💬 Matlab: ${w.en}\n🇵🇰 Urdu: *${w.ur}*\n✏️ Misal: _"${w.ex}"_\n\nKal naya lafz! 🌟`);
    } catch (e) { await send(ctx, '😟 Aaj ka lafz load nahi ho saka.'); }
  },
  dailyword: 'wordday',

  // 13. Spelling quiz
  spellquiz: async (ctx, query) => {
    try {
      const q = (query || '').trim().toLowerCase();
      const d = readEdu();
      d.spell = d.spell || {};
      const me = d.spell[ctx.sender] || { score: 0, played: 0 };
      const pend = getPending(ctx.from);
      if (pend && pend.kind === 'spell' && q) {
        const right = pend.word.toLowerCase();
        me.played += 1;
        let msg;
        if (q === right) { me.score += 1; msg = '✅ *Bilkul sahih!* 🎉'; }
        else msg = `❌ Ghalat. Sahih spelling: *${pend.word}*`;
        d.spell[ctx.sender] = me; saveEdu(d); clearPending(ctx.from);
        await send(ctx, `${msg}\n\n📊 Score: *${me.score}/${me.played}*\n\nAgla lafz: *${ctx.prefix}spellquiz*`);
        return;
      }
      const item = SPELL_WORDS[Math.floor(Math.random() * SPELL_WORDS.length)];
      setPending(ctx.from, { kind: 'spell', word: item.w });
      await send(ctx, `🔤 *Spelling Quiz*\n\n💡 Hint: ${item.h}\n\nSpelling likhein: *${ctx.prefix}spellquiz <spelling>*\n📊 Score: ${me.score}/${me.played}`);
    } catch (e) { await send(ctx, '😟 Quiz load nahi ho saka.'); }
  },
  spelling: 'spellquiz',

  // 14. Math quiz
  mathquiz: async (ctx, query) => {
    try {
      const q = (query || '').trim().toLowerCase();
      const d = readEdu();
      d.math = d.math || {};
      const me = d.math[ctx.sender] || { streak: 0, best: 0 };
      const pend = getPending(ctx.from);
      if (pend && pend.kind === 'math' && q !== '' && !['easy', 'medium', 'hard'].includes(q)) {
        const ans = Number(q);
        let msg;
        if (!isNaN(ans) && Math.abs(ans - pend.a) < 0.001) {
          me.streak += 1; me.best = Math.max(me.best, me.streak);
          msg = `✅ *Sahih!* 🔥 Streak: *${me.streak}*`;
        } else {
          me.streak = 0;
          msg = `❌ Ghalat. Sahih jawab: *${pend.a}* — streak reset, phir se koshish karein!`;
        }
        d.math[ctx.sender] = me; saveEdu(d); clearPending(ctx.from);
        await send(ctx, `${msg}\n🏆 Best streak: ${me.best}\n\nAgla sawal: *${ctx.prefix}mathquiz medium*`);
        return;
      }
      const level = ['easy', 'medium', 'hard'].includes(q) ? q : 'medium';
      const p = mathProblem(level);
      setPending(ctx.from, { kind: 'math', a: p.a });
      await send(ctx, `🧮 *Maths Quiz* (${level})\n\n❓ ${p.q} = ?\n\nJawab: *${ctx.prefix}mathquiz <jawab>*\n🔥 Streak: ${me.streak} | 🏆 Best: ${me.best}`);
    } catch (e) { await send(ctx, '😟 Maths quiz load nahi ho saka.'); }
  },
  ganit: 'mathquiz',

  // 15. Science fact
  sciencefact: async (ctx, query) => {
    try {
      const q = (query || '').trim();
      const n = Number(q);
      let idx;
      if (q && Number.isInteger(n) && n >= 1 && n <= SCIENCE_FACTS.length) idx = n - 1;
      else idx = Math.floor(Math.random() * SCIENCE_FACTS.length);
      await send(ctx, `🔬 *Science Fact #${idx + 1}*\n\n${SCIENCE_FACTS[idx]}\n\nKisi number ka fact: *${ctx.prefix}science 42*`);
    } catch (e) { await send(ctx, '😟 Fact load nahi ho saka.'); }
  },
  science: 'sciencefact',

  // 16. On this day
  onthisday: async (ctx, query) => {
    try {
      const data = await fetchJson('https://history.muffinlabs.com/date');
      const events = (data?.data?.Events || []).slice(0, 3);
      if (!events.length) { await send(ctx, '😕 Aaj ke din ki maloomat nahi mil sakin.'); return; }
      const out = events.map(e => `📌 *${e.year}* — ${String(e.text).slice(0, 220)}`).join('\n\n');
      await send(ctx, `🗓️ *Aaj ke Din — ${data.date || ''}*\n\n${out}`);
    } catch (e) { await send(ctx, '😟 History load nahi ho saki, thori der baad try karein.'); }
  },
  history: 'onthisday',

  // 17. Exam countdown
  examcount: async (ctx, query) => {
    try {
      const q = (query || '').trim();
      const d = readEdu();
      d.exams = d.exams || {};
      const mine = d.exams[ctx.sender] || [];
      if (!q) {
        if (!mine.length) { await send(ctx, `📚 *Exam Countdown*\n\nIstimal: *${ctx.prefix}exam <YYYY-MM-DD> <naam>*\nMisal: *${ctx.prefix}exam 2026-12-15 Board Exams*`); return; }
        const n = pkNow();
        const lines = mine.map(x => {
          const days = Math.round((new Date(x.date + 'T00:00:00') - n) / 86400000);
          return `• *${x.name}* — ${x.date} (${days >= 0 ? days + ' din baqi' : 'ho chuka'})`;
        });
        await send(ctx, `📚 *Aap ke Exams*\n\n${lines.join('\n')}`);
        return;
      }
      const m = q.match(/^(\d{4}-\d{1,2}-\d{1,2})\s+(.+)$/);
      if (!m) { await send(ctx, `⚠️ Format: *${ctx.prefix}exam 2026-12-15 Board Exams*`); return; }
      const [date, name] = [m[1], m[2].slice(0, 60)];
      const n = pkNow();
      const days = Math.round((new Date(date + 'T00:00:00') - n) / 86400000);
      if (days < 0) { await send(ctx, '⚠️ Ye tareekh guzar chuki hai. Aane wali tareekh likhein.'); return; }
      mine.push({ date, name });
      d.exams[ctx.sender] = mine; saveEdu(d);
      let plan = '';
      try {
        plan = await askAI(`2 hafte ka mukhtasar study plan banao (Roman Urdu, 6-8 lines, bullet points) is exam ke liye: "${name}", ${days} din baqi hain.`, ctx.senderName);
      } catch (e) { plan = 'Roz 3 ghante parhein, purane papers hal karein, aakhri 3 din revision.'; }
      await send(ctx, `📚 *Exam Save ho gaya!*\n\n📝 ${name}\n📅 ${date}\n⏳ *${days} din baqi*\n\n📋 *2-Hafte ka Plan:*\n${String(plan).slice(0, 800)}`);
    } catch (e) { await send(ctx, '😟 Exam save nahi ho saka.'); }
  },
  exam: 'examcount',

  // 18. Flashcards
  flashcards: async (ctx, query) => {
    try {
      const q = (query || '').trim();
      const d = readEdu();
      d.flash = d.flash || {};
      const mine = d.flash[ctx.sender] || [];
      const low = q.toLowerCase();
      if (low.startsWith('add ')) {
        const parts = q.slice(4).split('|');
        if (parts.length < 2 || !parts[0].trim() || !parts[1].trim()) {
          await send(ctx, `⚠️ Format: *${ctx.prefix}flash add <sawal> | <jawab>*\nMisal: *${ctx.prefix}flash add Pakistan ka dar-ul-hukumat? | Islamabad*`);
          return;
        }
        mine.push({ q: parts[0].trim().slice(0, 300), a: parts[1].trim().slice(0, 300) });
        d.flash[ctx.sender] = mine; saveEdu(d);
        await send(ctx, `✅ Flashcard #${mine.length} save ho gaya! Total: *${mine.length}*`);
        return;
      }
      if (low === 'list') {
        if (!mine.length) { await send(ctx, `🃏 Abhi koi flashcard nahi. Banayein: *${ctx.prefix}flash add <sawal> | <jawab>*`); return; }
        await send(ctx, `🃏 *Aap ke Flashcards* (${mine.length})\n\n${mine.map((c, i) => `${i + 1}. ${c.q}`).join('\n')}\n\nJawab dekhne: *${ctx.prefix}flash ans* | Delete: *${ctx.prefix}flash del 2*`);
        return;
      }
      if (low.startsWith('del ')) {
        const n = Number(q.slice(4).trim());
        if (!Number.isInteger(n) || n < 1 || n > mine.length) { await send(ctx, `⚠️ Number 1 se ${mine.length} tak likhein.`); return; }
        mine.splice(n - 1, 1);
        d.flash[ctx.sender] = mine; saveEdu(d);
        await send(ctx, `🗑️ Flashcard #${n} delete ho gaya. Baqi: *${mine.length}*`);
        return;
      }
      if (low === 'ans') {
        const pend = getPending(ctx.from);
        if (pend && pend.kind === 'flash' && pend.owner === ctx.sender) {
          clearPending(ctx.from);
          await send(ctx, `💡 *Jawab:* ${pend.a}`);
        } else await send(ctx, `🃏 Pehle card nikalein: *${ctx.prefix}flash*`);
        return;
      }
      if (!mine.length) { await send(ctx, `🃏 Abhi koi flashcard nahi. Banayein: *${ctx.prefix}flash add <sawal> | <jawab>*`); return; }
      const idx = Math.floor(Math.random() * mine.length);
      setPending(ctx.from, { kind: 'flash', a: mine[idx].a, owner: ctx.sender });
      await send(ctx, `🃏 *Flashcard #${idx + 1}*\n\n❓ ${mine[idx].q}\n\nJawab ke liye: *${ctx.prefix}flash ans*`);
    } catch (e) { await send(ctx, '😟 Flashcards mein masla hua.'); }
  },
  flash: 'flashcards',

  // 19. Timetable
  timetable: async (ctx, query) => {
    try {
      const q = (query || '').trim();
      const DAYS = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
      const d = readEdu();
      d.ttable = d.ttable || {};
      const mine = d.ttable[ctx.sender] || {};
      const low = q.toLowerCase();
      if (low === 'week') {
        const keys = Object.keys(DAYS).filter(k => mine[k]?.length);
        if (!keys.length) { await send(ctx, `🗓️ Timetable khaali hai.\n\nSet karein: *${ctx.prefix}ttable mon Math, Physics, Urdu*`); return; }
        await send(ctx, `🗓️ *Hafte ka Timetable*\n\n${keys.map(k => `*${DAYS[k]}:* ${mine[k].join(', ')}`).join('\n')}`);
        return;
      }
      const m = q.match(/^([a-z]{3})\s+(.+)$/i);
      if (m && DAYS[m[1].toLowerCase()]) {
        const day = m[1].toLowerCase();
        mine[day] = m[2].split(',').map(s => s.trim()).filter(Boolean).slice(0, 10);
        d.ttable[ctx.sender] = mine; saveEdu(d);
        await send(ctx, `✅ *${DAYS[day]}* ka timetable save!\n📚 ${mine[day].join(', ')}`);
        return;
      }
      if (!q) {
        const today = pkNow().toLocaleString('en-US', { timeZone: 'Asia/Karachi', weekday: 'short' }).toLowerCase();
        const subs = (mine[today] || []);
        if (!subs.length) { await send(ctx, `🗓️ Aaj (${DAYS[today]}) ka koi schedule nahi.\n\nSet karein: *${ctx.prefix}ttable ${today} Math, Physics*\nPoora hafta: *${ctx.prefix}ttable week*`); return; }
        await send(ctx, `🗓️ *Aaj — ${DAYS[today]}*\n\n${subs.map((s, i) => `${i + 1}. ${s}`).join('\n')}`);
        return;
      }
      await send(ctx, `🗓️ *Timetable*\n\nSet: *${ctx.prefix}ttable <din> <mazameen>*\nDin: mon, tue, wed, thu, fri, sat, sun\nMisal: *${ctx.prefix}ttable mon Math, Physics, Urdu*\n\nAaj ka: *${ctx.prefix}ttable* | Poora: *${ctx.prefix}ttable week*`);
    } catch (e) { await send(ctx, '😟 Timetable mein masla hua.'); }
  },
  ttable: 'timetable',
};

// ---------------- Menu + Web + Registration ----------------

export const MENU_SECTION = `🕌 *14. Islamic Plus*
• *qibla <city>* ➔ Qibla direction degrees
• *zakat <cash gold silver debts>* ➔ Zakat calculator
• *hajj* ➔ Hajj step guide / *umrah*
• *seerah* ➔ Seerah quiz
• *hifz* ➔ Quran hifz tracker
• *hadithday* ➔ Daily hadith (on/off)
• *hijrical <date>* ➔ Gregorian ↔ Hijri
• *ramadan <city>* ➔ Ramadan countdown + Sehri/Iftar
• *dhikr <naam>* ➔ Zikr counter
• *wudu* ➔ Wudu/Ghusl tareeqa

📚 *15. Education*
• *dict <word>* ➔ Dictionary + Urdu meaning
• *wordday* ➔ Daily English word
• *spellquiz* ➔ Spelling game
• *mathquiz <easy|hard>* ➔ Maths practice
• *science* ➔ Daily science fact
• *onthisday* ➔ Aaj ke din history
• *exam <date> <name>* ➔ Exam countdown + plan
• *flash add <q> | <a>* ➔ Flashcards
• *ttable* ➔ Class timetable`;

export const WEB_COMMANDS = [
  { cmd: 'qibla', title: 'Qibla Direction', desc: 'Kisi sheher se Qibla ka rukh degrees mein', usage: 'qibla <city>', section: 'Islamic Plus' },
  { cmd: 'zakat', title: 'Zakat Calculator', desc: 'Cash, sona, chandi, qarz se zakat ka hisab', usage: 'zakat <cash> <gold_tola> <silver_tola> <debts>', section: 'Islamic Plus' },
  { cmd: 'hajj', title: 'Hajj / Umrah Guide', desc: 'Hajj step-by-step aur mukhtasar Umrah guide', usage: 'hajj  /  umrah', section: 'Islamic Plus' },
  { cmd: 'seerahquiz', title: 'Seerah Quiz', desc: 'Seerat-e-Nabvi ﷺ par MCQ quiz aur score', usage: 'seerah  /  seerah a', section: 'Islamic Plus' },
  { cmd: 'hifz', title: 'Quran Hifz Tracker', desc: 'Roz ek ayat yaad karein, progress save ho', usage: 'hifz  /  hifz done  /  hifz status', section: 'Islamic Plus' },
  { cmd: 'hadithday', title: 'Daily Hadith', desc: 'Roz subah 8 baje hadith (subscribe)', usage: 'hadithday  /  hadithday on|off', section: 'Islamic Plus' },
  { cmd: 'hijrical', title: 'Hijri Calendar', desc: 'Eeswi ↔ Hijri tareekh converter', usage: 'hijrical <YYYY-MM-DD>  /  hijrical h <1447-1-1>', section: 'Islamic Plus' },
  { cmd: 'ramadan', title: 'Ramadan Countdown', desc: 'Ramadan countdown + Sehri/Iftar auqaat', usage: 'ramadan <city>', section: 'Islamic Plus' },
  { cmd: 'dhikr', title: 'Zikr Counter', desc: 'Apne azkaar ginain aur save rakhein', usage: 'dhikr <naam>  /  dhikr +100  /  dhikr total', section: 'Islamic Plus' },
  { cmd: 'wudu', title: 'Wudu / Ghusl Tareeqa', desc: 'Wudu aur ghusl ka sahih tareeqa', usage: 'wudu  /  ghusl', section: 'Islamic Plus' },
  { cmd: 'dictionary', title: 'Dictionary', desc: 'English lafz ka matlab + Urdu tarjuma', usage: 'dict <word>', section: 'Education' },
  { cmd: 'wordday', title: 'Word of the Day', desc: 'Roz ek naya English lafz Urdu matlab ke sath', usage: 'wordday', section: 'Education' },
  { cmd: 'spellquiz', title: 'Spelling Quiz', desc: 'Mushkil spellings ka khel, score ke sath', usage: 'spellquiz  /  spellquiz <spelling>', section: 'Education' },
  { cmd: 'mathquiz', title: 'Maths Quiz', desc: 'Hisaab ke sawal, streak system', usage: 'mathquiz <easy|medium|hard>  /  mathquiz <jawab>', section: 'Education' },
  { cmd: 'sciencefact', title: 'Science Fact', desc: 'Roz ek dilchasp science fact', usage: 'science  /  science <n>', section: 'Education' },
  { cmd: 'onthisday', title: 'On This Day', desc: 'Tareekh mein aaj ke din kya hua', usage: 'onthisday', section: 'Education' },
  { cmd: 'examcount', title: 'Exam Countdown', desc: 'Exam countdown + AI study plan', usage: 'exam <YYYY-MM-DD> <naam>', section: 'Education' },
  { cmd: 'flashcards', title: 'Flashcards', desc: 'Apne sawal-jawab cards banayein aur dohrayein', usage: 'flash add <q> | <a>  /  flash  /  flash ans', section: 'Education' },
  { cmd: 'timetable', title: 'Class Timetable', desc: 'Hafte ka timetable save aur dekhein', usage: 'ttable <din> <mazameen>  /  ttable  /  ttable week', section: 'Education' },
];

registerBatch({ MENU_SECTION, WEB_COMMANDS, HANDLERS });

// ---------------- Schedulers ----------------
// Daily hadith: every 60s, fire at 08:00 Asia/Karachi to subscribed chats.
let lastHadithDay = '';
setInterval(async () => {
  try {
    if (!botRef) return;
    const n = pkNow();
    if (n.getHours() !== 8 || n.getMinutes() !== 0) return;
    const dayKey = `${n.getFullYear()}-${n.getMonth() + 1}-${n.getDate()}`;
    if (lastHadithDay === dayKey) return;
    lastHadithDay = dayKey;
    const d = readDeen();
    const subs = Object.keys(d.hadithSubs || {});
    if (!subs.length) return;
    const h = await randomHadithText();
    const text = `📜 *Subah Bakhair! Hadith of the Day*\n📚 ${h.title} — #${h.number}\n\n${h.body.length > 900 ? h.body.slice(0, 900) + '…' : h.body}`;
    for (const chat of subs) {
      try {
        if (typeof botRef.sendMessage === 'function') await botRef.sendMessage(chat, { text });
        else if (botRef.sock?.sendMessage) await botRef.sock.sendMessage(chat, { text });
      } catch (e) { /* one chat failing must not stop others */ }
      await new Promise(r => setTimeout(r, 800));
    }
  } catch (e) { /* scheduler never throws */ }
}, 60 * 1000).unref?.();
