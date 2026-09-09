# Research: closing #545 — flag-matched, same-commit, real-CI-compared cross-arch confirmation

Status: **spike, answered — closes #545 and #615's remaining gaps.** Written as a
follow-up to [#545](https://github.com/dfadler/zombie-mermaid/issues/545) (still open
at the time of this doc, despite [#615](https://github.com/dfadler/zombie-mermaid/issues/615)
having already answered most of it) and its own remaining gaps, part of the
[#544](https://github.com/dfadler/zombie-mermaid/issues/544) Docker tracking cluster.

## Why this doc exists

Three prior spikes ([#545](https://github.com/dfadler/zombie-mermaid/issues/545)'s
original comment, [#549](../research/549-ci-container-migration.md),
[#615](../research/615-emulated-amd64-vs-native-arm64-spike.md)) already did almost
all of the empirical work #545 asks for. What was still missing, per #615's own
"Still not tested" list: **a flag-matched (`CI=true`, `retries: 2`) native-arm64 run**,
and **a real bare-metal-x86-CI data point on the exact same commit** to diff against.
Both gaps are closed here, on a machine that is a real Apple Silicon Mac with Docker
(`uname -m` → `arm64`; confirmed the pinned tag is genuinely multi-arch and this host
pulls `linux/arm64` natively, not under Rosetta/QEMU).

## Method

- **Image**: `mcr.microsoft.com/playwright:v1.62.1-jammy` (the mutable multi-arch tag,
  not the amd64-pinned digest `ci.yml` uses for its container job — using the digest
  would have forced emulation on this host, since that digest names only the amd64
  manifest). `docker manifest inspect` confirmed both `linux/amd64` and `linux/arm64`
  manifests exist; `docker build --platform linux/arm64` and the container's own
  `uname -m` → `aarch64` confirm this run is native, not emulated.
- **Font layer**: identical to `docker/visual-regression.Dockerfile` and `ci.yml`'s own
  steps — `fonts-dejavu-core` + `fc-cache -f`, with the same `fc-match` assertion
  (`monospace`/`sans-serif`/`serif` → `DejaVu*`) built into the image so a silent
  font-resolution regression would fail the build, not the suite.
- **Node**: 22.23.2, matching `actions/setup-node`'s `node-version: '22'` resolution,
  installed via the official linux-arm64 tarball (not the image's stock Node 24).
- **Tree**: `git archive HEAD` of commit `73d5940` (this worktree fast-forwarded to
  `origin/main` at the time of the run) into a scratch directory, with a
  container-side `pnpm install --frozen-lockfile` — no host `node_modules` reused.
  **This is the exact commit real CI evaluated in
  [run 34377940579](https://github.com/dfadler/zombie-mermaid/actions/runs/34377940579)**,
  making this a true same-commit comparison, not merely same-baseline.
- **Flags**: `CI=true` for every run (so `playwright.config.ts` applies `retries: 2`
  and `--disable-gpu`) — the flag-matched configuration #615 flagged as untested for
  its own arm64 runs, and the actual configuration real CI uses.
- **Scope**: the full suite, all 4 `--shard=N/4` slices, run sequentially — 281 tests
  (190 SVG + 90 ASCII + `sidebar-focus.visual.test.ts`), matching #549's scope.
- **Repetitions**: 3 full-suite runs (843 executions total), matching #615's own
  3-run methodology, specifically to avoid over-reading a single run one way or the
  other.
- **No `--update-snapshots`** was ever passed; `CI=true` also makes Playwright refuse
  to write a missing baseline. Baseline integrity was checked by `sha256` over all 562
  `__screenshots__/*.png` files before run 1 and after run 3.

Host: Apple Silicon Mac, Docker Desktop, native `linux/arm64` VM (not
Rosetta/emulated — verified per-run via in-container `uname -m` → `aarch64`).

## Results

### Three full-suite runs, native arm64, flag-matched (`CI=true`)

| Run | Shard 1/4         | Shard 2/4                  | Shard 3/4         | Shard 4/4         | Final tally | Flaky (cleared by 1 retry)                                |
| --- | ----------------- | -------------------------- | ----------------- | ----------------- | ----------- | --------------------------------------------------------- |
| 1   | 71 passed (25.4s) | 70 passed (27.5s)          | 70 passed (53.7s) | 70 passed (24.5s) | **281/281** | 0                                                         |
| 2   | 71 passed (12.4s) | 69 passed +1 flaky (18.0s) | 70 passed (23.0s) | 70 passed (22.8s) | **281/281** | 1 — SVG `Interactivity: Step Routing`, 278px (ratio 0.01) |
| 3   | 71 passed (9.2s)  | 69 passed +1 flaky (14.7s) | 70 passed (22.1s) | 70 passed (22.6s) | **281/281** | 1 — SVG `Sequence: Alt/Else Block`, 238px (ratio 0.01)    |

**843/843 executions passed in the final tally across 3 runs. Zero ASCII failures**
(0/270 individual executions) — reconfirms #614's font fix and #615's finding that
architecture contributes nothing to that half. **Two SVG flakes total (2/570 SVG
executions, 0.35%)**, both cleared by the first retry, both the same signature as
every SVG mismatch this whole cluster has found: identical dimensions, ~230–280
differing pixels, ratio 0.01 (just over the suite's `0.002` threshold) — ordinary
antialiasing jitter on curved/stepped paths, not a structural or font mismatch. No
sample failed in more than one of the three runs.

**Baseline integrity**: `sha256` manifest of all 562 `__screenshots__/*.png` files was
byte-identical before run 1 and after run 3. No baseline was written, altered, or
regenerated by any of this.

### The same-commit comparison: real x86 CI, right now, on `73d5940`

Real CI ([run 34377940579](https://github.com/dfadler/zombie-mermaid/actions/runs/34377940579),
2026-09-09T16:37Z) ran this exact commit inside the same pinned amd64 container on a
real `ubuntu-latest` runner while this spike was in progress. Its shard 2/4
(`--shard=2/4`, 70 tests) is the sharpest available real-CI data point on this exact
tree:

```
1 failed
17 flaky
52 passed (34.2s)
```

The one hard failure (`Class: Basic Class`, survived both retries) and all 17 flakes
share the identical signature this cluster has documented throughout: same
dimensions, small pixel counts, ratio ~0.01. **Real x86 CI showed dramatically more
jitter on this exact commit and exact baselines than this spike's quiet-host native
arm64 runs did** (17/70 flaky + 1/70 hard-failed in one CI shard vs. 2/570 flaky and
0 hard failures across three full arm64 runs). The other three shards of that same CI
run passed cleanly. This is one sampled run, not a distribution — but it directly
answers the question this spike exists to close: **whichever side has more jitter on
this comparison, it is not the arm64 side.**

## What this means for #545

**#545 is answered.** With the #614 font-corrected image and CI's actual retry
policy (`retries: 2`) applied — the configuration real CI uses, which no prior spike
in this cluster had matched until now — identical-image cross-architecture rendering
(native `arm64` Mac vs. real `amd64` CI, same commit, same unmodified baselines) does
**not** produce a meaningful divergence:

- **ASCII/terminal**: zero divergence, confirmed for the third time (#615, #549's
  amd64-side control, and this arm64-side run all agree): 0 failures across every
  execution measured in this cluster once the font layer is applied. Architecture is
  conclusively not a factor.
- **SVG**: real, small, intermittent rasterization jitter exists on **both** sides of
  the arch comparison — this was never in question (`playwright.config.ts`'s own
  comments document it, and CI's `retries: 2` exists specifically to absorb it). What
  #545 needed to establish is whether arm64 has _meaningfully more_ of it than amd64
  CI does, and on this same-commit measurement the answer is no — if anything the
  reverse, since quiet-host arm64 (0.35% flaky, 0 hard failures over 843 executions)
  looked cleaner than today's real, contended x86 CI shard (24% flaky, 1 hard failure
  in 70 tests). The likely driver of CI's higher jitter is shared-runner CPU
  contention — the same noise source `playwright.config.ts`'s `workers: 2` cap and
  its font-rasterization-jitter comments already document — not architecture.
- This closes both items #615 flagged as open ("real bare-metal x86" — now have a
  direct same-commit comparison from live CI history rather than a proxy; "a
  flag-matched comparison" — done, `CI=true` throughout).

## What this does NOT mean for #551

**This spike only measures divergence _within_ Linux/Docker rendering** (arm64
container vs. amd64 container/CI). It says nothing about whether native macOS
Playwright — the actual generator of the committed `-chromium-darwin.png`
baselines — matches the Linux container's output. That is the original,
still-completely-untested variable behind why the `-linux`/`-darwin` split exists in
the first place (font rasterization differing between bare macOS and bare Linux,
per #544's own opening background). Nothing in this cluster's three spikes has ever
measured that comparison.

[#551](https://github.com/dfadler/zombie-mermaid/issues/551)'s two proposed branches
(full consolidation, or renaming the split from OS-based to arch-based) both
presuppose that local dev and CI render inside the _same_ environment. That is true
today only for ASCII, where [#550](https://github.com/dfadler/zombie-mermaid/issues/550)'s
Docker wrapper (`scripts/docker-test-visual-ascii.sh`) already routes local dev
through the shared container. It is not true for SVG: local SVG testing on a
contributor's Mac still runs native macOS Playwright against the `-darwin` baselines,
untouched by anything measured here or in #549/#614/#615. Consolidating or renaming
the SVG baseline split now would conflate "the container is arch-agnostic" (proven
here) with "native macOS matches the container" (never measured, and the entire
premise `-darwin` baselines exist to accommodate).

**#551 is not warranted yet.** The concrete, bounded prerequisite is extending #550's
Docker wrapper to SVG (so local dev renders SVG samples inside the same container CI
uses, the way ASCII already does) — only once that exists does "one baseline set,
generated by the one environment both CI and local dev share" become a coherent
target. That is new scope beyond what #545 was asked to close, and beyond what this
spike measured.

## Reproducing

```sh
# Native arm64 build (multi-arch tag, NOT the amd64-pinned digest ci.yml uses for
# its container job — that digest would force emulation on Apple Silicon).
docker build --platform linux/arm64 -t zm-545-verify:jammy-arm64-native - <<'DOCKERFILE'
FROM mcr.microsoft.com/playwright:v1.62.1-jammy
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/* && fc-cache -f
RUN set -eu; for g in monospace sans-serif serif; do case "$(fc-match "$g")" in DejaVu*) ;; *) exit 1 ;; esac; done
ARG NODE_VERSION=22.23.2
RUN curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-arm64.tar.gz" -o /tmp/n.tgz \
    && tar -xzf /tmp/n.tgz -C /usr/local --strip-components=1 && rm /tmp/n.tgz
DOCKERFILE

# Clean snapshot; do not reuse host node_modules (darwin-arm64 binaries).
mkdir -p /tmp/zm-snapshot && git archive HEAD | tar -x -C /tmp/zm-snapshot

docker run --rm --platform linux/arm64 --ipc=host -v /tmp/zm-snapshot:/work -w /work \
  zm-545-verify:jammy-arm64-native \
  sh -c 'corepack enable && corepack prepare pnpm@11.13.0 --activate && \
         pnpm install --frozen-lockfile && \
         for i in 1 2 3 4; do CI=true pnpm exec playwright test --shard="$i/4" || exit 1; done'
```

Run this 3× to reproduce the flaky-rate measurement; a single run being clean (as run
1 above was) is expected and not evidence of zero jitter on its own.
