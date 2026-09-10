# PR-rescue candidates (issue #258)

Research pass for [#258](https://github.com/dfadler/zombie-mermaid/issues/258). This is
**research only** — nothing here has been cherry-picked, rebased, or imported. Every row
below is upstream's own code, listed for the repo owner to review; importing any of it
is a separate decision that involves real license/attribution/quality judgment calls.

## Method

`gh pr list --repo lukilabs/beautiful-mermaid --state open --limit 100` returned all 30
open PRs against upstream (`lukilabs/beautiful-mermaid`) as of 2026-09-09. Both repos are
MIT-licensed, so there's no license conflict for any of these — attribution (crediting
the original author in the commit and CHANGELOG, per the issue's own instructions) still
applies to every import.

"Size" is `+additions/-deletions` across N files, from the PR list API — not a diff
review. "Likely duplicate" means zombie-mermaid's own `docs/../demo/fork-fixes-data.ts`
already lists an independently-authored fix for what looks like the same upstream bug;
that needs a real diff comparison before deciding whether the upstream PR still adds
anything (a different fix approach, broader coverage, etc.), not just superseding it.

## Candidate table

| PR | Title | Author | Size | Assessment |
|---|---|---|---|---|
| [#150](https://github.com/lukilabs/beautiful-mermaid/pull/150) | New diagram types: pie, timeline, mindmap, quadrant | Daniele-rolli | +2571/-3, 36 files | **Top candidate, but big.** zombie-mermaid currently only supports flowchart/sequence/class/ER/xychart (confirmed against `src/diagram-registry.ts`) — this would be a real capability gain, not a duplicate. Opened today (2026-09-09); large and unreviewed upstream, so budget a full review pass, not a quick cherry-pick. |
| [#142](https://github.com/lukilabs/beautiful-mermaid/pull/142) | fix: tolerate trailing semicolon on flowchart class assignments | dfadler (repo owner) | +52/-1, 2 files | **Not a rescue candidate** — this is the repo owner's own upstream contribution, sent from this fork. Confirm it's already present in zombie-mermaid's own parser rather than double-applying it. |
| [#141](https://github.com/lukilabs/beautiful-mermaid/pull/141) | Add `"sideEffects": false` so bundlers can drop elkjs from ASCII-only builds | zjywill | +1/-0, 1 file | **Likely already covered.** zombie-mermaid's `package.json` already declares `"sideEffects": false` at the package level, and CHANGELOG 2.2.1 (#644) describes a more thorough fix (splitting the diagram-type registry so `./ascii` never imports elkjs at all) than this one-line PR attempts. Confirm no gap remains, but probably nothing to import. |
| [#139](https://github.com/lukilabs/beautiful-mermaid/pull/139) | Fix edge-label text overflowing its padded background on wide labels | OmShiv | +142/-56, 2 files | **Good candidate.** Small, focused SVG fix, plausible bug, no obvious overlap with existing fork-fixes entries. |
| [#135](https://github.com/lukilabs/beautiful-mermaid/pull/135) | fix: measure monospace fonts with uniform advance width | aryasaatvik | +111/-3, 3 files | **Good candidate.** Small, focused font-measurement fix. |
| [#134](https://github.com/lukilabs/beautiful-mermaid/pull/134) | fix(svg): render start-arrowhead markers properly | wsnark | +38/-29, 2 files | **Possible duplicate — check first.** zombie-mermaid already fixed a start-arrowhead double-reversal bug (`fork-fixes-data.ts`'s `start-arrow-markers` entry, internal PR 50) that sounds like the same class of bug. Diff before importing. |
| [#132](https://github.com/lukilabs/beautiful-mermaid/pull/132) | fix(parser): support CJK subgraph ids and quoted bracket titles (closes #89) | andelf | +58/-7, 2 files | **Likely duplicate.** zombie-mermaid's `cjk-subgraph-id` fork-fix entry already resolves upstream issue #89 (CJK subgraph ids). Confirm coverage is equivalent; the "quoted bracket titles" half may still be new. |
| [#128](https://github.com/lukilabs/beautiful-mermaid/pull/128) | fix: align ASCII box borders around fullwidth (CJK/emoji) labels | chan1103 | +558/-111, 13 files | **Likely duplicate, and large.** zombie-mermaid's `cjk-box-width` fork-fix entry already resolves upstream issues #12, #13, #119, #122 (this exact symptom). Given the size, a diff review is worth doing only if the existing fix is known to be incomplete. |
| [#127](https://github.com/lukilabs/beautiful-mermaid/pull/127) | Strict cardinality parser | denilsonsa | +27/-26, 3 files | **Possible overlap, worth a look.** May extend beyond the `er-cardinality` fork-fix (upstream #124) — "strict" parsing suggests broader validation, not just the `}o` case. Small enough to review quickly. |
| [#126](https://github.com/lukilabs/beautiful-mermaid/pull/126) | fix: Correct parsing of `}o` cardinality | denilsonsa | +8/-8, 1 file | **Likely already fixed.** zombie-mermaid's `er-cardinality` fork-fix entry uses the exact `TAG }o--\|\| PRODUCT` reproduction case. Tiny diff, cheap to confirm and close out. |
| [#120](https://github.com/lukilabs/beautiful-mermaid/pull/120) | feat: add MCP server with SVG/ASCII rendering tools | LordCasser | +2673/-150, 14 files | **Not a candidate — superseded.** zombie-mermaid already ships its own `./mcp` export (own architecture, own tests); importing a second, differently-designed MCP server would conflict. |
| [#118](https://github.com/lukilabs/beautiful-mermaid/pull/118) | Add timeline diagram rendering | adewale | +1585/-3, 12 files | **Good candidate, moderate size.** Timeline isn't supported yet (confirmed against `src/diagram-registry.ts`). Overlaps in scope with #150 above — if both land, resolve which timeline implementation wins rather than merging both. |
| [#117](https://github.com/lukilabs/beautiful-mermaid/pull/117) | Support Mermaid frontmatter and init config | adewale | +709/-25, 8 files | **Good candidate.** No frontmatter support currently found in `src/`; this is a real, moderately-sized capability gain from a repeat contributor (same author as #118). |
| [#116](https://github.com/lukilabs/beautiful-mermaid/pull/116) | fix: auto-contrast text color for nodes with custom fills | linjiejim | +155/-2, 2 files | **Good candidate.** Small, focused accessibility/contrast fix, no known overlap. |
| [#113](https://github.com/lukilabs/beautiful-mermaid/pull/113) | Fixes #111 Fixes #112 | rmvegasm | +306/-43, 11 files | **Lower confidence.** Title doesn't say what's fixed; moderate size across 11 files bundles at least two issues together. Needs a real read of the diff and the linked upstream issues before judging mergeability. |
| [#110](https://github.com/lukilabs/beautiful-mermaid/pull/110) | fix: support `--o` and `--x` flowchart edge markers (closes #109) | mk668a | +451/-83, 10 files | **Likely duplicate.** zombie-mermaid's `circle-cross-edges` fork-fix entry already resolves upstream issues #109 and #137 for exactly this symptom (`A --o B`, `A --x C`). |
| [#99](https://github.com/lukilabs/beautiful-mermaid/pull/99) | fix: correct CJK/Korean double-width character alignment in ASCII renderer | narujiki | +105/-31, 6 files | **Possible overlap.** Related to the same class of bug as `cjk-box-width`; check whether Korean-specific cases are already covered before treating this as redundant. |
| [#98](https://github.com/lukilabs/beautiful-mermaid/pull/98) | Fix nested-subgraph layout when direction is set | ayrtonmassey | +4088/-1443, 34 files | **High value, high risk.** Large, invasive layout change across 34 files. Worth reviewing given how disruptive subgraph-direction bugs are, but this needs a dedicated review pass, not a quick import. |
| [#96](https://github.com/lukilabs/beautiful-mermaid/pull/96) | fix(svg): improve bidirectional arrow markers | TrySquadDF | +4/-4, 1 file | **Tiny — cheap to check, possibly duplicate** of the same start-arrowhead class of bug as #134 / the existing `start-arrow-markers` fork-fix. One-file diff, low cost to verify either way. |
| [#82](https://github.com/lukilabs/beautiful-mermaid/pull/82) | Feat: Add interactive playground for mermaid charts | chouraycn | +3581/-5, 19 files | **Not a candidate — superseded.** zombie-mermaid already has its own demo/editor (`editor.ts`, `demo/`); a second playground UI would duplicate existing, more-integrated infrastructure. |
| [#81](https://github.com/lukilabs/beautiful-mermaid/pull/81) | Add support CSS class attributes for classNames without a defined style (fixes #80) | richardtallent | +2515/-345, 6 files | **Worth a look despite size.** Single named issue, notable contributor (maintains other well-known OSS). Large diff for 6 files suggests substantial test/fixture churn rather than pure logic size — worth confirming before writing it off. |
| [#77](https://github.com/lukilabs/beautiful-mermaid/pull/77) | Round all floats to 2 decimal places in SVG output | GauBen | +1424/-1066, 9 files | **Good candidate, narrow purpose.** Output-precision/size improvement from a recognized OSS contributor (AdonisJS core team). Diff size is likely mostly regenerated fixtures, not new logic — confirm during review. |
| [#74](https://github.com/lukilabs/beautiful-mermaid/pull/74) | fix(package): define fallback entrypoint to exports | yhatt | +2/-1, 1 file | **Probably moot.** zombie-mermaid's `package.json` `exports` map is already substantially restructured (separate `.`/`./ascii`/`./mcp` subpaths) from upstream's, so this one-line packaging fix likely doesn't apply as-is. Cheap to confirm. |
| [#71](https://github.com/lukilabs/beautiful-mermaid/pull/71) | Add parser and integration tests for C4 and ArchiMate diagrams | devx | +30785/-19846, 112 files | **Not practical to cherry-pick as-is.** Enormous diff (112 files); C4/ArchiMate aren't supported in zombie-mermaid at all yet. If C4/ArchiMate support is ever wanted, treat this as prior art to study, not a mergeable patch. |
| [#70](https://github.com/lukilabs/beautiful-mermaid/pull/70) | chore: add Biome linter/formatter with auto-fixed codebase | devx | +2348/-1535, 77 files | **Not a candidate — tooling conflict.** zombie-mermaid uses its own lint/format tooling; a repo-wide Biome auto-format from a different codebase snapshot would conflict wholesale rather than merge cleanly. |
| [#69](https://github.com/lukilabs/beautiful-mermaid/pull/69) | fix: group root nodes by downstream target and align fan-in children | ktrysmt | +31/-7, 1 file | **Good candidate.** Tiny, focused layout fix from a contributor who sent three small PRs in one day (see #67, #66) — suggests a careful, incremental fixer. |
| [#67](https://github.com/lukilabs/beautiful-mermaid/pull/67) | fix: use edge-target check for root detection instead of order-dependent scan | ktrysmt | +50/-56, 3 files | **Good candidate.** Small, focused root-detection fix; same author as #69/#66. |
| [#66](https://github.com/lukilabs/beautiful-mermaid/pull/66) | fix: add iteration limit to A* pathfinder to prevent OOM on dense graphs | ktrysmt | +144/-0, 2 files | **Top candidate.** OOM-prevention fixes are high value and low risk to import; small, additive, and well-scoped. |
| [#63](https://github.com/lukilabs/beautiful-mermaid/pull/63) | Fix misleading edge overlap in routing | tegonzalez | +1501/-153, 14 files | **Moderate candidate.** Real, narrowly-described routing fix, but large enough (14 files) to need a genuine review before importing. |
| [#57](https://github.com/lukilabs/beautiful-mermaid/pull/57) | feat: expose `mergeEdges` in RenderOptions for edge bundling control | leslie555 | +16/-1, 3 files | **Good candidate.** Small, clean, additive API surface — low risk. |
| [#54](https://github.com/lukilabs/beautiful-mermaid/pull/54) | fix: silently dropped notes before first message | rnbguy | +190/-0, 4 files | **Good candidate.** Focused sequence-diagram fix, moderate size, no known overlap. |
| [#51](https://github.com/lukilabs/beautiful-mermaid/pull/51) | feat: add CLI for rendering diagrams from the command line | vinceyyy | +916/-11, 10 files | **Not a candidate — superseded.** zombie-mermaid already has its own `src/cli.ts` and `src/cli/` directory. |
| [#50](https://github.com/lukilabs/beautiful-mermaid/pull/50) | feat: CJK and emoji fullwidth character support for ASCII renderer | GavinRiver | +678/-132, 18 files | **Likely duplicate.** Same feature area as zombie-mermaid's own `cjk-box-width` fork-fix; confirm before treating as new. |
| [#42](https://github.com/lukilabs/beautiful-mermaid/pull/42) | feat: add MCP server for AI agent integration | manuareraa | +424/-1, 4 files | **Not a candidate — superseded**, same reasoning as #120. |
| [#34](https://github.com/lukilabs/beautiful-mermaid/pull/34) | Add C4 and ArchiMate diagram support | kristjanakkermann | +3503/-10, 15 files | **Interesting but big, and unsupported diagram family.** Would be a genuine capability add if C4/ArchiMate support is wanted; needs a full review, not a cherry-pick. Two independent PRs targeting the same diagram types (this and #71) suggests real upstream demand for it. |
| [#31](https://github.com/lukilabs/beautiful-mermaid/pull/31) | Add static color resolution for PDF-compatible SVG output | martinec | +1407/-212, 10 files | **Moderate candidate.** Narrow, real use case (PDF export compatibility), but large enough to need review before import. |
| [#28](https://github.com/lukilabs/beautiful-mermaid/pull/28) | docs: add SkillKit skills for AI coding assistants | rohitg00 | +4015/-0, 12 files | **Low priority.** Docs-only (lower risk to merge technically), but large bulk-generated skill content of uncertain ongoing value; zombie-mermaid already has its own CLAUDE.md/skills setup. |
| [#3](https://github.com/lukilabs/beautiful-mermaid/pull/3) | Add Codex/Claude skill | chrischabot | +307/-0, 5 files | **Low priority — likely superseded** by zombie-mermaid's own existing agent-skill setup. |

## Top picks for a first rescue batch

If picking a small first batch to actually import (a separate decision from this
research pass), the lowest-risk, highest-value candidates are:

1. **[#66](https://github.com/lukilabs/beautiful-mermaid/pull/66)** — A* pathfinder OOM guard. Small, additive, prevents a real crash.
2. **[#69](https://github.com/lukilabs/beautiful-mermaid/pull/69) / [#67](https://github.com/lukilabs/beautiful-mermaid/pull/67)** — same author's small, focused root-detection/layout fixes.
3. **[#57](https://github.com/lukilabs/beautiful-mermaid/pull/57)** — tiny, additive `mergeEdges` option.
4. **[#116](https://github.com/lukilabs/beautiful-mermaid/pull/116)** — auto-contrast text fix, small and self-contained.
5. **[#139](https://github.com/lukilabs/beautiful-mermaid/pull/139)** and **[#135](https://github.com/lukilabs/beautiful-mermaid/pull/135)** — small, focused SVG fixes with no known overlap.

For new diagram-type capability (bigger effort, bigger payoff): **[#150](https://github.com/lukilabs/beautiful-mermaid/pull/150)**
(pie/timeline/mindmap/quadrant) and **[#117](https://github.com/lukilabs/beautiful-mermaid/pull/117)** (frontmatter/init config)
stand out as real gaps zombie-mermaid doesn't cover today.

Several PRs flagged "likely duplicate" above (#134, #132, #128, #126, #110, #99, #96,
#50) cluster around CJK/fullwidth-character handling and start-arrowhead markers —
exactly the areas zombie-mermaid's own fork-fixes page already advertises as fixed. A
useful next step before any cherry-pick is a systematic diff between each flagged PR and
the corresponding fork-fixes commit, to confirm equivalence (or find a gap) rather than
relying on title similarity alone.
