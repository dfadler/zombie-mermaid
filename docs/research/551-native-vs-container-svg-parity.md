# Research: closing #551 — does native macOS Playwright match the containerized SVG output?

Status: **spike, answered — closes #551. Decision: keep the `-linux`/`-darwin` baseline split as-is. No consolidation, no rename.**

## Question

[#545](https://github.com/dfadler/zombie-mermaid/issues/545) already ruled out
**architecture** (arm64 vs amd64) as a driver of visual-regression divergence
inside the container, on both halves of the suite. That left a different,
unmeasured question, explicit in #551's scope: does **native macOS**
Playwright — the actual generator of the committed `-chromium-darwin.png`
baselines — produce the same SVG output as the **containerized** Playwright
run, independent of architecture? I.e. does running inside Docker at all
change anything versus running natively on macOS, outside any container.

[#837](https://github.com/dfadler/zombie-mermaid/pull/842) extended the local
Docker wrapper (`scripts/docker-test-visual.sh`) to cover the SVG half, which
made this comparison practical to run for the first time.

## Method

All 190 samples in `__tests__/visual/svg-samples.visual.test.ts` (the
`samples-data.ts` gallery plus `xychart-samples-data.ts`), on one Apple
Silicon Mac:

1. **Native capture**: `pnpm exec playwright test
__tests__/visual/svg-samples.visual.test.ts --update-snapshots`, run
   directly on macOS (no container), with `playwright.config.ts`'s
   `snapshotDir` temporarily pointed at a scratch directory so the run wrote
   fresh actual PNGs without touching the committed baselines.
2. **Container capture, run 1**: the same test file run inside
   `docker/visual-regression.Dockerfile`'s image
   (`zombie-mermaid/playwright-visual:v1.62.1-jammy`, `--platform
linux/arm64`, `CI=true`, same font-layer assertions
   `scripts/docker-test-visual.sh` makes) — invoked directly rather than
   through the wrapper, since the wrapper deliberately rejects
   `--update-snapshots` (a safety rail for the _committed_ baselines, not
   applicable to a scratch directory that never touches them).
3. **Container capture, run 2**: an independent repeat of step 2, same image,
   same commit, to measure the container's own run-to-run jitter as a control.
4. Every pair of same-named PNGs was diffed with `pixelmatch` (`threshold:
0.4`, mirroring `playwright.config.ts`'s `toHaveScreenshot.threshold`) and
   scored against the suite's own `maxDiffPixelRatio: 0.002` — the exact bar
   the real suite uses to call a mismatch a real failure rather than noise.

**Dimension handling**: `pixelmatch` requires both images to share exact
dimensions, so it cannot run directly on a size-mismatched pair. For the
core native-vs-container comparisons in the results table below (A, A2, B),
every one of the 190 pairs had matching width and height at capture time —
0/190 dimension mismatches, no padding or resizing needed, `pixelmatch` ran
directly on all of them. The separate host-caveat comparison further down
(this measurement host's fresh native capture vs. the already-committed
`-chromium-darwin.png` baselines) did include dimension-mismatched pairs
(e.g. `general-2`); those were counted directly as over-threshold mismatches
without attempting `pixelmatch` on them, rather than padded or resized to a
common size — a size change is itself evidence of a real difference, not
something to paper over before comparing.

This is a controlled comparison, not just "native vs. one container run":
comparing native against _two independent_ container runs, and comparing the
container runs _against each other_, is what makes it possible to tell a real
native-vs-container effect apart from ordinary screenshot jitter (the kind
`playwright.config.ts`'s comment on `toHaveScreenshot` already documents, and
that CI's `retries: 2` already exists to absorb).

## Results

| Comparison                                                             | Samples over `maxDiffPixelRatio: 0.002` | Median ratio |
| ---------------------------------------------------------------------- | --------------------------------------- | ------------ |
| A: native vs. container run 1 (cross-platform)                         | 43/190 (22.6%)                          | 0.117%       |
| A2: native vs. container run 2 (cross-platform)                        | 30/190 (15.8%)                          | 0.102%       |
| B: container run 1 vs. container run 2 (same-platform jitter, control) | 26/190 (13.7%)                          | **0.000%**   |

The control (B) matters: two container runs of the identical image against
the identical commit are pixel-identical for the _median_ sample (p50 =
0.000%), confirming the container's rendering is highly deterministic for
most samples. That means the cross-platform numbers (A, A2) are not merely
"noisy screenshots" at the same rate as same-platform noise — they represent
a real gap on top of a near-zero noise floor for most samples.

Isolating the signal further: for each sample, compare its cross-platform
diff (native vs. container run 1) against its own same-platform jitter
(container run 1 vs. run 2):

- **78/190 samples (41%)** show the cross-platform diff clearly exceeding the
  container's own run-to-run jitter (by >0.1 percentage points) — this is a
  _relative_ signal (cross-platform diff vs. that sample's own jitter), not
  the same thing as exceeding the suite's absolute `maxDiffPixelRatio: 0.002`
  gate; see the results table above for the absolute-threshold counts
  (43/190 and 30/190).
- **9/190 samples (4.7%)** show the reverse (jitter exceeds the cross-platform
  diff) — these are the suite's ordinary flaky-sample tail, not evidence
  against the finding.
- A meaningful cluster of samples (e.g. `xychart-90`,
  `xychart-74`,`xychart-65`, `general-51`, `general-86`, `xychart-86`,
  `xychart-61`, `general-53`) show **exactly 0.000% jitter between the two
  container runs** (byte-identical renders) while still differing from native
  macOS by a real, nonzero, reproducible amount — the cleanest possible
  signal that this is a genuine native-vs-container effect, not flakiness.

One sample initially looked like a strong example
(`xychart-57-titles-formatting-long-title`, 0.760% cross-platform) but turned
out to also have high _same-platform_ jitter (0.832% between the two
container runs) — a reminder that any single sample can be misleading and the
run-to-run control is what actually separates signal from noise here. It is
excluded from the examples below for that reason.

### Root cause

Visual inspection of a clean example
(`general-51-class-class-interface-annotation`, 0.273% cross-platform diff,
0.000% same-platform jitter) shows the difference concentrated in text
rendering — different glyph shapes and metrics for the same characters, not a
structural/layout regression. This matches the renderer's own font stack
(`packages/core/src/theme.ts`'s `buildStyleBlock`):

- Body text: `font-family: 'Inter', system-ui, sans-serif`
- Class-diagram code text: `font-family: 'JetBrains Mono', 'SF Mono', 'Fira
Code', ui-monospace, monospace`

Neither `Inter` nor (in the container) `JetBrains Mono` is installed in every
environment, so each platform's browser resolves the generic fallback
(`system-ui` / `sans-serif` / `monospace`) to a **different actual
typeface**: macOS resolves to San Francisco (and to `JetBrains Mono` itself,
if locally installed), while the Linux container — per
`docker/visual-regression.Dockerfile`'s font layer, which
`scripts/docker-test-visual.sh` asserts at container-script runtime — resolves
`sans-serif`/`monospace` to DejaVu Sans / DejaVu Sans Mono. Different
typefaces have different glyph metrics, which is exactly what produces the
observed differences: mostly small pixel-level shifts, occasionally a
measurable width/height change in text-wrapped or auto-sized boxes.

This is the same font-rendering rationale #544 originally cited for having
the `-linux`/`-darwin` split at all (bare macOS vs. bare Linux font
rasterization differing) — now directly confirmed for the container case too.

### A caveat about this measurement host

This measurement machine's own **native** capture also diverges non-trivially
from the _already-committed_ `-chromium-darwin.png` baselines: 72/190 samples
(37.9%) exceed the same 0.002 threshold, including outright dimension changes
(e.g. `general-2`: captured 794×204 vs. committed 767×197). Font inspection
found this Mac has both a variable JetBrains Mono font file
(`JetBrainsMono[wght].ttf`) and separate static weight instances
(`JetBrainsMono-Regular.ttf`, etc.) installed under the same family name —
precisely the font-duplication artifact CONTRIBUTING.md's existing "darwin
side" caveat already warns can shift text metrics on a contributor's machine
independent of any real regression.

This is a real, separate signal worth a follow-up (this host's own darwin
output isn't a clean stand-in for "the" native-macOS baseline), but it does
**not** undermine the core finding above: the native-vs-container comparison
is validated independently via the container run-to-run control (B), which
has nothing to do with whether this host's darwin output matches the
committed baseline. Even a hypothetical Mac with a perfectly clean font
install would still resolve `Inter`/`system-ui`/`JetBrains Mono` to macOS's
own typefaces, not DejaVu — the fallback-target mismatch between the two
OSes is what drives the effect, not this host's specific font-install quirk.

## Decision

**Do not consolidate.** A real, systematic, non-noise fraction of SVG samples
render differently between native macOS and the containerized Linux run: 43
of 190 (22.6%, run 1) and 30 of 190 (15.8%, run 2) exceed the suite's own
`maxDiffPixelRatio: 0.002` real-regression threshold outright, and 78 of 190
(41%) show a cross-platform diff that clearly exceeds that specific sample's
own measured jitter — the two figures answer different questions (absolute
threshold vs. relative-to-jitter), and both point the same direction.
Merging `-chromium-linux.png` and `-chromium-darwin.png` into one suffix
would either force the tolerance to be loosened suite-wide (defeating the
suite's ability to catch real regressions — see `playwright.config.ts`'s own
comment on how tightly `threshold`/`maxDiffPixelRatio` are already tuned) or
produce permanent, unfixable flakiness for a large minority of samples.

**Do not rename to an architecture-based split either.** #545 already
conclusively ruled out architecture as the driver, for both halves of the
suite. This spike confirms the actual driver is OS/font-rendering-environment
— which is exactly what the _current_ `-linux`/`-darwin` naming already
reflects. An arch-based rename (`-amd64`/`-arm64`) would describe a variable
that doesn't matter and stop describing the one that does.

**#551's answer is "keep as-is."** That is a legitimate, evidence-backed
outcome — not a failure to reach the more novel-sounding conclusion. See the
2026-09-09 amendment to
[`docs/decisions/playwright-docker-image-visual-regression.md`](../decisions/playwright-docker-image-visual-regression.md)
for the decision-record entry, and CONTRIBUTING.md's "Visual regression
tests" section for the contributor-facing summary.

## Reproduction

The measurement above used a temporary, uncommitted edit to
`playwright.config.ts`'s `snapshotDir` (pointed at a scratch directory) plus
a direct `docker run` mirroring `scripts/docker-test-visual.sh`'s container
invocation but with `--update-snapshots` allowed (safe against a scratch
directory; the wrapper's refusal of that flag is specifically about
protecting the _committed_ baselines, which this never touched). No
committed file was regenerated or overwritten as part of this measurement.
