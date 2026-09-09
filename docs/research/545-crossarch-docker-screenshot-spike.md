# Research summary: identical Playwright Docker image, real Apple Silicon vs. real x86 CI screenshots

> **Closed.** The two gaps this doc left open (a flag-matched arm64 run, and a real
> x86-CI-on-the-same-commit data point) are closed in
> [545-crossarch-ci-flag-matched-confirmation.md](545-crossarch-ci-flag-matched-confirmation.md) —
> read that doc for the final answer. This page is kept as-is as the original,
> stock-image measurement that motivated [#614](https://github.com/dfadler/zombie-mermaid/issues/614)'s
> font fix.

Status: **partially answered — the arm64 side is measured with real data; the amd64/x86 CI
side still needs either a human-approved CI trial or a real x86 machine.** Written for
[#545](https://github.com/dfadler/zombie-mermaid/issues/545), part of the
[#544](https://github.com/dfadler/zombie-mermaid/issues/544) Docker tracking cluster, feeding
the go/no-go decision in [#548](https://github.com/dfadler/zombie-mermaid/issues/548).

The full experiment write-up — methodology, verification table, the throwaway CI workflow
that couldn't be pushed, and the complete results breakdown — lives on the issue instead of
in this repo, since it's a point-in-time research artifact rather than something future
readers need committed alongside the code:
[#545's research comment](https://github.com/dfadler/zombie-mermaid/issues/545#issuecomment-5571597826).
This page is a condensed summary of the same findings.

## What was measured

Ran this repo's full SVG + ASCII visual-regression suites (280 tests,
`svg-samples.visual.test.ts` + `ascii-samples.visual.test.ts`) inside
`mcr.microsoft.com/playwright:v1.62.1-jammy`, pulled and run **natively as arm64** on a real
Apple Silicon Mac (confirmed live via `docker manifest inspect` and in-container `uname -m`),
diffed against the already-committed `-chromium-linux.png` baselines (real, previously
CI-generated amd64 output).

| Suite                                             | Total   | Passed  | Failed | Fail rate |
| ------------------------------------------------- | ------- | ------- | ------ | --------- |
| ASCII/terminal (`ascii-samples.visual.test.ts`)   | 90      | 2       | 88     | **97.8%** |
| SVG (`svg-samples.visual.test.ts`, incl. xychart) | 190     | 187     | 3      | **1.6%**  |
| **Total**                                         | **280** | **189** | **91** | 32.5%     |

## Findings

- **ASCII/terminal fails almost entirely on a font-substitution bug, not architecture.**
  Every failure has the same shape (identical height, 10–45% wider width). Root cause
  reproduced directly inside the container: `fc-match monospace` resolves to `WenQuanYi Zen
Hei Mono` (a CJK font) because the stock image ships none of `.ascii-panel`'s requested
  `'JetBrains Mono', 'Fira Code', 'Cascadia Code'` faces. This tracks (and appears larger
  than) the same class of mismatch #326 already documented on the older `-noble` tag.
- **SVG comes close to matching real CI already.** The 3 failures share identical dimensions
  and a 0.01 diff ratio (threshold 0.002) — plausibly ordinary rasterization jitter (this run
  used `retries: 0`; real CI retries twice) rather than a structural mismatch.
- **The literal question #545 asked — identical container on real Apple Silicon vs. real x86
  CI — is still not fully answered.** What was measured instead is arm64-container vs. real
  CI's already-produced bare-metal output, a related but weaker comparison. Getting the true
  data point needs a human to run the throwaway CI workflow captured in the issue comment (a
  push attempt was blocked by this environment's own permission classifier), or a real x86
  machine with Docker.

## What this means for #544/#548

- **ASCII/terminal**: a shared container does not look like it would collapse the
  `-darwin`/`-linux` baseline split as-is — the container disagrees with real CI's output
  more than local macOS Playwright already does. Fixing the container's font install is a
  prerequisite before this changes, tracked separately in
  [#614](https://github.com/dfadler/zombie-mermaid/issues/614).
- **SVG**: the more promising half — close enough to plausibly unify, pending the missing
  x86-CI data point.
- The QEMU-emulated-amd64 angle (untested here) is tracked separately in
  [#615](https://github.com/dfadler/zombie-mermaid/issues/615).

See [docs/decisions/playwright-docker-image-visual-regression.md](../decisions/playwright-docker-image-visual-regression.md)
for how this fed the actual go/no-go decision.
