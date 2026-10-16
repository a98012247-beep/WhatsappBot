// Batch 5 web commands — Business + Money & Finance (22 entries).
// Consumed by the AwaisxBot dashboard to render command cards in the
// Commands Reference tab. Mirrors WEB_COMMANDS in lib/batch5-biz-money.js.
export const BATCH5_WEB_COMMANDS = [
  { cmd: 'invoice', example: '!invoice Ahmed | Chai 2 500 ; Cake 1 1200', desc: 'Invoice banayein' },
  { cmd: 'expense', example: '!expense add 500 chai', desc: 'Kharcha hisab' },
  { cmd: 'todo', example: '!todo add Doodh lena', desc: 'To-do list' },
  { cmd: 'notes', example: '!notes save List | doodh, anday', desc: 'Notes' },
  { cmd: 'sendlater', example: '!sendlater 2h Meeting yaad dilana', desc: 'Scheduled message' },
  { cmd: 'qreply', example: '!qreply add salam | Walaikum Assalam', desc: 'Quick replies' },
  { cmd: 'orderbook', example: '!order Ahmed | Biryani x2 @250', desc: 'Order book' },
  { cmd: 'pricelist', example: '!pricelist add Chai | 150', desc: 'Price list' },
  { cmd: 'attendance', example: '!attend', desc: 'Hazri lagayein' },
  { cmd: 'meeting', example: '!meeting 30m Team standup', desc: 'Meeting reminder' },
  { cmd: 'email', example: '!email ali@mail.com | Salam | Kaam ho gaya', desc: 'Email draft link' },
  { cmd: 'csvlog', example: '!csvlog expenses', desc: 'CSV download' },
  { cmd: 'bizcard', example: '!bizcard Ahmed | 03001234567 | Awax Store', desc: 'Digital visiting card' },
  { cmd: 'review', example: '!review Bot bohat kaam ka hai', desc: 'Feedback jama karein' },
  { cmd: 'cryptoalert', example: '!cryptoalert btc above 90000', desc: 'Crypto price alerts' },
  { cmd: 'stocks', example: '!stocks aapl', desc: 'Stock prices' },
  { cmd: 'goldrate', example: '!goldrate', desc: 'Sona rate (andaza)' },
  { cmd: 'forex', example: '!forex', desc: 'USD/PKR & more' },
  { cmd: 'salarytax', example: '!salarytax 150000', desc: 'Income tax andaza' },
  { cmd: 'budget', example: '!budget set 50000', desc: 'Monthly budget' },
  { cmd: 'savegoal', example: '!savegoal Umrah 500000', desc: 'Savings goal' },
  { cmd: 'billsplit', example: '!billsplit 3000 4', desc: 'Bill split' },
];

// Append command cards into a container (selector or element).
// Returns the number of cards rendered.
export function renderBatch5Commands(container) {
  const el = typeof container === 'string'
    ? (typeof document !== 'undefined' ? document.querySelector(container) : null)
    : container;
  if (!el) return 0;
  let n = 0;
  for (const c of BATCH5_WEB_COMMANDS) {
    const b = document.createElement('button');
    b.className = 'cmd';
    b.dataset.batch5 = c.cmd;
    const code = document.createElement('code');
    code.textContent = c.example;
    const span = document.createElement('span');
    span.textContent = c.desc;
    b.append(code, span);
    el.appendChild(b);
    n++;
  }
  return n;
}
