import { rank, decide, hintAnswer } from './matcher.js';

const T = {
  en: { lead: 'What are you throwing away?', ph: 'e.g. greasy pizza box, receipt, ice pack…', foot: "Answers quote official sources: the Ministry of Environment sorting guide (재활용품 분리배출 가이드라인) and newer official Q&A. Local rules can differ.",
        pilotbtn: 'Pilot log', pilotTitle: 'Pilot log (stored on this device only)', export: 'Export CSV', close: 'Close',
        mean: 'Which one do you mean?', none: "If it's none of these, it isn't in the official guide.", unknownT: "This item isn't in the official guide.", unknownB: "Bunri won't guess. Ask your district office (구청) or check the government's 내 손안의 분리배출 app.",
        closest: 'Closest entries:', guide: 'Official text', updated: 'Updated rule', older: 'The older guide said:',
        local: 'Local ordinance applies: check your district', fb: 'Did this answer your question?', yes: 'Yes', no: 'Still not sure', thanks: 'Logged. Thanks.',
        stats: (n, a, u, ns) => `${n} lookups · ${a} answered · ${u} not in guide · ${ns} "still not sure"`, translation: 'English text is an unofficial translation.' },
  ko: { lead: '무엇을 버리시나요?', ph: '예: 기름 묻은 피자박스, 영수증, 아이스팩…', foot: '답은 환경부 「재활용품 분리배출 가이드라인」과 최신 공식 Q&A 원문을 인용합니다. 지역마다 기준이 다를 수 있습니다.',
        pilotbtn: '시범 기록', pilotTitle: '시범 기록 (이 기기에만 저장)', export: 'CSV 내보내기', close: '닫기',
        mean: '어느 것인가요?', none: '이 중에 없다면 공식 가이드에 없는 품목입니다.', unknownT: '공식 가이드에 없는 품목입니다.', unknownB: '추측해서 답하지 않습니다. 구청에 문의하거나 「내 손안의 분리배출」 앱을 확인하세요.',
        closest: '가장 가까운 항목:', guide: '원문', updated: '바뀐 기준', older: '이전 가이드:',
        local: '지자체 조례에 따름: 구청 기준 확인', fb: '도움이 됐나요?', yes: '네', no: '아직 모르겠어요', thanks: '기록했습니다.',
        stats: (n, a, u, ns) => `조회 ${n} · 답변 ${a} · 가이드에 없음 ${u} · '모르겠음' ${ns}`, translation: '' },
};
const EXAMPLES = { en: ['greasy pizza box', 'receipt', 'ice pack', 'eggshells', 'umbrella', 'soy milk carton', 'broken glass', 'clear water bottle'],
                   ko: ['피자박스', '영수증', '아이스팩', '계란 껍질', '우산', '멸균팩', '깨진 유리', '생수 페트병'] };

let lang = localStorage.getItem('bunri.lang') || 'en';
const $ = s => document.querySelector(s);
const kb = await (await fetch('kb.json')).json();
const log = JSON.parse(localStorage.getItem('bunri.log') || '[]');
const saveLog = () => localStorage.setItem('bunri.log', JSON.stringify(log.slice(-5000)));

function setLang(l) {
  lang = l; localStorage.setItem('bunri.lang', l);
  document.documentElement.lang = l;
  document.querySelectorAll('[data-lang]').forEach(b => b.classList.toggle('on', b.dataset.lang === l));
  document.querySelectorAll('[data-t]').forEach(e => { const v = T[l][e.dataset.t]; if (typeof v === 'string') e.textContent = v; });
  $('#q').placeholder = T[l].ph;
  $('#examples').innerHTML = EXAMPLES[l].map(x => `<button class="chip">${x}</button>`).join('');
  run();
}
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const binBadge = b => { const B = kb.bins[b]; return `<div class="badge" style="background:${B.color}">${lang === 'ko' ? B.ko : B.en}<small>${lang === 'ko' ? B.en : B.ko}</small></div>`; };

function itemCard(item, q, chosen) {
  const t = T[lang];
  const question = item.ask ? kb.questions[item.ask] : null;
  let pick = chosen;
  if (question && pick == null) { const h = hintAnswer(question, q); if (h >= 0) pick = h; }
  const opt = question && pick != null ? question.options[pick] : null;
  const bin = opt ? opt.bin : item.bin;
  const howEn = (opt && opt.note_en) || item.method_en || kb.bins[bin].how_en;
  let html = `<div class="card" data-item="${item.id}">`;
  html += `<div class="bin">${question && !opt ? binBadge('material').replace(kb.bins.material.en, lang === 'ko' ? '답에 따라 다름' : 'Depends on your answer').replace(kb.bins.material.ko, '') : binBadge(bin)}<div class="item"><b>${esc(lang === 'ko' ? item.ko : item.en)}</b><br>${esc(lang === 'ko' ? item.en : item.ko)}</div></div>`;
  if (question) {
    html += `<p class="ask">${lang === 'ko' ? question.ko : question.en}</p><div class="opts">` +
      question.options.map((o, i) => `<button class="opt${i === pick ? ' sel' : ''}" data-opt="${i}">${lang === 'ko' ? o.ko : o.en}</button>`).join('') + `</div>`;
  }
  if (item.previous) html += `<div class="warn">${t.updated}</div> `;
  if (!question || opt) {
    if (item.local) html += `<div class="warn">${t.local}</div>`;
    if (lang === 'en') html += `<p class="how">${esc(howEn)}</p>`;
  }
  html += `<div style="margin-top:12px"><div class="src">${t.guide}</div><blockquote lang="ko">${esc(item.method_ko)}</blockquote>
    <div class="src"><a href="${kb.sources[item.doc].url}" target="_blank" rel="noopener">${srcLabel(item.doc, item.page)}</a>${lang === 'en' && t.translation ? ' · ' + t.translation : ''}</div></div>`;
  if (item.previous) html += `<div class="src" style="margin-top:8px">${t.older} <span lang="ko">${esc(item.previous.method_ko)}</span> (${srcLabel(item.previous.doc, item.previous.page)})</div>`;
  html += `<div class="fb">${t.fb} <button data-fb="yes">${t.yes}</button><button data-fb="no">${t.no}</button></div></div>`;
  return html;
}

const srcLabel = (doc, page) => kb.sources[doc][lang].replace('{page}', page);
let current = null;
function run(chosen) {
  const q = $('#q').value.trim();
  const out = $('#out');
  if (!q) { out.innerHTML = ''; current = null; return; }
  const ranked = rank(kb.index, q, 5);
  const d = decide(ranked, kb.thresholds);
  const t = T[lang];
  const shown = d.kind === 'pick' && d.candidates[0].score < 0.3 ? 'unknown' : d.kind;
  current = { q, d, shown, at: new Date().toISOString() };
  if (d.kind === 'answer') out.innerHTML = itemCard(kb.items[d.item], q, chosen);
  else if (d.kind === 'pick' && d.candidates[0].score >= 0.3) out.innerHTML = `<p class="ask">${t.mean}</p><div class="opts">` + d.candidates.map(c => `<button class="chip" data-item-pick="${c.item}">${esc(lang === 'ko' ? kb.items[c.item].ko : kb.items[c.item].en)}</button>`).join('') + `</div><p class="muted" style="margin-top:10px">${t.none}</p>`;
  else out.innerHTML = `<div class="card unknown"><h3>${t.unknownT}</h3><p class="muted">${t.unknownB}</p>` +
    (d.candidates.length ? `<p class="muted">${t.closest}</p><div class="opts">` + d.candidates.map(c => `<button class="chip" data-item-pick="${c.item}">${esc(lang === 'ko' ? kb.items[c.item].ko : kb.items[c.item].en)}</button>`).join('') + '</div>' : '') + `</div>`;
}

let timer;
let logTimer;
// Show results while typing; log a lookup only once the user stops typing.
$('#q').addEventListener('input', () => { clearTimeout(timer); clearTimeout(logTimer); timer = setTimeout(run, 250); logTimer = setTimeout(record, 1500); });
function record() { if (current) { log.push({ at: current.at, q: current.q, kind: current.shown, item: current.d.item ?? '' }); saveLog(); } }

document.addEventListener('click', e => {
  const el = e.target.closest('button'); if (!el) return;
  if (el.dataset.lang) setLang(el.dataset.lang);
  else if (el.classList.contains('chip') && el.closest('#examples')) { $('#q').value = el.textContent; run(); record(); }
  else if (el.dataset.itemPick) { const it = kb.items[+el.dataset.itemPick]; $('#out').innerHTML = itemCard(it, $('#q').value); log.push({ at: new Date().toISOString(), q: '(picked)', kind: 'picked', item: it.id }); saveLog(); }
  else if (el.dataset.opt) { const id = +el.closest('.card').dataset.item; $('#out').innerHTML = itemCard(kb.items[id], '', +el.dataset.opt); }
  else if (el.dataset.fb) { log.push({ at: new Date().toISOString(), q: current?.q || '', kind: 'feedback_' + el.dataset.fb, item: current?.d.item ?? '' }); saveLog(); el.parentElement.textContent = T[lang].thanks; }
  else if (el.id === 'pilot') { showStats(); $('#pilotDlg').showModal(); }
  else if (el.id === 'closeDlg') $('#pilotDlg').close();
  else if (el.id === 'exportCsv') {
    const csv = 'time,query,result,item\n' + log.map(r => [r.at, JSON.stringify(r.q), r.kind, r.item === '' ? '' : kb.items[r.item].ko].join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = 'bunri_pilot_log.csv'; a.click();
  }
});
function showStats() {
  const n = log.filter(r => ['answer', 'pick', 'unknown'].includes(r.kind)).length;
  const a = log.filter(r => r.kind === 'answer' || r.kind === 'picked').length;
  const u = log.filter(r => r.kind === 'unknown');
  const ns = log.filter(r => r.kind === 'feedback_no').length;
  const top = Object.entries(u.reduce((m, r) => (m[r.q] = (m[r.q] || 0) + 1, m), {})).sort((x, y) => y[1] - x[1]).slice(0, 8);
  $('#pilotStats').innerHTML = `<p>${T[lang].stats(n, a, u.length, ns)}</p>` + (top.length ? `<table>${top.map(([q, c]) => `<tr><td>${esc(q)}</td><td>${c}</td></tr>`).join('')}</table>` : '');
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
setLang(lang);
