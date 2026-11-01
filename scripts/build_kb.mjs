// Builds public/kb.json from the source tables in data/.
import fs from 'fs';
import { buildIndex } from '../src/matcher.js';

const tsv = f => fs.readFileSync(f, 'utf8').trim().split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split('\t'));
const src = new Map();
for (const [ko, m, p] of tsv('data/raw_moe_dictionary.tsv')) src.set(ko, { method_ko: m, page: p, doc: 'moe' });
for (const [ko, m, p] of tsv('data/extra_body_items.tsv')) {
  const [doc, page] = p.startsWith('seoul') ? ['seoul', ''] : p.includes(':') ? p.split(':') : ['moe', p];
  src.set(ko, { method_ko: m, page, doc });
}
const sources = JSON.parse(fs.readFileSync('data/sources.json', 'utf8'));
// Newer official sources override the older guide; the old text is kept and shown.
const updates = new Map(tsv('data/updates.tsv').map(([ko, bin, ask, doc, page, m, men]) => [ko, { bin, ask, doc, page, method_ko: m, method_en: men }]));
const en = new Map(tsv('data/method_en.tsv'));
const bins = JSON.parse(fs.readFileSync('data/bins.json', 'utf8'));
const questions = JSON.parse(fs.readFileSync('data/questions.json', 'utf8'));

const items = [];
const docs = [];
for (let [ko, enName, aliases, bin, ask] of tsv('data/items.tsv')) {
  const s0 = src.get(ko);
  if (!s0) throw new Error('no source for ' + ko);
  const u = updates.get(ko);
  const s = u ? { ...u, previous: { method_ko: s0.method_ko, doc: s0.doc, page: s0.page } } : s0;
  if (u) { bin = u.bin; ask = u.ask; }
  if (!bins[bin]) throw new Error('bad bin ' + bin + ' for ' + ko);
  const q = ask || (bin === 'material' ? 'material' : '');
  if (q && !questions[q]) throw new Error('bad question ' + q);
  const id = items.length;
  const local = /지자체 조례|지자체별/.test(s.method_ko);
  items.push({ id, ko, en: enName, bin, ask: q || null, method_ko: s.method_ko, method_en: s.method_en || en.get(s.method_ko) || null, page: s.page, doc: s.doc, local, previous: s.previous || null });
  const names = new Set([ko, ko.replace(/\(.*?\)/g, ''), ...ko.split(/,\s*/), enName, ...enName.split(/,\s*/), ...(aliases ? aliases.split(';') : [])]);
  for (const n of names) if (n.trim()) docs.push({ text: n.trim(), itemId: id });
}
const index = buildIndex(docs);
const th = JSON.parse(fs.readFileSync('data/thresholds.json', 'utf8'));
fs.mkdirSync('public', { recursive: true });
fs.copyFileSync('src/matcher.js', 'public/matcher.js');
fs.writeFileSync('public/kb.json', JSON.stringify({ version: '2026-11-01b', bins, questions, sources, items, index, thresholds: th }));
console.log(`items ${items.length}, docs ${docs.length}, features ${Object.keys(index.idf).length}, kb ${(fs.statSync('public/kb.json').size / 1024).toFixed(0)} KB`);
