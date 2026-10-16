// AwaisxBot dashboard — Batch 6 extra commands (Health & News/Info).
// Self-mounting browser script: appends command cards to #commands-grid
// (same shape as the built-in cards) and wires clicks to prefill the
// quick-reply box. Safe to load even if the grid or quick-reply form
// is absent. Include via <script src="/extra-cmds/batch6.js"></script>.
(function () {
  'use strict';

  var COMMANDS = [
    { code: '!water on', desc: 'Pani reminders (hourly 9am-10pm)' },
    { code: '!water log', desc: 'Aaj ka glass count karein' },
    { code: '!med 09:00 Panadol', desc: 'Dawai reminders' },
    { code: '!med list', desc: 'Dawai list dekhein' },
    { code: '!calories 2 roti salan', desc: 'Calories andaza' },
    { code: '!workout weight loss', desc: '7-din workout plan' },
    { code: '!sleep 7.5', desc: 'Neend tracker' },
    { code: '!sleep week', desc: 'Neend weekly report' },
    { code: '!recipe aloo, pyaz', desc: 'Recipe banayein' },
    { code: '!steps 8500', desc: 'Step challenge' },
    { code: '!steps board', desc: 'Steps leaderboard' },
    { code: '!paknews', desc: 'Pakistan headlines' },
    { code: '!cricket', desc: 'Cricket updates' },
    { code: '!football', desc: 'Football scores (Bundesliga)' },
    { code: '!prayeralert on Lahore', desc: 'Namaz alerts (5 min pehle)' },
    { code: '!rainalert Lahore', desc: 'Barish alert (24h)' },
    { code: '!loadshed set Gulberg 10am-12pm', desc: 'Bijli schedule' },
    { code: '!train Lahore Karachi', desc: 'Railway timings' },
    { code: '!jobs', desc: 'Job alerts (Pakistan)' }
  ];

  function fillQuickReply(code) {
    var input = document.getElementById('quick-reply-text');
    if (input) {
      input.value = code;
      input.focus();
      if (input.scrollIntoView) {
        try { input.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
      }
    }
  }

  function mount() {
    var grid = document.getElementById('commands-grid');
    if (!grid) return;
    COMMANDS.forEach(function (c) {
      if (grid.querySelector('[data-batch6="' + c.code.replace(/"/g, '') + '"]')) return;
      var b = document.createElement('button');
      b.className = 'cmd';
      b.setAttribute('data-batch6', c.code);
      b.setAttribute('data-section', 'Batch 6: Health & News');
      var code = document.createElement('code');
      code.textContent = c.code;
      var span = document.createElement('span');
      span.textContent = c.desc;
      b.appendChild(code);
      b.appendChild(span);
      b.addEventListener('click', function () { fillQuickReply(c.code); });
      grid.appendChild(b);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
