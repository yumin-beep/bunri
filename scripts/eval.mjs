// Evaluates the matcher.
// v1 (eval/queries.tsv): every 3rd query = dev (used to pick thresholds), rest = test.
//   After the 11/01 review, four failing v1 test queries were fixed with aliases/rules, so v1 test is no longer clean.
// v2 (eval/queries_v2.tsv): written after the review and before those fixes; never used for tuning. Primary result.
// Some queries also exist verbatim (after normalisation) as an alias; results are reported with and without them.
import fs from 'fs';
import { rank, decide, normalize, setOptions } from '../src/matcher.js';

const kb = JSON.parse(fs.readFileSync('public/kb.json', 'utf8'));
const byKo = new Map(kb.items.map(i => [i.ko, i]));
const load = f => fs.readFileSync(f, 'utf8').trim().split('\n').filter(l => !l.startsWith('#')).map(l => l.split('\t'));
const v1 = load('eval/queries.tsv'), v2 = load('eval/queries_v2.tsv'), v3 = load('eval/queries_v3.tsv'), v4 = load('eval/queries_v4.tsv');
for (const [, g] of [...v1, ...v2, ...v3, ...v4]) if (g !== 'OOS' && !byKo.has(g)) throw new Error('gold not in kb: ' + g);
const dev = v1.filter((_, i) => i % 3 === 0), test = v1.filter((_, i) => i % 3 !== 0);

// names + aliases as the build used them
const tsv = f => fs.readFileSync(f, 'utf8').trim().split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split('\t'));
const aliasRows = tsv('data/items.tsv').map(([ko, en, al]) => ({ ko, names: [ko, ko.replace(/\(.*?\)/g, ''), ...ko.split(/,\s*/), en, ...en.split(/,\s*/), ...(al ? al.split(';') : [])].filter(Boolean) }));
const aliasSet = new Set(aliasRows.flatMap(r => r.names.map(n => normalize(n).replace(/\s/g, ''))));
const overlaps = q => aliasSet.has(normalize(q).replace(/\s/g, ''));

// Baselines: a plain search box doing substring matching, (a) on item names only, (b) on names + the same aliases Bunri uses.
function substring(useAliases) {
  const table = kb.items.map((it, i) => ({ id: it.id, names: (useAliases ? aliasRows[i].names : [it.ko, it.en].flatMap(n => n.split(/[,()]/)))
    .map(n => n.toLowerCase().replace(/\s/g, '')).filter(n => n.length > 1) }));
  return q => {
    const s = q.toLowerCase().replace(/\s/g, '');
    const hit = table.find(t => t.names.some(n => s.includes(n) || n.includes(s)));
    return hit ? { kind: 'answer', item: hit.id } : { kind: 'unknown' };
  };
}

function score(set, fn) {
  const r = { queries: set.length, in_scope: 0, out_of_scope: 0, direct: 0, same_bin_other_item: 0, picked_top3: 0, missed: 0, wrong_bin: 0, oos_declined: 0 };
  const errors = [];
  for (const [q, g] of set) {
    const d = fn(q);
    if (g === 'OOS') {
      r.out_of_scope++;
      if (d.kind === 'answer') { r.wrong_bin++; errors.push(`OOS answered: "${q}" → ${kb.items[d.item].ko}`); } else r.oos_declined++;
      continue;
    }
    r.in_scope++;
    const gold = byKo.get(g);
    if (d.kind === 'answer') {
      const it = kb.items[d.item];
      if (it.id === gold.id) r.direct++;
      else if (it.bin === gold.bin && it.ask === gold.ask) r.same_bin_other_item++;
      else { r.wrong_bin++; errors.push(`wrong bin: "${q}" → ${it.ko} (gold ${g})`); }
    } else if (d.kind === 'pick' && d.candidates.some(c => c.item === gold.id)) r.picked_top3++;
    else { r.missed++; errors.push(`${d.kind === 'pick' ? 'not in top-3' : 'declined'}: "${q}" (gold ${g})`); }
  }
  const answers = r.direct + r.same_bin_other_item + r.wrong_bin;
  const pct = x => +(100 * x / r.in_scope).toFixed(1);
  r.direct_pct = pct(r.direct + r.same_bin_other_item);
  r.pick_pct = pct(r.picked_top3);
  r.resolved_pct = pct(r.direct + r.same_bin_other_item + r.picked_top3);
  r.wrong_bin_pct_of_answers = answers ? +(100 * r.wrong_bin / answers).toFixed(1) : 0;
  r.errors = errors;
  return r;
}

let cache = new Map();
const ranked = q => { if (!cache.has(q)) cache.set(q, rank(kb.index, q, 5)); return cache.get(q); };
const model = th => q => decide(ranked(q), th, kb.items);
if (kb.options) setOptions(kb.options);

if (process.argv[2] === 'tune') {
  // Round 2 (11/15): dev = v1 dev + v3. v4 is never touched here.
  const devSet = [...dev, ...v3];
  let best = null;
  for (const context of [false, true]) for (const unseen of [1, 0.75, 0.5]) for (const known of [false, true]) { var cb = null;
    setOptions({ context, unseen, known }); cache = new Map();
    for (let reject = 0.15; reject <= 0.4; reject += 0.025)
      for (let accept = reject; accept <= 0.7; accept += 0.025)
        for (const margin of [0, 0.02, 0.04, 0.06])
          for (const agree of [0, 0.3, 0.35, 0.4, 0.45]) for (const ratio of [0.8, 0.9]) {
            if (!agree && ratio !== 0.8) continue;
            const th = { reject: +reject.toFixed(3), accept: +accept.toFixed(3), margin, agree, ratio };
            const r = score(devSet, model(th));
            const key = r.wrong_bin * 10 - r.resolved_pct - r.direct_pct * 0.5;
            if (!best || key < best.key) best = { key, th, opts: { context, unseen, known }, r };
            if (!cb || key < cb.key) cb = { key, th, r };
          }
    console.log({ context, unseen, known }, 'key', cb.key.toFixed(1), 'direct', cb.r.direct_pct, 'resolved', cb.r.resolved_pct, 'wrong', cb.r.wrong_bin, 'oos', cb.r.oos_declined, JSON.stringify(cb.th));
  }
  fs.writeFileSync('data/thresholds.json', JSON.stringify({ ...best.th, options: best.opts }));
  const { errors, ...r } = best.r;
  console.log('tuned on v1 dev + v3:', best.th, best.opts, r);
} else if (process.argv[2] === 'dev') {
  const { errors, ...r } = score([...dev, ...v3], model(kb.thresholds));
  console.log(r); console.log(errors.join('\n'));
} else {
  const th = kb.thresholds;
  const sets = { v4_test: v4, v3_dev: v3, v2_all: v2, v2_no_alias_overlap: v2.filter(([q]) => !overlaps(q)), v1_test: test, v1_test_no_alias_overlap: test.filter(([q]) => !overlaps(q)), v1_dev: dev };
  const out = { thresholds: th, alias_overlap: { v2: v2.filter(([q]) => overlaps(q)).length + '/' + v2.length, v1_test: test.filter(([q]) => overlaps(q)).length + '/' + test.length } };
  for (const [k, set] of Object.entries(sets)) out[k] = { bunri: score(set, model(th)), substring_names_only: score(set, substring(false)), substring_with_aliases: score(set, substring(true)) };
  fs.writeFileSync('eval/results.json', JSON.stringify(out, null, 1));
  console.log('alias overlap', out.alias_overlap);
  for (const k of Object.keys(sets)) for (const m of ['bunri', 'substring_names_only', 'substring_with_aliases']) {
    const { errors, ...r } = out[k][m];
    console.log(k.padEnd(26), m.padEnd(24), `n=${r.in_scope}+${r.out_of_scope}oos direct ${r.direct_pct}% pick ${r.pick_pct}% resolved ${r.resolved_pct}% wrong-bin ${r.wrong_bin} (${r.wrong_bin_pct_of_answers}%) oos-declined ${r.oos_declined}/${r.out_of_scope}`);
  }
  console.log('\nv4 bunri errors:\n ' + out.v4_test.bunri.errors.join('\n '));
}
