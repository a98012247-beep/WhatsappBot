// Verifies: every dashboard command button (hardcoded + all 7 batches) maps to a section.
import { readFileSync } from 'fs';
import { createRequire } from 'module';
const R = (p) => readFileSync('/home/hatch/workspace/whatsapp-bot/src/exe/public/' + p, 'utf8');

const window = {};
eval(R('extra-cmds/sections.js'));
const sections = window.COMMAND_SECTIONS;
const lookup = {};
sections.forEach(s => (s.cmds || []).forEach(c => lookup[c] = s.num));
const tokenOf = (code) => code.trim().replace(/^!/, '').split(/[\s\/·|]/)[0].toLowerCase();

const buttons = [];
// hardcoded
for (const m of R('index.html').matchAll(/<button class="cmd"><code>([^<]*)<\/code>/g)) buttons.push(['hardcoded', m[1]]);
// batch1: ['!x', 'desc']
for (const m of R('extra-cmds/batch1.js').matchAll(/\['(![^']+)',\s*'[^']*'\]/g)) buttons.push(['b1', m[1]]);
// batch2: {cmd:'!x', desc}
for (const m of R('extra-cmds/batch2.js').matchAll(/cmd:\s*'(![^']+)'/g)) buttons.push(['b2', m[1]]);
// batch3: {usage:'...', desc}
for (const m of R('extra-cmds/batch3.js').matchAll(/usage:\s*'([^']+)'/g)) buttons.push(['b3', '!' + m[1]]);
// batch4: module
const b4 = await import('/home/hatch/workspace/whatsapp-bot/src/exe/public/extra-cmds/batch4.js');
for (const x of (b4.BATCH4_WEB_COMMANDS || [])) buttons.push(['b4', '!' + (x.example || x.command)]);
// batch5: {example:'!x ...'}
for (const m of R('extra-cmds/batch5.js').matchAll(/example:\s*'(![^']+)'/g)) buttons.push(['b5', m[1]]);
// batch6: {code:'!x'}
for (const m of R('extra-cmds/batch6.js').matchAll(/code:\s*'(![^']+)'/g)) buttons.push(['b6', m[1]]);
// batch7: {cmd:'!x'}
for (const m of R('extra-cmds/batch7.js').matchAll(/cmd:\s*'(![^']+)'/g)) buttons.push(['b7', m[1]]);

const per = {};
const unmatched = [];
for (const [src, code] of buttons) {
  const t = tokenOf(code);
  const n = lookup[t];
  if (!n) { unmatched.push(src + ':' + code); continue; }
  per[n] = (per[n] || 0) + 1;
}
console.log('buttons:', buttons.length, '| sections:', sections.length);
console.log('unmatched:', unmatched.length, JSON.stringify(unmatched.slice(0, 15)));
const empty = sections.filter(s => !per[s.num]).map(s => s.num);
console.log('empty sections:', JSON.stringify(empty));
let total = 0; for (const s of sections) total += per[s.num] || 0;
console.log('placed:', total);
