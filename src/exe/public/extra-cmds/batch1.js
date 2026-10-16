// Batch 1 web companion: adds the 27 new Fun & AI commands to the
// dashboard's Commands Reference grid (#commands-grid). Plain browser script,
// idempotent and fully defensive — no-ops if the grid is absent.
(function () {
  'use strict';

  var COMMANDS = [
    ['!imggen flying cat', 'AI image generator'],
    ['!editphoto cyberpunk style', 'AI photo editor (photo pe reply karein)'],
    ['!summarize <lambi text>', 'Text ka khulasa'],
    ['!askdoc yeh kis bare mein hai?', 'Reply kiye message se sawal'],
    ['!tr en Salam kya haal hai', 'Translator'],
    ['!grammar He go to school', 'Grammar fixer'],
    ['!letter 3 din ki chutti', 'Application/letter writer'],
    ['!codehelp for loop samjhao', 'Code explainer'],
    ['!cv Ali, driver, 3 saal tajurba', 'CV builder'],
    ['!brandname chai ka dhaba', 'Business names + slogans'],
    ['!kahani bahadur billa', 'Bachon ki kahani'],
    ['!horoscope aries', 'Daily sitara (fun)'],
    ['!khwab maine samandar dekha', 'Khwab ki tabeer'],
    ['!personality', 'Personality quiz'],
    ['!tictactoe', 'Tic-tac-toe vs bot'],
    ['!hangman', 'Hangman word game'],
    ['!quiz', 'GK quiz + scoreboard'],
    ['!truthdare truth', 'Truth ya dare'],
    ['!8ball kya main ameer banunga?', 'Magic 8-ball jawab'],
    ['!rps rock', 'Pathar kaichi kagaz'],
    ['!guessnum', 'Number guess (1-100)'],
    ['!wordchain apple', 'Word chain game'],
    ['!emojimovie', 'Emoji se movie guess'],
    ['!scramble', 'Ulte lafz seedhe karein'],
    ['!mathduel', 'Speed maths challenge'],
    ['!gameboard', 'Top gamers leaderboard'],
    ['!memecaption jab bijli chali jaye', 'Caption ka funny score']
  ];

  // Expose for other scripts / debugging.
  try { window.AWAX_BATCH1_COMMANDS = COMMANDS; } catch (e) {}

  function inject() {
    try {
      var grid = document.getElementById('commands-grid');
      if (!grid || grid.dataset.batch1Done === '1') return;
      COMMANDS.forEach(function (pair) {
        var b = document.createElement('button');
        b.className = 'cmd';
        b.setAttribute('data-batch', '1');
        var c = document.createElement('code');
        c.textContent = pair[0];
        var s = document.createElement('span');
        s.textContent = pair[1];
        b.appendChild(c);
        b.appendChild(s);
        // Same tap-to-copy behaviour as the static buttons.
        b.addEventListener('click', function () {
          try {
            var t = pair[0].split(' ')[0];
            if (navigator.clipboard) navigator.clipboard.writeText(t);
          } catch (e) {}
        });
        grid.appendChild(b);
      });
      grid.dataset.batch1Done = '1';
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
