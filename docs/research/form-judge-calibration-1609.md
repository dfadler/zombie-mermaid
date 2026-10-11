# Form-judge calibration baseline (#1609)

Run 2026-10-11, locally, with `claude -p --model claude-sonnet-5 --max-turns 150`, `--allowedTools "Read,Write"` and the same `--disallowedTools` list as the judge step in `.github/workflows/form-judge-weekly.yml`, the unchanged `scripts/form-judge-category-prompt.md` (`__BATCH_SIZE__` = 5). Case ids were blinded (`case-NNN`; the opaque-to-real map is `*-ids.json`), so the judge could not read the mutation name from the id.

13 known-faithful base samples (5 Flowchart, 3 Sequence, 5 Class/ER/State), 13 clean cases and 61 planted defects. Sessions: Flowchart (30 cases, 463 s), Sequence (18, 204 s), Class/ER/State (26, 561 s), run in parallel; then one `dropEdge` re-run (11 cases, 450 s) and one single-case retry (the Sequence session skipped one case; 41 s).

## Result against the plan's thresholds

| Metric                                                 | Value           | Threshold | Verdict  |
| ------------------------------------------------------ | --------------- | --------- | -------- |
| False-positive rate on clean (`faithful: false`)       | 0 / 13 = 0%     | <= 10%    | pass     |
| Recall on planted defects (`faithful: false`)          | 46 / 61 = 75.4% | >= 80%    | **fail** |
| Recall counting any finding, even with `faithful:true` | 59 / 61 = 96.7% | (info)    | n/a      |

## Per mutation

| Mutation                                             | n   | `faithful:false` | any finding |
| ---------------------------------------------------- | --- | ---------------- | ----------- |
| missingNode (blank one box)                          | 13  | 13 (100%)        | 13          |
| dropEdge v2 (blank one edge: head plus its run)      | 11  | 10 (91%)         | 10          |
| swapDirection (flip every arrowhead)                 | 11  | 10 (91%)         | 11          |
| truncateLabel (cut a label by 2 chars)               | 13  | 6 (46%)          | 13          |
| wrongLabel (replace a label with `Zzzz`)             | 13  | 7 (54%)          | 12          |
| dropEdge v1 (delete only the arrowhead row), for ref | 11  | 3 (27%)          | 6           |

Flowchart `faithful:false` on the two label mutations: 0/10; Sequence 3/6; Class/ER/State 10/10.

## What the judge got wrong

1. **Verdict vs finding gap (prompt problem).** The prompt lists a label "cut off mid-word" as a defect to look for, and the judge reports it (every Flowchart `truncateLabel`/`wrongLabel` case has a `moderate` finding such as "The 'Start' node label is replaced with unrelated placeholder text 'Zzzzz'"), but then sets `faithful: true`: all 10 Flowchart label mutations and 3 of the 16 elsewhere. The rule "`faithful` is false only when ... severe enough" plus "a false positive here is worse than a missed minor issue" pushes moderate findings to a true verdict. In the weekly report these land under "(noted)" and not in the "not faithful" count, so the headline number understates real defects. Following up in a separate issue.
2. **Missed arrowhead-only loss.** When only the arrowhead row is removed (v1) most misses report nothing, or a `minor` arrowhead finding with `faithful: true` (state `[*]` edges, class association). The v2 mutation (the edge is gone) is caught 10/11; the miss was Flowchart nested subgraphs.
3. **One true silent miss:** Sequence OAuth flow with a replaced label (large diagram), no finding at all.

## Reproduce

```
pnpm run form-facts
pnpm run form-judge-calibrate build --index=form-facts-index.json --data-out=calib-data.json --ids-out=calib-ids.json --sample-ids=<ids>
# run the judge on calib-data.json exactly like the workflow's judge step, writing calib-results.jsonl
pnpm run form-judge-calibrate score --results=calib-results.jsonl --ids=calib-ids.json
```

Raw verdicts and id maps for this run: `docs/research/form-judge-calibration-1609/`.
