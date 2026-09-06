# Research: identical Playwright Docker image, real Apple Silicon vs. real x86 CI screenshots

Status: **partially answered — the arm64 side is measured with real data; the amd64/x86 CI
side still needs either a human-approved CI trial or a real x86 machine.** Written for
[#545](https://github.com/dfadler/zombie-mermaid/issues/545), part of the
[#544](https://github.com/dfadler/zombie-mermaid/issues/544) Docker tracking cluster, feeding
the go/no-go decision in [#548](https://github.com/dfadler/zombie-mermaid/issues/548).

## TL;DR

- **This agent sandbox genuinely is a real Apple Silicon Mac** (`uname -m` → `arm64`,
  Darwin/macOS, Docker Desktop backed by a native `linux/arm64` VM — confirmed live, not
  assumed) — so the arm64 half of this spike's question was actually measurable here, not
  just inferred.
- **The pinned tag is confirmed multi-arch** (`docker manifest inspect
  mcr.microsoft.com/playwright:v1.62.1-jammy` lists separate `linux/amd64` and `linux/arm64`
  manifests) and Docker on this host resolves it natively to the `linux/arm64` variant
  (`docker image inspect` → `arm64 linux`; the running container reports `uname -m` →
  `aarch64`) — exactly as #544's research predicted.
- **Running this repo's own visual-regression suite inside that container on real arm64,
  and diffing against the already-committed `-chromium-linux.png` baselines (real,
  previously-generated `ubuntu-latest`/amd64 CI output — not a guess)**: SVG samples pass
  overwhelmingly (**187/190, 98.4%**); ASCII/terminal samples fail overwhelmingly
  (**88/90, 97.8%**) with the identical, easily-attributable failure shape: **same
  height, wider width** on the container side — a monospace font-substitution problem, not
  a structural/architecture one. Root cause reproduced directly: `fc-match monospace` inside
  the container resolves to `WenQuanYi Zen Hei Mono` (a CJK font), because the image ships
  none of `.ascii-panel`'s requested `'JetBrains Mono', 'Fira Code', 'Cascadia Code'` faces.
- **This does not yet answer the literal question #545 asks** (identical image on real
  Apple Silicon *vs.* the identical image on real x86 CI) — it answers the adjacent,
  still-highly-relevant question of "identical image on real Apple Silicon vs. real CI's
  *actual, already-produced* bare-metal output." Getting a true container-on-x86-CI data
  point requires either a human to approve pushing/dispatching a one-off CI workflow (this
  agent's attempt to do that was blocked by the environment's own auto-mode classifier — see
  below, not worked around) or a person with a real x86 machine and Docker.
- **Bottom line for #544's decision**: for the ASCII/terminal-panel baseline split
  specifically, a shared container does **not** look like it would collapse it — if
  anything the container disagrees with real CI's bare-metal output far more than local
  native macOS Playwright already does (which is *why* the linux/darwin split exists in the
  first place). For the SVG baseline split, the container comes very close to matching real
  CI bare-metal output already, on the arm64 side alone.

## What was actually verified vs. what wasn't (read this before the rest)

Per the issue's own constraint check:

| Claim | Verified how | Confidence |
|---|---|---|
| This sandbox is a real Apple Silicon Mac | `uname -a` → `Darwin ... RELEASE_ARM64_T6030 ... arm64`; Docker Desktop version banner | High — direct command output |
| `v1.62.1-jammy` tag is multi-arch (amd64 + arm64) | `docker manifest inspect` live against `mcr.microsoft.com` | High — live registry query, not memory |
| Docker on this host runs the image natively as arm64 | `docker image inspect --format '{{.Architecture}} {{.Os}}'` → `arm64 linux`; in-container `uname -m` → `aarch64` | High |
| Container's ASCII/terminal screenshots vs. real CI's *already-committed* linux baselines | Ran `pnpm exec playwright test __tests__/visual/svg-samples.visual.test.ts __tests__/visual/ascii-samples.visual.test.ts` (280 tests total) inside the container, mounting a clean `git archive` of commit `9a04a152` (no host `node_modules` reused — fresh `pnpm install --frozen-lockfile` ran inside the container so all native deps, e.g. `@resvg/resvg-js`, are the container's own linux-arm64 build) | High — real Playwright screenshot-diff run, real committed baseline files, not a simulation |
| Font-substitution root cause | `fc-list \| wc -l` (50 fonts total in the image) and `fc-match monospace` / `fc-match 'JetBrains Mono'` run live inside the container | High — direct command output |
| Whether the *same* container run on real x86 CI matches the arm64 container's own output | **Not verified.** No real x86 CI run of this container was obtained (see next section) | **Not tested** |
| Whether emulated amd64-in-Docker (QEMU) on this Mac would match real bare-metal x86 CI any more closely | **Not attempted** — out of scope for the effort budget once the native-arm64 run and the CI-attempt already gave a clear signal; flagged as a possible follow-up, not a finding | **Not tested** |

## Why the real x86-CI-in-container data point is still missing

This agent tried to close that gap by adding a narrowly-scoped, isolated
`workflow_dispatch`-only GitHub Actions workflow (not touching `ci.yml`) that would have run
the same container image on real `ubuntu-latest`, per the issue's own "How to test" section
and #544's sibling issue #547 (which independently plans exactly this kind of throwaway CI
trial for timing purposes). The workflow file was written and committed locally, but
**pushing it to `origin` was blocked by this environment's own auto-mode permission
classifier** ("Blocked by classifier" — a `gh`-token-level `workflow` scope existing does not
mean the sandbox's own policy layer allows using it). Per this agent's operating
instructions, that block was respected rather than worked around (no alternate push path, no
raw REST call as a bypass) — the commit was reverted and the branch discarded rather than
landing a workflow whose CI-triggering half could never actually run.

**This is exactly the kind of gap the issue anticipated**: "If you genuinely cannot access
both a real arm64 host and real CI in this sandboxed environment... report the spike as
partially answered." The arm64 host access is real and was used; the CI-trigger access is
not available to this agent in this environment. A human with `gh` access to
`dfadler/zombie-mermaid` (or push rights to add a workflow file) can finish this in minutes:
the throwaway workflow content this agent would have used is reproduced below so it doesn't
need to be re-derived.

<details>
<summary>Throwaway workflow content (never pushed — for a human to add and run, then delete)</summary>

```yaml
name: 'Spike #545: Docker cross-arch screenshot diff'
on:
  workflow_dispatch: {}
permissions:
  contents: read
jobs:
  docker-container-render:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    container:
      image: mcr.microsoft.com/playwright:v1.62.1-jammy
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0
      - run: uname -m && cat /etc/os-release | head -5
      - run: corepack enable && corepack prepare pnpm@11.13.0 --activate
      - run: pnpm install --frozen-lockfile
      - name: Run a sample slice of the visual regression suite
        continue-on-error: true
        run: |
          pnpm exec playwright test __tests__/visual/svg-samples.visual.test.ts __tests__/visual/ascii-samples.visual.test.ts --reporter=list,json 2>&1 | tee playwright-spike-output.log
      - if: always()
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2
        with:
          name: spike-545-docker-x86-screenshots
          path: |
            test-results/
            playwright-report/
            playwright-spike-output.log
          retention-days: 3
          if-no-files-found: warn
```

Add this as `.github/workflows/spike-545-docker-arch.yml` on a throwaway branch, `gh workflow
run` it (or use the Actions UI's "Run workflow"), download the
`spike-545-docker-x86-screenshots` artifact, and diff its `test-results/**/*-actual.png`
files against this run's local arm64 output (saved alongside this doc's data — ask the
agent/session that produced this file, or re-run the recipe below) — or more simply, just
read whether that CI run's own `pnpm exec playwright test` output shows the same near-100%
ASCII fail-rate / near-0% SVG fail-rate this doc reports for arm64. If the x86 container run
instead matches the committed linux baselines cleanly (0 or near-0 ASCII failures), that
would mean the mismatch found here **is** architecture-specific after all (the container's
font-fallback resolution differing by arch), not just "any Docker container differs from
bare-metal ubuntu-latest regardless of arch" — which is the open question this leaves.
Delete the workflow file and branch afterward; it has no reason to stay in the repo.

</details>

## The experiment actually run

1. **Confirmed the tag is multi-arch**, live:

   ```
   $ docker manifest inspect mcr.microsoft.com/playwright:v1.62.1-jammy
   ...
   "manifests": [
     {"digest": "sha256:75d2d72c...", "platform": {"architecture": "amd64", "os": "linux"}},
     {"digest": "sha256:f9ab55d8...", "platform": {"architecture": "arm64", "os": "linux"}}
   ]
   ```

   `package.json` pins `"@playwright/test": "1.62.1"`, matching the `v1.62.1-jammy` tag the
   issue specified (not `-noble`, which is what the older #326 investigation used — a
   different base-OS tag, noted here in case anyone tries to compare the two directly).

2. **Pulled and inspected the image** on this host: `docker image inspect
   mcr.microsoft.com/playwright:v1.62.1-jammy --format '{{.Architecture}} {{.Os}}'` →
   `arm64 linux`. Docker Desktop's own backend here is natively `linux/arm64` (`docker info
   --format '{{.Architecture}}'` → `aarch64`), so this is a genuine native-arm64 pull, not an
   emulated one.

3. **Built a clean commit snapshot** (`git archive HEAD` of `9a04a152`, the branch tip at
   spike time) into a scratch directory — deliberately *not* mounting the host's own
   `node_modules` (which contains darwin-arm64-native binaries that wouldn't run inside a
   Linux container) — so the container would install its own linux-arm64 native deps from
   scratch (`pnpm install --frozen-lockfile`, ~4m36s cold).

4. **Ran the full SVG + ASCII visual-regression suites** (`svg-samples.visual.test.ts` +
   `ascii-samples.visual.test.ts`, 280 tests, `playwright.config.ts`'s own `workers: 2` cap
   respected) inside the container:

   ```
   docker run --rm -v "<scratch-repo>:/work" -w /work mcr.microsoft.com/playwright:v1.62.1-jammy \
     sh -c "corepack enable && corepack prepare pnpm@11.13.0 --activate && \
            pnpm exec playwright test __tests__/visual/svg-samples.visual.test.ts __tests__/visual/ascii-samples.visual.test.ts"
   ```

   Because the container's `process.platform` is `linux`, Playwright's
   `snapshotPathTemplate` (`{name}-{projectName}-{platform}{ext}`) automatically compared
   against the **already-committed `-chromium-linux.png` baselines** — the same files real
   CI generates and commits on bare `ubuntu-latest` — with no config changes needed. No
   `--update-snapshots` was used; this is a straight compare, sabotage-test-style but without
   sabotaging anything.

## Results

| Suite | Total | Passed | Failed | Fail rate |
|---|---|---|---|---|
| ASCII/terminal (`ascii-samples.visual.test.ts`) | 90 | 2 | 88 | **97.8%** |
| SVG (`svg-samples.visual.test.ts`, incl. xychart) | 190 | 187 | 3 | **1.6%** |
| **Total** | **280** | **189** | **91** | 32.5% |

### ASCII failures: a consistent, large, structural pattern — not noise

Every ASCII failure examined has the **same shape**: identical height, consistently wider
width on the container side, tens of thousands of differing pixels (ratio ~0.1–0.3, far
above the suite's `maxDiffPixelRatio: 0.002` tolerance). Examples pulled directly from
Playwright's own failure output:

```
Expected an image 558px by 142px, received 776px by 142px. 30087 pixels (ratio 0.28) different.
Expected an image 255px by 142px, received 335px by 142px.
Expected an image 578px by 448px, received 894px by 448px.
Expected an image 696px by 943px, received 956px by 943px.
```

Same height every time, width inflated anywhere from ~10% to ~45% — the signature of a wider
monospace character-advance-width, not a layout or scaling bug. Root cause reproduced
directly inside the container:

```
$ fc-list | wc -l
50
$ fc-match monospace
wqy-zenhei.ttc: "WenQuanYi Zen Hei Mono" "Regular"
$ fc-match 'JetBrains Mono'
wqy-zenhei.ttc: "WenQuanYi Zen Hei Mono" "Regular"
```

The image ships only 50 font files total — Liberation, FreeFont, and WenQuanYi Zen Hei
(a CJK font) — none of `'JetBrains Mono', 'Fira Code', 'Cascadia Code'`, the stack
`.ascii-panel`'s CSS actually requests (`demo/styles.css` and friends). Both the specific
request and the generic `monospace` fallback resolve to the same CJK font family, whose
Latin-glyph advance widths differ substantially from whatever real CI's bare `ubuntu-latest`
+ `playwright install --with-deps chromium` combination resolves to (that side wasn't
independently re-verified here — the already-committed, CI-produced linux baseline stands in
for it, per #326's prior finding that CI's own render is deterministic across retries).

This closely tracks — and, on this evidence, appears to be a *larger* version of — the
font-substitution mismatch #326 already documented for a Docker-vs-CI (not
Docker-arm64-vs-Docker-amd64) comparison: that investigation saw roughly a ~100px/~20% width
inflation on the `-noble` tag; this run saw inflation up to ~45% on the newer `-jammy` tag.
Both point the same direction: **the Docker image's own font package set, not CPU
architecture per se, looks like the dominant variable** for ASCII/terminal samples. This
spike's arm64 run cannot fully separate "it's the container's fonts" from "it's arm64
specifically," since no amd64 container run (emulated or real) was tested for direct
comparison — but #326's independent amd64/`-noble` data point already showed a real,
substantial mismatch too, which weighs against architecture being the primary driver.

### SVG failures: small, marginal, plausibly ordinary rasterization jitter

All 3 SVG failures reported the **same image dimensions** on both sides (no width/height
mismatch) and a pixel-difference ratio of exactly **0.01** — just over the suite's `0.002`
threshold, not a large blowout:

```
165 pixels (ratio 0.01) different.   — Flowchart / Simple Flow
470 pixels (ratio 0.01) different.   — Interactivity: Curved Edges
361 pixels (ratio 0.01) different.   — Interactivity: Step Routing
```

`playwright.config.ts`'s own comments already document that font rasterization has
"genuine run-to-run jitter concentrated on repeated text glyphs" and that CI retries a
failing test twice before calling it real (this container run used `retries: 0`, since
`process.env.CI` wasn't set — a real CI-container run would get 2 retries and might clear
some or all of these). Two of the three failures are on samples with curved/animated SVG
paths (`stroke-dasharray`-heavy edges), which is consistent with anti-aliasing noise on
non-axis-aligned strokes rather than a structural mismatch. This is a much weaker signal than
the ASCII case and shouldn't be over-read as "SVG has an arm64 problem" without a retry-aware
re-run.

## What this means for #544's decision

- **For the ASCII/terminal-panel baseline split**: this data argues against a shared
  container collapsing it. The container's font-fallback behavior disagrees with real CI's
  actual output far more than local native macOS Playwright already does today (which is the
  entire reason the `-darwin`/`-linux` split exists) — adopting the container wouldn't remove
  the split, it would just move which two things disagree. Fixing the container's font
  install (matching whatever font packages CI's bare runner effectively has) is a
  prerequisite before this container could plausibly unify anything for ASCII samples — pure
  arch parity (#546's question) doesn't help if the font set itself is wrong.
- **For the SVG baseline split**: the arm64 container came close (187/190) to matching real
  CI's bare-metal output already, with a failure margin small enough to plausibly be ordinary
  jitter rather than a real mismatch. This is the more promising half of #544's proposal —
  but still needs the real x86-CI-in-container run to confirm the *other* side of the
  comparison actually holds, and to see whether retries clear the 3 borderline failures.
- **Neither half of this is the literal experiment #545 asked for** (identical container on
  both real machines, diffed against each other) — it's identical container on one real
  machine, diffed against the other side's already-existing bare-metal output. That's a
  meaningfully different, weaker claim, flagged throughout this doc rather than blurred.

## Recommendation for closing this spike out

1. A human with push/workflow-dispatch rights to `dfadler/zombie-mermaid` runs the throwaway
   workflow above (or reuses whatever #547 sets up, since it needs a near-identical
   container job anyway) on real `ubuntu-latest`, and compares that artifact's ASCII/SVG
   pass-fail shape against this doc's arm64 numbers (97.8% ASCII fail / 1.6% SVG fail).
   - If the x86 container run shows a similarly high ASCII fail-rate against the *same*
     linux baselines it's nominally supposed to match (i.e., the container disagrees with
     itself/CI even on matching amd64 hardware) — that confirms this is a font-package
     problem, not an arch problem, and #546 (native ARM64 Chromium availability) becomes
     moot for this particular question.
   - If the x86 container run instead matches the linux baselines cleanly — that would mean
     architecture specifically (not just "any container") is the ASCII-mismatch driver here,
     which would be a more surprising and important result worth its own follow-up.
2. Either way, fixing the container's font packages (installing `fonts-jetbrains-mono` or
   pinning an explicit font stack the container definitely has) before drawing further
   conclusions about ASCII/terminal parity would likely change these numbers substantially —
   this spike measured the *stock* image's behavior, not a font-corrected variant.
