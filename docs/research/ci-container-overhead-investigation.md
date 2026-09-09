# Investigation: reducing `visual-regression`'s container init overhead

Answers [#729](https://github.com/dfadler/zombie-mermaid/issues/729), a follow-up to
the real timing numbers `docs/research/ci-container-job-vs-actions-cache-timing.md`
(§4) recorded for the `visual-regression` job's `container:` step after PR
[#651](https://github.com/dfadler/zombie-mermaid/pull/651)'s migration
(container init 25–42s, avg ~29.5s/shard; total shard wall-clock 62–90s, avg
~70.5s/shard, sampled from 10 `main` push runs). Part of the Docker tracking
cluster, [#544](https://github.com/dfadler/zombie-mermaid/issues/544).

## TL;DR

**No config-level or workflow change closes this gap without giving up something
the migration was for, or adding new infrastructure this repo doesn't have.**
Every candidate below was checked against this repo's actual setup (not assumed),
and each is blocked by a concrete, cited fact rather than a guess. No workflow
change is made by this issue; the job in `.github/workflows/ci.yml` is unchanged.
The ~29.5s/shard container-init cost is the price of pulling a ~900MB
multi-browser image fresh onto an ephemeral VM, which is inherent to running
this job as a GitHub-hosted `container:` job at all — not a misconfiguration.

## What was checked

### 1. A smaller/slimmer official Playwright image variant

**Not available.** The pinned tag family (`v1.62.1`) publishes only
OS-variant × architecture tags — `jammy` / `noble` / `resolute`, each in
`amd64`/`arm64` — no browser-subset ("chromium-only") variant exists on
`mcr.microsoft.com/playwright`. Confirmed by pulling the full tag list from the
registry directly rather than guessing:

```
$ curl -sS https://mcr.microsoft.com/v2/playwright/tags/list | jq ...
v1.62.1, v1.62.1-amd64, v1.62.1-arm64, v1.62.1-jammy, v1.62.1-jammy-amd64,
v1.62.1-jammy-arm64, v1.62.1-noble, v1.62.1-noble-amd64, v1.62.1-noble-arm64,
v1.62.1-resolute, v1.62.1-resolute-amd64, v1.62.1-resolute-arm64
```

Every tag ships Chromium, Firefox, and WebKit together — this repo's
`playwright.config.ts` only runs the `chromium` project (line 58), so roughly
two-thirds of the browser payload in every pull is unused. The pinned amd64
`jammy` manifest (`sha256:75d2d72c...`, the exact digest in `ci.yml`) has 7
layers totaling **896,931,706 bytes (~897MB) compressed**, per its manifest —
not the ~2.3GB figure the job's own comment cites (that appears to be an
uncompressed/on-disk estimate; either way it's a sizable pull for a fresh VM).

A custom image built from `docker/visual-regression.Dockerfile` with only
`chromium` installed (`npx playwright install --with-deps chromium`) would cut
some of that, but:

- It would have to be built and pushed somewhere (GHCR), which is new
  infrastructure this repo doesn't have today — no workflow in
  `.github/workflows/` builds or pushes any image, and `ci.yml`'s own comment
  (the block just above the `container:` key) already weighed and rejected
  publishing an image for a much smaller reason (one apt package for font
  parity). Re-deciding that for a bigger reason is a legitimate future option,
  but it is not a low-risk, one-PR config change — it reopens exactly the kind
  of "does the custom image still match the committed baselines" question that
  took three issues (#545, #614, #615) and a full decision doc
  (`docs/decisions/playwright-docker-image-visual-regression.md`) to answer for
  the _current_ image. That verification burden belongs to a dedicated issue
  under #544, not this one, if it's pursued at all.
- The savings are speculative and likely partial: much of the ~897MB is shared
  OS/browser-dependency layers (X11, Mesa/GL software rendering, fonts, NSS,
  etc.) that Chromium itself also needs, not pure Firefox/WebKit weight.

### 2. GitHub Actions' built-in Docker layer caching

**Not available for `container:` jobs on GitHub-hosted runners, confirmed two
ways:**

- The [official docs page for `container:` jobs](https://docs.github.com/actions/using-jobs/running-jobs-in-a-container)
  documents no image-caching mechanism at all — the only pull-related note is
  that GitHub-hosted runners are exempt from Docker Hub rate limits, nothing
  about speed or caching.
- Mechanically, the job's container image is pulled by the Actions runner
  _before_ any step in the job runs — including a hypothetical `actions/cache`
  restore step — so `actions/cache` structurally cannot intercept or shortcut
  that pull. This is also why no first-party `actions/cache`-based solution
  exists for this; the third-party workarounds that do exist (e.g. the
  "Docker Cache" and "Docker Layer Caching" Marketplace actions) work by
  `docker save`/`docker load`-ing a tarball through `actions/cache` themselves,
  which moves comparable byte counts through the same cache-blob-storage path
  and is not a proven net win for a ~900MB image — and would still be new,
  unverified infrastructure for the same one-PR-low-risk reason as option 1.
- There is also no runner-side image pre-cache to lean on: `ubuntu-latest`
  currently resolves to Ubuntu 24.04 (per
  [actions/runner-images' README](https://github.com/actions/runner-images)),
  and that image's own
  [toolset manifest](https://github.com/actions/runner-images/blob/main/images/ubuntu/toolsets/toolset-2404.json)
  lists no pre-cached Docker images at all (only the Docker engine/CLI/buildx/
  compose components themselves) — consistent with
  [actions/runner-images#12625](https://github.com/actions/runner-images/issues/12625),
  which confirms 24.04 dropped the preloaded-image set earlier Ubuntu runner
  images had. So even a generic image wouldn't get a "free" warm pull here,
  let alone a specialized ~900MB one that was never on that list to begin with.

### 3. `docker pull --platform` pin / self-hosted-runner pre-pull

**Not applicable — this repo has no self-hosted runners.** Every job in every
workflow under `.github/workflows/` uses `runs-on: ubuntu-latest`:

```
$ grep -rn "runs-on:" .github/workflows/*.yml
# every match is ubuntu-latest across ci.yml, dashboard-refresh.yml,
# fork-fixes-nudge.yml, form-judge-weekly.yml, pages.yml, publish.yml,
# upstream-check.yml
```

A self-hosted runner is the one setup where a warm local Docker cache would
carry over between jobs — GitHub-hosted runners are fresh, single-job VMs, so
there's no persistent Docker cache to pre-warm even in principle. The
`container:` key's `image:` is already pinned by digest to the single amd64
manifest matching `ubuntu-latest`'s architecture (see the comment above it in
`ci.yml`), so there's no fat-manifest-list resolution overhead either — that
part is already as tight as it gets without a different runner architecture.

### 4. Reducing shard count vs. per-shard init overhead

**The math doesn't clearly favor a change, so none is made.** From the sampled
data: total shard wall-clock avg ~70.5s, of which container init is ~29.5s —
the remaining ~41s covers checkout, the font-install/verify steps,
`pnpm install`, and the shard's slice of the Playwright run.

- **Fewer, larger shards** (e.g. 4 → 2) pays container init only twice instead
  of four times per run (lower total billed Actions-minutes), but each
  remaining shard now runs roughly double the test slice — wall-clock per
  shard rises to somewhere near 29.5s + ~82s ≈ 112s, which _increases_ the
  time a PR waits on this check, trading a minutes-billed win for a slower
  feedback loop. That's the wrong direction for a CI check most PRs wait on.
- **More, smaller shards** (e.g. 4 → 8) could lower the per-shard test slice
  toward ~20s, pulling the wall-clock ceiling down toward ~50s, but doubles
  the number of container inits paid for in the run (8 × ~29.5s ≈ 236s of
  billed compute vs. today's 4 × ~29.5s ≈ 118s) for a shrinking marginal gain,
  since the ~29.5s init floor doesn't shrink with more shards — at some shard
  count the job is _all_ init overhead and no amount of further sharding
  helps. It also uses more concurrent runner slots per run.

Neither direction is an unambiguous win, and the issue this doc answers is
explicit that shard count shouldn't move without the math clearly favoring it.
It doesn't here, so shard count is left at 4.

## Why the container migration still stands

None of the above reopens whether the container job itself was the right call.
Per `docs/decisions/playwright-docker-image-visual-regression.md`'s 2026-09-07
amendment, the migration's purpose was cross-platform rendering
parity/consistency (ASCII font-fallback and SVG baseline stability across
architectures — #545/#614/#615), not speed; §4 of the timing doc this issue
follows up on already says as much. This investigation only asked "can the
_speed cost_ of that decision be reduced," and the answer, checked rather than
assumed, is: not without either infrastructure this repo doesn't have
(self-hosted runners, a published custom image with its own re-verification
burden) or a shard-count tradeoff that doesn't clearly pay for itself.

## If this gets revisited

Two things would change this conclusion, and both are bounded, closeable
follow-ups rather than more speculation:

1. **A real measurement of a chromium-only custom image's actual pull time**,
   built and pushed to GHCR, timed the same way the current job was
   (`gh run view --json jobs` over several real runs) — not estimated from
   layer sizes. This is the same "measure, don't infer" standard
   `ci-container-job-vs-actions-cache-timing.md` and the font-parity spikes
   (#545/#614/#615) already held themselves to. Until that number exists, "a
   smaller image would probably help" stays a guess, not a decision input.
2. **A move to a paid GitHub-hosted "larger runner" or a self-hosted runner**,
   either of which can carry a warm Docker cache across jobs — out of scope
   for a workflow-file-only, no-new-infrastructure change, and contingent on
   this repo's GitHub plan/ownership decisions, not something to assume here.
