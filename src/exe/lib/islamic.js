// Islamic Data Engine: Quran, Hadith, Tafseer, Audio & Prayer Times
// Powered by alquran.cloud, jsDelivr Fawaz Ahmed Hadith API, AlAdhan, and mp3quran.net

// 114 Surahs Manifest with Arabic, Transliteration, Meaning, Total Ayahs & Revelation Type
export const SURAHS_LIST = [
  { number: 1, name: "Al-Fatihah", arabic: "الفاتحة", meaning: "The Opening / Deebacha", ayahs: 7, type: "Meccan" },
  { number: 2, name: "Al-Baqarah", arabic: "البقرة", meaning: "The Cow / Gaaye", ayahs: 286, type: "Medinan" },
  { number: 3, name: "Ali 'Imran", arabic: "آل عمران", meaning: "Family of Imran", ayahs: 200, type: "Medinan" },
  { number: 4, name: "An-Nisa", arabic: "النساء", meaning: "The Women / Auratein", ayahs: 176, type: "Medinan" },
  { number: 5, name: "Al-Ma'idah", arabic: "المائدة", meaning: "The Table Spread", ayahs: 120, type: "Medinan" },
  { number: 6, name: "Al-An'am", arabic: "الأنعام", meaning: "The Cattle / Maweshi", ayahs: 165, type: "Meccan" },
  { number: 7, name: "Al-A'raf", arabic: "الأعراف", meaning: "The Heights / Bulandiyan", ayahs: 206, type: "Meccan" },
  { number: 8, name: "Al-Anfal", arabic: "الأنفال", meaning: "The Spoils of War / Maal-e-Ghanimat", ayahs: 75, type: "Medinan" },
  { number: 9, name: "At-Tawbah", arabic: "التوبة", meaning: "The Repentance / Maafi", ayahs: 129, type: "Medinan" },
  { number: 10, name: "Yunus", arabic: "يونس", meaning: "Prophet Jonah", ayahs: 109, type: "Meccan" },
  { number: 11, name: "Hud", arabic: "هود", meaning: "Prophet Hud", ayahs: 123, type: "Meccan" },
  { number: 12, name: "Yusuf", arabic: "يوسف", meaning: "Prophet Joseph", ayahs: 111, type: "Meccan" },
  { number: 13, name: "Ar-Ra'd", arabic: "الرعد", meaning: "The Thunder / Garaj", ayahs: 43, type: "Medinan" },
  { number: 14, name: "Ibrahim", arabic: "إبراهيم", meaning: "Prophet Abraham", ayahs: 52, type: "Meccan" },
  { number: 15, name: "Al-Hijr", arabic: "الحجر", meaning: "The Rocky Tract", ayahs: 99, type: "Meccan" },
  { number: 16, name: "An-Nahl", arabic: "النحل", meaning: "The Bee / Shehad ki Makhi", ayahs: 128, type: "Meccan" },
  { number: 17, name: "Al-Isra", arabic: "الإسراء", meaning: "The Night Journey / Bani Israil", ayahs: 111, type: "Meccan" },
  { number: 18, name: "Al-Kahf", arabic: "الكهف", meaning: "The Cave / Ghaar", ayahs: 110, type: "Meccan" },
  { number: 19, name: "Maryam", arabic: "مريم", meaning: "Mary", ayahs: 98, type: "Meccan" },
  { number: 20, name: "Ta-Ha", arabic: "طه", meaning: "Ta-Ha", ayahs: 135, type: "Meccan" },
  { number: 21, name: "Al-Anbiya", arabic: "الأنبياء", meaning: "The Prophets", ayahs: 112, type: "Meccan" },
  { number: 22, name: "Al-Hajj", arabic: "الحج", meaning: "The Pilgrimage", ayahs: 78, type: "Medinan" },
  { number: 23, name: "Al-Mu'minun", arabic: "المؤمنون", meaning: "The Believers", ayahs: 118, type: "Meccan" },
  { number: 24, name: "An-Nur", arabic: "النور", meaning: "The Light / Roshni", ayahs: 64, type: "Medinan" },
  { number: 25, name: "Al-Furqan", arabic: "الفرقان", meaning: "The Criterion", ayahs: 77, type: "Meccan" },
  { number: 26, name: "Ash-Shu'ara", arabic: "الشعراء", meaning: "The Poets", ayahs: 227, type: "Meccan" },
  { number: 27, name: "An-Naml", arabic: "النمل", meaning: "The Ant / Cheenti", ayahs: 93, type: "Meccan" },
  { number: 28, name: "Al-Qasas", arabic: "القصص", meaning: "The Stories / Waqiat", ayahs: 88, type: "Meccan" },
  { number: 29, name: "Al-'Ankabut", arabic: "العنكبوت", meaning: "The Spider / Makri", ayahs: 69, type: "Meccan" },
  { number: 30, name: "Ar-Rum", arabic: "الروم", meaning: "The Romans", ayahs: 60, type: "Meccan" },
  { number: 31, name: "Luqman", arabic: "لقمان", meaning: "Luqman", ayahs: 34, type: "Meccan" },
  { number: 32, name: "As-Sajdah", arabic: "السجدة", meaning: "The Prostration", ayahs: 30, type: "Meccan" },
  { number: 33, name: "Al-Ahzab", arabic: "الأحزاب", meaning: "The Confederates", ayahs: 73, type: "Medinan" },
  { number: 34, name: "Saba", arabic: "سبأ", meaning: "Sheba", ayahs: 54, type: "Meccan" },
  { number: 35, name: "Fatir", arabic: "فاطر", meaning: "The Originator", ayahs: 45, type: "Meccan" },
  { number: 36, name: "Ya-Sin", arabic: "يس", meaning: "Ya-Sin (Dil-e-Quran)", ayahs: 83, type: "Meccan" },
  { number: 37, name: "As-Saffat", arabic: "الصافات", meaning: "Those Who Set The Ranks", ayahs: 182, type: "Meccan" },
  { number: 38, name: "Sad", arabic: "ص", meaning: "The Letter Sad", ayahs: 88, type: "Meccan" },
  { number: 39, name: "Az-Zumar", arabic: "الزمر", meaning: "The Troops", ayahs: 75, type: "Meccan" },
  { number: 40, name: "Ghafir", arabic: "غافر", meaning: "The Forgiver", ayahs: 85, type: "Meccan" },
  { number: 41, name: "Fussilat", arabic: "فصلت", meaning: "Explained In Detail", ayahs: 54, type: "Meccan" },
  { number: 42, name: "Ash-Shura", arabic: "الشورى", meaning: "The Consultation", ayahs: 53, type: "Meccan" },
  { number: 43, name: "Az-Zukhruf", arabic: "الزخرف", meaning: "The Gold Adornments", ayahs: 89, type: "Meccan" },
  { number: 44, name: "Ad-Dukhan", arabic: "الدخان", meaning: "The Smoke / Dhuan", ayahs: 59, type: "Meccan" },
  { number: 45, name: "Al-Jathiyah", arabic: "الجاثية", meaning: "The Crouching", ayahs: 37, type: "Meccan" },
  { number: 46, name: "Al-Ahqaf", arabic: "الأحقاف", meaning: "The Wind-Curved Sandhills", ayahs: 35, type: "Meccan" },
  { number: 47, name: "Muhammad", arabic: "محمد", meaning: "Prophet Muhammad (PBUH)", ayahs: 38, type: "Medinan" },
  { number: 48, name: "Al-Fath", arabic: "الفتح", meaning: "The Victory / Fatah", ayahs: 29, type: "Medinan" },
  { number: 49, name: "Al-Hujurat", arabic: "الحجرات", meaning: "The Rooms / Hujray", ayahs: 18, type: "Medinan" },
  { number: 50, name: "Qaf", arabic: "ق", meaning: "The Letter Qaf", ayahs: 45, type: "Meccan" },
  { number: 51, name: "Adh-Dhariyat", arabic: "الذاريات", meaning: "The Winnowing Winds", ayahs: 60, type: "Meccan" },
  { number: 52, name: "At-Tur", arabic: "الطور", meaning: "The Mount / Koh-e-Toor", ayahs: 49, type: "Meccan" },
  { number: 53, name: "An-Najm", arabic: "النجم", meaning: "The Star / Sitara", ayahs: 62, type: "Meccan" },
  { number: 54, name: "Al-Qamar", arabic: "القمر", meaning: "The Moon / Chaand", ayahs: 55, type: "Meccan" },
  { number: 55, name: "Ar-Rahman", arabic: "الرحمن", meaning: "The Beneficent / Zeenat-e-Quran", ayahs: 78, type: "Medinan" },
  { number: 56, name: "Al-Waqi'ah", arabic: "الواقعة", meaning: "The Inevitable", ayahs: 96, type: "Meccan" },
  { number: 57, name: "Al-Hadid", arabic: "الحديد", meaning: "The Iron / Loha", ayahs: 29, type: "Medinan" },
  { number: 58, name: "Al-Mujadila", arabic: "المجادلة", meaning: "The Pleading Woman", ayahs: 22, type: "Medinan" },
  { number: 59, name: "Al-Hashr", arabic: "الحشر", meaning: "The Exile / Ikatha hona", ayahs: 24, type: "Medinan" },
  { number: 60, name: "Al-Mumtahanah", arabic: "الممتحنة", meaning: "She That Is To Be Examined", ayahs: 13, type: "Medinan" },
  { number: 61, name: "As-Saff", arabic: "الصف", meaning: "The Ranks / Qataar", ayahs: 14, type: "Medinan" },
  { number: 62, name: "Al-Jumu'ah", arabic: "الجمعة", meaning: "The Congregation / Friday", ayahs: 11, type: "Medinan" },
  { number: 63, name: "Al-Munafiqun", arabic: "المنافقون", meaning: "The Hypocrites", ayahs: 11, type: "Medinan" },
  { number: 64, name: "At-Taghabun", arabic: "التغابن", meaning: "The Mutual Disillusion", ayahs: 18, type: "Medinan" },
  { number: 65, name: "At-Talaq", arabic: "الطلاق", meaning: "The Divorce", ayahs: 12, type: "Medinan" },
  { number: 66, name: "At-Tahrim", arabic: "التحريم", meaning: "The Prohibition", ayahs: 12, type: "Medinan" },
  { number: 67, name: "Al-Mulk", arabic: "الملک", meaning: "The Sovereignty / Badshahi", ayahs: 30, type: "Meccan" },
  { number: 68, name: "Al-Qalam", arabic: "القلم", meaning: "The Pen", ayahs: 52, type: "Meccan" },
  { number: 69, name: "Al-Haqqah", arabic: "الحاقة", meaning: "The Reality", ayahs: 52, type: "Meccan" },
  { number: 70, name: "Al-Ma'arij", arabic: "المعارج", meaning: "The Ascending Stairways", ayahs: 44, type: "Meccan" },
  { number: 71, name: "Nuh", arabic: "نوح", meaning: "Prophet Noah", ayahs: 28, type: "Meccan" },
  { number: 72, name: "Al-Jinn", arabic: "الجن", meaning: "The Jinn", ayahs: 28, type: "Meccan" },
  { number: 73, name: "Al-Muzzammil", arabic: "المزمل", meaning: "The Enshrouded One", ayahs: 20, type: "Meccan" },
  { number: 74, name: "Al-Muddaththir", arabic: "المدثر", meaning: "The Cloaked One", ayahs: 56, type: "Meccan" },
  { number: 75, name: "Al-Qiyamah", arabic: "القيامة", meaning: "The Resurrection", ayahs: 40, type: "Meccan" },
  { number: 76, name: "Al-Insan", arabic: "الإنسان", meaning: "The Man / Insan", ayahs: 31, type: "Medinan" },
  { number: 77, name: "Al-Mursalat", arabic: "المرسلات", meaning: "The Emissaries", ayahs: 50, type: "Meccan" },
  { number: 78, name: "An-Naba", arabic: "النبأ", meaning: "The Tidings / Badi Khabar", ayahs: 40, type: "Meccan" },
  { number: 79, name: "An-Nazi'at", arabic: "النازعات", meaning: "Those Who Drag Forth", ayahs: 46, type: "Meccan" },
  { number: 80, name: "'Abasa", arabic: "عبس", meaning: "He Frowned", ayahs: 42, type: "Meccan" },
  { number: 81, name: "At-Takwir", arabic: "التكوير", meaning: "The Overthrowing", ayahs: 29, type: "Meccan" },
  { number: 82, name: "Al-Infitar", arabic: "الانفطار", meaning: "The Cleaving", ayahs: 19, type: "Meccan" },
  { number: 83, name: "Al-Mutaffifin", arabic: "المطففين", meaning: "Defrauding / Naap taul mein kami", ayahs: 36, type: "Meccan" },
  { number: 84, name: "Al-Inshiqaq", arabic: "الانشقاق", meaning: "The Splitting Asunder", ayahs: 25, type: "Meccan" },
  { number: 85, name: "Al-Buruj", arabic: "البروج", meaning: "The Mansions of the Stars", ayahs: 22, type: "Meccan" },
  { number: 86, name: "At-Tariq", arabic: "الطارق", meaning: "The Morning Star", ayahs: 17, type: "Meccan" },
  { number: 87, name: "Al-A'la", arabic: "الأعلى", meaning: "The Most High", ayahs: 19, type: "Meccan" },
  { number: 88, name: "Al-Ghashiyah", arabic: "الغاشية", meaning: "The Overwhelming", ayahs: 26, type: "Meccan" },
  { number: 89, name: "Al-Fajr", arabic: "الفجر", meaning: "The Dawn / Subha", ayahs: 30, type: "Meccan" },
  { number: 90, name: "Al-Balad", arabic: "البلد", meaning: "The City / Sheher", ayahs: 20, type: "Meccan" },
  { number: 91, name: "Ash-Shams", arabic: "الشمس", meaning: "The Sun / Suraj", ayahs: 15, type: "Meccan" },
  { number: 92, name: "Al-Layl", arabic: "الليل", meaning: "The Night / Raat", ayahs: 21, type: "Meccan" },
  { number: 93, name: "Ad-Duha", arabic: "الضحى", meaning: "The Morning Hours", ayahs: 11, type: "Meccan" },
  { number: 94, name: "Ash-Sharh", arabic: "الشرح", meaning: "The Relief / Inshirah", ayahs: 8, type: "Meccan" },
  { number: 95, name: "At-Tin", arabic: "التين", meaning: "The Fig / Anjeer", ayahs: 8, type: "Meccan" },
  { number: 96, name: "Al-'Alaq", arabic: "العلق", meaning: "The Clot / Pehli Wahi", ayahs: 19, type: "Meccan" },
  { number: 97, name: "Al-Qadr", arabic: "القدر", meaning: "The Power / Shab-e-Qadr", ayahs: 5, type: "Meccan" },
  { number: 98, name: "Al-Bayyinah", arabic: "البينة", meaning: "The Clear Proof", ayahs: 8, type: "Medinan" },
  { number: 99, name: "Az-Zalzalah", arabic: "الزلزلة", meaning: "The Earthquake / Zalzala", ayahs: 8, type: "Medinan" },
  { number: 100, name: "Al-'Adiyat", arabic: "العاديات", meaning: "The Courser", ayahs: 11, type: "Meccan" },
  { number: 101, name: "Al-Qari'ah", arabic: "القارعة", meaning: "The Calamity", ayahs: 11, type: "Meccan" },
  { number: 102, name: "At-Takathur", arabic: "التكاثر", meaning: "The Rivalry in World Increase", ayahs: 8, type: "Meccan" },
  { number: 103, name: "Al-'Asr", arabic: "العصر", meaning: "The Declining Day / Zamana", ayahs: 3, type: "Meccan" },
  { number: 104, name: "Al-Humazah", arabic: "الهمزة", meaning: "The Traducer", ayahs: 9, type: "Meccan" },
  { number: 105, name: "Al-Fil", arabic: "الفيل", meaning: "The Elephant / Haathi", ayahs: 5, type: "Meccan" },
  { number: 106, name: "Quraysh", arabic: "قريش", meaning: "Quraysh", ayahs: 4, type: "Meccan" },
  { number: 107, name: "Al-Ma'un", arabic: "الماعون", meaning: "Small Kindnesses", ayahs: 7, type: "Meccan" },
  { number: 108, name: "Al-Kawthar", arabic: "الكوثر", meaning: "Abundance / Hauz-e-Kausar", ayahs: 3, type: "Meccan" },
  { number: 109, name: "Al-Kafirun", arabic: "الكافرون", meaning: "The Disbelievers", ayahs: 6, type: "Meccan" },
  { number: 110, name: "An-Nasr", arabic: "النصر", meaning: "Divine Support / Madad", ayahs: 3, type: "Medinan" },
  { number: 111, name: "Al-Masad", arabic: "المسد", meaning: "The Palm Fibre / Abu Lahab", ayahs: 5, type: "Meccan" },
  { number: 112, name: "Al-Ikhlas", arabic: "الإخلاص", meaning: "Sincerity / Tauheed", ayahs: 4, type: "Meccan" },
  { number: 113, name: "Al-Falaq", arabic: "الفلق", meaning: "The Daybreak / Subha", ayahs: 5, type: "Meccan" },
  { number: 114, name: "An-Nas", arabic: "الناس", meaning: "Mankind / Log", ayahs: 6, type: "Meccan" }
];

// Hadith Books Mapping & Maximum Hadith Numbers
export const HADITH_BOOKS = {
  bukhari: {
    title: "Sahih al-Bukhari (صحيح البخاري)",
    urdKey: "urd-bukhari",
    engKey: "eng-bukhari",
    araKey: "ara-bukhari",
    maxHadith: 7563
  },
  muslim: {
    title: "Sahih Muslim (صحيح مسلم)",
    urdKey: "urd-muslim",
    engKey: "eng-muslim",
    araKey: "ara-muslim",
    maxHadith: 7563
  },
  tirmidhi: {
    title: "Jami' at-Tirmidhi (جامع الترمذي)",
    urdKey: "urd-tirmidhi",
    engKey: "eng-tirmidhi",
    araKey: "ara-tirmidhi",
    maxHadith: 3956
  },
  abudawud: {
    title: "Sunan Abi Dawud (سنن أبي داود)",
    urdKey: "urd-abudawud",
    engKey: "eng-abudawud",
    araKey: "ara-abudawud",
    maxHadith: 5274
  },
  nasai: {
    title: "Sunan an-Nasa'i (سنن النسائي)",
    urdKey: "urd-nasai",
    engKey: "eng-nasai",
    araKey: "ara-nasai",
    maxHadith: 5758
  },
  ibnmajah: {
    title: "Sunan Ibn Majah (سنن ابن ماجه)",
    urdKey: "urd-ibnmajah",
    engKey: "eng-ibnmajah",
    araKey: "ara-ibnmajah",
    maxHadith: 4341
  }
};

// Asma-ul-Husna (99 Blessed Names of Allah)
export const ALLAH_NAMES = [
  { num: 1, arabic: "الرَّحْمَنُ", urdu: "Ar-Rahman", meaning: "Bohot Rehm Karne Wala (The Most Gracious)" },
  { num: 2, arabic: "الرَّحِيمُ", urdu: "Ar-Raheem", meaning: "Nihayat Meherban (The Most Merciful)" },
  { num: 3, arabic: "الْمَلِكُ", urdu: "Al-Malik", meaning: "Haqeeqi Badshah (The Sovereign / King)" },
  { num: 4, arabic: "الْقُدُّوسُ", urdu: "Al-Quddus", meaning: "Har Aib Se Paak (The Most Holy)" },
  { num: 5, arabic: "السَّلاَمُ", urdu: "As-Salam", meaning: "Salamati Bakhshne Wala (The Giver of Peace)" },
  { num: 6, arabic: "الْمُؤْمِنُ", urdu: "Al-Mu'min", meaning: "Aman Aur Imaan Dene Wala (The Granter of Security)" },
  { num: 7, arabic: "الْمُهَيْمِنُ", urdu: "Al-Muhaymin", meaning: "Nigehban (The Overseer / Protector)" },
  { num: 8, arabic: "الْعَزِيزُ", urdu: "Al-Aziz", meaning: "Ghalib Aur Zabardast (The Almighty)" },
  { num: 9, arabic: "الْجَبَّارُ", urdu: "Al-Jabbar", meaning: "Badi Shaan Wala (The Compeller)" },
  { num: 10, arabic: "الْمُتَكَبِّرُ", urdu: "Al-Mutakabbir", meaning: "Buzurgi Wala (The Supreme)" },
  { num: 11, arabic: "الْخَالِقُ", urdu: "Al-Khaliq", meaning: "Paida Karne Wala (The Creator)" },
  { num: 12, arabic: "الْبَارِئُ", urdu: "Al-Bari", meaning: "Wajood Mein Laane Wala (The Evolver)" },
  { num: 13, arabic: "الْمُصَوِّرُ", urdu: "Al-Musawwir", meaning: "Surat Banane Wala (The Flawless Shaper)" },
  { num: 14, arabic: "الْغَفَّارُ", urdu: "Al-Ghaffar", meaning: "Bakhshne Wala (The Great Forgiver)" },
  { num: 15, arabic: "الْقَهَّارُ", urdu: "Al-Qahhar", meaning: "Zorawar (The Subduer)" },
  { num: 16, arabic: "الْوَهَّابُ", urdu: "Al-Wahhab", meaning: "Ata Farmane Wala (The Bestower)" },
  { num: 17, arabic: "الرَّزَّاقُ", urdu: "Ar-Razzaq", meaning: "Rizq Dene Wala (The Provider)" },
  { num: 18, arabic: "الْفَتَّاحُ", urdu: "Al-Fattah", meaning: "Kholne Wala (The Opener)" },
  { num: 19, arabic: "الْعَلِيمُ", urdu: "Al-Aleem", meaning: "Sab Kuch Janne Wala (The All-Knowing)" },
  { num: 20, arabic: "الْقَابِضُ", urdu: "Al-Qabid", meaning: "Tang Karne Wala (The Restrainer)" },
  { num: 21, arabic: "الْبَاسِطُ", urdu: "Al-Basit", meaning: "Farakh Karne Wala (The Extender)" },
  { num: 22, arabic: "الْخَافِضُ", urdu: "Al-Khafid", meaning: "Pasto Karne Wala (The Abaser)" },
  { num: 23, arabic: "الرَّافِعُ", urdu: "Ar-Rafi", meaning: "Buland Karne Wala (The Exalter)" },
  { num: 24, arabic: "الْمُعِزُّ", urdu: "Al-Mu'izz", meaning: "Izzat Dene Wala (The Giver of Honour)" },
  { num: 25, arabic: "المُذِلُّ", urdu: "Al-Muzill", meaning: "Zillat Dene Wala (The Dishonourer)" },
  { num: 26, arabic: "السَّمِيعُ", urdu: "As-Samee", meaning: "Sab Kuch Sunne Wala (The All-Hearing)" },
  { num: 27, arabic: "الْبَصِيرُ", urdu: "Al-Baseer", meaning: "Sab Kuch Dekhne Wala (The All-Seeing)" },
  { num: 28, arabic: "الْحَكَمُ", urdu: "Al-Hakam", meaning: "Faisla Farmane Wala (The Judge)" },
  { num: 29, arabic: "الْعَدْلُ", urdu: "Al-Adl", meaning: "Insaaf Farmane Wala (The Utterly Just)" },
  { num: 30, arabic: "اللَّطِيفُ", urdu: "Al-Lateef", meaning: "Lutf-o-Karam Wala (The Subtle One)" },
  { num: 31, arabic: "الْخَبِيرُ", urdu: "Al-Khabeer", meaning: "Ba-Khabar (The All-Aware)" },
  { num: 32, arabic: "الْحَلِيمُ", urdu: "Al-Haleem", meaning: "Burdbaar (The Forbearing)" },
  { num: 33, arabic: "الْعَظِيمُ", urdu: "Al-Azeem", meaning: "Azmat Wala (The Magnificent)" },
  { num: 34, arabic: "الْغَفُورُ", urdu: "Al-Ghafoor", meaning: "Bohot Muaf Karne Wala (The Great Forgiver)" },
  { num: 35, arabic: "الشَّكُورُ", urdu: "Ash-Shakoor", meaning: "Qadardaan (The Most Appreciative)" },
  { num: 36, arabic: "الْعَلِيُّ", urdu: "Al-Ali", meaning: "Bohot Buland (The Most High)" },
  { num: 37, arabic: "الْكَبِيرُ", urdu: "Al-Kabeer", meaning: "Bohot Bada (The Most Great)" },
  { num: 38, arabic: "الْحَفِيظُ", urdu: "Al-Hafeez", meaning: "Hifazat Karne Wala (The Preserver)" },
  { num: 39, arabic: "المُقِيتُ", urdu: "Al-Muqeet", meaning: "Rozi Pahunchane Wala (The Sustainer)" },
  { num: 40, arabic: "الْحسِيبُ", urdu: "Al-Haseeb", meaning: "Hisab Lene Wala (The Reckoner)" },
  { num: 41, arabic: "الْجَلِيلُ", urdu: "Al-Jaleel", meaning: "Buzurgi Wala (The Majestic)" },
  { num: 42, arabic: "الْكَرِيمُ", urdu: "Al-Kareem", meaning: "Karam Farmane Wala (The Most Generous)" },
  { num: 43, arabic: "الرَّقِيبُ", urdu: "Ar-Raqeeb", meaning: "Nigraan (The Watchful)" },
  { num: 44, arabic: "الْمُجِيبُ", urdu: "Al-Mujeeb", meaning: "Duaein Qubool Karne Wala (The Responsive)" },
  { num: 45, arabic: "الْوَاسِعُ", urdu: "Al-Wasi", meaning: "Kushaadgi Wala (The All-Encompassing)" },
  { num: 46, arabic: "الْحَكِيمُ", urdu: "Al-Hakeem", meaning: "Hikmat Wala (The All-Wise)" },
  { num: 47, arabic: "الْوَدُودُ", urdu: "Al-Wadood", meaning: "Mohabbat Karne Wala (The Most Loving)" },
  { num: 48, arabic: "الْمَجِيدُ", urdu: "Al-Majeed", meaning: "Buzurg (The Glorious)" },
  { num: 49, arabic: "الْبَاعِثُ", urdu: "Al-Ba'ith", meaning: "Maut Ke Baad Uthane Wala (The Resurrector)" },
  { num: 50, arabic: "الشَّهِيدُ", urdu: "Ash-Shaheed", meaning: "Gawah (The Witness)" },
  { num: 51, arabic: "الْحَقُّ", urdu: "Al-Haqq", meaning: "Haq Aur Sach (The Absolute Truth)" },
  { num: 52, arabic: "الْوَكِيلُ", urdu: "Al-Wakeel", meaning: "Kaarsaaz (The Trustee)" },
  { num: 53, arabic: "الْقَوِيُّ", urdu: "Al-Qawi", meaning: "Taaqatwar (The Most Strong)" },
  { num: 54, arabic: "الْمَتِينُ", urdu: "Al-Mateen", meaning: "Mazboot (The Firm)" },
  { num: 55, arabic: "الْوَلِيُّ", urdu: "Al-Wali", meaning: "Madadgaar Dost (The Protecting Associate)" },
  { num: 56, arabic: "الْحَمِيدُ", urdu: "Al-Hameed", meaning: "Tareef Ke Layaq (The Praiseworthy)" },
  { num: 57, arabic: "الْمُحْصِي", urdu: "Al-Muhsi", meaning: "Shumar Karne Wala (The All-Enumerating)" },
  { num: 58, arabic: "الْمُبْدِئُ", urdu: "Al-Mubdi", meaning: "Pehli Baar Paida Karne Wala (The Originator)" },
  { num: 59, arabic: "الْمُعِيدُ", urdu: "Al-Mu'id", meaning: "Dobara Paida Karne Wala (The Restorer)" },
  { num: 60, arabic: "الْمُحْيِي", urdu: "Al-Muhyi", meaning: "Zindagi Bakhshne Wala (The Giver of Life)" },
  { num: 61, arabic: "اَلْمُمِيتُ", urdu: "Al-Mumeet", meaning: "Maut Dene Wala (The Bringer of Death)" },
  { num: 62, arabic: "الْحَيُّ", urdu: "Al-Hayy", meaning: "Hamesha Zinda (The Ever-Living)" },
  { num: 63, arabic: "الْقَيُّومُ", urdu: "Al-Qayyum", meaning: "Sab Ko Qaim Rakhne Wala (The Sustainer)" },
  { num: 64, arabic: "الْوَاجِدُ", urdu: "Al-Wajid", meaning: "Paane Wala (The Perceiver)" },
  { num: 65, arabic: "الْمَاجِدُ", urdu: "Al-Majid", meaning: "Badi Shaan Wala (The Illustrious)" },
  { num: 66, arabic: "الْواحِدُ", urdu: "Al-Wahid", meaning: "Yakka Aur Tanha (The One)" },
  { num: 67, arabic: "اَلاَحَدُ", urdu: "Al-Ahad", meaning: "Ek Aur Akela (The Unique / Indivisible)" },
  { num: 68, arabic: "الصَّمَدُ", urdu: "As-Samad", meaning: "Be-Niaz (The Eternal / Self-Sufficient)" },
  { num: 69, arabic: "الْقَادِرُ", urdu: "Al-Qadir", meaning: "Qudrat Wala (The All-Powerful)" },
  { num: 70, arabic: "الْمُقْتَدِرُ", urdu: "Al-Muqtadir", meaning: "Kamil Qudrat Wala (The Determiner)" },
  { num: 71, arabic: "الْمُقَدِّمُ", urdu: "Al-Muqaddim", meaning: "Aage Karne Wala (The Expediter)" },
  { num: 72, arabic: "الْمُؤَخِّرُ", urdu: "Al-Mu'akhkhir", meaning: "Peechhe Karne Wala (The Delayer)" },
  { num: 73, arabic: "الأوَّلُ", urdu: "Al-Awwal", meaning: "Sab Se Pehla (The First)" },
  { num: 74, arabic: "الآخِرُ", urdu: "Al-Akhir", meaning: "Sab Se Aakhir (The Last)" },
  { num: 75, arabic: "الظَّاهِرُ", urdu: "Az-Zahir", meaning: "Zahir (The Manifest)" },
  { num: 76, arabic: "الْبَاطِنُ", urdu: "Al-Batin", meaning: "Chhupa Hua (The Hidden)" },
  { num: 77, arabic: "الْوَالِي", urdu: "Al-Wali", meaning: "Hukmran (The Governor)" },
  { num: 78, arabic: "الْمُتَعَالِي", urdu: "Al-Muta'ali", meaning: "Sab Se Buland (The Supremely Exalted)" },
  { num: 79, arabic: "الْبَرُّ", urdu: "Al-Barr", meaning: "Ehsaan Farmane Wala (The Source of All Goodness)" },
  { num: 80, arabic: "التَّوَّابُ", urdu: "At-Tawwab", meaning: "Tauba Qubool Karne Wala (The Acceptor of Repentance)" },
  { num: 81, arabic: "الْمُنْتَقِمُ", urdu: "Al-Muntaqim", meaning: "Badla Lene Wala (The Avenger)" },
  { num: 82, arabic: "العَفُوُّ", urdu: "Al-Afuww", meaning: "Darguzar Farmane Wala (The Pardoner)" },
  { num: 83, arabic: "الرَّؤُوفُ", urdu: "Ar-Ra'oof", meaning: "Shafeeq (The Most Kind)" },
  { num: 84, arabic: "مَالِكُ الْمُلْكِ", urdu: "Malik-ul-Mulk", meaning: "Tamam Jahan Ka Malik (Owner of All Sovereignty)" },
  { num: 85, arabic: "ذُوالْجَلاَلِ وَالإكْرَامِ", urdu: "Zul-Jalali-wal-Ikram", meaning: "Jalal Aur Inam Wala (Lord of Majesty and Generosity)" },
  { num: 86, arabic: "الْمُقْسِطُ", urdu: "Al-Muqsit", meaning: "Insaaf Karne Wala (The Equitable)" },
  { num: 87, arabic: "الْجَامِعُ", urdu: "Al-Jami", meaning: "Jama Karne Wala (The Gatherer)" },
  { num: 88, arabic: "الْغَنِيُّ", urdu: "Al-Ghani", meaning: "Be-Parwah / Ghani (The Self-Sufficient)" },
  { num: 89, arabic: "الْمُغْنِي", urdu: "Al-Mughni", meaning: "Ghani Karne Wala (The Enricher)" },
  { num: 90, arabic: "اَلْمَانِعُ", urdu: "Al-Mani", meaning: "Rokne Wala (The Preventer)" },
  { num: 91, arabic: "الضَّارَّ", urdu: "Ad-Darr", meaning: "Nuqsan Pahunchane Wala (The Distressor)" },
  { num: 92, arabic: "النَّافِعُ", urdu: "An-Nafi", meaning: "Faida Pahunchane Wala (The Benefactor)" },
  { num: 93, arabic: "النُّورُ", urdu: "An-Nur", meaning: "Roshni Dene Wala (The Light)" },
  { num: 94, arabic: "الْهَادِي", urdu: "Al-Hadi", meaning: "Hidayat Dene Wala (The Guide)" },
  { num: 95, arabic: "الْبَدِيعُ", urdu: "Al-Badi", meaning: "Bemisaal Paida Karne Wala (The Incomparable Originator)" },
  { num: 96, arabic: "اَلْبَاقِي", urdu: "Al-Baqi", meaning: "Hamesha Baqi Rehne Wala (The Everlasting)" },
  { num: 97, arabic: "الْوَارِثُ", urdu: "Al-Warith", meaning: "Sab Ka Waris (The Inheritor)" },
  { num: 98, arabic: "الرَّشِيدُ", urdu: "Ar-Rasheed", meaning: "Seedhi Rah Dikhane Wala (The Infallible Guide)" },
  { num: 99, arabic: "الصَّبُورُ", urdu: "As-Saboor", meaning: "Sabr Karne Wala (The Most Patient)" }
];

// Essential Daily Masnoon Duas
export const DAILY_DUAS = [
  {
    topic: "Ghar Se Nikalne Ki Dua",
    arabic: "بِسْمِ اللَّهِ تَوَكَّلْتُ عَلَى اللَّهِ، وَلاَ حَوْلَ وَلاَ قُوَّةَ إِلاَّ بِاللَّهِ",
    roman: "Bismillahi tawakkaltu 'alallahi, wa la hawla wa la quwwata illa billah.",
    urdu: "Allah ke naam ke sath, maine Allah par bharosa kiya, aur burai se bachne aur neki karne ki taqat Allah hi ki taraf se hai."
  },
  {
    topic: "Safar Ki Dua",
    arabic: "سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَٰذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ وَإِنَّا إِلَىٰ رَبِّنَا لَمُنقَلِبُونَ",
    roman: "Subhanallazi sakh-khara lana haza wa ma kunna lahu muqrinin, wa inna ila rabbina lamunqalibun.",
    urdu: "Pak hai Wo Zaat jis ne is (sawari) ko hamare bas mein kiya warna hum isay qaboo karne walay na thay, aur yaqeenan hum apne Rab hi ki taraf lautne walay hain."
  },
  {
    topic: "Sone Se Pehle Ki Dua",
    arabic: "اللَّهُمَّ بِاسْمِكَ أَمُوتُ وَأَحْيَا",
    roman: "Allahumma bismika amutu wa ahya.",
    urdu: "Ae Allah! Main tere hi naam par marta (sota) hoon aur zinda hota (uth-ta) hoon."
  },
  {
    topic: "Subha Uthne Ki Dua",
    arabic: "الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ",
    roman: "Alhamdu lillahillazi ahyana ba'da ma amatana wa ilayhin-nushoor.",
    urdu: "Tamam tareefein Allah ke liye hain jis ne hamein marne (sone) ke baad zinda kiya aur usi ki taraf laut kar jana hai."
  },
  {
    topic: "Khana Khane Ke Baad Ki Dua",
    arabic: "الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنَا وَسَقَانَا وَجَعَلَنَا مُسْلِمِينَ",
    roman: "Alhamdu lillahillazi at'amana wa saqana wa ja'alana muslimeen.",
    urdu: "Shukar hai Allah ka jis ne hamein khilaya, pilaya aur musalman banaya."
  },
  {
    topic: "Pareshani Aur Fikar Door Karne Ki Dua",
    arabic: "حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ",
    roman: "Hasbunallahu wa ni'mal wakeel.",
    urdu: "Hamein Allah hi kafi hai aur Wo behtareen kaarsaaz hai."
  },
  {
    topic: "Ilm Mein Izafay Ki Dua",
    arabic: "رَّبِّ زِدْنِي عِلْمًا",
    roman: "Rabbi zidni 'ilma.",
    urdu: "Ae mere Rab! Mere ilm mein barkat aur izafa farma."
  },
  {
    topic: "Maghfirat Aur Reham Ki Dua",
    arabic: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ",
    roman: "Rabbana aatina fid-dunya hasanatan wa fil-aakhirati hasanatan wa qina 'azaban-nar.",
    urdu: "Ae hamare Rab! Hamein dunya mein bhi bhalai ata farma aur aakhirat mein bhi bhalai ata farma, aur hamein aag (jahannam) ke azaab se bacha."
  }
];

// --- CORE FUNCTIONS ---

const SURAH_ALIASES = {
  'yaseen': 36,
  'yasin': 36,
  'rehman': 55,
  'rahman': 55,
  'mulk': 67,
  'fatiha': 1,
  'fatihah': 1,
  'fateha': 1,
  'baqra': 2,
  'baqarah': 2,
  'baqara': 2,
  'kahf': 18,
  'kahaf': 18,
  'ikhlas': 112,
  'qulhuwallah': 112,
  'falaq': 113,
  'falak': 113,
  'naas': 114,
  'nas': 114,
  'waqiah': 56,
  'waqia': 56,
  'waqea': 56,
  'kausar': 108,
  'kawthar': 108,
  'maryam': 19,
  'mariam': 19,
  'yousuf': 12,
  'yusuf': 12,
  'imran': 3,
  'aleimran': 3,
  'nisa': 4,
  'juma': 62,
  'jummah': 62,
  'jumuah': 62,
  'taha': 20,
  'duha': 93,
  'adduha': 93,
  'inshirah': 94,
  'alamnashrah': 94,
  'qadr': 97,
  'tin': 95,
  'teen': 95,
  'feel': 105,
  'fil': 105,
  'quraish': 106,
  'quraysh': 106,
  'maun': 107,
  'kafiroon': 109,
  'kafirun': 109,
  'nasr': 110,
  'lahab': 111,
  'masad': 111
};

/**
 * Find Surah by Number (1-114) or Name / Transliteration
 */
export function findSurah(query) {
  if (!query) return null;
  const q = String(query).trim().toLowerCase();

  // If number
  const num = parseInt(q, 10);
  if (!isNaN(num) && num >= 1 && num <= 114) {
    return SURAHS_LIST[num - 1];
  }

  // If common phonetic alias
  const cleanQ = q.replace(/^(surah|al-|an-|ash-|at-|ar-|az-)/i, '').replace(/[^a-z0-9]/g, '');
  if (SURAH_ALIASES[cleanQ]) {
    return SURAHS_LIST[SURAH_ALIASES[cleanQ] - 1];
  }

  // Search by name / transliteration
  return SURAHS_LIST.find(s => {
    const sName = s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const sArabic = s.arabic;
    return sName.includes(cleanQ) || cleanQ.includes(sName) || sArabic.includes(q);
  }) || null;
}

/**
 * Smart lookup for Masnoon Duas by keyword (safar, sona, khana, etc.)
 */
export function findDua(query) {
  if (!query) return DAILY_DUAS[Math.floor(Math.random() * DAILY_DUAS.length)];
  const q = String(query).toLowerCase().trim();
  const match = DAILY_DUAS.find(d => 
    d.topic.toLowerCase().includes(q) || 
    d.urdu.toLowerCase().includes(q) || 
    d.roman.toLowerCase().includes(q)
  );
  return match || DAILY_DUAS[Math.floor(Math.random() * DAILY_DUAS.length)];
}

/**
 * Fetch Ayah details with Arabic, Urdu translation, English translation & Maududi Tafseer
 */
export async function getAyahDetails(surahNum, ayahNum) {
  // Check for Ayat-ul-Kursi shorthand
  const checkStr = `${surahNum} ${ayahNum || ''}`.toLowerCase();
  if (checkStr.includes('kursi')) {
    surahNum = 2;
    ayahNum = 255;
  }

  const surah = findSurah(surahNum);
  if (!surah) {
    throw new Error(`Surah #${surahNum} nahi mili. Surah 1 se 114 tak hoti hain.`);
  }

  const sNumber = surah.number;
  const aNumber = parseInt(ayahNum, 10);
  if (isNaN(aNumber) || aNumber < 1 || aNumber > surah.ayahs) {
    throw new Error(`Surah ${surah.name} mein total ${surah.ayahs} ayahs hain. Please 1 se ${surah.ayahs} ke darmiyan number dein.`);
  }

  const url = `https://api.alquran.cloud/v1/ayah/${sNumber}:${aNumber}/editions/quran-uthmani,ur.jalandhry,en.sahih,ur.maududi`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`AlQuran Cloud API error: HTTP ${res.status}`);
  const json = await res.json();

  if (json.code !== 200 || !json.data) {
    throw new Error("Ayah data fetch nahi ho saka.");
  }

  const editions = json.data;
  const arabicText = editions.find(e => e.edition.identifier === 'quran-uthmani')?.text || '';
  const urduTrans = editions.find(e => e.edition.identifier === 'ur.jalandhry')?.text || '';
  const engTrans = editions.find(e => e.edition.identifier === 'en.sahih')?.text || '';
  const urduTafseer = editions.find(e => e.edition.identifier === 'ur.maududi')?.text || '';

  const audioUrl = `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${editions[0].number}.mp3`;

  return {
    surah,
    ayahNumber: aNumber,
    globalAyahNumber: editions[0].number,
    arabic: arabicText,
    urdu: urduTrans,
    english: engTrans,
    tafseer: urduTafseer,
    audioUrl
  };
}

/**
 * Fetch Surah Translation Summary & Details
 */
export async function getSurahOverview(query) {
  const surah = findSurah(query);
  if (!surah) {
    throw new Error(`Surah "${query}" nahi mili. Surah number (1-114) ya naam check karein.`);
  }

  // Fetch opening 5 ayahs with Urdu translation
  const url = `https://api.alquran.cloud/v1/surah/${surah.number}/editions/quran-uthmani,ur.jalandhry`;
  let sampleAyahs = [];
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const json = await res.json();
      if (json.code === 200 && json.data) {
        const arData = json.data[0]?.ayahs || [];
        const urData = json.data[1]?.ayahs || [];
        sampleAyahs = arData.slice(0, 3).map((a, i) => ({
          ayahNum: a.numberInSurah,
          arabic: a.text,
          urdu: urData[i]?.text || ''
        }));
      }
    }
  } catch (e) {}

  const paddedNum = String(surah.number).padStart(3, '0');
  const fullAudioUrl = `https://server8.mp3quran.net/afs/${paddedNum}.mp3`;

  return {
    surah,
    audioUrl: fullAudioUrl,
    sampleAyahs
  };
}

/**
 * Get Direct Quran Tilawat Audio URL for Full Surah (High-speed Cloudflare CDN)
 */
export function getSurahAudio(query, reciter = 'alafasy') {
  const surah = findSurah(query);
  if (!surah) {
    throw new Error(`Surah "${query}" nahi mili. Example: tilawat 36 ya tilawat yasin`);
  }

  const paddedNum = String(surah.number).padStart(3, '0');
  let audioUrl = `https://download.quranicaudio.com/quran/mishaari_raashid_al_3afaasee/${paddedNum}.mp3`;
  let fallbackUrl = `https://server8.mp3quran.net/afs/${paddedNum}.mp3`;
  let reciterName = "Sheikh Mishary Rashid Alafasy (مشاري راشد العفاسي)";

  if (/sudais|sds/i.test(reciter)) {
    audioUrl = `https://download.quranicaudio.com/quran/abdurrahmaan_as-sudays/${paddedNum}.mp3`;
    fallbackUrl = `https://server11.mp3quran.net/sds/${paddedNum}.mp3`;
    reciterName = "Sheikh Abdul Rahman Al-Sudais (عبد الرحمن السديس)";
  } else if (/abdulbaset|basit/i.test(reciter)) {
    audioUrl = `https://download.quranicaudio.com/quran/abdulbaset_mujawwad/${paddedNum}.mp3`;
    fallbackUrl = `https://server7.mp3quran.net/basit/${paddedNum}.mp3`;
    reciterName = "Sheikh Abdul Basit Abdul Samad (عبد الباسط عبد الصمد)";
  } else if (/ghamdi/i.test(reciter)) {
    audioUrl = `https://download.quranicaudio.com/quran/sa3d_al-ghaamidee/${paddedNum}.mp3`;
    fallbackUrl = `https://server8.mp3quran.net/ghamdi/${paddedNum}.mp3`;
    reciterName = "Sheikh Saad Al-Ghamdi (سعد الغامدي)";
  } else if (/maher|muaiqly/i.test(reciter)) {
    audioUrl = `https://download.quranicaudio.com/quran/maher_almu3aiqly/${paddedNum}.mp3`;
    fallbackUrl = `https://server12.mp3quran.net/maher/${paddedNum}.mp3`;
    reciterName = "Sheikh Maher Al-Muaiqly (ماهر المعيقلي)";
  }

  return {
    surah,
    audioUrl,
    fallbackUrl,
    reciterName
  };
}

/**
 * Fetch Tilawat MP3 at high speed into Buffer using connection-pooled fetch
 */
export async function getFastSurahAudioBuffer(query, reciter = 'alafasy') {
  const info = getSurahAudio(query, reciter);
  const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

  // 1. Fast Cloudflare CDN Fetch
  try {
    const res = await fetch(info.audioUrl, {
      signal: AbortSignal.timeout(12000),
      headers
    });
    if (res.ok) {
      const ab = await res.arrayBuffer();
      return {
        ...info,
        buffer: Buffer.from(ab)
      };
    }
  } catch (err) {
    console.warn(`Fast Cloudflare CDN fetch error for Surah ${info.surah.number}:`, err.message);
  }

  // 2. Secondary CDN Fallback
  if (info.fallbackUrl) {
    try {
      const res = await fetch(info.fallbackUrl, {
        signal: AbortSignal.timeout(15000),
        headers
      });
      if (res.ok) {
        const ab = await res.arrayBuffer();
        return {
          ...info,
          buffer: Buffer.from(ab)
        };
      }
    } catch (e) {}
  }

  // Return info without buffer if both downloads timed out (Baileys will stream directly)
  return info;
}

/**
 * Fetch Hadith from Six Books by Book Name & Number (Bukhari, Muslim, Tirmidhi, Abu Dawud, Nasai, Ibn Majah)
 */
export async function getHadith(bookQuery, hadithNumber) {
  const bKey = String(bookQuery || 'bukhari').trim().toLowerCase().replace(/[^a-z]/g, '');
  let bookConfig = null;
  let bookCode = 'bukhari';

  if (bKey.includes('muslim')) {
    bookConfig = HADITH_BOOKS.muslim;
    bookCode = 'muslim';
  } else if (bKey.includes('tirmidhi')) {
    bookConfig = HADITH_BOOKS.tirmidhi;
    bookCode = 'tirmidhi';
  } else if (bKey.includes('dawud') || bKey.includes('abudawud')) {
    bookConfig = HADITH_BOOKS.abudawud;
    bookCode = 'abudawud';
  } else if (bKey.includes('nasai')) {
    bookConfig = HADITH_BOOKS.nasai;
    bookCode = 'nasai';
  } else if (bKey.includes('majah') || bKey.includes('ibnmajah')) {
    bookConfig = HADITH_BOOKS.ibnmajah;
    bookCode = 'ibnmajah';
  } else {
    bookConfig = HADITH_BOOKS.bukhari;
    bookCode = 'bukhari';
  }

  let hNum = parseInt(hadithNumber, 10);
  if (isNaN(hNum) || hNum < 1) {
    hNum = 1;
  }
  if (hNum > bookConfig.maxHadith) {
    throw new Error(`${bookConfig.title} mein hadith number 1 se ${bookConfig.maxHadith} tak dastyab hain.`);
  }

  // Fetch Urdu edition and English edition concurrently from jsDelivr Fawaz Ahmed API
  const urdUrl = `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/${bookConfig.urdKey}/${hNum}.json`;
  const engUrl = `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/${bookConfig.engKey}/${hNum}.json`;
  const araUrl = `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/${bookConfig.araKey}/${hNum}.json`;

  const [urdRes, engRes, araRes] = await Promise.allSettled([
    fetch(urdUrl, { signal: AbortSignal.timeout(6000) }).then(r => r.ok ? r.json() : null),
    fetch(engUrl, { signal: AbortSignal.timeout(6000) }).then(r => r.ok ? r.json() : null),
    fetch(araUrl, { signal: AbortSignal.timeout(6000) }).then(r => r.ok ? r.json() : null)
  ]);

  const urdData = urdRes.status === 'fulfilled' ? urdRes.value : null;
  const engData = engRes.status === 'fulfilled' ? engRes.value : null;
  const araData = araRes.status === 'fulfilled' ? araRes.value : null;

  const hadithUrdu = urdData?.hadiths?.[0]?.text || null;
  const hadithEng = engData?.hadiths?.[0]?.text || null;
  const hadithAra = araData?.hadiths?.[0]?.text || null;
  const grades = urdData?.hadiths?.[0]?.grades || engData?.hadiths?.[0]?.grades || [];

  if (!hadithUrdu && !hadithEng && !hadithAra) {
    throw new Error(`Hadith #${hNum} (${bookConfig.title}) load nahi ho saki.`);
  }

  return {
    book: bookConfig.title,
    bookCode,
    number: hNum,
    arabic: hadithAra,
    urdu: hadithUrdu,
    english: hadithEng,
    grades
  };
}

/**
 * Get Prayer Times (Namaz) for Any City
 */
export async function getPrayerTimes(cityName = 'Karachi', country = 'Pakistan') {
  const url = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(cityName)}&country=${encodeURIComponent(country)}&method=1`;
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`AlAdhan API error: HTTP ${res.status}`);
  const json = await res.json();

  if (json.code !== 200 || !json.data) {
    throw new Error(`"${cityName}" ke prayer times nahi mil sakay.`);
  }

  const d = json.data;
  const t = d.timings;
  const hDate = d.date?.hijri;
  const gDate = d.date?.readable;

  return {
    city: cityName,
    country,
    gregorian: gDate,
    hijri: hDate ? `${hDate.day} ${hDate.month?.en} ${hDate.year} AH (${hDate.month?.ar})` : null,
    timings: {
      Fajr: t.Fajr,
      Sunrise: t.Sunrise,
      Dhuhr: t.Dhuhr,
      Asr: t.Asr,
      Maghrib: t.Maghrib,
      Isha: t.Isha
    }
  };
}

/**
 * Daily Random Inspiring Ayah
 */
export async function getRandomAyah() {
  const featuredAyahs = [
    { surah: 2, ayah: 255 }, // Ayat-ul-Kursi
    { surah: 2, ayah: 286 }, // La yukallifullahu nafsan
    { surah: 3, ayah: 139 }, // Wa la tahinu wa la tahzanu
    { surah: 13, ayah: 28 }, // Ala bi zikrillahi tatma'innul qulub
    { surah: 65, ayah: 3 },  // Wa yarzuqhu min haythu la yahtasib
    { surah: 94, ayah: 5 },  // Fa inna ma'al 'usri yusra
    { surah: 55, ayah: 13 }, // Fa bi ayyi aalaa'i rabbikuma tukazziban
    { surah: 67, ayah: 2 },  // Allazi khalaqal mawta wal hayata
    { surah: 112, ayah: 1 }  // Qul huwallahu ahad
  ];

  const pick = featuredAyahs[Math.floor(Math.random() * featuredAyahs.length)];
  return await getAyahDetails(pick.surah, pick.ayah);
}

/**
 * 12 Islamic (Hijri) Months List with Arabic & Urdu Names
 */
export const ISLAMIC_MONTHS = [
  { num: 1, name: "Muharram", arabic: "مُحَرَّم", urdu: "محرم الحرام", description: "Pehla Islami maheena aur hurmat walay 4 maheenon mein se aik." },
  { num: 2, name: "Safar", arabic: "صَفَر", urdu: "صفر المظفر", description: "Doosra Islami maheena." },
  { num: 3, name: "Rabi' al-Awwal", arabic: "رَبِيع الأَوَّل", urdu: "ربیع الاول", description: "Huzoor Nabi Kareem ﷺ ki wiladat-e-ba-sa'adat ka maheena." },
  { num: 4, name: "Rabi' al-Thani", arabic: "رَبِيع الآخِر", urdu: "ربیع الثانی / ربیع الآخر", description: "Chautha Islami maheena (Giyarween Sharif)." },
  { num: 5, name: "Jumada al-Awwal", arabic: "جُمَادَىٰ الأُولَىٰ", urdu: "جمادی الاول", description: "Panchwa Islami maheena." },
  { num: 6, name: "Jumada al-Thani", arabic: "جُمَادَىٰ الآخِرَة", urdu: "جمادی الثانی", description: "Chhata Islami maheena." },
  { num: 7, name: "Rajab", arabic: "رَجَب", urdu: "رجب المرجب", description: "Hurmat wala maheena, Shab-e-Miraj-un-Nabi ﷺ (27 Rajab)." },
  { num: 8, name: "Sha'ban", arabic: "شَعْبَان", urdu: "شعبان المعظم", description: "Barkaton wala maheena, Shab-e-Barat (15 Sha'ban)." },
  { num: 9, name: "Ramadan", arabic: "رَمَضَان", urdu: "رمضان المبارک", description: "Rozon aur Quran-e-Pak ke nuzool ka babarkat tareen maheena, Shab-e-Qadr." },
  { num: 10, name: "Shawwal", arabic: "شَوَّال", urdu: "شوال المکرم", description: "Eid-ul-Fitr (1 Shawwal) aur 6 nafli rozon ka maheena." },
  { num: 11, name: "Dhu al-Qi'dah", arabic: "ذُو القَعْدَة", urdu: "ذی القعدہ", description: "Hurmat wala maheena, Hajj ki tayyari." },
  { num: 12, name: "Dhu al-Hijjah", arabic: "ذُو الحِجَّة", urdu: "ذی الحجہ", description: "Hajj, Youm-e-Arafah (9 Zul-Hijjah) aur Eid-ul-Adha (10 Zul-Hijjah)." }
];

/**
 * Major Sacred Islamic Events & Festivals (Hijri Calendar)
 */
export const MAJOR_ISLAMIC_EVENTS = [
  { day: 1, month: 1, event: "Naya Islami Saal (Hijri New Year)", desc: "1st Muharram — Aaghaz-e-Saal-e-Nau" },
  { day: 9, month: 1, event: "Tasu'a (Ashura se pehle ka roza)", desc: "9th Muharram — Sunnat Roza" },
  { day: 10, month: 1, event: "Youm-e-Ashura", desc: "10th Muharram — Shahadat-e-Hazrat Imam Hussain (R.A) & Roza" },
  { day: 12, month: 3, event: "Eid Milad-un-Nabi ﷺ", desc: "12th Rabi-ul-Awwal — Wiladat-e-Khatam-un-Nabiyyin ﷺ" },
  { day: 27, month: 7, event: "Shab-e-Miraj-un-Nabi ﷺ", desc: "27th Rajab — Isra wal Miraj ki Mubarak Raat" },
  { day: 15, month: 8, event: "Shab-e-Barat (Lailat-ul-Bara'ah)", desc: "15th Sha'ban — Maghfirat aur Rahmat ki Raat" },
  { day: 1, month: 9, event: "Aaghaz-e-Ramazan-ul-Mubarak", desc: "1st Ramadan — Pehla Roza Mubarak" },
  { day: 17, month: 9, event: "Ghazwa-e-Badr", desc: "17th Ramadan — Youm-ul-Furqan" },
  { day: 27, month: 9, event: "Shab-e-Qadr (Lailat-ul-Qadr)", desc: "27th Ramadan — Hazar maheenon se behtar raat" },
  { day: 1, month: 10, event: "Eid-ul-Fitr (Meethi Eid)", desc: "1st Shawwal — Ramazan ke baad Allah ki taraf se inaam" },
  { day: 8, month: 12, event: "Aaghaz-e-Ayyam-e-Hajj", desc: "8th Zul-Hijjah — Youm-ut-Tarwiyah" },
  { day: 9, month: 12, event: "Youm-e-Arafah (Hajj ka Azeem Din)", desc: "9th Zul-Hijjah — Wuqoof-e-Arafat aur Afzal Roza" },
  { day: 10, month: 12, event: "Eid-ul-Adha (Bakra Eid / Sunnat-e-Ibrahimi)", desc: "10th Zul-Hijjah — Qurbani aur Eid" },
  { day: 11, month: 12, event: "Ayyam-e-Tashreeq", desc: "11-13 Zul-Hijjah — Takbeerat-e-Tashreeq aur Qurbani ke din" }
];

/**
 * Get Today's Live Islamic Hijri Date with Arabic/Urdu Names & Events
 */
export async function getIslamicDate() {
  try {
    const today = new Date();
    const dStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;
    const url = `https://api.aladhan.com/v1/gToH?date=${dStr}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const json = await res.json();
      if (json.code === 200 && json.data?.hijri) {
        const h = json.data.hijri;
        const g = json.data.gregorian;
        const monthNum = parseInt(h.month.number, 10);
        const dayNum = parseInt(h.day, 10);
        const monthInfo = ISLAMIC_MONTHS[monthNum - 1] || null;
        const eventToday = MAJOR_ISLAMIC_EVENTS.find(e => e.day === dayNum && e.month === monthNum);

        return {
          day: dayNum,
          monthNumber: monthNum,
          monthNameEn: h.month.en,
          monthNameAr: h.month.ar,
          monthNameUrdu: monthInfo ? monthInfo.urdu : h.month.en,
          year: h.year,
          designation: h.designation?.abbreviated || "AH",
          weekdayEn: h.weekday?.en,
          weekdayAr: h.weekday?.ar,
          formattedHijri: `${dayNum} ${monthInfo ? monthInfo.urdu : h.month.en} ${h.year} Hijri (${h.month.ar})`,
          formattedEnglish: `${g.day} ${g.month?.en} ${g.year}`,
          description: monthInfo?.description || null,
          eventToday: eventToday || null,
          holidays: h.holidays || []
        };
      }
    }
  } catch (err) {
    console.warn("AlAdhan Hijri API fetch error, using Intl fallback:", err.message);
  }

  // Offline Intl DateTimeFormat Fallback
  const today = new Date();
  const parts = new Intl.DateTimeFormat('en-TN-u-ca-islamic-umalqura', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    weekday: 'long'
  }).formatToParts(today);

  const dayVal = parseInt(parts.find(p => p.type === 'day')?.value || '1', 10);
  const monthVal = parseInt(parts.find(p => p.type === 'month')?.value || '1', 10);
  const yearVal = parts.find(p => p.type === 'year')?.value || '1448';
  const weekdayVal = parts.find(p => p.type === 'weekday')?.value || '';
  const monthInfo = ISLAMIC_MONTHS[monthVal - 1] || null;
  const eventToday = MAJOR_ISLAMIC_EVENTS.find(e => e.day === dayVal && e.month === monthVal);

  return {
    day: dayVal,
    monthNumber: monthVal,
    monthNameEn: monthInfo?.name || "Islamic Month",
    monthNameAr: monthInfo?.arabic || "",
    monthNameUrdu: monthInfo?.urdu || "Islami Maheena",
    year: yearVal,
    designation: "AH",
    weekdayEn: weekdayVal,
    formattedHijri: `${dayVal} ${monthInfo ? monthInfo.urdu : ''} ${yearVal} Hijri`,
    formattedEnglish: today.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }),
    description: monthInfo?.description || null,
    eventToday: eventToday || null,
    holidays: []
  };
}
