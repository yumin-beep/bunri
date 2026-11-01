// Places narration clips at scene starts and encodes the final mp4.
// node video/mux.cjs <in.webm> <out.mp4>
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const [inp, out] = process.argv.slice(2);
const scenes = JSON.parse(fs.readFileSync('/tmp/vid/scenes.json', 'utf8'));
const NARR = path.join(__dirname, 'narration');
const clips = scenes.map(s => ({ ...s, f: path.join(NARR, `n${String(s.n).padStart(2, '0')}.wav`) })).filter(c => fs.existsSync(c.f));
// The recorded video starts a little after the context is created; measure the offset as 0 (Playwright starts recording at context creation).
const inputs = clips.map(c => `-i "${c.f}"`).join(' ');
const delays = clips.map((c, i) => `[${i + 1}:a]adelay=${Math.round((c.t + 0.25) * 1000)}:all=1,aresample=48000[a${i}]`).join(';');
const mix = clips.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${clips.length}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,apad[a]`;
execSync(`ffmpeg -v error -y -i "${inp}" ${inputs} -filter_complex "${delays};${mix}" -map 0:v -map "[a]" -c:v libx264 -pix_fmt yuv420p -crf 20 -preset slow -movflags +faststart -c:a aac -b:a 128k -shortest "${out}"`, { stdio: 'inherit' });
console.log('clips', clips.length);
