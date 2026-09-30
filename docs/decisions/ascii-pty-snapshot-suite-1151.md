# Real-PTY pixel-snapshot CI suite for ASCII rendering (#1151 Option B)

Status: **proposal, awaiting owner decision.** This page started as the
"not now" recommendation in #1186. That recommendation is kept below as the
first position; the "Proposal" section supersedes it only if the owner
approves the scoped version. Nothing here is required CI.

## Context

[#1141](https://github.com/dfadler/zombie-mermaid/issues/1141) asked how to
automate real-terminal verification of ASCII output. Its confirmed bug was
fixed in [#1146](https://github.com/dfadler/zombie-mermaid/pull/1146) and
Option A (a Vitest check that `renderMermaidASCII` and the `ascii-html.ts`
mockup produce identical character grids) shipped in
[#1147](https://github.com/dfadler/zombie-mermaid/pull/1147).
[#1151](https://github.com/dfadler/zombie-mermaid/issues/1151) asks whether
to also add Option B: record samples through a real PTY
(`scripts/ascii-terminal-capture.sh`, `ASCII_AGG_RUNTIME=docker`) and diff
against committed goldens.

## First position (#1186): not now

- **Benefit is narrow.** After #1147, B adds real font shaping, rasterization
  and color-through-a-TTY coverage only. No repeat incident in that class.
- **Cost is recurring.** A Docker/agg/asciinema CI dependency and a
  regenerate-and-review step on every legitimate ASCII output change.
- **Revisit trigger.** A second regression that passes #1147 but is visibly
  wrong in a real terminal.

Written before the prototype below existed. Two of its cost assumptions
(about 90 goldens; a full per-PR run) do not apply to the scoped version.

## Proposal: scoped, advisory, easy to remove

Implemented as a prototype in this PR; every file is removable in one commit.

- **Scope.** 13 curated samples in `scripts/ascii-pty-snapshot-samples.txt`
  (flowchart, edge styles, subgraphs, state, CJK wide glyphs, sequence, class,
  ER, XY), each with a one-line reason. Not the ~90 catalog.
- **Goldens.** `__tests__/ascii-pty-snapshots/<index>-<slug>.{txt,png}`, 26
  files, 232 KB total. The `.txt` (terminal text as recorded through the PTY)
  is compared exactly; the `.png` is compared with a small pixel tolerance.
  Keeping both separates the failure classes: `.txt` differs means the
  renderer's output changed, `.png`-only differs means rasterization, font or
  color drift.
- **Runner.** `scripts/ascii-pty-snapshot.sh` wraps the existing
  `ascii-terminal-capture.sh` unchanged. `--update` rewrites goldens. agg's
  Docker image is pinned by digest, so a new agg release cannot move pixels
  without a reviewed commit.
- **CI.** `.github/workflows/ascii-pty-snapshot.yml`: `workflow_dispatch` plus
  `pull_request` filtered to `packages/ascii-renderer/**`,
  `packages/site/ascii-html.ts`, `packages/site/samples-data.ts`, the capture
  scripts and the goldens. `continue-on-error: true`, `contents: read` only,
  actions SHA-pinned, captures and diffs uploaded as an artifact.
- **Hermetic guard.** `__tests__/ascii-pty-snapshot-samples.test.ts` runs in
  the normal suite with no PTY or Docker: it fails if a listed index stops
  matching its sample title (reordered `samples-data.ts`) or a golden is
  missing.

### What was verified

- **Goldens made on macOS arm64 match Linux x86_64 CI.** CI run on this PR:
  13 of 13 samples, 0.000000 differing-pixel fraction on every PNG, text
  identical.
- **Cost.** About 22 s locally for 13 samples; 36 s for the compare step in
  CI (69 s for the whole job including install).
- **A glyph regression is caught.** Temporarily changed the `Down` arrow in
  `draw-arrows.ts`: 7 of 13 samples reported a text diff, but the PNG check
  alone flagged only 1 of them at the 0.1% tolerance. The exact `.txt`
  compare does the work.
- **A color-only regression is caught, which Option A cannot see.** Option A
  renders with `colorMode: 'none'`. Temporarily swapping R and B in the
  truecolor escape in `ansi.ts` left the text unchanged and made the two XY
  chart samples report a PNG diff.
- **Sample list drift is caught.** Renaming a title in the list failed the
  Vitest guard.

All temporary breakage was reverted. Not verified: the failure path inside
CI itself (only the passing run was observed there).

### Findings that cut against the proposal

- **The Docker image does not remove rasterization artifacts.** The committed
  `12-linkstyle-color-coded-edges.png` shows a small protrusion on the `┬`
  junctions, which looks like the notch the capture script's comments say the
  Docker image avoids. Goldens would enshrine it. This supports #1186's
  "mostly re-tests agg" point. Not investigated further.
- **Color coverage depends on sample choice.** The same color swap was
  invisible in sample 12 ("Color-Coded Edges"): its rendered colors are near
  neutral greys, and a swap shifts them by less than the 8-per-channel pixel
  delta. Saturated samples (the XY charts) carry the color signal.
- **The pixel tolerance is not the safety net.** With 0.1% allowed, a
  one-glyph change usually passes the PNG check. In a pinned image the
  tolerance could go to zero; that is untested across future agg bumps.
- **Ubuntu's apt `asciinema` (2.4.0) is rejected** by the capture script
  (no size flags). CI installs the 3.2.1 release binary pinned by sha256.

### Recurring cost

Every legitimate ASCII output change that touches a listed sample needs
`scripts/ascii-pty-snapshot.sh --update` and a review of the changed goldens
(text diffs are readable; PNGs need an eyeball). Expect this on most renderer
PRs, since the samples cover the common glyph families. The advisory workflow
keeps it off the merge path; it does not remove it.

## Decision needed

1. **Adopt the advisory version** (merge this PR). Revisit in about a month:
   promote to required only if it caught something real without false
   alarms; delete it if it only produced golden churn.
2. **Keep "not now"**: close this PR and #1151 as not planned, merge #1186
   alone. The prototype stays in this PR's history if the trigger fires.

## Consequences

If adopted: `ascii-terminal-capture.sh` and the `verify-ascii-terminal` skill
remain the manual before/after check for PR screenshots, and CI gains an
advisory real-terminal signal for the renderer paths. The `.txt` compare
overlaps Option A on character grids, so the unique value is the PTY path
(real TTY color-mode detection, wide-glyph handling) and PNG color and glyph
rendering. If not adopted, CI enforcement stays at Option A.
