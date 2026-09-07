# Research: font-corrected Playwright Docker image, ASCII/terminal baseline parity

Status: **answered, with a correction to the recommended fix.** Written for
[#614](https://github.com/dfadler/zombie-mermaid/issues/614), part of the
[#544](https://github.com/dfadler/zombie-mermaid/issues/544) Docker tracking cluster.
Closes gap (2) of the two gaps
[docs/decisions/playwright-docker-image-visual-regression.md](../decisions/playwright-docker-image-visual-regression.md)
identified as blocking a real go/no-go in
[#548](https://github.com/dfadler/zombie-mermaid/issues/548).

## TL;DR

- **The font fix works, completely.** A one-package layer on top of the pinned base tag
  takes `ascii-samples.visual.test.ts` from **88/90 failing (97.8%)** to **0/90 failing
  (90 passed)** against the same committed, CI-produced `-chromium-linux.png` baselines —
  no baseline regeneration, no test changes. Reproduced on three consecutive runs.
- **The package is `fonts-dejavu-core`, not `fonts-jetbrains-mono`.** #548's follow-up
  brief proposed installing `fonts-jetbrains-mono` "(or pin whatever exact font stack
  `.ascii-panel` requests)". Measured: installing that stack
  (`fonts-jetbrains-mono fonts-firacode fonts-cascadia-code`) makes the fail rate
  **worse — 90/90** — and leaves the ASCII grid byte-identical to the stock image.
- **Reason: `.ascii-panel`'s font stack never applies to the ASCII text at all.** The
  panel is `<pre class="ascii-output"><code>…</code></pre>`, and Chromium's UA stylesheet
  sets `code { font-family: monospace }` directly on the child. A UA rule matching the
  element itself beats an inherited author value, so the `<code>` computes to the bare
  generic `monospace` — confirmed live via `getComputedStyle`. Only fontconfig's generic
  alias matters; the named faces are irrelevant to the grid.
- **#545's diagnosis was right about the symptom, wrong about the lever.** `fc-match
monospace` → `WenQuanYi Zen Hei Mono` is indeed the cause, but the fix is to make the
  _generic alias_ resolve the way `ubuntu-latest` does, not to supply the named faces the
  CSS asks for.
- **The 88 ASCII failures were essentially all font-fallback.** Nothing structural or
  architecture-specific survives the fix, so the "deeper architecture difference" branch
  is ruled out for the ASCII suite.

## Verification table

| Claim                                                           | Verified how                                                                                                                                    | Confidence                              |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Stock image ships 50 fonts, no DejaVu, `monospace` → WenQuanYi  | `fc-list \| wc -l`, `fc-match monospace` live in the container                                                                                  | High — direct command output            |
| Stock ASCII fail rate is 88/90                                  | Full `ascii-samples.visual.test.ts` run in the stock image vs. committed baselines                                                              | High — reproduced #545 independently    |
| Named-face install makes it worse (90/90)                       | Same run in a `fonts-jetbrains-mono fonts-firacode fonts-cascadia-code` layer                                                                   | High — real run                         |
| `<code>` computes to bare `monospace`                           | `getComputedStyle(code).fontFamily` inside the real harness → `"monospace"` while the parent `<pre>` keeps full stack                           | High — direct measurement               |
| Named faces are never selected for the ASCII text               | CDP `CSS.getPlatformFontsForNode` on `.ascii-output` → only `WenQuanYi Zen Hei Mono`, even with JetBrains Mono installed                        | High — Chromium's own font accounting   |
| `fonts-dejavu-core` takes ASCII to 90/90                        | Three full runs (two ad-hoc, one via the committed Dockerfile)                                                                                  | High — reproduced 3×                    |
| Real CI's baselines were rendered at DejaVu Sans Mono's metrics | Least-squares fit of all 90 committed baselines: `width = 6.7405 × cols + 32.70`; DejaVu Sans Mono is 0.6014em = 6.7355px at the panel's 11.2px | High — fit over the real baseline files |
| SVG suite is unaffected by the font layer                       | Stock and fixed runs land in the same noise band with disjoint failing sets (below)                                                             | Medium — noise-dominated, see caveat    |

Environment: real Apple Silicon Mac, Docker Desktop, base tag pulled **natively as
`linux/arm64`** (`docker image inspect` → `arm64 linux`, in-container `uname -m` →
`aarch64`), commit `f4bf20a`, clean `git archive` snapshot with a container-side
`pnpm install --frozen-lockfile` (no host `node_modules` reused). `retries: 0`, no `CI`
env — matching #545 so the numbers are directly comparable.

> **Pin the platform explicitly.** A bare `docker pull` of the multi-arch tag on this
> host silently retagged the local image to the `linux/amd64` variant mid-spike, which
> then failed every test with an `@esbuild/linux-arm64` vs `linux-x64` error rather than
> a screenshot diff. Always pass `--platform` to both `pull` and `run`.

## Results

### ASCII/terminal — `ascii-samples.visual.test.ts`, 90 tests

| Image                                                          | `fc-match monospace`   | Failed | Passed | Fail rate |
| -------------------------------------------------------------- | ---------------------- | ------ | ------ | --------- |
| Stock `mcr.microsoft.com/playwright:v1.62.1-jammy`             | WenQuanYi Zen Hei Mono | 88     | 2      | **97.8%** |
| \+ `fonts-jetbrains-mono fonts-firacode fonts-cascadia-code`   | WenQuanYi Zen Hei Mono | 90     | 0      | **100%**  |
| \+ `fonts-dejavu-core` (`docker/visual-regression.Dockerfile`) | DejaVu Sans Mono       | **0**  | **90** | **0%**    |

The stock number reproduces #545's 88/90 exactly. Every stock failure is the same shape:
identical height, inflated width, no exceptions.

### Why the named-face install fails

Chromium resolves the font per element, and the ASCII grid lives in a `<code>`:

```
.ascii-output  (the <pre>)  → "JetBrains Mono", "Fira Code", "Cascadia Code", monospace
  └─ <code>    (the text)   → monospace          ← UA stylesheet wins over inheritance
```

So the declared stack styles nothing that matters. What it _does_ style is the panel
chrome — `.terminal-title` is a plain `<span>` and inherits normally — which is why
installing the named faces shifted titlebar metrics and broke the two samples that had
been passing, while leaving the grid byte-identical (the Simple Flow diff was the same
`18352 pixels (ratio 0.28)` before and after).

Measured advances at the panel's `font-size: 0.7rem` (11.2px):

| Font                           | Latin advance | Box-drawing advance (U+2500 etc.) |
| ------------------------------ | ------------- | --------------------------------- |
| WenQuanYi Zen Hei Mono (stock) | 5.5938px      | **11.1875px** — full-width        |
| JetBrains Mono                 | 6.7127px      | 6.7127px                          |
| DejaVu Sans Mono               | 6.7355px      | 6.7355px                          |

The CJK font renders Latin at half-width but box-drawing at full width, so a grid made of
box characters inflates. Simple Flow, 11 columns: `32px padding + 11 × 11.1875 = 155.06`
→ a 156px panel against a 114px baseline.

Fitting all 90 committed Linux baselines gives `width = 6.7405 × cols + 32.70` — i.e. the
baselines were rendered at ~0.6018em, which is DejaVu Sans Mono (0.6014em). The
`-chromium-darwin.png` baselines fit at 0.6008em (macOS `monospace` → Menlo, 0.6023em) and
have **identical widths** to the Linux set on every sample checked, which is why one font
package reconciles the container with CI. (The handful of large fit residuals are narrow
panels whose width is set by the titlebar, not the grid.)

`fonts-dejavu-core` also moves generic `sans-serif` and `serif` off WenQuanYi onto DejaVu
Sans / DejaVu Serif — again matching a stock Ubuntu, so it moves the SVG suite's generic
fallbacks toward CI rather than away from it.

### SVG — `svg-samples.visual.test.ts`, 190 tests

Not conclusive either way, and the font layer is not implicated:

| Image | Run 1     | Run 2      | Run 3    |
| ----- | --------- | ---------- | -------- |
| Stock | 7 failed  | 16 failed  | —        |
| Fixed | 12 failed | 18 failed¹ | 9 failed |

¹ Run under CPU contention with a concurrent container, which `playwright.config.ts`
already documents as a measurable source of screenshot noise.

Every failure in every run is same-dimensions with a `ratio 0.01` diff (threshold 0.002),
and the failing _sets_ are near-disjoint between runs — 3 samples in common between two
runs of the same image. That is the signature of rasterization jitter, not a font change:
the two images' ranges overlap completely. #545's 3/190 sits at the low end of the same
band. Real CI runs `retries: 2`, which would absorb much of this; these runs used
`retries: 0`.

**This does not close gap (1)** — the real x86-container-vs-real-x86-CI data point for the
SVG suite is still missing, and nothing here substitutes for it.

## What this means for #548

Gap (2) is closed, and it closed in the direction the decision hoped for: the ASCII fail
rate collapses to **zero**, well past "something in the suite's normal jitter range". The
decision's stated landing condition —

> If (1) confirms amd64-container SVG output tracks real CI bare-metal within the suite's
> existing tolerance, and (2) shows the font fix collapses the ASCII fail rate […] the
> likely landing point is **partial adopt for SVG samples only**

— is now half-satisfied, but the evidence argues for a **different** shape than that
sentence anticipated. The ASCII suite is the half that is now provably at parity, on a
one-package, deterministic, verified-3× fix. The SVG suite is the half still resting on
noise-band inference and a missing CI data point. If anything the two are the other way
around from the decision's expectation.

Recommendation: **do not re-decide #548 on this alone — but reverse which suite is
treated as the risky one.** Concretely:

1. `docker/visual-regression.Dockerfile` is committed and ready; it needs no further
   research.
2. Gap (1) remains genuinely open and is still the blocker. It should now be run with
   _this_ image rather than the stock tag, and should cover both suites — an x86 CI run of
   the fixed image would simultaneously confirm the ASCII result holds on amd64 (this
   measurement is arm64-only) and supply the SVG data point.
3. A same-arch caveat applies to everything above: the font layer is arch-independent by
   construction (same `apt` package, same TTF), so the ASCII result is very likely to
   transfer, but "very likely" is what gap (1) exists to replace with a measurement.

One incidental finding worth its own issue, independent of Docker: because the `<code>`
child resets to generic `monospace`, **the live demo's ASCII panel does not render in
JetBrains Mono either**, despite `demo/styles.css` asking for it and
`demo/site-shell.ts` loading the web font. Whatever monospace the visitor's browser
defaults to is what they see. That is a real rendering bug in the demo, not a test
artifact.

## Reproducing

```sh
docker build --platform linux/arm64 \
  -t zombie-mermaid/playwright-visual:v1.62.1-jammy \
  -f docker/visual-regression.Dockerfile docker

# Clean snapshot; do not reuse host node_modules (darwin-native binaries).
git archive HEAD | tar -x -C /tmp/zm-snapshot

docker run --rm --platform linux/arm64 -v /tmp/zm-snapshot:/work -w /work \
  zombie-mermaid/playwright-visual:v1.62.1-jammy \
  sh -c 'corepack enable && corepack prepare pnpm@11.13.0 --activate && \
         pnpm install --frozen-lockfile && \
         pnpm exec playwright test __tests__/visual/ascii-samples.visual.test.ts'
```
