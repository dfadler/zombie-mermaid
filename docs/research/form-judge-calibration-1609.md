# Form-judge calibration (#1609, prompt fix #1822)

Runs on 2026-10-11, locally, with `claude -p --model claude-sonnet-5 --max-turns 150`, `--allowedTools "Read,Write"` and the same `--disallowedTools` list as the judge step in `.github/workflows/form-judge-weekly.yml`, `__BATCH_SIZE__` = 5. Case ids were blinded (`case-NNN`; the opaque-to-real map is `*-ids.json`), so the judge could not read the mutation name from the id.

13 known-faithful base samples (5 Flowchart, 3 Sequence, 5 Class/ER/State): 13 clean cases and 61 planted defects. Raw verdicts and id maps: `form-judge-calibration-1609/before/` (original prompt) and `form-judge-calibration-1609/after/` (prompt from #1822, same cases and same ids).

## Before and after

|                                                         | before (original prompt) | after (#1822 prompt) | threshold |
| ------------------------------------------------------- | ------------------------ | -------------------- | --------- |
| False-positive rate on the 13 clean base cases          | 0/13 = 0%                | 0/13 = 0%            | <= 10%    |
| False-positive rate on 10 extra unseen clean samples    | not run                  | 0/10 = 0%            | <= 10%    |
| Recall on planted defects (`faithful: false`)           | 46/61 = 75.4%            | 61/61 = 100%         | >= 80%    |
| Recall counting any finding, even with `faithful: true` | 59/61 = 96.7%            | 61/61 = 100%         | info      |

| Mutation                                         | n   | before `faithful:false` | after `faithful:false` |
| ------------------------------------------------ | --- | ----------------------- | ---------------------- |
| missingNode (blank one box)                      | 13  | 13                      | 13                     |
| dropEdge (blank one whole edge)                  | 11  | 10                      | 11                     |
| swapDirection (flip every arrowhead)             | 11  | 11                      | 11                     |
| truncateLabel (cut a label by 2 chars)           | 13  | 5                       | 13                     |
| wrongLabel (replace a label with `Zzzz`)         | 13  | 7                       | 13                     |
| dropEdge v1, arrowhead row only (reference only) | 11  | 3                       | 3                      |

The v1 `dropEdge` (delete only the arrowhead row, leaving the connector) is a much weaker defect. After the fix it is reported as a finding in 11/11 cases but only 3 get `faithful: false`; the rest stay `minor` and so `faithful: true`, which the new rule allows. It is excluded from the recall figure in both columns.

## What changed in the prompt

`scripts/form-judge-category-prompt.md`: severity and `faithful` are now separate calls. Any `major` or `moderate` finding (a wrong or truncated label, a missing or extra node or edge, a wrong connection, a flipped arrow, wrong element kind or position) makes `faithful: false`; `faithful: true` is for no findings or purely cosmetic `minor` ones. The "when in doubt, don't report" guard, the "quote both the ASCII and the SVG" evidence requirement, and all the untrusted-data / injection wording are unchanged. The report job in the workflow already counts `faithful: false` as "not faithful" and lists `faithful: true` findings as "(noted)", so it needed no change.

## Why this should not be overfit

- The rule is stated in terms of content differing from the SVG, not in terms of the mutations (no mention of arrowheads-only, `Zzzz`, or truncation lengths).
- False positives were re-measured twice: on the 13 clean cases already used, and on 10 clean samples that were never mutated or used in tuning (all-edge-styles, LR direction, actor stick figures, activation boxes, interface annotation, PK/FK keys, composite states, all class relationship types, all ER cardinalities, chained edges). 0 of 23 clean cases were flagged and none produced any finding.
- The only real finding in the last successful weekly run (a `minor` on "XY: Multiple Bar Series", which the judge itself concluded matches real mermaid) stays `minor`, so `faithful: true`, under the new rule.
- Only one prompt iteration was needed; no tuning loop against these cases.

Caveat: the clean set is small (23). A single false positive would be 4%, and the weekly run is the larger check. Re-run this calibration when the prompt or model changes.

## Corrections after review

- `before/sequence-results.jsonl`: the judge skipped OAuth `dropEdge` (`case-014`) and numbered the rest by position, so the verdicts labelled `case-014`..`case-016` described `swapDirection`, `truncateLabel` and `wrongLabel` (each by its finding text). They are now relabelled `case-015`..`case-017`. This moves one caught case from truncateLabel to swapDirection in the table above (swapDirection 11/11, truncateLabel 5/13); the 46/61 total is unchanged. OAuth `dropEdge` is covered by `dropedge-results.jsonl`.
- `dropEdge` on the 3 Sequence samples (cases `case-007`..`case-009` of `dropedge-*`) was generated before `blankEdge` was fixed to follow a horizontal arrowhead along its own axis. A Sequence arrowhead sits in the lifeline column, so the old code blanked the lifeline and left the message line. Those 3 cases were rebuilt with the fixed mutation and re-judged: with the original prompt for `before/`, with the #1822 prompt for `after/`, and the committed verdict files are updated. All 3 are `faithful: false` under both prompts (finding: the first message's connector and arrowhead is missing), so the dropEdge counts do not change (before 10/11, after 11/11). The `dropEdge v1` reference row comes from the Sequence/Flowchart/Class sets and was never the fixed mutation; it stays reference only.
- **Open question for the maintainer, not decided here:** the single-case OAuth `wrongLabel` retry (`before/retry-results.jsonl`, `faithful: true`, no finding) was a re-run of a case the Sequence session had skipped; the session's own verdict for that case, once relabelled to `case-017`, is `faithful: false`. The "before" numbers above use the retry verdict. Totals both ways (original prompt):

  |            | with retry override (`true`) | with relabelled session verdict (`false`) |
  | ---------- | ---------------------------- | ----------------------------------------- |
  | wrongLabel | 7/13                         | 8/13                                      |
  | recall     | 46/61 = 75.4%                | 47/61 = 77.0%                             |

  Both are below the 80% threshold. The "after" numbers (100%) do not depend on this choice.

## Earlier baseline notes (original prompt)

All 10 Flowchart label mutations and 3 of the other 16 got a `moderate` finding with `faithful: true`; the `dropEdge` miss was Flowchart nested subgraphs; one Sequence OAuth `wrongLabel` case got no finding at all (and the first Sequence session skipped one case, re-run singly).

## Wall time (after-run, parallel sessions)

Flowchart 30 cases 434 s, Sequence 18 cases 162 s, Class/ER/State 26 cases 511 s, `dropEdge` 11 cases 157 s, extra clean 10 cases (see above), all in parallel, about 9 minutes. The before-run took about 19 minutes.

## Reproduce

```
pnpm run form-facts
pnpm run form-judge-calibrate build --index=form-facts-index.json --data-out=calib-data.json --ids-out=calib-ids.json --sample-ids=<ids>
# run the judge on calib-data.json exactly like the workflow's judge step, writing calib-results.jsonl
pnpm run form-judge-calibrate score --results=calib-results.jsonl --ids=calib-ids.json
```
