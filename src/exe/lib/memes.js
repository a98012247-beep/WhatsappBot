/**
 * Huge Library of Memes: Audio, Image, Text, Roasts & Desi Jokes
 */

export const DESI_ROASTS = [
  "Bhai tu jab bolta hai na, lagta hai WiFi ka signal 1 bar ho gaya ho. Thora sooch ke bola kar! 😂",
  "Aapki aqal aur Pakistan ke bijli bill mein ek baat common hai... dono ka koi ata pata nahi hota! 💡",
  "Bhai itna confidence laate kahan se ho? Zara 2 rupay ka hume bhi udhar de do! 💸",
  "Agar overthinking Olympic sport hoti na, to bhai tu har saal Gold Medal le kar aata! 🥇",
  "Tumhari baatein sun kar lagta hai ke phone ki battery 1% reh gayi hai aur charger bhi nahi mil raha! 🔋",
  "Bhai tu jab chup rehta hai na, qasam se dunya kitni khoobsurat lagti hai! 🤫",
  "Aapka dimagh 5G ke zamane mein 2G speed par chal raha hai, software update karwa lo bhai! 📱",
  "Bhai tu camera ke baghair bhi bohot filter lagata hai apni baaton mein! 📸",
  "Mujhe lagta hai tum jab paida huay thay to doctor ne pehle mubarakbaad nahi di thi, balkay maafi maangi thi! 👶",
  "Aapka gussa dekh kar to machhar bhi hans parta hai ke 'yeh kya kar lega'! 🦟",
  "Bhai tu har maamle mein taang adane ka contract le kar baitha hai kya? 🦵",
  "Tumhari shairi sun kar Ghalib ne qabr mein karwat badal li hogi ke 'yeh kya zulm hai'! 📜",
  "Itna dimagh agar parhai ya business mein lagate na, to ab tak Elon Musk ke barabar hotay! 🚀",
  "Aapki personality bilkul WhatsApp status jaisi hai... 24 ghante baad koi yaad nahi rakhta! ⏳",
  "Bhai shakal se to sharif lagte ho, harkatein kisi purane chor jaisi hain! 🕵️"
];

export const FUNNY_CHUTKULAY = [
  "Teacher: Agar tumhare paas 10 aam hain aur 4 kisi ko de do to kya bachega?\nStudent: Sir depression bachega ke aam kyun diye! 😂",
  "Biwi: Suniye ji, agar main kho gayi to aap kya karenge?\nMian: Akhbar mein ishtihar doonga ke 'Jisko mile usi ki, wapis mat bhejna!' 🤣",
  "Doctor: Rozana 5 kilometer walk kiya karein.\nPatient: Doctor sahab, 5 din mein to main Multan pohnch jaoonga, wahan se wapis kaise aaoon? 🏃‍♂️",
  "Pathan ne dukandar se pocha: 'Bhai yeh fan kitne ka hai?'\nDukandar: '5000 ka.'\nPathan: 'Bhai ismein hawa thori kam kar do, 3000 ka kar do!' 💨",
  "Ustaad: Woh kaunsi cheez hai jo saal mein 1 dafa aati hai aur mahine mein 2 dafa?\nShagird: Sir, mera walid sahab ka mood! 🤦‍♂️",
  "Pappu: Yar kal raat main ne sapna dekha ke main karorpati ban gaya!\nDost: Phir kya hua?\nPappu: Phir subah ammi ne jhaadu maar kar utha diya ke 'uth tanki ka paani band kar!' 🪣",
  "Judge: Tum ne 3 saal mein 10 dafa chori ki hai!\nChor: Janab kam az kam main aapke court ka sabse regular customer to hoon! ⚖️",
  "Biwi: Tum shadi se pehle to mere peechay peechay ghoomte thay!\nShohar: Haan, to jailer bhi qaidi ke peechay peechay hi ghoomta hai! 🔒",
  "Dost 1: Yar kal meri billi ne chohay ko pakar kar maafi maang li!\nDost 2: Kyun?\nDost 1: Kehti 'sorry yar, aaj mera roza hai!' 🐱",
  "Teacher: Dunya mein sabse purani zaban kaunsi hai?\nStudent: Sir, Maadri zaban (Mother Tongue)!\nTeacher: Wo kyun?\nStudent: Kyun ke Adam (A.S) ke zamane mein kisi mard ko bolne ka mauqa hi nahi mila! 🤐"
];

export const MEME_TEMPLATES = [
  { name: 'Cheems Doge', url: 'https://i.imgflip.com/43a45p.png', caption: 'Sed Life Bro 🥺' },
  { name: 'Chad Sigma', url: 'https://i.imgflip.com/5ccl14.jpg', caption: 'Average AwaisxBot Enjoyer 🗿' },
  { name: 'Disaster Girl', url: 'https://i.imgflip.com/23ls.jpg', caption: 'Group mein aag laga kar chup chaap nikal gaya 🔥' },
  { name: 'Distracted Boyfriend', url: 'https://i.imgflip.com/1ur9b0.jpg', caption: 'Purana dost vs Naya Group 👫' },
  { name: 'Drake Hotline Bling', url: 'https://i.imgflip.com/30b1gx.jpg', caption: 'Parhai karna ❌ Bot se baatein karna ✔️' },
  { name: 'Two Buttons', url: 'https://i.imgflip.com/1g8my4.jpg', caption: 'So jana vs Raat 3 baje reels dekhna 🔘' },
  { name: 'Bernie Asking Again', url: 'https://i.imgflip.com/3oevdk.jpg', caption: 'I am once again asking for balance / hotspot 📱' },
  { name: 'Woman Yelling at Cat', url: 'https://i.imgflip.com/345v97.jpg', caption: 'Ammi scolding vs Me eating samosa 🐱' },
  { name: 'Babu Rao Hera Pheri', url: 'https://i.imgflip.com/4t0m5.jpg', caption: 'Utha le re baba, utha le! 👓' },
  { name: 'Akshay Kumar Scheme', url: 'https://i.imgflip.com/28j0te.jpg', caption: '21 din mein paisa double! 💰' }
];

/**
 * Fetch a fresh viral meme from Reddit / Public Meme API
 */
export async function getViralMeme() {
  const subreddits = ['memes', 'dankmemes', 'wholesomememes', 'me_irl'];
  const randomSub = subreddits[Math.floor(Math.random() * subreddits.length)];

  try {
    const res = await fetch(`https://meme-api.com/gimme/${randomSub}`, {
      signal: AbortSignal.timeout(4500),
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.url && !data.nsfw) {
        return {
          title: data.title || 'Fresh Viral Meme 😂',
          url: data.url,
          author: data.author || 'Reddit',
          subreddit: data.subreddit || randomSub
        };
      }
    }
  } catch (e) {
    console.warn('Meme API notice:', e.message);
  }

  // Fallback to internal curated meme templates
  const fallback = MEME_TEMPLATES[Math.floor(Math.random() * MEME_TEMPLATES.length)];
  return {
    title: fallback.name,
    url: fallback.url,
    author: 'AwaisxBot Meme Vault',
    subreddit: 'DesiMemes'
  };
}

/**
 * Get Random Roast (AI-powered for unlimited variety, list as fallback)
 */
export async function getMemeRoast(targetName = '', senderId = null) {
  // Try AI for a fresh roast
  try {
    const { askAI } = await import('./ai.js');
    const prompt = targetName
      ? `Ek funny desi roast likho "${targetName}" ke liye, Roman Urdu mein, 2-3 lines, hasna chahiye, vulgar nahi.`
      : `Ek funny desi roast likho, Roman Urdu mein, 2-3 lines, creative ho, vulgar nahi.`;
    const aiRoast = await askAI(prompt, { senderId: senderId || 'roast', senderName: 'Friend' });
    if (aiRoast && aiRoast.length > 10 && !aiRoast.includes('demo mode')) {
      return `🔥 *Roast${targetName ? ` for ${targetName}` : ''}:*\n\n${aiRoast}`;
    }
  } catch (e) {}
  // Fallback to hardcoded list
  const roast = DESI_ROASTS[Math.floor(Math.random() * DESI_ROASTS.length)];
  if (targetName) {
    return `🔥 *Roast for @${targetName.replace('@', '')}:*\n\n${roast}`;
  }
  return `🔥 *Meme Roast:*\n\n${roast}`;
}

/**
 * Get Random Desi Joke / Chutkula (AI-powered for unlimited variety)
 */
export async function getMemeJoke(senderId = null) {
  // Try AI for a fresh joke
  try {
    const { askAI } = await import('./ai.js');
    const aiJoke = await askAI('Ek funny desi chutkula/latifa sunao, Roman Urdu mein, 3-4 lines, hasna chahiye.', { senderId: senderId || 'joke', senderName: 'Friend' });
    if (aiJoke && aiJoke.length > 10 && !aiJoke.includes('demo mode')) {
      return `🤣 *Desi Chutkula:*\n\n${aiJoke}`;
    }
  } catch (e) {}
  // Fallback to hardcoded list
  const joke = FUNNY_CHUTKULAY[Math.floor(Math.random() * FUNNY_CHUTKULAY.length)];
  return `🤣 *Desi Chutkula / Meme Joke:*\n\n${joke}`;
}
