# Spike: real CI time cost of a `container:` job vs. current `actions/cache` install

Feeds: [#548](https://github.com/dfadler/zombie-mermaid/issues/548) (decision). Part of
the Docker tracking cluster, [#544](https://github.com/dfadler/zombie-mermaid/issues/544).
Answers [#547](https://github.com/dfadler/zombie-mermaid/issues/547).

**Status of the two halves of this comparison:**

- **Current approach (`actions/cache` + `playwright install`): real, measured** —
  pulled from this repo's own recent CI run history via `gh run view --json jobs`.
- **Container-job approach (`container: image: mcr.microsoft.com/playwright:...`):
  documented estimate, not a measurement.** No `workflow_dispatch` trial was run
  against real CI for this spike. Rationale below.

## Why the container side is an estimate, not a live trial

The issue authorized triggering a real CI run for this, gated on confidence that
doing so is authorized and wise inside an unsupervised, oldest-first backlog sweep
where this agent owns only issue #547. Actions minutes/runners are a shared
resource across the whole repo (and this sweep runs many parallel worktree agents
against the same repo's CI), and a throwaway `workflow_dispatch` trial — even on a
scoped experimental workflow file — still consumes real shared CI capacity and
needs a human's go-ahead to add even a temporary workflow file. Given the issue's
own fallback ("if you're not confident this is authorized ... do NOT trigger real
CI runs"), this spike stays on the documented-estimate path. A follow-up with
explicit human sign-off could still run the real trial the issue describes
(add a scoped `workflow_dispatch`-only workflow, run it a few times cold/warm,
delete it) — that work is not done here.

## 1. Current approach: real measured timing

`.github/workflows/ci.yml`'s `visual-regression` job today (read directly from the
file, not from the issue's summary of it):

- Matrix: 4 shards (`--shard=N/4`), `fail-fast: false`.
- `actions/cache@v4.2.4` keyed on `playwright-chromium-${{ runner.os }}-${{
hashFiles('pnpm-lock.yaml') }}`, caching `~/.cache/ms-playwright`.
- On cache hit: runs `pnpm exec playwright install-deps chromium` (system apt
  packages only — these live outside the cached path and always have to be
  (re)installed regardless of cache state).
- On cache miss: runs `pnpm exec playwright install --with-deps chromium` (full
  browser binary download + system deps).
- Playwright pinned at `1.62.1` (`package.json`), so the CI image being compared
  against is `mcr.microsoft.com/playwright:v1.62.1-jammy`.

Per-shard job timing pulled from 8 recent real runs (`gh run list --workflow=ci.yml
--limit 20 --json databaseId,conclusion,createdAt`, then `gh run view <id> --json
jobs` for shard 1's step timestamps in each), covering both cache states:

| Run ID      | Event        | Cache state | Install step (`Cache Playwright...` → install step end) | Total shard job (`Set up job` → `Complete job`) |
| ----------- | ------------ | ----------- | ------------------------------------------------------- | ----------------------------------------------- |
| 34047581209 | pull_request | **miss**    | 21s                                                     | 55s                                             |
| 34046147560 | pull_request | **miss**    | 26s                                                     | 60s                                             |
| 34047479916 | pull_request | hit         | 12s                                                     | 46s                                             |
| 34043536545 | push (main)  | hit         | 12s                                                     | 43s                                             |
| 34043024628 | push (main)  | hit         | 12s                                                     | 44s                                             |
| 34042546613 | push (main)  | hit         | 28s                                                     | 67s                                             |
| 34048115474 | pull_request | hit         | 12s                                                     | 42s                                             |
| 34041904701 | pull_request | hit         | 12s                                                     | 40s                                             |

Aggregates (small sample, shared noisy runners — treat as indicative, not exact):

- **Cache hit** (6 runs): install step 12–28s (avg ~14.7s); total shard job 40–67s
  (avg ~47s).
- **Cache miss** (2 runs): install step 21–26s (avg ~23.5s); total shard job 55–60s
  (avg ~57.5s).
- Cache hit/miss delta observed here is modest: roughly **+9s** to the install step
  and **+10s** to total job time on a miss, not the large penalty a cold Chromium
  download might suggest — because the dominant, _uncacheable_ cost on both paths is
  the `apt install --with-deps` system-package step, which runs either way.
- All 4 shards start within ~1–2s of each other (no queuing delay observed across
  this sample), so per-shard time is a reasonable proxy for the job's contribution
  to PR wall-clock time; each shard is billed separately regardless.

Only 2 cache-miss samples were found in the last 20 runs (lockfile — and thus the
cache key — rarely changes), so the miss-side numbers here are weaker evidence than
the hit-side numbers; a cache miss happens whenever `pnpm-lock.yaml` changes (e.g. a
Playwright version bump), which is infrequent in this repo's recent history.

## 2. Container-job approach: documented estimate

### Image size (measured directly, not estimated)

```
$ docker manifest inspect mcr.microsoft.com/playwright:v1.62.1-jammy
```

resolves to a multi-arch index; the `linux/amd64` manifest (the one `ubuntu-latest`
runners would actually pull) has 7 layers summing to:

**896,931,706 bytes ≈ 897 MB compressed** (this part is a real, live measurement —
just not a CI _timing_ measurement).

That is **~1.45×** the 618 MB image benchmarked in the blog post cited by #544's
research and by issue #547 itself
([karmacomputing.co.uk](https://blog.karmacomputing.co.uk/make-playwright-faster-with-containers-and-build-caching-github-actions/)),
so its numbers don't transfer 1:1 — they're the best available public data point,
scaled with an explicit, stated assumption below.

### What that post actually measured (real data, different image/repo)

Re-reading the post directly (not just the one number #547 already quoted):

- Caching the container image via `actions/cache` + `docker load`: cache restore
  **17s+**, then `docker load` unpack **+33s**, then container start + test run
  **+17s** — a _slower_ path overall than expected.
- Pulling the image directly (`docker pull` from ghcr.io, no cache) each run: **62s
  total, of which 47s was actual test execution** — implying roughly **~15s** of
  pull + container-start overhead for their 618 MB image.
- The post's own conclusion: for their image, direct pull without caching beat
  caching the image tarball (62s vs. their cached-path total, and comparable to
  their **64s** non-containerized baseline). Caching the raw image did not pay for
  itself.

### Scaling to this repo's image and job

Two official-docs facts bound this estimate:

- GitHub-hosted runners are exempt from Docker Hub's normal pull rate limits ("GitHub-hosted
  runners are not subject to these limits based on an agreement between GitHub and
  Docker" — [GitHub Actions docs: running jobs in a
  container](https://docs.github.com/en/actions/using-jobs/running-jobs-in-a-container)),
  so registry throttling isn't a factor for either MCR (this repo's registry) or
  ghcr.io (the blog's).
- GitHub does **not** publish an actual network-bandwidth figure for hosted
  runners — only a _minimum_ requirement of "at least 70 kilobits per second
  upload and download" ([GitHub Actions docs: about GitHub-hosted
  runners](https://docs.github.com/en/actions/using-github-hosted-runners/about-github-hosted-runners/about-github-hosted-runners)),
  which is far below real-world observed throughput and not usable for an estimate.
  The blog's own measured **76.1 MB/s peak** during its cache-restore download is
  the only concrete throughput figure available and is what this estimate leans on.
- `actions/cache`'s own docs likewise document no restore-speed characteristics —
  size limits (10 GB/repo default) and eviction policy (7-day LRU) only
  ([GitHub Actions docs: caching
  dependencies](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/caching-dependencies-to-speed-up-workflows)).
  There is no official number to compare against; every restore-speed figure in
  this document (this repo's and the blog's) is empirical, not documented.

Assuming pull time scales roughly linearly with compressed image size (a
simplification — real pulls parallelize layer downloads, typically 3–6 concurrent,
so wall-clock time is not a strict linear function of total bytes, and CPU-bound
decompression adds a second, non-network-bound term that doesn't scale the same
way):

- 618 MB → ~15s pull+start overhead (blog's direct-pull figure)
- 897 MB (this repo's image) → **~22s estimated** pull+start overhead (897/618 ×
  15s ≈ 21.8s)

Each of this job's 4 shards is its own fresh runner VM (GitHub Actions jobs each
get "a new virtual machine" — no persistent Docker layer cache carries over
between separate job runs), so this pull cost would be paid **once per shard, per
run**, exactly like the current Playwright-install cost is today — this is an
apples-to-apples per-shard comparison, not a one-time amortized cost.

## 3. Comparison

|                                     | Current (`actions/cache` + install)                | Container job (estimated)                                                                                                                                                 |
| ----------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-shard overhead before tests run | 12–28s (measured: ~14.7s hit avg, ~23.5s miss avg) | ~22s (estimated, ±unknown margin)                                                                                                                                         |
| Data source                         | Real, this repo's own CI history (8 runs)          | Estimated: scaled from one third-party blog benchmark on a different, smaller (618 MB vs. 897 MB) image, pulled from a different registry (ghcr.io vs. mcr.microsoft.com) |
| Confidence                          | High (direct measurement)                          | Low — single external data point, linear-scaling assumption, different registry, no cold/warm split measured for _this_ image                                             |

**Bottom line: the estimated container-job overhead (~22s) lands within the same
range as the current approach's already-measured overhead (12–28s), not clearly
better or worse.** The blog post's own conclusion — that caching the image
tarball was _slower_ than a plain uncached pull, and that the plain pull was
roughly on par with a non-containerized install — is consistent with what this
estimate finds for this repo's larger image: no strong time-cost argument in
either direction from this spike's data alone.

This means #548's decision should weigh other factors from the tracking issue
(cross-platform baseline consistency being the primary motivation — see #544 — not
CI speed) rather than expecting a container job to be a clear speed win. If #548
wants a confident _measured_ number rather than this estimate, the concrete next
step is the real trial #547 originally described: a scoped, temporary
`workflow_dispatch`-only workflow file testing the `container:` approach against
this exact image and job, run a few times cold and warm, with explicit human
sign-off to spend the shared CI capacity — then deleted. That was not done here.

## Appendix: raw commands used

```bash
# Current-approach timing
gh run list --workflow=ci.yml --limit 20 --json databaseId,conclusion,createdAt,headBranch,event
gh run view <id> --json jobs -q '.jobs[] | select(.name | contains("(1, 4)")) | .steps[] | {name, conclusion, startedAt, completedAt}'

# Container image size
docker manifest inspect mcr.microsoft.com/playwright:v1.62.1-jammy
docker manifest inspect mcr.microsoft.com/playwright@sha256:<amd64-digest>
```
