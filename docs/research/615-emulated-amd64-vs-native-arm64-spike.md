# Research summary: emulated amd64-in-Docker vs. native arm64, visual-regression parity with x86 CI

Status: **spike, answered — with one substituted variable and one gap still open.** Written
for [#615](https://github.com/dfadler/zombie-mermaid/issues/615), part of the
[#544](https://github.com/dfadler/zombie-mermaid/issues/544) Docker tracking cluster, feeding
the go/no-go decision in [#548](https://github.com/dfadler/zombie-mermaid/issues/548).
Follows up on [#545](https://github.com/dfadler/zombie-mermaid/issues/545), whose native-arm64
run this re-measures as a same-session control.

The full experiment write-up — verification table, method, the Rosetta/QEMU substitution
detail, the complete ASCII/SVG results breakdown, and caveats — lives on the issue instead of
in this repo, since it's a point-in-time research artifact rather than something future
readers need committed alongside the code:
[#615's research comment](https://github.com/dfadler/zombie-mermaid/issues/615#issuecomment-5590646193).
This page is a condensed summary of the same findings.

## What was measured

Re-ran #545's full SVG + ASCII visual-regression suite (three runs each) inside
`mcr.microsoft.com/playwright:v1.62.1-jammy`, once emulated as `linux/amd64` and once native
`linux/arm64`, on the same repo snapshot (`git archive 9a04a152`) #545 used, diffed against
the committed x86-CI baselines. The emulation backend turned out to be Rosetta 2, not QEMU
(Docker Desktop's `useVirtualizationFrameworkRosetta` setting) — same x86-64 ISA, so the
rendering comparison still holds, but the cost numbers below are Rosetta's, not QEMU's.

| Suite (full run)               | emulated amd64 fail | native arm64 fail |
| ------------------------------- | -------------------- | ------------------ |
| ASCII/terminal (90 tests)        | 88/90 (97.8%)        | 88/90 (97.8%)       |
| SVG (190 tests × 3 runs = 570)   | **0**/570            | 30/570 (5.3%)       |
| Full-suite wall clock           | 24.4m                | 2.2m                |

## Findings

- **ASCII: architecture is irrelevant.** Identical fail rate on both platforms, and diffing
  the two platforms' own failing screenshots against each other shows a max per-pixel channel
  delta of 1/255 — zero difference under the suite's `threshold: 0.4`.
  [#614](https://github.com/dfadler/zombie-mermaid/issues/614)'s font substitution is the
  entire gap; architecture contributes nothing.
- **SVG: architecture matters, and the answer flips.** Emulated amd64 matched the committed
  x86-CI baselines exactly (0/570) across three runs; native arm64 produced 30/570 failures,
  intermittent across 27 distinct samples with no sample failing in all three runs.
- **Cost is real**: ~3.5x on scalar CPU, ~11x on the actual test workload, plus two
  emulation-only timeout failures (the suite's 30s/15s limits are sized for native speed).
- **Still not tested**: real bare-metal x86 (`ubuntu-latest`) and literal QEMU TCG — Rosetta
  was what this host's Docker actually runs, and #545's missing CI data point is still
  missing.

## What this means for #548

- **SVG**: emulated-amd64 is now a same-architecture, 570/570 match to CI baselines — the
  strongest available proxy short of a real x86 runner. Narrows #545's missing
  x86-container-vs-real-CI data point; doesn't close it.
- **ASCII**: removes architecture as a competing explanation, leaving #614's font fix as the
  only remaining variable on that half.
- **New wrinkle for #550** (local-Docker-wrapper plan): a developer on native arm64 sharing an
  x86-generated SVG baseline set would hit ~5% intermittent failures; emulated amd64 avoids
  that but costs ~11x wall clock. If SVG baselines are unified, the local wrapper likely has
  to mandate `--platform linux/amd64`.

None of this changes the current "no adopt — yet" call; it sharpens what #614 and the
`workflow_dispatch` CI trial still need to show.
