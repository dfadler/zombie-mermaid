# Chromium-only Playwright image for the real `visual-regression` CI job in
# `.github/workflows/ci.yml`'s `container:` key.
#
# Built to answer zombie-mermaid#737: does a custom image with only the
# browser this repo actually runs (`playwright.config.ts` only defines a
# `chromium` project) pull measurably faster from GHCR than the pinned
# multi-browser `mcr.microsoft.com/playwright:v1.62.1-jammy` image
# (docker/visual-regression.Dockerfile) that job used before? Yes - #737
# measured ~36% faster / ~43s saved per 4-shard run (see
# docs/research/737-chromium-only-image-pull-timing.md), and #868 adopted it:
# `ci.yml`'s `visual-regression` job now pins the digest this file builds
# instead of the stock multi-browser tag. #868 also re-ran the full suite
# against this exact image (281/281 passed against the unchanged committed
# baselines - see `ci.yml`'s `visual-regression` job comment for the run
# link) before switching.
#
# Built and published by
# `.github/workflows/visual-regression-chromium-image.yml`, which is now
# `ci.yml`'s real dependency for this image (not just a measurement
# throwaway) - re-dispatch that workflow to publish a new build after
# editing this file, then re-derive and update the digest `ci.yml` pins (see
# that workflow's and job's own comments).
#
# KEEPING THE BASE TAG IN SYNC WITH docker/visual-regression.Dockerfile
#
# This file's `ubuntu:22.04` base and docker/visual-regression.Dockerfile's
# `mcr.microsoft.com/playwright:v1.62.1-jammy` base are two independent pins
# that both encode "v1.62.1, jammy" and must move together: bumping one
# without the other reintroduces the exact Chromium/OS-library skew both
# files exist to prevent. If you bump either base tag, bump the other file's
# base tag (and this file's `playwright@1.62.1` install pin below) to match
# in the same change - docker/visual-regression.Dockerfile's own FROM
# comment carries the same cross-reference back to this file.
#
# WHY THIS CAN'T JUST EXTEND docker/visual-regression.Dockerfile
#
# `docker/visual-regression.Dockerfile`'s FROM, `mcr.microsoft.com/playwright`,
# bakes Chromium, Firefox, and WebKit into the image at build time upstream -
# there is no stock tag or build arg that ships fewer of them (confirmed in
# #729/#733's investigation: the v1.62.1 tag family only varies by OS variant
# and CPU arch, never by browser subset). You cannot subtract already-baked
# browser layers by adding more layers on top; the only way to get a genuinely
# chromium-only image is to start from a browser-less base and install just
# Chromium, which is what this file does.
#
# BASE IMAGE CHOICE
#
# `ubuntu:22.04` (jammy), matching the OS variant of the pinned
# `mcr.microsoft.com/playwright:v1.62.1-jammy` tag this repo already uses, so
# apt package availability (fonts-dejavu-core, below) and glibc/library
# versions stay comparable to the image this is being measured against.
# Pinned by digest for the same reason the real job pins its base by digest
# (docker/visual-regression.Dockerfile's FROM comment, ci.yml's `container:`
# key): reproducible builds, no silent drift.
#
# Node is installed via NodeSource's setup script rather than a Node-branded
# base image because there is no official `node:*-jammy` (Ubuntu) tag - only
# Debian (`-bookworm`/`-bullseye`) and Alpine variants exist - and this
# Dockerfile deliberately matches the Ubuntu jammy base above.
#
# Build (matching the platform you intend to run in CI, linux/amd64):
#   docker build --platform linux/amd64 \
#     -t zombie-mermaid/playwright-visual-chromium:v1.62.1-jammy \
#     -f docker/visual-regression-chromium.Dockerfile .
#
# Built and pushed to GHCR by
# .github/workflows/visual-regression-chromium-image.yml (workflow_dispatch),
# tagged `visual-regression-chromium-only` so it can never collide with or be
# mistaken for the real multi-browser image tag.
FROM ubuntu:22.04@sha256:281c5745f657873d78e5531fc5ba8575f46ab7769b94550ac99543f122679986

# Linked so the built image shows up under this repo's GHCR packages instead
# of as an anonymous, unattributed package.
LABEL org.opencontainers.image.source="https://github.com/dfadler/zombie-mermaid"
LABEL org.opencontainers.image.description="Chromium-only Playwright image for the real visual-regression CI job (zombie-mermaid#868, a #737 follow-up)"

ENV DEBIAN_FRONTEND=noninteractive

# Node 22, matching package.json's "engines".node (>=22) and the "node-version:
# '22'" pin every ci.yml job already uses.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Same path the stock mcr.microsoft.com/playwright image sets. The CI job
# that consumes this image installs the repo's own @playwright/test (from
# node_modules, via `pnpm install`) separately - it does not use this image's
# global `playwright` CLI to run tests, only to pre-download the browser
# binary at build time. Setting PLAYWRIGHT_BROWSERS_PATH here means
# @playwright/test finds the already-installed Chromium at test-run time
# instead of triggering its own download (which would silently reintroduce
# the browser-download step this whole exercise exists to avoid, and wreck
# the pull-time measurement by hiding a slow download inside "test setup").
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Pinned to the exact @playwright/test version in package.json (1.62.1) - the
# same lockstep requirement docker/visual-regression.Dockerfile's base-tag
# comment documents, so this image's Chromium build/revision matches what the
# suite's own @playwright/test expects. `--with-deps` installs Chromium's
# OS-level shared-library dependencies (the same ones the stock
# mcr.microsoft.com/playwright image ships pre-baked) alongside the browser
# itself - Firefox and WebKit, and their own OS deps, are simply never
# requested.
RUN npm install -g playwright@1.62.1 \
    && npx playwright install --with-deps chromium

# Same DejaVu font-parity fix as docker/visual-regression.Dockerfile, for the
# same reason: a bare Ubuntu jammy image's own font set may not resolve the
# generic `monospace`/`sans-serif`/`serif` CSS families the same way real CI's
# `ubuntu-latest` runner does, and the ASCII/terminal suite's box-drawing grid
# is sensitive to exactly that resolution (docs/research/614-docker-font-parity.md).
# This is what makes the real `visual-regression` job's own runtime
# "Verify generic font families resolve to DejaVu" step (ci.yml) pass without
# a runtime `apt-get install` step: the fix (and the assertion below) already
# happened at build time, in this image.
RUN apt-get update \
    && apt-get install -y --no-install-recommends fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/* \
    && fc-cache -f

RUN set -eu; \
    assert_family() { \
        match="$(fc-match -f '%{family}' "$1")"; \
        [ "$match" = "$2" ] || { echo "fc-match $1 resolved to '$match', expected '$2'" >&2; exit 1; }; \
    }; \
    assert_family monospace "DejaVu Sans Mono"; \
    assert_family sans-serif "DejaVu Sans"; \
    assert_family serif "DejaVu Serif"
