# Bunri (분리)

Type what you're throwing away. Bunri tells you which bin it goes in under Korea's household sorting rules, shows the official sentence it got that answer from, and asks one question when the answer depends on something (is the pizza box oily? is the PET bottle clear?). If the item isn't in the official guide, it says so instead of guessing.

Arbiter Hacks V1, Theme track: Rethinking Waste.

**Live demo:** https://yumin-beep.github.io/bunri/ (works offline after the first visit)

## The problem

Korea sorts household waste into a dozen streams: paper, paper cartons, cans, scrap metal, glass, plastic, clear PET, film, styrofoam, clothing, food waste, pay-as-you-throw bags, non-burnable sacks, bulky waste, e-waste and drop-off boxes. The rules live in a 34-page Ministry of Environment PDF. The guide is full of items that look recyclable and aren't: receipts (thermal paper), eggshells (not food waste), ice packs, oily pizza boxes. Others are recyclable but go in the wrong stream, like paper cartons thrown in with paper. A wrong item in a recycling stream contaminates the batch; a recyclable in the trash is lost. Paper cartons are one example: of 75,000 tonnes shipped in 2022, about 60% were mixed into waste paper and 27% went into garbage bags (Hankook Ilbo, 2024-01-17) [press].

Search boxes that match on the item name miss how people actually type ("계란 껍떼기", "greasy pizza box", "우유곽"), and chatbots that answer fluently can't show where an answer came from.

## What it does

- **Fuzzy item matching** in Korean and English. Korean text is decomposed into jamo so typos and spacing don't break the match.
- **Answer, ask, or abstain.** A confidence threshold (tuned on a dev split) decides whether to answer, show the top 3 candidates, or say "not in the official guide".
- **One follow-up question** for items that depend on a condition. Words already in the query pre-answer it ("greasy pizza box" → oily → general bag).
- **The official text, every time.** Each answer quotes the source sentence in Korean with its page number and a link. English text is labelled as an unofficial translation.
- **Newer rules override the old guide, visibly.** Example: foil-lined (aseptic) cartons. The older guide says to put them in the pay-as-you-throw bag; the Korea Waste Association's 2026 Q&A says to put them out with paper cartons. Bunri shows the 2026 rule, marks it as updated, and keeps the older sentence underneath.
- **Local-rule flag** when the guideline itself says the district ordinance decides.
- **Offline PWA.** Static files, no server, no API key, no tracking. Runs on any phone.
- **Pilot log** (stored on the device only): counts lookups, abstentions and "still not sure" taps, exports CSV. This is how a building manager or dorm can measure it (see below).

## Results

All query sets are synthetic: written for this project in the way people type (Korean and English, typos, question endings, "old"/"empty"/"다 쓴" in front of the item, and items that are **not** in the guide), not logged from real users. v2, v3 and v4 were each committed to git before the matcher changes they measure (v1 was committed together with the first version of the app); the commit order is in `eval/round2_2026-11-15.md`.

**Primary result: v4 (`eval/queries_v4.tsv`, 158 queries), sealed test set.** Written before the second round of changes, scored once for this report and never used for tuning (CI re-runs the same report on every push). One gold label (sneakers/운동화 → 신발, guide p.30) was corrected before the first run; that correction lowers the wrong-bin count of both versions by one.

| v4, 151 in-guide + 7 out-of-guide queries | Bunri (11/15) | Bunri as first submitted (11/02) | Substring, names + aliases | Substring, names only |
|---|---|---|---|---|
| Direct answer, right bin | **72.8%** | 64.2% | 66.2% | 51.7% |
| Right item among the 3 options it shows | 19.9% | 27.8% | n/a | n/a |
| **Resolved (either of the above)** | **92.7%** | 92.1% | 66.2% | 51.7% |
| **Confident answers in the wrong bin** | **1** (0.9% of answers) | 2 | 30 (23.1%) | 16 (17.0%) |
| Out-of-guide queries declined | 6 / 7 | 7 / 7 | 4 / 7 | 5 / 7 |

The one wrong-bin answer is "car battery" → household battery drop-off (car batteries aren't in the household guide). Misses that never reach the 3 options: rotten-food phrasings ("rotten fruit", "썩은 과일"), coloured PET, body-wash bottle, paper bag, chip packet, 컵라면 용기.

Earlier sets, kept for history: v1 (224, thresholds of round 1 tuned on its dev third), v2 (129, primary in round 1), v3 (184, dev set for round 2). All numbers and every error are in `eval/results.json`.

What changed in round 2: context words ("old", "empty", "빈", "다 쓴") stripped before matching; a stopword bug that turned "tuna can" into "tuna" fixed; and **same-bin agreement**: when every close candidate goes to the same bin with the same follow-up, Bunri answers instead of asking the user to pick. It still asks when the candidates disagree ("bottle cap": metal or plastic?).

Reproduce: `npm test` (build + smoke tests) and `npm run eval`.

## How it works

```
data/raw_moe_dictionary.tsv   285 entries from the guideline's item dictionary (appendix, pp.27-34)
data/extra_body_items.tsv     27 more from the guideline (23 body rules pp.6-15, 4 material-split rows pp.28/33),
                              3 from a Seoul city page (2024), 1 from the 2026 Q&A
data/updates.tsv              newer rules that override the guide (2026 Q&A), with the old text kept
data/sources.json             source titles, dates, URLs
data/items.tsv                English names, aliases, bin, follow-up question per entry
data/questions.json           follow-up questions, options → bin, hint words
scripts/build_kb.mjs          builds public/kb.json (items + TF-IDF index)
src/matcher.js                normalisation, jamo n-grams, TF-IDF cosine, word-coverage check, decide()
scripts/eval.mjs              option/threshold search on dev sets + report + baselines
tests/smoke.mjs               fast checks run in CI (.github/workflows/ci.yml)
docs/pilot/                   A4 QR poster, bag audit sheet, pilot protocol
public/                       the app (index.html, app.js, sw.js)
```

Matching: query → strip filler and context words ("버리는 법", "how do I throw away", "old", "다 쓴") → jamo 2–4-grams + word tokens → TF-IDF cosine against ~1,400 names and aliases → lower the score when a typed word is not explained by the matched name → decide answer / pick / unknown with the tuned thresholds; a pick whose close candidates all share one bin becomes an answer.

## Run it

```
node scripts/build_kb.mjs
python3 -m http.server -d public 8000   # open http://localhost:8000
```

## Measuring impact (pilot kit)

Ready to print in `docs/pilot/`: an A4 bilingual QR poster, a bag audit sheet and the protocol (`PILOT.md`).

One apartment block or dorm, four weeks. Weeks 1–2 baseline, weeks 3–4 with the posters at the recycling area. Each week, same weekday and time, open 10 recycling bags picked by position and count items that don't belong in that stream.
1. Main metric: contamination rate = wrong items ÷ items checked, weeks 1–2 vs 3–4.
2. Paper cartons found in the paper pile (the most-missed rule in the national figures).
3. From the pilot log (CSV export): lookups, "not in guide" queries (what to add next), "still not sure" taps.

Cost: four printed sheets and about 30 minutes a week. Limits: one building, no control building, so the change can't be attributed to Bunri alone; a second round would add a control building.

## Limits

- Trade-off of round 2: out-of-guide queries declined fell from 7/7 to 6/7 on v4 ("car battery" → household battery drop-off), and "chicken bone" in v2 is still answered as chicken box. Answering more often means occasionally answering when it should abstain.

- Rules are the national guideline. Districts can differ; Bunri flags items where the guideline defers to the ordinance, but it does not yet have per-district data.
- The guideline copy used has no printed edition date, so some entries may be out of date. Known updates (cartons) are applied from the 2026 Q&A; the 2026 directive table (지침 별표1) itself wasn't machine-readable here. Press reports say separate carton collection becomes mandatory for large apartment complexes in January 2027 under a revised directive (Maeil Shinmun, 2026-10-11) [press]; Bunri will need the final directive text when it is published. A few rules (clear PET bottles separate from other plastic) come from Seoul's 2024 page.
- Material-based answers for "wood or mixed" follow similar entries in the guide (wooden chopsticks, wooden combs) rather than an explicit rule.
- No photo input yet.

## Next

Per-district overlays (a JSON file per 구), the 2026 directive table, a photo mode that proposes candidates for the same answer/ask/abstain flow, and the pilot above.

## Sources

See `data/SOURCES.md`. Code: MIT. Guideline text is quoted from Korean government publications with attribution.
