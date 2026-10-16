import sharp from 'sharp';

/**
 * Top Viral Desi & Global Meme Sounds (High-Speed Open Source CDN)
 */
export const MEME_SOUNDS = [
  // --- VIRAL FUNNY SONGS & TUNES ---
  { name: 'moye moye', category: 'Song', keywords: ['moye', 'moyemoye'], url: 'https://www.myinstants.com/media/sounds/moye-moye.mp3', title: 'Moye Moye 🎵' },
  { name: 'coffin dance', category: 'Song', keywords: ['coffin', 'astronomia', 'janaza'], url: 'https://www.myinstants.com/media/sounds/astronomia.mp3', title: 'Coffin Dance (Astronomia) ⚰️' },
  { name: 'gigachad', category: 'Song', keywords: ['gigachad', 'chad', 'sigma'], url: 'https://www.myinstants.com/media/sounds/gigachad.mp3', title: 'GigaChad Sigma Theme 🗿' },
  { name: 'sad violin', category: 'Song', keywords: ['sad', 'violin', 'dukh', 'dard'], url: 'https://www.myinstants.com/media/sounds/sad-violin_1.mp3', title: 'Sad Violin / Dukh Dard 🎻' },
  { name: 'chipi chipi', category: 'Song', keywords: ['chipi', 'chapa', 'cat'], url: 'https://www.myinstants.com/media/sounds/chipi-chipi-chapa-chapa.mp3', title: 'Chipi Chipi Chapa Chapa 🐱' },
  { name: 'rickroll', category: 'Song', keywords: ['rick', 'roll', 'rickroll'], url: 'https://www.myinstants.com/media/sounds/rick-roll.mp3', title: 'Rickroll (Never Gonna Give You Up) 🕺' },

  // --- DESI FUNNY MEMES & DIALOGUES ---
  { name: 'maro mujhe', category: 'Desi', keywords: ['maro', 'bhai maro', 'waqt badal diya', 'jazbaat'], url: 'https://www.myinstants.com/media/sounds/ek-dum-se-waqt-badal-diya.mp3', title: 'Oh Bhai Maro Mujhe Maro / Waqt Badal Diya 😂' },
  { name: 'aye haye mazay', category: 'Desi', keywords: ['mazay', 'aye haye', 'maze', 'oye hoye'], url: 'https://www.myinstants.com/media/sounds/oye-hoye-haye-haye.mp3', title: 'Aye Haye Mazay / Oye Hoye 🤤' },
  { name: 'tauba tauba', category: 'Desi', keywords: ['tauba', 'sar kharab', 'toba'], url: 'https://www.myinstants.com/media/sounds/tauba-tauba-123-meme-joke.mp3', title: 'Tauba Tauba Sar Kharab Kar Diya 🤦‍♂️' },
  { name: 'aayein', category: 'Desi', keywords: ['aayein', 'baigan', 'aaye'], url: 'https://www.myinstants.com/media/sounds/aayein-meme.mp3', title: 'Aayein? Baigan 🍆' },
  { name: 'bhupendra jogi', category: 'Desi', keywords: ['bhupendra', 'jogi', 'naam', 'bhupender'], url: 'https://www.myinstants.com/media/sounds/bhupender-jogi.mp3', title: 'Bhupendra Jogi 🎒' },
  { name: 'khatam', category: 'Desi', keywords: ['khatam', 'tata', 'bye', 'goodbye'], url: 'https://www.myinstants.com/media/sounds/rahul-gandhi-khatam-tata-good-bye.mp3', title: 'Khatam Tata Bye Bye 👋' },
  { name: 'jalwa', category: 'Desi', keywords: ['jalwa', 'hamara'], url: 'https://www.myinstants.com/media/sounds/jalwa-h-hamara.mp3', title: 'Jalwa Hai Hamara 😎' },
  { name: 'kya gunda', category: 'Desi', keywords: ['gunda', 'banega', 'kya gunda banega re tu'], url: 'https://www.myinstants.com/media/sounds/kya-gunda-banega-re-tu.mp3', title: 'Kya Gunda Banega Re Tu 🤣' },
  { name: 'shabash', category: 'Desi', keywords: ['shabash', 'shabash beta'], url: 'https://www.myinstants.com/media/sounds/shabash-beta.mp3', title: 'Shabash Beta Bahut Badhiya 👏' },
  { name: 'kehna kya chahte ho', category: 'Desi', keywords: ['kehna', 'chahte ho', 'kehna kya'], url: 'https://www.myinstants.com/media/sounds/arey-kehna-kya-chahte-ho.mp3', title: 'Arey Kehna Kya Chahte Ho 🤔' },
  { name: 'chup kar', category: 'Desi', keywords: ['chup', 'chup kar'], url: 'https://www.myinstants.com/media/sounds/chup-kar-be-kutte.mp3', title: 'Chup Kar Be 🤫' },
  { name: 'phir hera pheri', category: 'Desi', keywords: ['hera pheri', 'phir hera pheri', 'babu bhaiya'], url: 'https://www.myinstants.com/media/sounds/phirherapheri.mp3', title: 'Phir Hera Pheri Theme 💰' },
  { name: 'waah kya scene', category: 'Desi', keywords: ['waah', 'scene', 'waah kya scene hai'], url: 'https://www.myinstants.com/media/sounds/waah-kya-scene-hai.mp3', title: 'Waah Kya Scene Hai 🤩' },
  { name: 'rom rom bhaiyo', category: 'Desi', keywords: ['rom rom', 'system', 'rom rom bhaiyo'], url: 'https://www.myinstants.com/media/sounds/rom-rom-bhaiyo.mp3', title: 'Rom Rom Bhaiyo System 🔊' },
  { name: 'majnu bhai', category: 'Desi', keywords: ['majnu', 'majnu bhai'], url: 'https://www.myinstants.com/media/sounds/majnu-bhai-laugh.mp3', title: 'Majnu Bhai Laugh 😂' },

  // --- GLOBAL VIRAL MEMES ---
  { name: 'emotional damage', category: 'Meme', keywords: ['damage', 'emotional'], url: 'https://www.myinstants.com/media/sounds/emotional-damage-meme.mp3', title: 'Emotional Damage! 💔' },
  { name: 'bruh', category: 'Meme', keywords: ['bruh', 'bro'], url: 'https://www.myinstants.com/media/sounds/movie_1.mp3', title: 'Bruh Sound Effect 🗿' },
  { name: 'siu', category: 'Meme', keywords: ['siu', 'ronaldo', 'siuuu'], url: 'https://www.myinstants.com/media/sounds/siuuu.mp3', title: 'Ronaldo Siuuu! ⚽' },
  { name: 'directed by', category: 'Meme', keywords: ['directed', 'curb', 'robert'], url: 'https://www.myinstants.com/media/sounds/curb-your-enthusiasm-theme-audiotrimmer.mp3', title: 'Directed by Robert B. Weide / Curb 🎬' },
  { name: 'bing chilling', category: 'Meme', keywords: ['bing', 'chilling'], url: 'https://www.myinstants.com/media/sounds/bing-chilllllling.mp3', title: 'Bing Chilling 🍦' },
  { name: 'run', category: 'Meme', keywords: ['run', 'bhago', 'bhaago'], url: 'https://www.myinstants.com/media/sounds/run-vine-sound-effect_1.mp3', title: 'Run! (Bhaago) 🏃‍♂️' },
  { name: 'gta wasted', category: 'Meme', keywords: ['wasted', 'gta'], url: 'https://www.myinstants.com/media/sounds/gta-v-death-sound-effect-102.mp3', title: 'GTA Wasted 💀' },
  { name: 'mission passed', category: 'Meme', keywords: ['mission', 'passed', 'respect'], url: 'https://www.myinstants.com/media/sounds/gta-san-andreas-mission-complete-sound-hq.mp3', title: 'Mission Passed Respect + 🎖️' },

  // --- FUNNY SOUND EFFECTS & REACTIONS ---
  { name: 'vine boom', category: 'SFX', keywords: ['boom', 'vine'], url: 'https://www.myinstants.com/media/sounds/vine-boom.mp3', title: 'Vine Boom 💥' },
  { name: 'laugh', category: 'SFX', keywords: ['laugh', 'hansi', 'funny', 'wheeze', 'risitas'], url: 'https://www.myinstants.com/media/sounds/risitas.mp3', title: 'Viral Wheeze Laugh (Risitas) 🤣' },
  { name: 'oh no laugh', category: 'SFX', keywords: ['oh no', 'funny laugh'], url: 'https://www.myinstants.com/media/sounds/oh-no-no-no-laugh.mp3', title: 'Oh No No No Laugh 😆' },
  { name: 'fart', category: 'SFX', keywords: ['fart', 'hawa'], url: 'https://www.myinstants.com/media/sounds/fart-with-reverb.mp3', title: 'Fart with Reverb 💨' },
  { name: 'metal pipe', category: 'SFX', keywords: ['pipe', 'metal', 'gir gaya'], url: 'https://www.myinstants.com/media/sounds/metal-pipe-clang.mp3', title: 'Metal Pipe Falling 🪈' },
  { name: 'bonk', category: 'SFX', keywords: ['bonk', 'cheems', 'danda'], url: 'https://www.myinstants.com/media/sounds/bonk.mp3', title: 'Bonk Doge 🔨' },
  { name: 'slap', category: 'SFX', keywords: ['slap', 'thapad', 'punch'], url: 'https://www.myinstants.com/media/sounds/slap-sound-effect.mp3', title: 'Slap / Punch Sound 🥊' },
  { name: 'fbi open up', category: 'SFX', keywords: ['fbi', 'open up', 'police'], url: 'https://www.myinstants.com/media/sounds/fbi-open-up-sfx.mp3', title: 'FBI Open Up! 🚨' },
  { name: 'airhorn', category: 'SFX', keywords: ['airhorn', 'horn', 'mlg'], url: 'https://www.myinstants.com/media/sounds/mlg-airhorn.mp3', title: 'MLG Airhorn 📯' },
  { name: 'dun dun dun', category: 'SFX', keywords: ['dun', 'shock', 'drama', 'suspense'], url: 'https://www.myinstants.com/media/sounds/dun-dun-dun.mp3', title: 'Dun Dun Dun (Suspense) 😱' },
  { name: 'cheering', category: 'SFX', keywords: ['cheer', 'crowd', 'stadium', 'cricket'], url: 'https://www.myinstants.com/media/sounds/cheering.mp3', title: 'Crowd Cheering 👏' },
  { name: 'windows error', category: 'SFX', keywords: ['windows', 'error', 'xp'], url: 'https://www.myinstants.com/media/sounds/windows-xp-error.mp3', title: 'Windows XP Error 💻' },

  // --- VIRAL PACK EXPANSION ---
  { name: 'chup bilkul chup', category: 'Desi', keywords: ['chup bilkul', 'bilkul chup', 'chup'], url: 'https://www.myinstants.com/media/sounds/chup-bilkul-chup.mp3', title: 'Chup Bilkul Chup 🤫' },
  { name: 'kya baat hai', category: 'Desi', keywords: ['kya baat hai sir', 'kya baat'], url: 'https://www.myinstants.com/media/sounds/kya-baat-hai-sir-meme.mp3', title: 'Kya Baat Hai Sir! 👏' },
  { name: 'doglapan', category: 'Desi', keywords: ['dogla', 'doglapan', 'ashneer'], url: 'https://www.myinstants.com/media/sounds/ye-sab-doglapan-hai.mp3', title: 'Yeh Sab Doglapan Hai 🦈' },
  { name: 'jaldi wahan se hato', category: 'Desi', keywords: ['jaldi', 'hato', 'wahan se hato'], url: 'https://www.myinstants.com/media/sounds/jaldi-wahan-se-hato.mp3', title: 'Jaldi Wahan Se Hato 📢' },
  { name: 'chhoti bachi ho kya', category: 'Desi', keywords: ['bachi', 'chhoti bachi', 'tiger shroff'], url: 'https://www.myinstants.com/media/sounds/choti-bachi-ho-kya.mp3', title: 'Chhoti Bachi Ho Kya? 👧' },
  { name: 'paisa hi paisa', category: 'Desi', keywords: ['paisa', 'paisa hi paisa hoga', 'akshay'], url: 'https://www.myinstants.com/media/sounds/paisa-hi-paisa-hoga-akshay-kumar-meme.mp3', title: 'Paisa Hi Paisa Hoga 💰' },
  { name: 'scheme bata de', category: 'Desi', keywords: ['scheme', 'zor zor se'], url: 'https://www.myinstants.com/media/sounds/zor-zor-se-bolke-sabko-scheme-bata-de.mp3', title: 'Zor Zor Se Bolke Scheme Bata De 🤫' },
  { name: 'dil garden garden', category: 'Desi', keywords: ['garden', 'dil garden garden'], url: 'https://www.myinstants.com/media/sounds/dil-garden-garden-hogaya.mp3', title: 'Dil Garden Garden Ho Gaya 🌸' },
  { name: 'are baap re', category: 'Desi', keywords: ['baap re', 'are baap re'], url: 'https://www.myinstants.com/media/sounds/are-baap-re-ye-kya-hai.mp3', title: 'Are Baap Re! 😱' },
  { name: 'goli beta masti nahi', category: 'Desi', keywords: ['goli', 'masti', 'tarak mehta', 'jethalal'], url: 'https://www.myinstants.com/media/sounds/goli-beta-masti-nahi.mp3', title: 'Goli Beta Masti Nahi 👓' },
  { name: 'bik gayi hai gormint', category: 'Desi', keywords: ['gormint', 'bik gayi', 'aunty'], url: 'https://www.myinstants.com/media/sounds/yeh-bik-gayi-hai-gormint.mp3', title: 'Yeh Bik Gayi Hai Gormint 👵' },
  { name: 'pawri hori hai', category: 'Desi', keywords: ['pawri', 'party', 'dananeer'], url: 'https://www.myinstants.com/media/sounds/yeh-humari-pawri-hori-hai.mp3', title: 'Pawri Hori Hai 🎉' }
];

/**
 * Convert Image Buffer to 512x512 Transparent WebP Sticker
 */
export async function imageToSticker(imageBuffer) {
  try {
    return await sharp(imageBuffer)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .webp({ quality: 80, effort: 4 })
      .toBuffer();
  } catch (err) {
    throw new Error(`Sticker conversion failed: ${err.message}`);
  }
}

/**
 * Convert Animated Image / GIF Buffer to Animated WebP Sticker
 */
export async function animToSticker(buffer) {
  try {
    return await sharp(buffer, { animated: true })
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .webp({ quality: 65, effort: 4, loop: 0 })
      .toBuffer();
  } catch (err) {
    // Fallback to static sticker
    return await imageToSticker(buffer);
  }
}

const STOP_WORDS = new Set(['kya', 'hai', 'hain', 'ka', 'ke', 'ki', 'ko', 'se', 'me', 'mein', 'aur', 'the', 'is', 'a', 'to', 'in', 'on', 'of', 'and', 're']);

/**
 * Find Meme Sound by Number (1-41), Name, Dialogue, or Keywords
 * @param {string|number} query
 * @param {boolean} fallbackToRandom - If true, returns random meme if no match found
 */
export function findMemeSound(query, fallbackToRandom = true) {
  if (!query || String(query).trim().toLowerCase() === 'random') {
    return fallbackToRandom ? MEME_SOUNDS[Math.floor(Math.random() * MEME_SOUNDS.length)] : null;
  }

  const raw = String(query).toLowerCase().trim();

  // 1. Exact Number Matching (1-based index: 1 to 66, #1, meme 1, soundboard 1, sound 7, etc.)
  const numMatch = raw.match(/^(?:[!#]|soundboard\s*|meme\s*|sound\s*|sfx\s*|no\.?\s*|number\s*)?(\d{1,2})$/i);
  if (numMatch) {
    const idx = parseInt(numMatch[1], 10);
    if (idx >= 1 && idx <= MEME_SOUNDS.length) {
      return MEME_SOUNDS[idx - 1];
    }
  }

  // Clean filler words and punctuation
  const q = raw
    .replace(/^(?:[!#]|soundboard\s+|meme\s+|sound\s+|audio\s+|funny\s+|play\s+|bhejo\s+|sunao\s+|chalao\s+)+/i, '')
    .replace(/\s+(?:meme|sound|soundboard|audio|sunao|chalao|song|bhejo|play)$/i, '')
    .trim();

  if (!q) {
    return fallbackToRandom ? MEME_SOUNDS[Math.floor(Math.random() * MEME_SOUNDS.length)] : null;
  }

  // 2. Score-based fuzzy and dialogue matching
  let bestMatch = null;
  let bestScore = 0;

  for (let i = 0; i < MEME_SOUNDS.length; i++) {
    const item = MEME_SOUNDS[i];
    let score = 0;

    const name = item.name.toLowerCase();
    const keywords = (item.keywords || []).map(k => k.toLowerCase());
    const title = (item.title || '').toLowerCase();

    // Exact matches
    if (name === q) score = Math.max(score, 100);
    if (keywords.includes(q)) score = Math.max(score, 95);

    // Substring matches
    if (q.includes(name)) score = Math.max(score, 90);
    if (name.includes(q) && q.length >= 4) score = Math.max(score, 80);

    // Keyword substring matches
    for (const kw of keywords) {
      if (q === kw) score = Math.max(score, 95);
      else if (q.includes(kw) && kw.length >= 4) score = Math.max(score, 85);
      else if (kw.includes(q) && kw.length >= 4) score = Math.max(score, 75);
    }

    // Title match
    if (title.includes(q) && q.length >= 4) score = Math.max(score, 70);

    // Significant token overlap (excluding common stop words)
    const qTokens = q.split(/\s+/).filter(t => t.length >= 3 && !STOP_WORDS.has(t));
    const itemTokens = [...name.split(/\s+/), ...keywords.flatMap(k => k.split(/\s+/))].filter(t => !STOP_WORDS.has(t));

    if (qTokens.length > 0) {
      const matchCount = qTokens.filter(t => itemTokens.includes(t)).length;
      if (matchCount >= 2 || (matchCount === 1 && qTokens.length === 1)) {
        score = Math.max(score, 50 + matchCount * 20);
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  if (bestScore >= 65 && bestMatch) {
    return bestMatch;
  }

  return fallbackToRandom ? MEME_SOUNDS[Math.floor(Math.random() * MEME_SOUNDS.length)] : null;
}

/**
 * Fetch Meme Audio at high speed into Buffer
 */
export async function getMemeAudioBuffer(soundItem) {
  if (!soundItem || !soundItem.url) throw new Error('Invalid sound item');
  const res = await fetch(soundItem.url, {
    signal: AbortSignal.timeout(10000),
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Referer': 'https://www.myinstants.com/',
      'Accept': '*/*'
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}
