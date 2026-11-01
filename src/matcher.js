// Bunri matcher: character n-gram TF-IDF retrieval over Hangul jamo + Latin text,
// with a confidence threshold so it asks instead of guessing.
// Runs the same in the browser and in Node (no dependencies).

const L = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const V = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const T = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';

export function toJamo(s) {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0) - 0xac00;
    if (c >= 0 && c < 11172) {
      out += L[Math.floor(c / 588)] + V[Math.floor((c % 588) / 28)];
      const t = c % 28;
      if (t) out += T[t];
    } else out += ch;
  }
  return out;
}

// Words people add around the item name. Removed before matching.
const FILLERS = [
  /어떻게|어디에|어디로|어디|버리는\s*법|버리는\s*방법|버리기|버려요|버려야|버리나요|버릴까요|버리면|분리\s*수거|분리\s*배출|인가요|되나요|맞나요|일까요|하나요|방법|배출/g,
  /\b(how|do|does|i|to|can|should|where|what|which|bin|throw|throwing|away|out|dispose|disposal|of|recycle|recycling|a|an|the|my|in|korea|please|is|it|this)\b/g,
];

export function normalize(q) {
  let s = q.normalize('NFC').toLowerCase();
  for (const re of FILLERS) s = s.replace(re, ' ');
  s = s.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  return s;
}

export function features(q) {
  const s = normalize(q);
  const f = new Map();
  const add = (k, w = 1) => f.set(k, (f.get(k) || 0) + w);
  // jamo n-grams over the string without spaces (Korean spacing is inconsistent)
  const j = '^' + toJamo(s.replace(/\s/g, '')) + '$';
  for (let n = 2; n <= 4; n++) for (let i = 0; i + n <= j.length; i++) add('j' + j.slice(i, i + n));
  // whole-word tokens (helps English)
  for (const w of s.split(' ')) if (w.length > 1) add('w' + w, 2);
  return f;
}

export function buildIndex(docs) {
  // docs: [{text, itemId}]
  const df = new Map();
  const feats = docs.map(d => features(d.text));
  for (const f of feats) for (const k of f.keys()) df.set(k, (df.get(k) || 0) + 1);
  const N = docs.length;
  const idf = {};
  for (const [k, c] of df) idf[k] = Math.log((N + 1) / (c + 1)) + 1;
  const vecs = feats.map((f, i) => ({ item: docs[i].itemId, v: weigh(f, idf), t: toJamo(normalize(docs[i].text).replace(/\s/g, '')) }));
  return { idf, vecs };
}

function weigh(f, idf) {
  const v = {};
  let norm = 0;
  for (const [k, c] of f) {
    const w = (1 + Math.log(c)) * (idf[k] || 0);
    if (w) { v[k] = w; norm += w * w; }
  }
  norm = Math.sqrt(norm) || 1;
  for (const k in v) v[k] /= norm;
  return v;
}

export function rank(index, q, k = 5) {
  // unseen n-grams get the max idf so a nonsense query scores low
  const maxIdf = Math.max(...Object.values(index.idf));
  const f = features(q);
  const idf = new Proxy(index.idf, { get: (o, key) => (key in o ? o[key] : maxIdf) });
  const qv = weigh(f, idf);
  const words = normalize(q).split(' ').filter(w => w.length > 1).map(w => toJamo(w));
  const best = new Map();
  for (const { item, v, t } of index.vecs) {
    let s = 0;
    for (const key in qv) if (key in v) s += qv[key] * v[key];
    if (!s) continue;
    // Coverage: every word the user typed should show up in the matched name.
    // "chicken bones" must not confidently match "chicken box".
    if (words.length > 1) {
      const covered = words.filter(w => wordIn(w, t)).length;
      s *= 0.4 + 0.6 * (covered / words.length);
    }
    if (s > (best.get(item) || 0)) best.set(item, s);
  }
  return [...best.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([item, score]) => ({ item, score }));
}

function wordIn(w, t) {
  if (t.includes(w)) return true;
  const n = w.length >= 6 ? 4 : 3;
  if (w.length < n) return false;
  let hit = 0, tot = 0;
  for (let i = 0; i + n <= w.length; i++) { tot++; if (t.includes(w.slice(i, i + n))) hit++; }
  return hit / tot >= 0.5;
}

// Decide: answer, ask the user to pick among candidates, or say it's not in the guide.
export function decide(ranked, th) {
  const top = ranked[0];
  if (!top || top.score < th.reject) return { kind: 'unknown', candidates: ranked.slice(0, 3) };
  const second = ranked[1];
  if (top.score < th.accept || (second && top.score - second.score < th.margin))
    return { kind: 'pick', candidates: ranked.slice(0, 3) };
  return { kind: 'answer', item: top.item, score: top.score };
}

// Pre-answer a follow-up question from words already in the query ("greasy pizza box").
export function hintAnswer(question, q) {
  const s = q.toLowerCase();
  for (let i = 0; i < question.options.length; i++)
    for (const h of question.options[i].hint || []) if (s.includes(h)) return i;
  return -1;
}
