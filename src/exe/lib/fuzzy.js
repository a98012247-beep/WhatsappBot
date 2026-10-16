// Command simplification & fuzzy matching (2026-10-14).
// Makes commands usable by common people: strips noise, handles typos,
// joins split words, matches natural language, suggests alternatives.

// Strip leading noise: emojis, symbols, whitespace.
// ".menu", "/menu", "!menu", "😀menu", ">menu" all -> "menu"
const LEADING_NOISE = /^[\s\u2000-\u200B\uFEFF!-/:-@\[-`{-~😀-🙏🚀-🛿🇦-🇿©®‼⁉™ℹⓂ▶◀🔴🔵⚪⚫✅❌⭐✨💡📌📢🎉👉👈👆👇🤖💬📝🔍⚙️🎵🎬📷🎮🕌💰🏥📚💼🛠️🎨📦🎭🔧📊👥🤖]+/u;
export function stripNoise(text) {
  if (!text) return '';
  let t = String(text);
  // Remove leading noise chars repeatedly
  let prev;
  do {
    prev = t;
    t = t.replace(LEADING_NOISE, '');
  } while (t !== prev && t.length > 0);
  return t;
}

// Collapse multiple spaces, trim.
export function normalizeSpaces(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

// Levenshtein distance.
export function levenshtein(a, b) {
  a = String(a).toLowerCase(); b = String(b).toLowerCase();
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1), curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// Max allowed distance: ≤2 for commands ≥4 chars, ≤1 for shorter.
export function maxDistFor(word) {
  return word.length >= 4 ? 2 : 1;
}

// Find the single closest command within threshold. Returns {cmd, dist} or null.
// Tie-breaker (2026-10-15): when distances tie, prefer a candidate that is an
// anagram of the input (transposition typo, e.g. "meun" -> "menu" not "meme"),
// then prefer candidates sharing a longer prefix with the input.
function sortedLetters(s) {
  return String(s).toLowerCase().split('').sort().join('');
}
export function findClosest(word, candidates) {
  word = String(word).toLowerCase();
  const maxD = maxDistFor(word);
  const wLetters = sortedLetters(word);
  let best = null, bestDist = Infinity, bestAnagram = false, bestPrefix = -1;
  for (const c of candidates) {
    const cl = String(c).toLowerCase();
    // Skip if length difference alone exceeds threshold
    if (Math.abs(cl.length - word.length) > maxD) continue;
    const d = levenshtein(word, cl);
    if (d > maxD) continue;
    const isAnagram = sortedLetters(cl) === wLetters;
    let pfx = 0;
    while (pfx < cl.length && pfx < word.length && cl[pfx] === word[pfx]) pfx++;
    const better = d < bestDist ||
      (d === bestDist && isAnagram && !bestAnagram) ||
      (d === bestDist && isAnagram === bestAnagram && pfx > bestPrefix);
    if (better) { bestDist = d; best = c; bestAnagram = isAnagram; bestPrefix = pfx; }
    if (bestDist === 0) break;
  }
  return best ? { cmd: best, dist: bestDist } : null;
}

// Top-N closest suggestions regardless of threshold.
export function suggestCommands(word, candidates, n = 3) {
  word = String(word).toLowerCase();
  const scored = [];
  for (const c of candidates) {
    const cl = String(c).toLowerCase();
    if (cl === word) continue;
    scored.push({ cmd: c, dist: levenshtein(word, cl) });
  }
  scored.sort((a, b) => a.dist - b.dist);
  return scored.slice(0, n).map(s => s.cmd);
}

// Natural word matching: for short messages, find a known command word
// anywhere in the message. Returns the command or null.
// Skips common chat words to avoid false positives.
const SKIP_WORDS = new Set(['the','a','an','and','or','to','me','my','you','your','please','kindly','can','could','would','will','is','are','was','hi','hello','hey','ok','okay','thanks','thank','bye','yes','no','not','do','does','it','this','that','i','we','us','in','on','at','for','with','send','give','get','make','show','tell','mujhe','karo','kar','do','bhejo','dekhao','batao','please']);
export function findCommandInText(text, candidates) {
  const words = normalizeSpaces(stripNoise(text)).toLowerCase().split(' ');
  if (words.length > 10 || words.length === 0) return null;
  const candSet = new Set([...candidates].map(c => String(c).toLowerCase()));
  for (const w of words) {
    const clean = w.replace(/[^a-z0-9]/g, '');
    if (clean.length < 3 || SKIP_WORDS.has(clean)) continue;
    if (candSet.has(clean)) return clean;
  }
  return null;
}

// Try joining first two words (e.g. "tag all" -> "tagall").
export function tryJoinWords(words, candidates) {
  if (words.length < 2) return null;
  const joined = (words[0] + words[1]).toLowerCase().replace(/[^a-z0-9]/g, '');
  const candSet = new Set([...candidates].map(c => String(c).toLowerCase()));
  if (candSet.has(joined)) return joined;
  return null;
}
