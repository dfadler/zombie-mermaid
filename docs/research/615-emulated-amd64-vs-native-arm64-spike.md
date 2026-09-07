# Research: emulated amd64-in-Docker vs. native arm64, visual-regression parity with x86 CI

Status: **spike, answered — with one substituted variable and one gap still open.** Written
for [#615](https://github.com/dfadler/zombie-mermaid/issues/615), part of the
[#544](https://github.com/dfadler/zombie-mermaid/issues/544) Docker tracking cluster, feeding
the go/no-go decision in [#548](https://github.com/dfadler/zombie-mermaid/issues/548).
Follows up on [#545](https://github.com/dfadler/zombie-mermaid/issues/545), whose native-arm64
run this re-measures as a same-session control.

Unlike the #545 and #546 docs, the full write-up lives here rather than in an issue comment —
this spike posted nothing to GitHub, so there is no comment to link to.

## TL;DR

- **The emulation used was Rosetta 2, not QEMU.** Docker Desktop on this host has
  `useVirtualizationFrameworkRosetta = true`, so `docker run --platform linux/amd64` is served
  by Rosetta, not the QEMU binfmt handler the issue's "How to test" assumed. Both execute the
  same x86-64 instruction set, so the _rendering_ question is still answered; the _cost_
  numbers below are Rosetta's and would be far worse under QEMU TCG. This was not switched —
  changing the user's Docker Desktop emulation setting is a config change, not a test step.
- **ASCII/terminal: emulation changes nothing.** 88/90 fail (97.8%) on emulated amd64 —
  identical to native arm64's 97.8%. Comparing the two containers' own failing screenshots
  directly, all 88 have **identical dimensions** and a **maximum per-pixel channel delta of
  1/255**. Under the suite's own `threshold: 0.4`, that is _zero_ difference. Architecture
  contributes nothing here; the font substitution tracked in
  [#614](https://github.com/dfadler/zombie-mermaid/issues/614) is the entire gap.
- **SVG: emulation matters, and the answer flips.** Emulated amd64 produced **0 pixel
  mismatches across 570 SVG test executions** (3 runs × 190). Native arm64 produced **30
  across the same 570** (5.3%), spread over 27 distinct samples with **no sample failing in
  all three runs** — intermittent, not systematic, and not fixed by dropping to
  `--workers=1`.
- **So the two halves of the suite answer #615 oppositely**: the emulated-amd64 container is
  a materially better match to real x86 CI's committed baselines for SVG, and no better at
  all for ASCII.
- **Cost**: ~3.5x on scalar CPU, ~11x on the real workload (full suite 24.4m emulated vs.
  2.2m native). Emulation also surfaced two timeout failures that never appear natively —
  the suite's 30s test / 15s `toHaveScreenshot` limits are too tight under it.

## What was verified vs. what wasn't

| Claim                                                                        | Verified how                                                                                                                                                                                                    | Confidence                                           |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Container really executed amd64 code                                         | In-container `uname -m` → `x86_64`; `node -p process.arch` → `x64`; image `.Architecture` → `amd64`                                                                                                             | High — direct command output                         |
| Emulation backend is Rosetta, not QEMU                                       | Docker Desktop `settings.json` → `useVirtualizationFrameworkRosetta: true`; `/proc/cpuinfo` `vendor_id: VirtualApple`, no `QEMU Virtual CPU` string; measured 3.5x scalar slowdown (QEMU TCG is typically 10x+) | High for "Rosetta"; the 3.5x figure is one benchmark |
| ASCII fail rate identical across architectures                               | Two full suite runs, same repo snapshot, same config                                                                                                                                                            | High                                                 |
| ASCII output is architecturally equivalent                                   | Pixel-diffed all 88 failing screenshots from each run against each other (PIL/numpy): max channel delta 1/255                                                                                                   | High — direct measurement                            |
| Emulated amd64 SVG matches committed x86-CI baselines                        | 3 runs × 190 SVG tests, 0 pixel mismatches                                                                                                                                                                      | High for this host/backend                           |
| Native arm64 SVG mismatches are intermittent, not systematic                 | 3 runs producing 5 / 16 / 9 failures over 27 distinct samples, intersection empty                                                                                                                               | High                                                 |
| Whether **real bare-metal x86** (`ubuntu-latest`) behaves like Rosetta-amd64 | **Not tested.** Rosetta-on-VZ is not `ubuntu-latest`; #545's missing CI data point is still missing                                                                                                             | **Not tested**                                       |
| Whether **QEMU TCG** specifically gives the same result                      | **Not tested** — Rosetta was what this host's Docker actually uses                                                                                                                                              | **Not tested**                                       |

## Method

Deliberately the same controls as #545, so the _only_ intended difference is `--platform`:

- Same image and tag: `mcr.microsoft.com/playwright:v1.62.1-jammy` (multi-arch; `amd64`
  digest `sha256:75d2d72c…`, `arm64` `sha256:f9ab55d8…`, confirmed via
  `docker manifest inspect`).
- Same repo snapshot: `git archive 9a04a152` — the exact commit #545 measured — into a
  scratch directory, so no host `node_modules` (darwin-arm64 binaries) leaks in and each
  container does its own `pnpm install --frozen-lockfile`.
- Same config: no `CI` env set, so `retries: 0` and no `--disable-gpu`, `workers: 2`.
- Straight compare against the already-committed `-chromium-linux.png` baselines (real,
  previously CI-generated amd64 output); no `--update-snapshots`.

```
docker run --rm --platform linux/amd64 -v "<scratch>:/work" -w /work \
  mcr.microsoft.com/playwright:v1.62.1-jammy \
  sh -c "corepack enable && corepack prepare pnpm@11.13.0 --activate && \
         pnpm install --frozen-lockfile && \
         pnpm exec playwright test __tests__/visual/svg-samples.visual.test.ts \
                                   __tests__/visual/ascii-samples.visual.test.ts"
```

`--platform linux/arm64` for the control, everything else byte-identical.

### On the Rosetta/QEMU substitution

The issue asked for QEMU. What this host actually runs is Rosetta:

```
$ python3 -c "…settings.json…"     # ~/Library/Group Containers/group.com.docker/settings.json
  useVirtualizationFramework = True
  useVirtualizationFrameworkRosetta = True

$ docker run --rm --platform linux/amd64 … grep -E '^(vendor_id|model name)' /proc/cpuinfo
vendor_id  : VirtualApple
model name : VirtualApple @ 2.50GHz          # QEMU would report "QEMU Virtual CPU version …"
```

Scalar benchmark (same Node one-liner, same image, both platforms): **arm64 12.6s → amd64
44.0s ≈ 3.5x**. QEMU TCG on this kind of workload is normally an order of magnitude worse, so
the timing evidence agrees with the settings flag.

This substitution is worth being clear about, but it does not invalidate the rendering
result: Rosetta and QEMU both execute the same x86-64 ISA against the same amd64 Chromium
build, and the CPU exposed AVX2/FMA/BMI2 (`/proc/cpuinfo` flags), so Skia's runtime SIMD
dispatch had the same code paths available that a real x86 runner would offer. What is
Rosetta-specific is the _speed_, and therefore the timeout failures noted below.

## Results

### Run tally

| #   | Platform       | Scope                   | ASCII fail | SVG pixel mismatch | SVG timeout | Wall  |
| --- | -------------- | ----------------------- | ---------- | ------------------ | ----------- | ----- |
| 1   | emulated amd64 | full                    | 88/90      | **0**/190          | 1           | 24.4m |
| 1   | native arm64   | full                    | 88/90      | 5/190              | 0           | 2.2m  |
| 2   | emulated amd64 | SVG only                | —          | **0**/190          | 0           | 3.6m  |
| 2   | native arm64   | SVG only                | —          | 16/190             | 0           | 1.0m  |
| 3   | emulated amd64 | SVG only                | —          | **0**/190          | 1           | 3.9m  |
| 3   | native arm64   | SVG only, `--workers=1` | —          | 9/190              | 0           | 2.2m  |

For reference, #545's native-arm64 run reported 88/90 ASCII and 3/190 SVG.

### ASCII/terminal — architecture is irrelevant here

Both platforms fail 88 of 90, and the _same_ 88. Against the committed CI baselines the
failure shape is identical on both: height matches in **all 88**, width is inflated on the
container side in **87 of 88** (median **+43.0%**, max **+59.6%**). `fc-match monospace`
resolves to `WenQuanYi Zen Hei Mono` in the amd64 image exactly as it does in the arm64 one —
the same 50-font set ships to both.

The decisive measurement is the container-vs-container comparison, which #545 could not make
because it only had one architecture. Diffing the amd64 run's 88 failing screenshots against
the arm64 run's 88:

```
n = 88
any-difference pixel ratio  : median 0.1034  max 0.2532
strong-difference (>60/255) : median 0.0000  max 0.0000
max per-pixel channel delta : median 1  max 1
```

Every pair has identical dimensions, and the largest disagreement anywhere is **1/255 on a
single channel** — pure rounding. The 10–25% "differing pixel" ratio is entirely made of
those ±1 values, which the suite's `threshold: 0.4` discards outright. **Emulating amd64
produces the same ASCII rendering as native arm64, and both are equally wrong relative to
CI.** #614's font fix is the whole variable.

(Note the width-inflation range measured here — median 43%, max 59.6% — is wider than the
"10–45%" #545 reported. #545 quoted a handful of examples; this is all 88 measured.)

### SVG — architecture does matter, reproducibly

Emulated amd64: **0 pixel mismatches in 570 test executions.** The two failures it did record
were not pixel mismatches at all —

- Run 1: `Class: Visibility Markers` — `Test timeout of 30000ms exceeded`, no `-actual.png`
  written.
- Run 3: `Axis Configurations / Wide Y-Axis Range` — `toHaveScreenshot … Timeout 15000ms
exceeded` while waiting for two consecutive stable screenshots, again no `-actual.png`.

Both are emulation-cost artifacts: the suite's timeouts are sized for native speed.

Native arm64: **30 pixel mismatches in 570**, and they are intermittent. The three runs failed
5, 16 and 9 samples respectively over **27 distinct samples**, with **empty intersection** —
no sample failed all three times. Dropping to `--workers=1` (run 3) did not help, so this is
not merely the CPU-contention noise `playwright.config.ts` already documents.

The magnitudes are not sub-pixel either. Run 1's five failures, measured against the committed
baseline:

```
general-6-flowchart-all-edge-styles          any=0.0180  strong(>60)=0.0110  maxdelta=210
general-54-class-class-inheritance           any=0.0365  strong(>60)=0.0160  maxdelta=205
general-53-class-class-enum-annotation       any=0.0496  strong(>60)=0.0222  maxdelta=205
general-25-interactivity-links-and-tooltips  any=0.0177  strong(>60)=0.0117  maxdelta=210
general-73-er-er-identifying-solid-relation  any=0.0285  strong(>60)=0.0095  maxdelta=205
```

`maxdelta` ~205 with 1–2% of pixels strongly different is a real rendering disagreement, an
order of magnitude beyond the ±1 seen between the two architectures' ASCII output.

The failing samples skew toward edge/arrow/line-heavy diagrams (`All Edge Styles`,
`No-Arrow Edges`, `Bidirectional Arrows`, `linkStyle`, `Curved Edges`, `Step Routing`, the ER
relationship samples) rather than plain-text ones — consistent with arm64 Skia's path
rasterization being the unstable part while glyph rasterization (the ASCII result above) is
not. That attribution is inference from the sample names and the ASCII contrast, not something
this spike instrumented directly.

## Answering #615

> Does emulated amd64 produce output closer to real bare-metal x86 CI than native arm64?

- **For ASCII/terminal: no, not at all.** 97.8% either way, and the two containers' output is
  equivalent under the suite's own tolerance. This is positive evidence for #614's premise:
  the font gap is the dominant — here, the _only_ — variable, and no amount of architecture
  matching will move it.
- **For SVG: yes, clearly.** 0/570 emulated-amd64 vs. 30/570 native-arm64, reproducible in
  both directions across three runs each. Architecture is a real contributor on this half of
  the suite, which #545 could not have detected with an arm64-only measurement.

## What this means for #548

The decision doc names two gaps. This spike moves one and adds a new consideration.

1. **Gap 1 (missing x86-container-vs-real-x86-CI data point) is narrowed, not closed.** #545
   could only offer arm64-container-vs-CI-baselines. This offers
   _x86-ISA-container-vs-CI-baselines_, at 570/570 — the strongest available proxy short of a
   real runner. It is still a proxy: Rosetta-on-VZ is not `ubuntu-latest`, and the
   `workflow_dispatch` trial #545 wrote is still the thing that would actually close this.
   But "partial adopt for SVG" now rests on a same-architecture match rather than a
   cross-architecture near-match.
2. **Gap 2 (font layer, #614) is untouched by architecture** — and this spike removes
   architecture as a competing explanation for the ASCII mismatch, so #614's experiment is
   now the single remaining question on that half.
3. **New: #550's local-Docker-wrapper plan has an Apple-Silicon problem the spikes hadn't
   surfaced.** A developer running the _native arm64_ container against a shared x86-generated
   baseline set would hit intermittent SVG failures at ~5% aggregate — different samples each
   run. Running the emulated amd64 container instead avoids that entirely, but costs ~11x wall
   clock (24.4m vs 2.2m for the full suite). Neither is obviously acceptable, and "share one
   baseline set via a local Docker wrapper" needs to answer this before it ships. If SVG
   baselines are unified, the local wrapper probably has to mandate `--platform linux/amd64`.

None of this argues for changing the current "no adopt — yet" call. It sharpens what the two
follow-ups have to show.

## Caveats

- **Rosetta was substituted for QEMU** (see above). The rendering conclusion should carry over
  — same ISA, same browser build — but this is a substitution, not the literal experiment.
- **Not bare metal.** No real x86 hardware was involved on either side.
- **`retries: 0`**, matching #545 for comparability. Real CI runs `retries: 2`, which would
  mask a good share of arm64's intermittent SVG failures — so the 5.3% figure is a
  _raw_ instability rate, not a prediction of how often CI would go red.
- **Three runs per platform** is a small sample. Enough to establish that arm64's failures are
  intermittent (empty intersection over 27 samples is hard to get by chance) and that amd64's
  zero is not a single lucky run, but not enough for a tight interval on either.
- **Host load was not isolated.** This machine may have been running other work concurrently.
  The amd64 and arm64 runs were interleaved over the same ~45 minutes rather than run on a
  quiesced machine, which limits how far the wall-clock ratios should be pushed.
