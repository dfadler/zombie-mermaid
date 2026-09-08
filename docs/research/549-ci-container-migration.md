# Research: migrating the visual-regression CI job into a pinned Playwright container

Status: **pre-flight evidence gathered; the real experiment is the first CI run of the
changed job.** Written for
[#549](https://github.com/dfadler/zombie-mermaid/issues/549), part of the
[#544](https://github.com/dfadler/zombie-mermaid/issues/544) Docker tracking cluster.
Executes the mandate in the 2026-09-07 amendment to
[docs/decisions/playwright-docker-image-visual-regression.md](../decisions/playwright-docker-image-visual-regression.md),
which unblocked #549 as "the gap-(1) experiment itself, with a declared abort condition
and no authorization to regenerate baselines."

> **Sequencing.** This branch is cut from `issue-614-docker-font-fix` (merged with
> `main`), so it carries `docker/visual-regression.Dockerfile` and
> `docs/research/614-docker-font-parity.md` with it. The 2026-09-07 amendment quoted
> throughout lives on `issue-548-decision-update-614-615` and is **not** merged here —
> if that branch lands after this one, the decision doc in this tree will not yet
> contain the amendment this document cites. #615's research doc
> (`615-emulated-amd64-vs-native-arm64-spike.md`) is likewise on its own branch; it is
> referenced by issue number only, never by path, for that reason. Merge order that
> reads cleanly: #614, then #548, then #549.

## TL;DR

- **The container matches the unchanged baselines.** Three consecutive full-suite runs
  (**281/281 passing each time, 843 executions total**) inside the pinned Playwright
  image with the #614 font layer, diffed against the `-chromium-linux.png` baselines
  exactly as committed on `main`. No baseline was regenerated, altered, or even written
  to — verified by `sha256` over all 562 baseline PNGs before and after.
- **Nothing was absorbed by retries.** These runs set `CI=true`, so
  `playwright.config.ts` applied `retries: 2` and `--disable-gpu` — the flag-matched
  configuration the amendment noted no spike had ever used. **Zero retries were
  consumed**: every test passed on its first attempt, and no `-diff.png`/`-actual.png`
  was produced. The margin is not "green after two retries."
- **The suite could still fail.** A same-session control on the _stock_ image (same
  amd64 digest, no font layer) fails the ASCII suite at the rate #545/#614 measured, so
  a green run here is a discriminating result rather than a test that cannot fail.
- **The workflow uses the stock tag plus an apt step, not a published image.** Actions'
  `container:` key takes an image reference, not a Dockerfile, and one apt package does
  not justify a GHCR image plus a second version pin to keep in sync.
  `docker/visual-regression.Dockerfile` stays as the local-dev artifact (#550) and as
  the written reasoning for the package choice.
- **What this does not prove is unchanged from #615: the host is still Rosetta-on-VZ,
  not a real `ubuntu-latest` runner.** It also exercises none of the GitHub Actions
  container mechanics (image pull, `actions/setup-node` and `actions/cache` inside a
  container, artifact upload from a container). Those are only observable in a real
  run, which is precisely why the amendment scoped #549 as an experiment with an abort
  condition.

## Verification table

| Claim                                                              | Verified how                                                                                                        | Confidence                                       |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| The container executed amd64 code                                  | In-container `uname -m` → `x86_64`; image `.Architecture` → `amd64`; base pinned to the amd64 digest                | High — direct output, printed in every run's log |
| Full suite passes against unchanged baselines                      | 3 × 4 shards, `281 passed` each run, all shards `exit=0`                                                            | High — reproduced 3×                             |
| No retry masked a failure                                          | Zero `retry #` lines and zero `flaky` lines across all 12 shard logs; no `test-results/` directory was ever created | High — retries were enabled and simply unused    |
| No baseline was written or modified                                | `sha256` of all 562 `__screenshots__/*.png` identical before run 1 and after run 3                                  | High — byte-level                                |
| The measured tree is `main`'s tree                                 | `git diff origin/main HEAD -- __tests__/visual playwright.config.ts src demo package.json pnpm-lock.yaml` → empty   | High                                             |
| The suite is capable of failing in this harness                    | Stock-image control (same amd64 digest, no `fonts-dejavu-core`) run in the same session — see "Control" below       | High — direct run                                |
| That real bare-metal `ubuntu-latest` behaves the same              | **Not tested.** The host is Rosetta-on-Virtualization.framework, as in #615                                         | **Not tested**                                   |
| That the Actions `container:` mechanics work (pull, setup-node, …) | **Not tested.** No CI run was dispatched from this environment; `actionlint` clean is the only static check         | **Not tested**                                   |

## Method

Deliberately the same controls as #614/#615, so the intended differences are only the
font layer, the Node pin, and the CI flags:

- **Image**: `mcr.microsoft.com/playwright:v1.62.1-jammy`, amd64 digest
  `sha256:75d2d72c89da49d06aa7f6e623987392019aebbc52c09fd8cd6e2c94c7c7d71d` — the same
  digest #615 measured. Pinning by digest also avoids the multi-arch retagging trap
  #614 documented; the local `:v1.62.1-jammy` tag flipped from amd64 to arm64 partway
  through this session (another concurrent pull), and the digest pin made that a
  non-event.
- **Font layer**: `apt-get install --no-install-recommends fonts-dejavu-core` +
  `fc-cache -f`, plus the Dockerfile's `fc-match` assertion — i.e. exactly the two job
  steps the workflow now runs, rather than a prebuilt image. After it,
  `fc-match monospace` → `DejaVu Sans Mono` (`fc-list | wc -l`: 50 → 56).
- **Node**: 22.23.2, the version `actions/setup-node`'s `node-version: '22'` resolves
  to. The stock image ships Node 24, and SVG/ASCII strings are generated in Node (only
  DOM mounting happens in the browser), so the pin is kept rather than inherited.
- **Tree**: `git archive HEAD` into a scratch directory with a container-side
  `pnpm install --frozen-lockfile` — no host `node_modules` (darwin-arm64 binaries)
  reused. HEAD is this branch, whose render-relevant paths are byte-identical to
  `origin/main` (checked, see table).
- **Flags**: `CI=true`, so `retries: 2` and `--disable-gpu`, at `workers: 2`. The first
  flag-matched comparison in this cluster.
- **Sharding**: all four `--shard=N/4` slices, run sequentially in one container. Real
  CI runs them on four separate runners; sequential execution keeps the CPU budget the
  same as an unsharded run while still exercising the exact `--shard` invocation.
- **Scope**: the full `testDir`, 281 tests — 190 SVG + 90 ASCII + the one
  `sidebar-focus.visual.test.ts` case that every previous spike in this cluster
  omitted.
- **`--update-snapshots` is never passed**, and under `CI=true` Playwright refuses to
  write a missing baseline rather than silently creating one.

Host: Apple Silicon Mac, Docker Desktop 25.0.3, 12 CPUs, `--platform linux/amd64`
served by Rosetta (`/proc/cpuinfo` → `vendor_id: VirtualApple`), `--ipc=host` per
Playwright's Docker guidance.

> **Contention caveat, stated rather than hidden.** Run 1 overlapped with another agent
> session running the #550 ASCII wrapper in a second container on this host (load
> average ~21 on 12 cores) — the same CPU-contention noise source `playwright.config.ts`
> warns about. Runs 2 and 3 ran with the host quiet. All three are identically green,
> which is the useful reading: contention did not perturb the result, and the clean
> runs are simply faster.

## Results

### Three full-suite runs, unchanged baselines

| Run | Shard 1/4        | Shard 2/4         | Shard 3/4        | Shard 4/4        | Total          |
| --- | ---------------- | ----------------- | ---------------- | ---------------- | -------------- |
| 1   | 71 passed (2.1m) | 70 passed (2.1m)  | 70 passed (2.4m) | 70 passed (1.9m) | **281 passed** |
| 2   | 71 passed (1.3m) | 70 passed (1.1m)  | 70 passed (1.1m) | 70 passed (1.1m) | **281 passed** |
| 3   | 71 passed (1.0m) | 70 passed (59.4s) | 70 passed (1.2m) | 70 passed (1.2m) | **281 passed** |

Every shard exited 0. Across all 12 shard runs: **0 failed, 0 flaky, 0 retries
consumed, 0 diff artifacts**.

Run 1's slower times are the contention noted above; runs 2 and 3 put the whole suite
at roughly 4.5 minutes of container time, which is well inside the job's timeout even
before accounting for CI running the four shards in parallel rather than in sequence.

### Baseline integrity

```text
562 files under __tests__/visual/__screenshots__ (281 -chromium-linux, 281 -chromium-darwin)
sha256 manifest before run 1  ==  sha256 manifest after run 3      (diff: empty)
```

Across those three runs no `test-results/` directory was created at all, so no
`-actual.png`, `-diff.png`, or `-expected.png` was written either. (The deliberately
failing control below does create one — and still leaves the baselines untouched.)

### Control: the same harness on the stock image

To confirm the green runs are discriminating rather than vacuous, the ASCII suite was
re-run in the _same session_, from the _same_ amd64 digest, with the only difference
being the absent font layer (`fc-match monospace` → `WenQuanYi Zen Hei Mono`):

| Image (same amd64 digest) | `fc-match monospace`   | ASCII result            | Measured in                 |
| ------------------------- | ---------------------- | ----------------------- | --------------------------- |
| \+ `fonts-dejavu-core`    | DejaVu Sans Mono       | **90 passed, 0 failed** | the 3 sharded runs above    |
| Stock, no font layer      | WenQuanYi Zen Hei Mono | **88 failed, 2 passed** | a dedicated run, 12.4m wall |

(The fixed-image ASCII figure is the 90 `ascii-samples` cases as they fall across the
four shards, not a separate ASCII-only invocation; the control was run on its own
because a failing shard would have stopped the sequence.)

The control produced 264 failure directories under `test-results/` — 88 distinct tests
× 3 attempts, i.e. `retries: 2` was exhausted on every one of them rather than
rescuing any. That is exactly the 88/90 #545 first reported and #614 root-caused,
reproduced here on **amd64** rather than arm64, which independently re-confirms #615's
finding that architecture contributes nothing to the ASCII half.

Two things follow. The font step in the workflow is load-bearing rather than
decorative; and the suite in this harness plainly can fail, so the 843 green
executions above are a discriminating result. (Even the deliberately-failing control
left the baselines byte-identical — `CI=true` keeps Playwright from writing them.)

## The workflow change

`.github/workflows/ci.yml`'s `visual-regression` job, in one sentence: it gains a
`container:` block on the pinned stock Playwright tag, gains two font steps, and loses
the three steps that used to provision Chromium onto a bare runner.

Unchanged, deliberately: the 4-way `--shard` matrix and `fail-fast: false`, the
`persist-credentials: false` checkout, the failure-artifact upload, the
`GITHUB_STEP_SUMMARY` write-up, the fork guard, `runs-on: ubuntu-latest`, and
`pnpm`/Node 22 setup.

Changed:

| Before                                                 | After                                                     |
| ------------------------------------------------------ | --------------------------------------------------------- |
| `actions/cache` on `~/.cache/ms-playwright`            | removed — the image carries the browser                   |
| `playwright install --with-deps chromium` (cache miss) | removed                                                   |
| `playwright install-deps chromium` (cache hit)         | removed                                                   |
| —                                                      | `apt-get install fonts-dejavu-core` + `fc-cache -f`       |
| —                                                      | `fc-match` assertion for `monospace`/`sans-serif`/`serif` |
| `timeout-minutes: 10`                                  | `timeout-minutes: 15`                                     |

Two choices worth stating explicitly:

- **Stock tag + apt step, not a GHCR image.** Actions' `container:` key takes an image
  reference, not a Dockerfile, so `docker/visual-regression.Dockerfile` cannot be
  consumed at the job level. Publishing it would add a registry, a build workflow, and
  a second pin to keep in lockstep with `@playwright/test` — for a single apt package
  whose effect is asserted in-job anyway. The amendment named this as the cheaper path;
  the measurement above used the apt-step form, so it is also the form that was
  actually tested.
- **`timeout-minutes` 10 → 15.** The job clock now includes GitHub's "Initialize
  containers" phase (a ~2.3GB pull on a cold runner). Dropping the browser
  download/extract offsets that, but a first-run timeout would muddy the very
  experiment this job is, so the headroom is deliberate.

No `--user 1001` (which Playwright's own Actions example uses): the font step needs
root. `--ipc=host` is set, per Playwright's Docker page —
[playwright.dev/docs/docker](https://playwright.dev/docs/docker) states it is
"recommended when using Chromium" because "without it, Chromium can run out of memory
and crash."

## What would falsify this, and what to do then

The amendment's abort condition applies verbatim, and the job's own comments now carry
it so it survives without this document:

> Acceptance bar: the full visual suite passes inside the container job against
> **unchanged** committed baselines. If it doesn't, revert and re-decide here — do not
> regenerate baselines to close the gap.

Concretely, if the first real CI run of this job goes red:

1. **Check the `fc-match` step first.** If it failed, the font install did not take
   effect and the ~90 ASCII mismatches downstream are an image problem, not a renderer
   regression.
2. **If ASCII is green and SVG is not**, that is the gap-(1) answer coming back
   negative: Rosetta-amd64 is not a good enough proxy for bare-metal `ubuntu-latest`,
   and the evidence above says so. Revert the job to its bare-runner form and record
   the result in the decision doc.
3. **Do not regenerate baselines in either case.** They are the measuring instrument
   for every result in the #544 cluster; a regenerated set makes the container green by
   destroying the thing that could have said otherwise.

## Reproducing

```sh
# Pin by digest, not by tag — the multi-arch tag can retag itself locally.
docker build --platform linux/amd64 -t zm-549-verify:jammy - <<'DOCKERFILE'
FROM mcr.microsoft.com/playwright@sha256:75d2d72c89da49d06aa7f6e623987392019aebbc52c09fd8cd6e2c94c7c7d71d
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/* && fc-cache -f
RUN set -eu; for g in monospace sans-serif serif; do case "$(fc-match "$g")" in DejaVu*) ;; *) exit 1 ;; esac; done
ARG NODE_VERSION=22.23.2
RUN curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.gz" -o /tmp/n.tgz \
    && tar -xzf /tmp/n.tgz -C /usr/local --strip-components=1 && rm /tmp/n.tgz
DOCKERFILE

# Clean snapshot; do not reuse host node_modules (darwin-native binaries).
mkdir -p /tmp/zm-snapshot && git archive HEAD | tar -x -C /tmp/zm-snapshot

docker run --rm --platform linux/amd64 --ipc=host -v /tmp/zm-snapshot:/work -w /work \
  zm-549-verify:jammy \
  sh -c 'corepack enable && corepack prepare pnpm@11.13.0 --activate && \
         pnpm install --frozen-lockfile && \
         for i in 1 2 3 4; do CI=true pnpm exec playwright test --shard="$i/4" || exit 1; done'
```

Swap the `FROM` for the bare digest with no font layer to reproduce the control.
