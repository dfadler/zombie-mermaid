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

Two follow-up spikes ran against the two gaps named above, and between them they
move this decision off "no adopt — yet." Full measurements live in their own
research docs, linked below — this amendment summarizes only what they found and
what it means for the decision.

- [#614](https://github.com/dfadler/zombie-mermaid/issues/614) —
  `docs/research/614-docker-font-parity.md`, on `issue-614-docker-font-fix`.
  Targets gap (2).
- [#615](https://github.com/dfadler/zombie-mermaid/issues/615) —
  `docs/research/615-emulated-amd64-vs-native-arm64-spike.md`, on
  `issue-615-qemu-arm64-spike`. Targets gap (1).

### Gap (2) — the font layer: closed

`fonts-dejavu-core` (not the originally-guessed JetBrains-Mono-family stack,
which made the fail rate worse) takes `ascii-samples.visual.test.ts` from
88/90 failing to **0/90** against the unchanged, committed Linux baselines. The
ASCII panel's `<code>` element resolves fonts through fontconfig's generic
`monospace` alias regardless of what its own CSS requests, so the fix points
that alias at the font CI already uses rather than installing the requested
faces. Four independent checks — direct mechanism measurement, 3× reproduction,
a least-squares fit against real CI baselines that lands on the installed font,
and an arm64-vs-amd64 diff ruling out architecture as a factor — back this; see
`docs/research/614-docker-font-parity.md` for the full measurement.
`docker/visual-regression.Dockerfile` now asserts the resolution at build time
so a future base-tag bump can't silently regress it.

### Gap (1) — x86-vs-CI for SVG: narrowed, not closed

#615 ran the suite under `--platform linux/amd64` on Apple Silicon (a
same-architecture Rosetta proxy for real x86 CI, not QEMU) against the same
committed Linux baselines #545 used, with a same-session native-arm64 control:

| Platform       | SVG pixel mismatches (of 570)                           |
| -------------- | -------------------------------------------------------- |
| emulated amd64 | **0**                                                    |
| native arm64   | 30 (5.3%, intermittent — empty run-to-run intersection)  |

Discriminating, but still a proxy for the container's *host*, not the literal
experiment: no run has been flag-matched to CI (`--disable-gpu`, `retries: 2`),
and real bare-metal x86 remains untested. See
`docs/research/615-emulated-amd64-vs-native-arm64-spike.md` for the full
measurement, including why native arm64 SVG rendering is newly unstable against
the shared baselines.

### The original expectation is inverted

This decision anticipated landing on "partial adopt for SVG samples only … ASCII/
terminal keeps its own resolution path." The evidence says the opposite. **ASCII
is now the proven half** — deterministic one-package fix, mechanism understood,
zero failures reproduced three times, architecture ruled out. **SVG is the half
still resting on a proxy**, and it has picked up a problem it didn't have before:
native arm64 rendering is genuinely unstable against x86 baselines.

### Updated decision: partial adopt, CI-side, sequenced — ASCII proven, SVG on trial

Moving off "no adopt — yet", but not to unconditional adoption:

- **Adopt the font-corrected image as the container of record.** Any container
  work under #544 uses `docker/visual-regression.Dockerfile`'s resolution (or its
  CI-step equivalent), never the stock tag. The stock tag is now a known-bad
  configuration for this repo, not a neutral default.
- **The remaining SVG uncertainty is closeable only in CI, and #549 is that
  experiment.** There is a circularity in leaving #549 gated on a data point that
  only #549 can produce. The resolution is to let it proceed _as an experiment
  with a declared abort condition_, which is materially different from adopting on
  faith — see the acceptance bar below.
- **No baseline regeneration is authorized by this amendment.** The committed
  `-chromium-linux.png` / `-chromium-darwin.png` sets are the measuring
  instrument for everything above; regenerating them to make a container run green
  destroys the data point permanently and converts the experiment back into an
  assumption.
- **#547's timing wash still stands**, and a new cost appears: the container is no
  longer a plain public tag but one needing a font layer, so #549 has to either
  publish an image or install the font as a job step. That was not in #547's
  estimate.

### What #549 / #550 / #551 should do now

**[#549](https://github.com/dfadler/zombie-mermaid/issues/549) (migrate CI to a
container image) — proceed, scoped as the gap-(1) experiment.**

- Acceptance bar: the full visual suite passes inside the container job against
  **unchanged** committed baselines. If it doesn't, revert and re-decide here —
  do not regenerate baselines to close the gap.
- Implementation note, not measured by either spike: GitHub Actions' `container:`
  key takes an image reference, not a Dockerfile, so #549 can't consume
  `docker/visual-regression.Dockerfile` directly at the job level. The cheaper
  path is `container: mcr.microsoft.com/playwright:v1.62.1-jammy` plus a first
  step installing `fonts-dejavu-core`, carrying the Dockerfile's `fc-match`
  assertion over as a post-install check (`fc-match monospace` must resolve to
  DejaVu Sans Mono, fail the job otherwise). Publishing to GHCR is the
  alternative and adds a registry and a second pin to keep in sync.
- Its run is also the first flag-matched comparison (`CI` set, so `--disable-gpu`
  and `retries: 2`), which no spike has done.

**[#550](https://github.com/dfadler/zombie-mermaid/issues/550) (local Docker
wrapper) — partially proceed: ASCII now, SVG blocked on #549.**

- The ASCII half is shippable today and needs nothing further: #614's 0/90 was
  measured on native arm64 against the committed Linux baselines, and #615
  showed architecture is irrelevant to ASCII, so a Mac contributor running the
  font-fixed container at native speed gets CI-identical ASCII output right now.
- The SVG half has a problem #548 didn't know about. A contributor on native
  arm64 hits ~5% intermittent SVG failures against shared x86 baselines, with
  different samples each run. `--platform linux/amd64` avoids it entirely but
  costs ~11× wall clock (24.4m vs 2.2m for the full suite) on a Rosetta-enabled
  host, and more on one without. The wrapper should not claim SVG parity until
  #549 settles what the shared target even is.
- CONTRIBUTING.md's #326 caveat can be narrowed for ASCII, but **not retired for
  SVG**.

**[#551](https://github.com/dfadler/zombie-mermaid/issues/551) (baseline
consolidation) — stays blocked, and needs re-scoping before it can be worked.**

- Both branches its task description offers are now falsified for SVG. Branch A
  ("no meaningful arch difference → consolidate") is contradicted by #615's
  0/570-vs-30/570. Branch B ("real arch difference → rename the split to
  `-amd64`/`-arm64`") assumes the per-arch output is stable enough to baseline,
  and #615 shows arm64's SVG output is intermittent, not systematically
  different — a nondeterministic renderer can't be given its own baseline set
  either.
- An ASCII-only slice is more promising. #614 observed the `-chromium-darwin.png`
  ASCII baselines have identical widths to the Linux set on every sample
  checked, and the container now reproduces the Linux set exactly. Identical
  widths is not identical bytes, so the cheap precondition is a direct `cmp`
  over the 90 pairs before anyone claims the ASCII baselines can collapse.

**[#552](https://github.com/dfadler/zombie-mermaid/issues/552) is still
unaffected**, and #614 retroactively confirms it was fixed with the right
technique.

### What is still not known

- **Real bare-metal x86, container vs. CI.** Only #549 closes this. Everything
  above is Rosetta-hosted.
- **A flag-matched comparison.** No run has used `--disable-gpu` with
  `retries: 2` against CI's own invocation.
- **QEMU rather than Rosetta.** Untested, and it matters for any contributor
  whose Docker Desktop doesn't have Rosetta enabled.
- **Native Linux arm64 contributors** (as opposed to macOS arm64) — never
  measured at all.
- **`sidebar-focus.visual.test.ts`.** Every spike measured 280 tests (190 SVG +
  90 ASCII); this one-test file, which has both `-linux` and `-darwin` baselines,
  was in none of them.
- **Whether the darwin and linux ASCII baselines are byte-identical**, per the
  #551 note above.

One incidental finding from #614 is tracked separately and does not bear on this
decision: because the `<code>` child resets to generic `monospace`, the live
demo's ASCII panel doesn't render in JetBrains Mono either, despite
`demo/styles.css` requesting it and `demo/site-shell.ts` loading the web font.
That is a real rendering bug in the demo, with the same root cause as the
container's font substitution.
