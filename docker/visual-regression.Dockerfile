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
# Run the suite against the committed baselines (ASCII, SVG, or both):
#   scripts/docker-test-visual.sh
#
# That wrapper is the supported entry point, not a raw `docker run` of this
# image: this image has no `USER` instruction, so it runs as root by default,
# and bind-mounting the checkout with `-v "$PWD:/work"` under a root-run
# container writes root-owned node_modules/test-results/report files back
# onto the host. The wrapper instead runs the container as the invoking
# UID/GID (`docker run --user "$(id -u):$(id -g)"`) against a synced copy
# outside the repo, so nothing it writes is root-owned and the checkout
# itself is never mounted read-write. If you do need a raw `docker run`
# (e.g. to poke around inside the image), pass `--user "$(id -u):$(id -g)"`
# and an `-e HOME=...` pointing at a writable directory, as the wrapper does.
#
# The base tag is pinned to the `@playwright/test` version in package.json
# (1.62.1) and must be bumped in lockstep with it.
#
# KEEPING THIS IN SYNC WITH docker/visual-regression-chromium.Dockerfile: that
# file's `ubuntu:22.04` base and `playwright@1.62.1` install pin encode the
# same "v1.62.1, jammy" version this tag does, so the real `visual-regression`
# CI job (which now runs on docker/visual-regression-chromium.Dockerfile's
# published image, not this one - see zombie-mermaid#868) stays in lockstep
# too. If you bump this tag, bump that file's base/version pins to match in
# the same change, then re-publish and re-pin the digest `ci.yml` uses (see
# that file's and .github/workflows/visual-regression-chromium-image.yml's
# own comments).
FROM mcr.microsoft.com/playwright:v1.62.1-jammy

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/* \
    && fc-cache -f

# Fail the build if the generic families stop resolving to DejaVu — a silent
# regression here would show up only as ~90 mismatched screenshots later.
# Exact family match, not a `DejaVu*` glob: fonts-dejavu-core installs DejaVu
# Sans (proportional), DejaVu Serif, and DejaVu Sans Mono together, so a glob
# would also accept the proportional "DejaVu Sans" face for the `monospace`
# generic — silently defeating this guard if `monospace` ever misresolved to
# it, since the ASCII grid needs an actually-monospaced font.
RUN set -eu; \
    assert_family() { \
        match="$(fc-match -f '%{family}' "$1")"; \
        [ "$match" = "$2" ] || { echo "fc-match $1 resolved to '$match', expected '$2'" >&2; exit 1; }; \
    }; \
    assert_family monospace "DejaVu Sans Mono"; \
    assert_family sans-serif "DejaVu Sans"; \
    assert_family serif "DejaVu Serif"
