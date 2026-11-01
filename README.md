# Bunri (분리)

Type what you're throwing away. Bunri tells you which bin it goes in under Korea's household sorting rules, shows the official sentence it got that answer from, and asks one question when the answer depends on something (is the pizza box oily? is the PET bottle clear?). If the item isn't in the official guide, it says so instead of guessing.

Arbiter Hacks V1, Theme track: Rethinking Waste.

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

Two sets of synthetic queries written for this project (not logged from real users), in the way people type: Korean and English, typos, question endings, and items that are **not** in the guide.

- **v2 (primary, `eval/queries_v2.tsv`, 129 queries)**: written after an independent review and before the fixes that review asked for. Never used for tuning. 18 of them also exist as an alias after normalisation; results without those are shown too.
- **v1 (`eval/queries.tsv`, 224 queries)**: every third query is the dev split used to pick the thresholds. After the review, four failing v1 test queries were fixed with aliases, so v1 test is no longer a clean test.

Baselines are a plain search box doing substring matching over the same dictionary: names only, and names plus the same aliases Bunri uses.

| v2, 122 in-guide + 7 out-of-guide queries | Bunri | Substring, names + aliases | Substring, names only |
|---|---|---|---|
| Direct answer, right bin | 36.1% | 65.6% | 44.3% |
| Right item among the 3 options it shows | 56.6% | n/a | n/a |
| **Resolved (either of the above)** | **92.6%** | 65.6% | 44.3% |
| **Confident answers in the wrong bin** | **2** (4.3% of answers) | 24 (23.1%) | 20 (27.0%) |
| Out-of-guide queries declined | 6 / 7 | 6 / 7 | 5 / 7 |

Without the 18 alias-overlap queries: Bunri resolves 91.3% (25.0% direct, 66.3% from 3 options) with 2 wrong-bin answers; the alias baseline resolves 61.5% with 22.

The trade-off is deliberate: Bunri asks "which one do you mean?" much more often than it answers directly, and in exchange it rarely sends an item to the wrong bin. v1 numbers and every error are in `eval/results.json`. Remaining v2 errors include "휴대폰 보조배터리" → phone battery (wrong bin), "chicken bone" → chicken box (should be declined), and "쿠팡 박스" / "chip bag" not reaching the top 3.

Reproduce: `node scripts/build_kb.mjs && node scripts/eval.mjs`.

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
scripts/eval.mjs              dev threshold search + test report + baseline
public/                       the app (index.html, app.js, sw.js)
```

Matching: query → strip filler words ("버리는 법", "how do I throw away") → jamo 2–4-grams + word tokens → TF-IDF cosine against ~1,400 names and aliases → lower the score when a typed word is not explained by the matched name → decide answer / pick / unknown with the tuned thresholds.

## Run it

```
node scripts/build_kb.mjs
python3 -m http.server -d public 8000   # open http://localhost:8000
```

## Measuring impact (pilot plan)

One apartment block or dorm, four weeks. Weeks 1–2 baseline, weeks 3–4 with a QR code to Bunri on the recycling area. Measure:
1. Contamination in the recycling bins: share of non-recyclable items by count in a fixed sample of bags, same day each week.
2. From the pilot log: lookups, abstentions (items to add), "still not sure" taps.
Success = lower contamination in weeks 3–4 than the baseline, with the abstention list shrinking as items are added.

## Limits

- Rules are the national guideline. Districts can differ; Bunri flags items where the guideline defers to the ordinance, but it does not yet have per-district data.
- The guideline copy used has no printed edition date, so some entries may be out of date. Known updates (cartons) are applied from the 2026 Q&A; the 2026 directive table (지침 별표1) itself wasn't machine-readable here. Press reports say separate carton collection becomes mandatory for large apartment complexes in January 2027 under a revised directive (Maeil Shinmun, 2026-10-11) [press]; Bunri will need the final directive text when it is published. A few rules (clear PET bottles separate from other plastic) come from Seoul's 2024 page.
- Material-based answers for "wood or mixed" follow similar entries in the guide (wooden chopsticks, wooden combs) rather than an explicit rule.
- No photo input yet.

## Next

Per-district overlays (a JSON file per 구), the 2026 directive table, a photo mode that proposes candidates for the same answer/ask/abstain flow, and the pilot above.

## Sources

See `data/SOURCES.md`. Code: MIT. Guideline text is quoted from Korean government publications with attribution.
