# Font-corrected Playwright image for the visual-regression suite.
#
# Why this layer exists (see docs/research/614-docker-font-parity.md for the
# full measurement):
#
# The stock `mcr.microsoft.com/playwright:v1.62.1-jammy` image ships 50 fonts
# and none of the DejaVu family, so fontconfig resolves the generic CSS
# `monospace` family to `WenQuanYi Zen Hei Mono` — a CJK font that renders
# box-drawing characters (U+2500 etc.) at full width (1em) while rendering
# Latin at half width (0.5em). The ASCII/terminal panel is a character grid
# built entirely out of those box-drawing glyphs, so the grid inflates and
# every `ascii-samples.visual.test.ts` screenshot mismatches the committed
# `-chromium-linux.png` baselines: 88 of 90 failed, all "same height, wider
# width".
#
# `fonts-dejavu-core` is the fix, and it is deliberately NOT
# `fonts-jetbrains-mono`. `.ascii-panel`'s CSS asks for
# `'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace`, but that stack
# never reaches the ASCII text: the panel's markup is
# `<pre class="ascii-output"><code>…</code></pre>`, and Chromium's UA
# stylesheet sets `code { font-family: monospace }` directly on the child.
# A UA rule matching the element itself beats an inherited author value, so
# the `<code>` computes to the bare generic family and only the generic alias
# matters. Installing the named faces instead changes the panel *chrome*
# (`.terminal-title` is a plain `<span>`, so it does pick them up) and made
# the fail rate worse — 90/90 — by shifting titlebar metrics away from the
# baselines. Verified by measurement, not inference.
#
# Real CI (`ubuntu-latest`, bare metal, no font install step) resolves generic
# `monospace` to DejaVu Sans Mono, which is what produced the committed Linux
# baselines. Adding `fonts-dejavu-core` here reproduces that resolution
# exactly and takes the ASCII suite to 90/90 passing against those same
# baselines, with no baseline regeneration.
#
# Build (matching the platform you intend to render on):
#   docker build --platform linux/amd64 \
#     -t zombie-mermaid/playwright-visual:v1.62.1-jammy \
#     -f docker/visual-regression.Dockerfile docker
#
# Run the suite against the committed baselines:
#   docker run --rm -v "$PWD:/work" -w /work \
#     zombie-mermaid/playwright-visual:v1.62.1-jammy \
#     sh -c 'corepack enable && pnpm install --frozen-lockfile && \
#            pnpm exec playwright test'
#
# The base tag is pinned to the `@playwright/test` version in package.json
# (1.62.1) and must be bumped in lockstep with it.
FROM mcr.microsoft.com/playwright:v1.62.1-jammy

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/* \
    && fc-cache -f

# Fail the build if the generic families stop resolving to DejaVu — a silent
# regression here would show up only as ~90 mismatched screenshots later.
RUN set -eu; \
    for generic in monospace sans-serif serif; do \
        match="$(fc-match "$generic")"; \
        case "$match" in \
            DejaVu*) ;; \
            *) echo "fc-match $generic resolved to '$match', expected a DejaVu face" >&2; exit 1 ;; \
        esac; \
    done
