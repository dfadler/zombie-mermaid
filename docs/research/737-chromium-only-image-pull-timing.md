# Spike: real GHCR pull time for a chromium-only Playwright image

Answers [#737](https://github.com/dfadler/zombie-mermaid/issues/737), a
speculative, explicitly low-priority follow-up to
[#729](https://github.com/dfadler/zombie-mermaid/issues/729)/[#733](https://github.com/dfadler/zombie-mermaid/pull/733)'s
investigation into `visual-regression`'s container-init overhead. Part of the
Docker tracking cluster, [#544](https://github.com/dfadler/zombie-mermaid/issues/544).

## Summary

The pinned `mcr.microsoft.com/playwright:v1.62.1-jammy` image ships Chromium,
Firefox, and WebKit together (~897MB compressed), but `playwright.config.ts`
only runs the `chromium` project. This spike built a chromium-only image
(`docker/visual-regression-chromium.Dockerfile`, installing only
`npx playwright install --with-deps chromium`), pushed it to GHCR, and
measured its real "Initialize containers" (pull) time in a throwaway CI job
(`.github/workflows/visual-regression-chromium-image.yml`), the same way
[`docs/research/ci-container-job-vs-actions-cache-timing.md`](ci-container-job-vs-actions-cache-timing.md)
measured the current multi-browser image's pull time.

| Image                                         | Init step (pull) time |
| --------------------------------------------- | --------------------- |
| Current, multi-browser (10 runs, prior spike) | ~29.5s avg (25–42s)   |
| Chromium-only (2 runs × 4 shards = 8 samples) | ~18.75s avg (15–24s)  |

Raw per-shard samples (`gh run view --json jobs`, "Initialize containers" step
duration):

- Run 1 ([34413251110](https://github.com/dfadler/zombie-mermaid/actions/runs/34413251110)): 24s, 19s, 20s, 23s
- Run 2 ([34413642128](https://github.com/dfadler/zombie-mermaid/actions/runs/34413642128)): 17s, 15s, 17s, 15s

**The chromium-only image pulls measurably faster**: roughly -10.75s per shard
(~36% reduction) vs. the multi-browser baseline. Across the 4-shard
`visual-regression` matrix, that's ~43s of billed Actions-minutes saved per
CI run if adopted.

## Recommendation

This is a real, meaningful reduction — bigger than the "roughly a wash"
verdict #729/#733 reached for other container-overhead levers, because this
one actually removes payload (two unused browsers) rather than trying to
route around fixed container-init cost. That said, this issue's own scope is
**"build the image and measure it," not "adopt it"** — switching the real
`visual-regression` job to a new pinned image is a CI/CD change with its own
review bar (matching Playwright/browser versions exactly, keeping the image
patched, updating `docker/visual-regression.Dockerfile`'s maintenance
story) that deserves its own PR and its own decision, not a fait accompli
bundled into a measurement spike.

**If a maintainer wants to pursue this**: file a follow-up issue to swap
`ci.yml`'s `visual-regression` job over to
`docker/visual-regression-chromium.Dockerfile` (published under the
`ghcr.io/dfadler/zombie-mermaid/visual-regression-chromium` tag this spike
used), given the ~36%/~43s-per-run win measured above. This spike's own
artifacts (`docker/visual-regression-chromium.Dockerfile`, the
manual-dispatch-only measurement workflow) are left in place as-is,
unreferenced by real CI, for that follow-up to build on.

## Methodology

1. Built `docker/visual-regression-chromium.Dockerfile`, extending the same
   `mcr.microsoft.com/playwright:v1.62.1-jammy` base but installing only
   `chromium` via `npx playwright install --with-deps chromium` in place of
   the full three-browser install the base image ships with.
2. Added `.github/workflows/visual-regression-chromium-image.yml`,
   `workflow_dispatch`-only (never runs as part of real PR/push CI): builds
   the image, pushes it to GHCR under a distinct tag, then runs a 4-shard
   throwaway job using it as its `container:`, mirroring the real
   `visual-regression` job's shard count.
3. Ran it twice (`gh workflow run` / re-run), then read each shard's
   "Initialize containers" step duration straight from
   `gh run view <id> --json jobs` — the exact technique
   `ci-container-job-vs-actions-cache-timing.md` used for the existing
   baseline number.
4. Compared against that existing doc's already-measured post-migration
   baseline (10 runs, ~29.5s avg) rather than re-measuring the current image —
   it's the same image, same job shape, measured the same way, recently.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
