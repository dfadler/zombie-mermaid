# Research summary: does Playwright ship a native Linux ARM64 Chromium build?

Status: **spike, not a decision — answered yes.** Written for
[#546](https://github.com/dfadler/zombie-mermaid/issues/546), part of the
[#544](https://github.com/dfadler/zombie-mermaid/issues/544) Docker tracking cluster,
feeding the go/no-go decision in [#548](https://github.com/dfadler/zombie-mermaid/issues/548).

The full write-up — the complete execution log (ELF header bytes, container commands,
dependency-install timing) and the documentation sources checked — lives on the issue
instead of in this repo, since it's a point-in-time research artifact rather than something
future readers need committed alongside the code:
[#546's research comment](https://github.com/dfadler/zombie-mermaid/issues/546#issuecomment-5572655677).
This page is a condensed summary of the same findings.

## Answer

**Yes.** As of Playwright 1.57 (Nov 2025) — and unchanged through this repo's pinned
1.62.1 — Playwright officially ships and installs a native, non-emulated Chromium build for
Linux ARM64. Verified both by reading Playwright's own release notes/docs and by actually
running the pinned Docker image on real Apple Silicon hardware and inspecting the installed
browser binary's ELF header (`e_machine = EM_AARCH64`, not the x86-64 value).

The 2022 report in [microsoft/playwright#11150](https://github.com/microsoft/playwright/issues/11150)
(no arm64 Chrome/Chromium build existed, forcing a Firefox fallback) is **stale** — accurate
for its time, superseded by Playwright's own project history since.

## What was verified by execution (2026-09-06)

Ran directly on this repo's pinned Playwright version (`1.62.1`) using the exact image
referenced in the issue (`mcr.microsoft.com/playwright:v1.62.1-jammy`) on real Apple Silicon
(Docker Desktop's native arm64 Linux VM, not Rosetta):

- The image is genuinely multi-arch (`docker manifest inspect` returns separate
  `linux/amd64` and `linux/arm64` manifests, each with its own digest).
- `--platform linux/arm64` runs natively (`uname -m` → `aarch64` inside the container).
- A Chromium build ships pre-installed in the arm64 image, no install step needed.
- The bundled `chrome` binary is a native AArch64 ELF executable, confirmed by reading its
  ELF header directly.
- This repo's dependency tree (`pnpm install --frozen-lockfile`) installs cleanly on real
  arm64 Linux with no native-binding/architecture errors.
- **This repo's own visual-regression test actually ran, launched Chromium, rendered a real
  sample, and passed**: `svg-samples.visual.test.ts`'s "Simple Flow" flowchart, diffed
  against the already-committed `-chromium-linux.png` baseline (generated on amd64 CI),
  passed within the configured threshold. One passing sample is a positive data point, not
  a substitute for [#545](https://github.com/dfadler/zombie-mermaid/issues/545)'s fuller
  ~280-sample measurement (which has since run — see that issue for the full-suite result).

## What was verified by documentation only

- Playwright's official system requirements list arm64 as a first-class, documented Linux
  target (Debian 12/13, Ubuntu 22.04/24.04/26.04, x86-64 or arm64).
- Playwright's 1.57.0 release notes are the single most decisive source: "Starting with this
  release, Playwright switches from Chromium, to using Chrome for Testing builds. [...] **On
  Arm64 Linux, Playwright continues to use Chromium.**" — a direct, dated, first-party
  statement of an ongoing, distinct arm64 Chromium build.
- No release note between 1.57 and 1.62.1 was found reverting or qualifying that statement.

## Caveats / what this spike does NOT resolve

- **Full-suite pixel parity vs. x86-64 CI is a separate question**, deferred to #545 (now
  answered: see that issue's research comment for the full ~280-sample breakdown).
- This spike didn't audit Firefox or WebKit arm64 support — out of scope, since this repo's
  visual suite is Chromium-only (`playwright.config.ts`'s single `chromium` project).
- Per the 1.57 release notes, arm64 Linux keeps using plain Chromium while other
  platforms — including CI's amd64 runner — moved to Chrome for Testing builds. That's a
  second, structural reason the two architectures' output could diverge, on top of the
  font-substitution issue #545 found and #614 tracks. #545's empirical SVG-pass rate already
  covers the practical impact of this; noted here for the record ahead of #548's decision.

## Sources

- [microsoft/playwright#11150](https://github.com/microsoft/playwright/issues/11150) — original 2022 report (superseded)
- [Playwright system requirements](https://playwright.dev/docs/intro#system-requirements)
- [Playwright Docker docs](https://playwright.dev/docs/docker)
- [Playwright release notes](https://playwright.dev/docs/release-notes)
- [Playwright v1.57.0 GitHub release](https://github.com/microsoft/playwright/releases/tag/v1.57.0) — "On Arm64 Linux, Playwright continues to use Chromium."
- [Chrome for Testing announcement](https://developer.chrome.com/blog/chrome-for-testing/)
- `docker manifest inspect mcr.microsoft.com/playwright:v1.62.1-jammy` (this spike, execution-verified)
