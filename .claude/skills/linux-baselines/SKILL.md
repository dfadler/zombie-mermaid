---
name: linux-baselines
description: |
  Update or check the `-chromium-linux.png` visual-regression baselines CI
  gates on. Use when `visual-regression` fails in CI, after an intentional
  rendering change that moves screenshots, or when deciding whether a Linux
  baseline is stale. Wraps CONTRIBUTING.md "Visual regression tests" and
  docs/visual-regression.md; not for the PR screenshot of an ASCII change
  (that is the verify-ascii-terminal skill).
---

# Linux visual baselines

A macOS `pnpm run test:visual` only compares against `-chromium-darwin.png`.
CI gates on `-chromium-linux.png`, so those need a separate path.

## Decision table

| Situation | Do this |
| --- | --- |
| CI `visual-regression` failed after an intentional change | Download the failing run's `visual-regression-failures-<shard>` artifacts (4 shards; the failure can be in any) and commit the new `-chromium-linux.png` files. Review each image. |
| Want to know before pushing whether Linux baselines moved | `scripts/docker-test-visual.sh [--suite ascii\|svg]` (needs Docker). It checks; it refuses to rewrite Linux baselines. |
| Container result for an SVG baseline is surprising | Trust a real CI run over the container (docs/visual-regression.md, #551). |
| Need the darwin baselines | `pnpm run test:visual:update` (rewrites only your platform). |

Never use a stock `mcr.microsoft.com/playwright:*` image: it lacks DejaVu and
mis-sizes ASCII panels (#326, #614). Use the wrapper.

## Rule: SVG and ASCII both

Every snapshot/golden case needs both an SVG and an ASCII snapshot, edge cases
included. When adding or changing a sample, confirm both
`svg-samples` and `ascii-samples` baselines exist for the Linux and darwin
suffixes before committing.

## Before committing

- `git status` should show only intended `__tests__/visual/__screenshots__/` changes.
- Open the PNGs you are committing; a baseline is a claim that this is correct.
