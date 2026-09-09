# Shared Playwright Docker image for visual regression: no adopt yet

> **Superseded in part.** The "no adopt — yet" call below was the 2026-09-06
> decision and is kept as written. Both gaps it named have since been measured;
> see [Amendment (2026-09-07)](#amendment-2026-09-07) for the current position
> and for what #549/#550/#551 should do.

## Context

[#544](https://github.com/dfadler/zombie-mermaid/issues/544) asked whether running
CI and local dev inside the _identical_ pinned `mcr.microsoft.com/playwright:*`
image could collapse this repo's `-chromium-linux.png` / `-chromium-darwin.png`
baseline split (`__tests__/visual/*.visual.test.ts`). Three spikes were run to
replace inference with real measurement, feeding this decision
([#548](https://github.com/dfadler/zombie-mermaid/issues/548)):

- [#545](https://github.com/dfadler/zombie-mermaid/issues/545) — real cross-arch
  screenshot diff (`docs/research/545-crossarch-docker-screenshot-spike.md`, on
  `issue-545-crossarch-screenshot-spike`)
- [#546](https://github.com/dfadler/zombie-mermaid/issues/546) — native Linux
  ARM64 Chromium availability (`docs/research/546-arm64-chromium-spike.md`, on
  `issue-546-arm64-chromium-spike`)
- [#547](https://github.com/dfadler/zombie-mermaid/issues/547) — real CI timing
  cost, container job vs. current `actions/cache` approach
  (`docs/research/ci-container-job-vs-actions-cache-timing.md`, on
  `issue-547-ci-timing-spike`)

### What the spikes actually found

**#546 — architecture is not a blocker.** Playwright ships a genuine native
(non-emulated) Linux ARM64 Chromium build, confirmed by ELF-header inspection
(`e_machine` = `EM_AARCH64`) and Playwright's own 1.57.0 release notes ("On Arm64
Linux, Playwright continues to use Chromium"). A real sample rendered inside the
arm64 container passed its diff against the existing amd64-CI-generated Linux
baseline outright. Mac-side native rendering inside the shared image is
architecturally viable.

**#545 — the SVG and ASCII halves of the suite tell opposite stories, and the
literal question wasn't answerable.** Running the full SVG + ASCII suites (280
tests) inside the arm64 container against the already-committed, CI-produced
Linux baselines:

| Suite                     | Fail rate     | Shape                                                                                                                                                                                                                                                                      |
| ------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SVG (190 tests)           | 1.6% (3/190)  | Same dimensions both sides, 0.01 diff ratio (threshold 0.002) — plausibly ordinary rasterization jitter (2 of 3 are curved-path samples); no retries were used (`retries: 0`, no `CI` env set), so a retry-aware re-run might clear some or all of these.                  |
| ASCII/terminal (90 tests) | 97.8% (88/90) | Same height, width inflated 10–45% — root-caused directly (`fc-match monospace` inside the container resolves to `WenQuanYi Zen Hei Mono`, a CJK font, because the image ships none of `.ascii-panel`'s requested `JetBrains Mono` / `Fira Code` / `Cascadia Code` faces). |

Critically, **the real x86-container-vs-real-x86-CI-bare-metal data point — the
literal thing #545 was asked to measure — could not be obtained.** The spike's
attempt to push a throwaway `workflow_dispatch` trial was blocked by this
environment's own permission classifier, and no real x86 machine with Docker was
available either. What was measured instead is a _weaker_ claim: arm64-container
vs. the Linux baseline _that CI's bare amd64 runner already produced_ — not
container-vs-container across architectures, and not container-vs-CI on matching
hardware. The spike is explicit that this leaves open whether the ASCII failure is
"the container's font set, regardless of arch" (the more likely reading, since the
same 50-font image ships identically to both `amd64` and `arm64` pulls of the tag,
and #326's independent amd64/`-noble` finding already showed a similar, if
smaller, mismatch) or something arch-specific that a same-arch container-vs-CI
comparison would not reproduce. That distinction was never closed.

**#547 — no timing case for adoption either way.** Current CI overhead (real,
measured from 8 recent runs): ~14.7s per-shard install on cache hit, ~23.5s on
miss. Estimated container-job overhead (not measured — scaled from a third-party
benchmark on a smaller, different-registry image, since no real CI trial ran):
~22s. These ranges overlap; the spike's own conclusion is that #544's actual
motivation (cross-platform consistency) has to carry this decision, because speed
does not.

## Decision

**No adopt — yet.** Neither "full adopt" nor "partial adopt" is supported by what
was actually measured, and the reason is specific and closeable, not a shrug:

- **Full adopt is not supported.** It would require believing the container
  collapses the linux/darwin split for _both_ sample families. ASCII/terminal
  samples fail at 97.8% inside the container as shipped — adopting today would
  trade a font-substitution mismatch this repo already understands and has tooled
  around (`playwright-linux`/`-darwin` baselines) for a much larger, undiagnosed
  one, with no evidence the font fix would even work before committing to it.
- **Partial adopt (CI-only, migrate #549/#551 now) is not supported either**,
  even restricted to SVG. Moving CI's baseline generation into the container
  without the real x86-container-vs-real-x86-CI data point means accepting on
  faith that the container's `linux/amd64` build matches what `ubuntu-latest`
  bare-metal produces today closely enough not to force a ~280-file baseline
  regeneration for uncertain gain. The arm64 evidence (98.4% match against
  _already-produced_ CI output) is suggestive, not proof for the amd64 side that
  actually matters for CI. #547 also removes the fallback argument ("even if
  baselines need to move, at least CI gets faster") — the timing is a wash.
- **This is not the same as "no adopt" (option 3) as originally framed**, because
  that option in #544 presumed the spikes would settle the question one way or
  the other. They didn't fully settle it — they identified exactly what's
  missing and showed it's answerable with bounded, concrete follow-up work, not
  more research or reading. Recording "no, permanently" here would discard a
  live, cheap-to-close lead (the SVG side came close) in favor of false
  certainty.

**Two concrete gaps block a real decision, and both are worth closing before
re-deciding:**

1. **The missing x86-container-vs-real-x86-CI data point**, for the SVG suite
   specifically. #545 already wrote the throwaway `workflow_dispatch` workflow
   this needs (reproduced in full in its research doc) — it only needs a human
   with push/dispatch rights to run it once cold and once warm, since #547
   already needs a near-identical container job for its own (still-undone) real
   timing trial and the two can share one CI run. This is a bounded, single-PR
   task, not open-ended research.
2. **A font-corrected image layer for the ASCII/terminal case**, tested the same
   way #545 already tested the stock image: install `fonts-jetbrains-mono` (or
   pin whatever exact font stack `.ascii-panel` requests) in a custom layer on
   top of the pinned base tag, re-run `ascii-samples.visual.test.ts` inside it,
   and see whether the fail rate collapses. This is the same shape of fix
   [#552](https://github.com/dfadler/zombie-mermaid/issues/552) already applied
   to the `agg`/asciinema toolchain (bake the right font into a custom layer
   rather than trust the base image's `fc-match` resolution) — worth doing
   _before_ concluding ASCII samples can't be unified, not instead of deciding.

If (1) confirms amd64-container SVG output tracks real CI bare-metal within the
suite's existing tolerance, and (2) shows the font fix collapses the ASCII fail
rate to something in the suite's normal jitter range, the likely landing point
is **partial adopt for SVG samples only** (CI + local dev share the container
for SVG; ASCII/terminal keeps its own resolution path, unified or not depending
on how far (2) actually gets) — not full adopt, since even a successful font fix
is a new, less-battle-tested resolution path than the SVG suite's, and nothing
in this evidence argues for touching ASCII before it's proven out on its own.
If either follow-up instead confirms the mismatch is structural (not the
specific font-fallback and missing-data-point gaps identified here), "no adopt"
becomes the settled answer, not just the current default.

## Consequences

- **[#549](https://github.com/dfadler/zombie-mermaid/issues/549) (migrate CI to
  a container image), [#550](https://github.com/dfadler/zombie-mermaid/issues/550)
  (local Docker wrapper), and [#551](https://github.com/dfadler/zombie-mermaid/issues/551)
  (baseline consolidation) stay **not started** — #544 already gates them on this
  decision landing on "adopt" or "partial adopt," and it hasn't. Re-open this
  decision once the two gaps above are closed; don't start them on the strength
  of the arm64-only SVG result alone.
- **[#552](https://github.com/dfadler/zombie-mermaid/issues/552) (containerize
  `agg`/asciinema) is unaffected** — #544 tracked it as independent of this
  decision from the start, and nothing in these spikes changes that; it doesn't
  touch Chromium/GPU rendering and was already being fixed with the same
  font-layer technique this decision recommends testing for the Playwright image.
- **The current two-baseline-set approach (`-chromium-linux.png` /
  `-chromium-darwin.png`) continues unchanged** — no baseline regeneration, no
  `playwright.config.ts` or CI workflow changes as a result of this decision.
- **The next actionable step is not "more research"** — it's the two bounded
  experiments above, both of which need a human's go-ahead (CI dispatch
  authorization; reviewing/merging a custom-image-layer trial), which is why
  they weren't done inside this decision-only issue rather than being deferred
  for lack of feasibility.
- **This decision should be revisited, not treated as final**, once either gap
  closes. It is deliberately not filed as "no adopt" (#544's option 3) as
  originally scoped, because that option assumed the spikes would give a
  conclusive answer; recording the gap explicitly here is what lets a future
  pass close it in one step instead of re-deriving it from the three spike docs
  again.

## Amendment (2026-09-07)

**Gap 2 closed, gap 1 narrowed, and the two halves of the suite swap places.**
Two follow-up spikes — [#614](https://github.com/dfadler/zombie-mermaid/issues/614)
(font layer, gap 2) and [#615](https://github.com/dfadler/zombie-mermaid/issues/615)
(x86-vs-CI for SVG, gap 1) — move this decision off "no adopt — yet," and invert
its original expectation: **ASCII is now the proven half** (a one-package font
fix collapses its fail rate to 0/90, architecture ruled out as a factor), while
**SVG is the half still resting on a proxy** (0/570 mismatches under an
amd64-on-Rosetta proxy for real x86 CI, but real bare-metal x86 remains
untested, and native arm64 rendering turns out to be intermittently unstable
against the shared baselines).

**Updated decision: partial adopt, CI-side, sequenced.** Moving off "no adopt —
yet", but not to unconditional adoption:

- Adopt the font-corrected image (`docker/visual-regression.Dockerfile`'s
  resolution) as the container of record for any work under #544 — the stock
  tag is now a known-bad configuration for this repo.
- The remaining SVG uncertainty is closeable only in CI. [#549](https://github.com/dfadler/zombie-mermaid/issues/549)
  proceeds as that experiment, scoped with a declared abort condition: the full
  suite must pass inside the container job against **unchanged** baselines, or
  revert and re-decide here.
- No baseline regeneration is authorized by this amendment — the committed
  baseline sets are the measuring instrument, and regenerating them to force a
  green run destroys the data point.
- [#550](https://github.com/dfadler/zombie-mermaid/issues/550) can proceed for
  ASCII now (CI-identical at native arch); SVG stays blocked on #549.
  [#551](https://github.com/dfadler/zombie-mermaid/issues/551) stays blocked
  and needs re-scoping — its two proposed branches are both falsified by #615's
  results.

The full measurements, the per-issue guidance for #549/#550/#551, and the
remaining open questions (real bare-metal x86, a flag-matched comparison, QEMU
vs. Rosetta, native Linux arm64) are recorded in
[a comment on this issue](https://github.com/dfadler/zombie-mermaid/issues/548#issuecomment-5591525595)
rather than duplicated here.

## Amendment (2026-09-09): #545 closed, architecture ruled out, #551 still not warranted

[#549](https://github.com/dfadler/zombie-mermaid/issues/549) has since merged — CI's
`visual-regression` job now runs inside the font-corrected container on real
`ubuntu-latest`, and has been green on the overwhelming majority of runs since. That
closed this amendment's gap 1 for the general case, but left #545's own literal
question (and #615's two remaining "not tested" items — a flag-matched arm64 run, and
a real-CI-on-the-same-commit comparison) still open. Both are now closed; see
[docs/research/545-crossarch-ci-flag-matched-confirmation.md](../research/545-crossarch-ci-flag-matched-confirmation.md)
for the full measurement. Summary:

- **Three full-suite runs (843 executions) on native arm64, with `CI=true`
  (`retries: 2`, matching real CI's actual configuration) — the flag-matched run
  #615 never did — passed 843/843 in the final tally.** Two SVG executions were
  flaky on first attempt (both cleared by one retry; same ratio-0.01,
  same-dimensions jitter signature this cluster has documented throughout); zero
  ASCII failures. Baseline `sha256` was verified unchanged before and after.
- **A real, same-commit comparison was available**: this spike's arm64 runs used
  commit `73d5940`, which real x86 CI evaluated in
  [run 34377940579](https://github.com/dfadler/zombie-mermaid/actions/runs/34377940579)
  at essentially the same time. That CI run's shard 2/4 showed _more_ jitter than
  any of the three quiet-host arm64 runs (17/70 flaky, 1/70 hard failure, vs. at
  most 1/281 flaky and 0 hard failures per arm64 run) — the opposite of what an
  arm64-specific instability theory would predict. The likely explanation is
  shared-runner CPU contention on the amd64 side, a noise source
  `playwright.config.ts`'s own comments already document, not architecture.
- **This inverts #615's more pessimistic reading** (30/570 SVG failures, 5.3%,
  attributed to native-arm64 instability). The discrepancy is explained by flag
  matching: #615's runs did not set `CI=true`, so none of its intermittent
  failures had a chance to clear on retry the way real CI — and this spike's own
  runs — allow for. Under the configuration that actually matters (CI's own), the
  arm64/amd64 divergence within Linux/Docker rendering is not meaningfully
  different from CI's own run-to-run variance.

**#545 is answered**: identical-image cross-architecture rendering does not produce
a meaningful divergence once (a) the #614 font layer is applied and (b) CI's actual
retry policy is in effect. Architecture is ruled out as a driver for both halves of
the suite.

**#551 is still not warranted**, but for a different, more precise reason than
before. This cluster's spikes — #545, #549, #615, and this amendment — only ever
measured divergence _within_ Linux/Docker rendering (arm64 container vs. amd64
container/CI). None of them measured whether native macOS Playwright — the actual
generator of the committed `-chromium-darwin.png` baselines — matches the Linux
container's output. That comparison is the original reason the OS-based split
exists (font rasterization differing between bare macOS and bare Linux, per #544's
opening background), and it remains completely untested. #551's two proposed
branches (full consolidation, or renaming the split from OS-based to arch-based)
both presuppose local dev and CI render inside the same environment — true today
only for ASCII (via #550's Docker wrapper), not for SVG, where local dev still runs
native macOS Playwright against `-darwin` baselines untouched by any of this. The
concrete prerequisite for #551 is extending #550's wrapper to SVG; that is new
scope, not something this amendment's evidence authorizes on its own.
