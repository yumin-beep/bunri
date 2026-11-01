// Records the demo: real app in Chromium + caption overlay, 1280x720.
// Scene lengths follow the narration clips in video/narration/nNN.wav when they exist.
// Writes /tmp/vid/scenes.json (start time of each scene, seconds from video start) for mux.cjs.
// Before running: cp video/slides.html public/_slides.html; python3 -m http.server 8765 -d public
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const BASE = 'http://localhost:8765/';
const NARR = path.join(__dirname, 'narration');
const dur = n => { const f = path.join(NARR, `n${String(n).padStart(2, '0')}.wav`); if (!fs.existsSync(f)) return 0;
  return parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${f}"`).toString()); };

(async () => {
  fs.mkdirSync('/tmp/vid', { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: '/tmp/vid', size: { width: 1280, height: 720 } } });
  const t0 = Date.now();
  const p = await ctx.newPage();
  await p.addInitScript(() => { if (!location.pathname.includes('_slides')) document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = 'main{zoom:1.2;margin-left:30px} header{zoom:1.2}'; document.head.appendChild(st); }); });
  const wait = ms => p.waitForTimeout(ms);
  const scenes = [];
  // a scene: start narration line n, run actions, then hold until the line has finished (+ pad) or minMs
  const scene = async (n, minMs, fn) => { const s = Date.now(); scenes.push({ n, t: (s - t0) / 1000 }); if (fn) await fn();
    const need = Math.max(minMs, dur(n) * 1000 + 700) - (Date.now() - s); if (need > 0) await wait(need); };
  const cap = async (text) => p.evaluate(t => {
    let c = document.getElementById('__cap');
    if (!c) { c = document.createElement('div'); c.id = '__cap'; c.style.cssText = 'position:fixed;right:24px;top:90px;width:330px;text-align:left;background:rgba(20,28,24,.88);color:#fff;font:600 24px/1.4 "Noto Sans KR",system-ui,sans-serif;padding:12px 22px;border-radius:12px;z-index:99'; document.body.appendChild(c); }
    c.style.display = t ? 'block' : 'none'; c.textContent = t;
  }, text);
  const down = () => p.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
  // Hide results while typing so half-typed matches don't flash on screen.
  const type = async (q) => { await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('out').style.visibility = 'hidden'; }); await p.fill('#q', ''); await p.type('#q', q, { delay: 70 }); await wait(500); await p.evaluate(() => document.getElementById('out').style.visibility = 'visible'); await down(); };

  await p.goto(BASE); await p.evaluate(() => localStorage.clear()); await p.reload(); await wait(400);
  await scene(1, 5000, async () => { await cap('Receipts look like paper. Korea\'s sorting guide says they are not.'); await type('receipt'); });
  await cap('');
  await p.goto(BASE + '_slides.html');
  await scene(2, 3500);
  await scene(3, 11000, () => p.evaluate(() => show('s2')));
  await p.goto(BASE); await wait(400);
  await scene(4, 4000, async () => { await cap('Type what you are throwing away. Words in the query can answer the follow-up.'); await type('greasy pizza box'); });
  await scene(5, 3500, () => cap('Every answer quotes the official text, with page and link.'));
  await scene(6, 3500, async () => { await cap('Not oily? One tap changes the answer.'); await p.click('button[data-opt="1"]'); });
  await scene(7, 6000, async () => { await cap('A typo still finds it. Not sure? It offers 3 options instead of guessing.'); await type('계란 껍떼기'); await wait(2200); await p.click('button[data-item-pick]'); await down(); });
  await scene(8, 5500, async () => { await cap('When the answer depends on something, it asks one question.'); await type('pet bottle'); await wait(1800); await p.click('button[data-opt="0"]'); });
  await scene(9, 5000, async () => { await type('umbrella'); await wait(1600); await p.click('button[data-opt="1"]'); });
  await scene(10, 7000, async () => { await cap('Rules change. Newer official rules override the old guide, and the old text stays visible.'); await type('soy milk carton'); });
  await scene(11, 5000, async () => { await cap('Not in the official guide? It says so, and does not make up a rule.'); await type('hair dryer'); });
  await scene(12, 7000, async () => { await cap('Korean interface for residents. Same data, same sources.'); await p.click('button[data-lang="ko"]'); await wait(500); await type('아이스팩'); await wait(2500); await type('멸균팩'); });
  await p.click('button[data-lang="en"]'); await wait(300);
  await scene(13, 5000, async () => { await cap('A pilot log on the device counts lookups, unknown items and "still not sure".'); await p.fill('#q', ''); await p.evaluate(() => document.getElementById('out').innerHTML = ''); await p.click('#pilot'); });
  await p.click('#closeDlg'); await cap('');
  await p.goto(BASE + '_slides.html');
  await scene(14, 11000, () => p.evaluate(() => show('s3')));
  await scene(15, 10000, () => p.evaluate(() => show('s4')));
  await scene(16, 10000, () => p.evaluate(() => show('s5')));
  await scene(17, 5500, () => p.evaluate(() => show('s6')));
  fs.writeFileSync('/tmp/vid/scenes.json', JSON.stringify(scenes));
  await ctx.close(); await b.close();
})();
