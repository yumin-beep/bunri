import fs from 'fs';
const rows = fs.readFileSync('data/raw_moe_dictionary.tsv','utf8').trim().split('\n').map(l=>l.split('\t'));
const rules = [
 [/재질에 맞게|재질별|재질에 맞는|분리하여 재질|분리해서|분리하여, 각각/, 'depends'],
 [/담을 수 없는 경우|담을 수 없다면|크기에 따라/, 'general_or_bulky'],
 [/^종이팩으로/, 'paper_pack'],
 [/알루미늄박이 붙어/, 'depends'],
 [/기름에 오염된/, 'depends'],
 [/비닐코딩/, 'depends'],
 [/폐가전|가전제품|대형가전/, 'ewaste'],
 [/대형폐기물|대형으로|대형페기물/, 'bulky'],
 [/불연성/, 'nonburnable'],
 [/음식물/, 'food'],
 [/폐식용유|전용수거함|약국/, 'dropoff'],
 [/전문처리|구입처|상담/, 'consult'],
 [/고철/, 'metal'],
 [/금속캔/, 'can'],
 [/플라스틱/, 'plastic'],
 [/비닐/, 'vinyl'],
 [/유리병류/, 'glass'],
 [/종이류/, 'paper'],
 [/종량제|감싸서|물에 적신|따로 봉투|모두 사용 후|헹구고 배출/, 'general'],
];
const out = rows.map(([ko,m,p])=>{const r=rules.find(([re])=>re.test(m)); return [ko, r?r[1]:'??', m];});
for (const o of out) console.log(o.join('\t'));
