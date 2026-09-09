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
Four candidates were checked against this repo's actual setup (not assumed) —
a slimmer official Playwright image, GitHub Actions' built-in Docker layer
caching, self-hosted-runner pre-pull, and a shard-count change — and each is
blocked by a concrete, cited fact rather than a guess. No workflow change is
made by this issue; the job in `.github/workflows/ci.yml` is unchanged. The
~29.5s/shard container-init cost is the price of pulling a ~900MB
multi-browser image fresh onto an ephemeral VM, which is inherent to running
this job as a GitHub-hosted `container:` job at all — not a misconfiguration.

Full investigation notes (per-candidate evidence, citations, and the shard-count
math) are recorded in
[the #729 issue comment](https://github.com/dfadler/zombie-mermaid/issues/729#issuecomment-5598686719)
rather than duplicated here.

## Why the container migration still stands

None of the above reopens whether the container job itself was the right call.
Per `docs/decisions/playwright-docker-image-visual-regression.md`'s 2026-09-07
amendment, the migration's purpose was cross-platform rendering
parity/consistency (ASCII font-fallback and SVG baseline stability across
architectures — #545/#614/#615), not speed. This investigation only asked
"can the _speed cost_ of that decision be reduced," and the answer, checked
rather than assumed, is: not without either infrastructure this repo doesn't
have (self-hosted runners, a published custom image with its own
re-verification burden) or a shard-count tradeoff that doesn't clearly pay
for itself.

## If this gets revisited

Two things would change this conclusion, and both are bounded, closeable
follow-ups rather than more speculation — see the linked issue comment for
detail:

1. A real measurement of a chromium-only custom image's actual pull time,
   built and pushed to GHCR, timed the same way the current job was — not
   estimated from layer sizes.
2. A move to a paid GitHub-hosted "larger runner" or a self-hosted runner,
   either of which can carry a warm Docker cache across jobs.
