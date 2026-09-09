# Chromium-only Playwright image, built to answer zombie-mermaid#737: does a
# custom image with only the browser this repo actually runs pull measurably
# faster from GHCR than the pinned multi-browser
# `mcr.microsoft.com/playwright:v1.62.1-jammy` image the real
# `visual-regression` CI job uses (docker/visual-regression.Dockerfile,
# consumed by `.github/workflows/ci.yml`'s `container:` key)?
#
# This is an ARTIFACT FOR MEASUREMENT, not a drop-in replacement adopted by
# this PR. See docs/research/737-chromium-only-image-pull-timing.md for the
# actual measured pull-time delta and the resulting recommendation. Per #737's
# own scope, this file and the `visual-regression-chromium.yml` workflow that
# builds/pushes it exist so the measurement could be taken at all - the real
# `visual-regression` job in `.github/workflows/ci.yml` is untouched.
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
# Built and pushed to GHCR by .github/workflows/visual-regression-chromium.yml
# (workflow_dispatch), tagged `visual-regression-chromium-only` so it can
# never collide with or be mistaken for the real multi-browser image tag.
FROM ubuntu:22.04@sha256:281c5745f657873d78e5531fc5ba8575f46ab7769b94550ac99543f122679986

# Linked so the built image shows up under this repo's GHCR packages instead
# of as an anonymous, unattributed package.
LABEL org.opencontainers.image.source="https://github.com/dfadler/zombie-mermaid"
LABEL org.opencontainers.image.description="Chromium-only Playwright image for measuring GHCR pull time (zombie-mermaid#737) - not used by the real visual-regression CI job"

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
# Kept here even though this image is measurement-only, not suite-verified,
# so that IF a real visual-regression trial run against this image is ever
# attempted, it starts from the same font baseline as the image it's being
# compared to rather than a silently different one.
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
