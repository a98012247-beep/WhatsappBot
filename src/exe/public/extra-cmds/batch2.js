// Batch 2 web commands — AwaisxBot dashboard (Downloader Pro + Daily Utilities).
// Renders the 29 batch-2 commands as cards into #batch2-commands.
// Usage in dashboard HTML: <div id="batch2-commands"></div><script src="extra-cmds/batch2.js"></script>
(function () {
  'use strict';

  var COMMANDS = [
    { cmd: '!pindl <link>', desc: 'Pinterest video/photo downloader', tag: 'Downloader' },
    { cmd: '!redditdl <link>', desc: 'Reddit video/photo downloader', tag: 'Downloader' },
    { cmd: '!dmd <link>', desc: 'Dailymotion video downloader', tag: 'Downloader' },
    { cmd: '!vimeodl <link>', desc: 'Vimeo video downloader', tag: 'Downloader' },
    { cmd: '!spotidl <link>', desc: 'Spotify track se MP3', tag: 'Downloader' },
    { cmd: '!ytpl <link>', desc: 'YouTube playlist ke pehle 3 songs', tag: 'Downloader' },
    { cmd: '!togif', desc: 'Video se GIF banayein (reply)', tag: 'Media Tool' },
    { cmd: '!photofx <filter>', desc: 'Photo filters: grey, sepia, blur, bright, invert (reply)', tag: 'Media Tool' },
    { cmd: '!hdphoto', desc: 'Photo enhance — 2x quality (reply)', tag: 'Media Tool' },
    { cmd: '!shrinkphoto', desc: 'Photo compress — size kam (reply)', tag: 'Media Tool' },
    { cmd: '!shrinkvideo', desc: 'Video compress — size kam (reply)', tag: 'Media Tool' },
    { cmd: '!trim <start-end>', desc: 'Audio ka hissa kaat lein, misal 0:10-0:30 (reply)', tag: 'Media Tool' },
    { cmd: '!tez <0.5-2>', desc: 'Audio ki speed change karein (reply)', tag: 'Media Tool' },
    { cmd: '!ringtone <sec>', desc: 'Audio se ringtone banayein (reply)', tag: 'Media Tool' },
    { cmd: '!qrscan', desc: 'QR code wali photo scan karein (reply)', tag: 'Utility' },
    { cmd: '!barcode <text>', desc: 'Text se barcode image banayein', tag: 'Utility' },
    { cmd: '!passgen <len>', desc: 'Mazboot random password (default 16)', tag: 'Utility' },
    { cmd: '!shorturl <link>', desc: 'Lamba link chhota karein', tag: 'Utility' },
    { cmd: '!tempemail', desc: 'Free temporary email + inbox check', tag: 'Utility' },
    { cmd: '!numinfo <number>', desc: 'Pakistani SIM ka carrier maloom karein', tag: 'Utility' },
    { cmd: '!websnap <url>', desc: 'Kisi website ka screenshot', tag: 'Utility' },
    { cmd: '!sitedown <url>', desc: 'Website up hai ya down?', tag: 'Utility' },
    { cmd: '!unitconv <5 km miles>', desc: 'Unit converter — lambai, wazan, garmi, raqba', tag: 'Utility' },
    { cmd: '!currency <100 usd pkr>', desc: 'Live currency converter', tag: 'Utility' },
    { cmd: '!timeconv <3pm Karachi London>', desc: 'Time zone converter', tag: 'Utility' },
    { cmd: '!bmi <70 175>', desc: 'BMI calculator (wazan kg, qad cm)', tag: 'Utility' },
    { cmd: '!age <2000-05-12>', desc: 'Umar calculator + agli birthday', tag: 'Utility' },
    { cmd: '!emi <500000 18 24>', desc: 'Loan EMI calculator', tag: 'Utility' },
    { cmd: '!fileconv <txt|json|csv>', desc: 'txt/json/csv file convert (reply)', tag: 'Utility' }
  ];

  var CSS = [
    '.b2-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}',
    '.b2-card{background:var(--card,#fff);border:1px solid var(--border,#e5e7eb);border-radius:14px;padding:12px 14px}',
    '.b2-cmd{font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:700;font-size:.86rem;color:var(--accent,#16a34a);margin-bottom:4px;word-break:break-word}',
    '.b2-desc{font-size:.82rem;color:var(--muted,#64748b);line-height:1.4}',
    '.b2-tag{display:inline-block;font-size:.66rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;',
    'background:rgba(22,163,74,.1);color:var(--accent,#16a34a);border-radius:999px;padding:2px 8px;margin-bottom:6px}',
    '.b2-sec{font-size:1.05rem;font-weight:800;margin:18px 0 10px}'
  ].join('\n');

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function card(c) {
    return '<div class="b2-card"><span class="b2-tag">' + esc(c.tag) + '</span>' +
      '<div class="b2-cmd">' + esc(c.cmd) + '</div>' +
      '<div class="b2-desc">' + esc(c.desc) + '</div></div>';
  }

  function render(sel) {
    var el = document.querySelector(sel || '#batch2-commands');
    if (!el) return false;
    var dl = COMMANDS.filter(function (c) { return c.tag !== 'Utility'; });
    var ut = COMMANDS.filter(function (c) { return c.tag === 'Utility'; });
    el.innerHTML =
      '<div class="b2-sec">📥 Downloader Pro &amp; Media Tools</div>' +
      '<div class="b2-grid">' + dl.map(card).join('') + '</div>' +
      '<div class="b2-sec">🧰 Daily Utilities</div>' +
      '<div class="b2-grid">' + ut.map(card).join('') + '</div>';
    return true;
  }

  function boot() {
    if (document.getElementById('b2-style')) return;
    var st = document.createElement('style');
    st.id = 'b2-style';
    st.textContent = CSS;
    document.head.appendChild(st);
    render();
  }

  window.Batch2Commands = { COMMANDS: COMMANDS, render: render };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
