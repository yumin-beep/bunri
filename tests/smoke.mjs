// Fast checks run in CI: the KB builds, every source table row resolves, and core behaviours hold.
import fs from 'fs';
import assert from 'assert/strict';
import { rank, decide, setOptions, hintAnswer } from '../src/matcher.js';
const kb = JSON.parse(fs.readFileSync('public/kb.json', 'utf8'));
setOptions(kb.options || {});
const ask = q => { const d = decide(rank(kb.index, q, 5), kb.thresholds, kb.items); return { ...d, item: d.item != null ? kb.items[d.item] : null }; };
const cases = [
  ['영수증', 'general'], ['receipt', 'general'], ['empty soju bottle', 'glass'], ['tuna can', 'can'],
  ['soy milk carton', 'paper_pack'], ['멸균팩', 'paper_pack'], ['ice pack', 'general'], ['clear water bottle', 'clear_pet'],
];
for (const [q, bin] of cases) { const r = ask(q); assert.equal(r.kind, 'answer', q); assert.equal(r.item.bin, bin, q); }
for (const q of ['dog poop', 'nuclear waste', 'asdfgh']) assert.notEqual(ask(q).kind, 'answer', q);
const pizza = kb.items.find(i => i.ko === '피자박스');
assert.equal(hintAnswer(kb.questions[pizza.ask], 'greasy pizza box'), 0);
for (const it of kb.items) { assert.ok(it.method_ko, it.ko); assert.ok(kb.sources[it.doc], it.ko); }
console.log(`ok: ${cases.length} answers, 3 abstentions, hints, ${kb.items.length} items sourced`);
