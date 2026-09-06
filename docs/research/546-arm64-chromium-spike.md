# Spike: does Playwright ship a native Linux ARM64 Chromium build?

Status: **spike, not a decision.** Written for [#546](https://github.com/dfadler/zombie-mermaid/issues/546),
part of the Docker tracking cluster ([#544](https://github.com/dfadler/zombie-mermaid/issues/544)),
feeding the go/no-go decision in [#548](https://github.com/dfadler/zombie-mermaid/issues/548).

## Answer

**Yes.** As of Playwright 1.57 (Nov 2025) — and unchanged through this repo's
pinned 1.62.1 — Playwright officially ships and installs a native, non-emulated
Chromium build for Linux ARM64. This was verified both by reading Playwright's
own release notes/docs and by actually running the pinned Docker image on real
Apple Silicon hardware and inspecting the installed browser binary's ELF header.

The 2022 report in [microsoft/playwright#11150](https://github.com/microsoft/playwright/issues/11150)
(no arm64 Chrome/Chromium build existed, forcing a Firefox fallback) is now
**stale**. It was accurate for its time but has been superseded by Playwright's
own project history since.

**Mac contributors can run this repo's visual suite natively (arm64, no
emulation) inside a Playwright Docker image today: yes.** Not only does
Chromium launch and render natively — a real sample from this repo's own
suite (`renders Flowchart / Simple Flow`) was run inside the arm64 container
and **passed** its `toHaveScreenshot` comparison against the existing
amd64-CI-generated Linux baseline outright (see execution log below). That is
one data point, not a full measurement — whether this holds across the whole
~280-sample suite, especially text-dense samples where this repo's own
`playwright.config.ts` comments already flag the most rasterization jitter, is
the fuller question [#545](https://github.com/dfadler/zombie-mermaid/issues/545)
is scoped to answer. This spike only guarantees Chromium _launches and renders_
natively on arm64 and gives one encouraging data point on pixel parity — it is
not a substitute for #545's broader measurement.

## What was verified by execution (this spike, 2026-09-06)

Ran directly on this repo's pinned Playwright version, `1.62.1` (`package.json`
`@playwright/test`), using the exact image referenced in the issue:
`mcr.microsoft.com/playwright:v1.62.1-jammy`. Host: Apple Silicon Mac
(`uname -m` → `arm64`), Docker Desktop with a native arm64 Linux VM (not Rosetta).

1. **The image is genuinely multi-arch**, not a single-arch image relying on
   emulation to serve arm64 requests:

   ```
   $ docker manifest inspect mcr.microsoft.com/playwright:v1.62.1-jammy
   ```

   returned two platform manifests — `linux/amd64` and `linux/arm64` — each
   with its own digest.

2. **`--platform linux/arm64` runs natively**, confirmed via:

   ```
   $ docker run --rm --platform linux/arm64 mcr.microsoft.com/playwright:v1.62.1-jammy uname -m
   aarch64
   ```

3. **A Chromium build ships pre-installed in the arm64 image**, without
   running any install step:

   ```
   $ docker run --rm --platform linux/arm64 mcr.microsoft.com/playwright:v1.62.1-jammy \
       sh -c "ls /ms-playwright"
   chromium-1234
   chromium_headless_shell-1234
   ffmpeg-1011
   firefox-1538
   webkit-2336
   ```

4. **The bundled `chrome` binary is a native AArch64 ELF executable**, not an
   x86-64 binary requiring emulation — confirmed by reading its ELF header
   directly:

   ```
   $ docker run --rm --platform linux/arm64 mcr.microsoft.com/playwright:v1.62.1-jammy \
       sh -c "od -An -tx1 -j 0 -N 20 /ms-playwright/chromium-1234/chrome-linux/chrome"
    7f 45 4c 46 02 01 01 00 00 00 00 00 00 00 00 00
    03 00 b7 00
   ```

   Bytes 18–19 (`e_machine`, little-endian) are `b7 00` = `0x00b7` = 183 =
   `EM_AARCH64`. (For comparison, x86-64 would read `3e 00`.) This is
   unambiguous: the shipped binary is compiled for AArch64, not amd64 running
   under QEMU translation.

5. **This repo's own dependency tree installs cleanly on real arm64 Linux**:
   ran `corepack enable && corepack prepare pnpm@11.13.0 --activate && pnpm
install --frozen-lockfile` against this repo's actual `pnpm-lock.yaml`
   inside the container (bind-mounted worktree, `--platform linux/arm64`).
   Completed in 2m35s with no native-binding/architecture errors (this repo
   has no `sharp`/`canvas`-style native dependency, so this was expected, but
   worth confirming — arm64 optional-dependency variants of `esbuild`/`rollup`
   were correctly resolved and installed).

6. **This repo's own visual-regression test actually ran, launched Chromium,
   rendered a real sample, and passed**, using the exact suite and pinned
   version referenced in the issue:

   ```
   $ npx playwright test __tests__/visual/svg-samples.visual.test.ts \
       --project=chromium --grep 'Simple Flow' --reporter=line

   Running 1 test using 1 worker
   [1/1] [chromium] › svg-samples.visual.test.ts:51:5 › gallery samples (samples-data.ts) › renders Flowchart / Simple Flow
     1 passed (23.2s)
   ```

   This ran the repo's real `renderMermaidSVG` output through a real Chromium
   page (`page.setContent` + the harness script), took a real
   `toHaveScreenshot` screenshot, and diffed it against the already-committed
   `-chromium-linux.png` baseline (generated on amd64 CI) — and it **passed**
   within the configured threshold (0.4 / 0.002 max diff ratio, see
   `playwright.config.ts`). That's a stronger result than this spike set out
   to prove: not just "Chromium launches on arm64" but "at least one real
   sample's arm64-native screenshot passed the existing amd64-baseline diff
   check outright." One passing sample is not a substitute for #545's fuller
   measurement across the ~280-sample suite (font/rasterization drift can be
   sample-dependent — text-dense samples are called out in this repo's own
   `playwright.config.ts` comments as the most jitter-prone), but it is a
   positive data point for that question, not just this one.

## What was verified by documentation only

- **Playwright's own official system requirements** (playwright.dev/docs/intro,
  fetched 2026-09-06) state: "Debian 12 / 13, Ubuntu 22.04 / 24.04 / 26.04
  (x86-64 or arm64)" as supported Linux targets — arm64 is a first-class,
  documented target, not an unsupported side path.
- **Playwright 1.57.0 release notes** (fetched via `gh api
repos/microsoft/playwright/releases/tags/v1.57.0`, published 2025-11-25) are
  the single most decisive source found:

  > Starting with this release, Playwright switches from Chromium, to using
  > [Chrome for Testing](https://developer.chrome.com/blog/chrome-for-testing/)
  > builds. Both headed and headless browsers are subject to this. [...]
  > **On Arm64 Linux, Playwright continues to use Chromium.**

  This is a direct, dated, first-party statement that Playwright maintains a
  distinct, ongoing Chromium build specifically for arm64 Linux — strong
  evidence against the "no arm64 Chromium build" claim, and current as of a
  release two minor versions after this repo's pin (1.57 → this repo pins
  1.62.1).

- No Playwright release note between 1.57 and 1.62.1 was found reverting or
  qualifying that arm64-Chromium statement (checked via
  `playwright.dev/docs/release-notes`, general web search for
  "Playwright Chromium Linux arm64 native build 2026 support", and GitHub's
  release list) — search results independently describe arm64 Linux
  continuing to use a Chromium build model matching the 1.57 announcement.
- `microsoft/playwright#11150` (2022) itself is closed; the original report
  (no Chrome/Chromium build for Ubuntu arm64) reflects the _pre-1.57_, and in
  fact pre-dates-by-years, landscape. No content in the issue thread itself
  was fetchable beyond the opening post via WebFetch (GitHub comment threads
  render via JS), so its resolution comments could not be quoted directly —
  the 1.57 release note is treated as the authoritative supersession instead
  of relying on that thread's own "resolved" status.

## Caveats / what this spike does NOT resolve

- **Full-suite pixel parity vs. x86-64 CI is a separate question**, explicitly
  deferred to #545. One sample (`Simple Flow`, a sparse flowchart) passing the
  existing diff threshold is a positive but limited data point — it does not
  establish that all ~280 samples would, particularly the text-dense ones
  this repo's own config comments flag as most jitter-prone. Do not read this
  spike's single passing test as resolving #545.
- This spike used the _default_ Chrome for Testing / Chromium switch behavior
  documented for 1.57. It did not audit Firefox or WebKit arm64 support (out
  of scope — this repo's visual suite is Chromium-only per
  `playwright.config.ts`'s single `chromium` project).
- The `mcr.microsoft.com/playwright:v1.62.1-jammy` image was already present
  locally in the test environment's Docker cache when the multi-arch check
  ran; the pull itself (~2.5 GB, confirmed via `docker images`) was verified
  fresh via `docker run ... uname -m` triggering a real pull on first use in
  this session, so the "arm64 manifest exists and is pullable" claim is
  execution-verified, not just read from `docker manifest inspect`.

## Sources

- [microsoft/playwright#11150](https://github.com/microsoft/playwright/issues/11150) — original 2022 report (superseded)
- [Playwright system requirements](https://playwright.dev/docs/intro#system-requirements)
- [Playwright Docker docs](https://playwright.dev/docs/docker)
- [Playwright release notes](https://playwright.dev/docs/release-notes)
- [Playwright v1.57.0 GitHub release](https://github.com/microsoft/playwright/releases/tag/v1.57.0) — "On Arm64 Linux, Playwright continues to use Chromium."
- [Chrome for Testing announcement](https://developer.chrome.com/blog/chrome-for-testing/)
- `docker manifest inspect mcr.microsoft.com/playwright:v1.62.1-jammy` (this spike, execution-verified)
