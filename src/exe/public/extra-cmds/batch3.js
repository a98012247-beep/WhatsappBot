// AwaisxBot Dashboard — Batch 3 extra commands (Islamic Plus + Education)
// Browser-safe mirror of WEB_COMMANDS from lib/batch3-deen-edu.js.
// The dashboard (public/app.js) can read window.AwaxExtraCommands to render
// command cards. Classic script — no modules, no dependencies.
(function () {
  var COMMANDS = [
    { cmd: 'qibla', title: 'Qibla Direction', desc: 'Kisi sheher se Qibla ka rukh degrees mein', usage: 'qibla <city>', section: 'Islamic Plus' },
    { cmd: 'zakat', title: 'Zakat Calculator', desc: 'Cash, sona, chandi, qarz se zakat ka hisab', usage: 'zakat <cash> <gold_tola> <silver_tola> <debts>', section: 'Islamic Plus' },
    { cmd: 'hajj', title: 'Hajj / Umrah Guide', desc: 'Hajj step-by-step aur mukhtasar Umrah guide', usage: 'hajj  /  umrah', section: 'Islamic Plus' },
    { cmd: 'seerahquiz', title: 'Seerah Quiz', desc: 'Seerat-e-Nabvi par MCQ quiz aur score', usage: 'seerah  /  seerah a', section: 'Islamic Plus' },
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
    { cmd: 'timetable', title: 'Class Timetable', desc: 'Hafte ka timetable save aur dekhein', usage: 'ttable <din> <mazameen>  /  ttable  /  ttable week', section: 'Education' }
  ];
  var MENU = '14. Islamic Plus (10) • 15. Education (9)';
  if (typeof window !== 'undefined') {
    window.AwaxExtraCommands = window.AwaxExtraCommands || {};
    window.AwaxExtraCommands.batch3 = { menu: MENU, commands: COMMANDS };
  }
})();
