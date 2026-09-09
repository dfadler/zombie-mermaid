# Self-hosted GitHub Actions runner for a warm Docker cache: no-go

## Context

[#738](https://github.com/dfadler/zombie-mermaid/issues/738) asked whether
moving `visual-regression` (or the whole CI workflow) to a **self-hosted**
runner would eliminate the job's repeated container-pull cost, since only a
self-hosted runner can carry a persistent Docker layer cache across separate
job runs — GitHub-hosted runners, including paid "larger runners," are
ephemeral, single-job VMs with no cache that survives between jobs (per
GitHub's own docs; the issue itself corrects an earlier, inaccurate premise
that a larger runner would help).

The issue was filed as a speculative, explicitly low-priority follow-up to
[#729](https://github.com/dfadler/zombie-mermaid/issues/729)'s investigation
into the same job's container-init overhead, at the reporter's request, even
though #729's own conclusion was "not worth pursuing without a concrete
reason." This doc supplies the concrete evaluation #729 didn't do (self-hosted
runners were named there only as an unverified, deferred hypothesis) and
records a real go/no-go rather than leaving the idea open-ended.

### The cost this would address

Real, measured numbers from this repo's own CI history
(`docs/research/ci-container-job-vs-actions-cache-timing.md`,
`docs/research/ci-container-overhead-investigation.md`):

- `visual-regression`'s `container:` step pays a fresh image pull on every
  shard, every run: **~29.5s/shard average** (25–42s range), because each
  shard is its own fresh, ephemeral GitHub-hosted VM.
- The job fans out over a 4-shard matrix, so that's **~92s of extra billed
  Actions-minutes per CI run** (push or PR) versus the pre-container-migration
  cache-hit baseline.
- #729 already checked and ruled out every workflow-level mitigation
  (`actions/cache` for Docker layers, a slimmer custom image, a shard-count
  change) that doesn't require new infrastructure — its stated conclusion was
  that closing the remaining gap needs either a real measurement of a custom
  image's pull time, or a self-hosted runner. This issue evaluates the second
  option.

### What a self-hosted runner actually requires

Per GitHub's own documentation
([about self-hosted runners](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/about-self-hosted-runners)):

- The host "can be physical, virtual, in a container, on-premises, or in a
  cloud," but **you are responsible for updating the operating system and all
  other software** on it, and **you are responsible for the cost of
  maintaining your runner machines.** This is genuinely new, ongoing
  operational surface — not a config change to a YAML file.
- A warm Docker cache requires the host to actually stay up and hold state
  between runs — an always-on (or at minimum, session-persistent) machine,
  not a job-scoped VM.

### The security fact that decides this

Per GitHub's own security hardening guide
([Security hardening for GitHub Actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)):

> "Self-hosted runners should almost never be used for public repositories on
> GitHub, because any user can open pull requests against the repository and
> compromise the environment."

`zombie-mermaid` is a public repository (confirmed via
`gh repo view --json isPrivate,visibility` → `"isPrivate": false,
"visibility": "PUBLIC"`), and `.github/workflows/ci.yml`'s own `test` job
comment already documents that this workflow runs `pull_request`-triggered
jobs against fork-submitted code, relying specifically on GitHub-hosted
runners' per-job ephemeral isolation and the fact that "secrets are not
passed to the runner" for fork PRs. A self-hosted runner has neither
property: it is long-lived (the entire point of "warm cache" is that state
persists across jobs) and it executes the PR's own code — including
`visual-regression`'s Playwright test suite, which is exactly the kind of
code path GitHub's warning is about. Any external contributor opening a PR
against this repo would get arbitrary code execution on a machine the
maintainer owns and is responsible for securing.

This is not a hypothetical/`ubuntu-latest`-adjacent risk that CI's existing
`github.repository == 'dfadler/zombie-mermaid'` fork-of-this-fork guard
mitigates — that guard protects against a *second* fork's own Actions budget,
not against PRs opened *against* this repo, which is exactly the scenario
GitHub's warning names.

## Decision

**No-go.** This is not "not yet" pending a plan — the public-repo security
model makes this a structural blocker, not a scheduling one:

- **The workload this would run on self-hosted infrastructure is untrusted by
  construction.** `visual-regression` runs on every PR, including from
  first-time external contributors on a public repo with zero forks today but
  open to any. GitHub's own guidance is that self-hosted runners should
  "almost never" be used for exactly this shape of repository, and the reason
  given — arbitrary PR-submitted code compromising the host — is precisely
  what this job would execute.
- **The benefit is small relative to the new risk and burden.** ~92s of
  Actions-minutes per run is not a bottleneck: the job's own timeout budget is
  15 minutes, and this repo has no evidence of CI turnaround being a real
  constraint (no queued-run backlog, no contributor complaints, nothing cited
  in #729/#738 beyond the raw timing number itself).
- **There is no owner for the operational burden.** This is a solo-maintainer
  open-source fork with no existing always-on infrastructure, cloud account,
  or on-call capacity mentioned anywhere in this repo's docs. GitHub's docs
  are explicit that OS/software updates and machine costs are the runner
  owner's responsibility, indefinitely, for as long as the runner exists —
  a materially different commitment than a one-time workflow-file change,
  and one #738 itself flagged as ungated ("contingent on this repo's GitHub
  plan and ownership... someone has to own/secure/maintain the host").
- **A scoped workaround (self-hosted only for trusted `push` events on
  `main`, never `pull_request`) was considered and rejected.** It would
  remove the fork-PR attack surface, but it only saves the ~92s cost on
  `main` pushes — the minority of this workflow's runs, since most CI
  executions are PR runs — while still requiring the same always-on host,
  the same ongoing maintenance burden, and now a second, diverging code path
  in `ci.yml` to keep in sync. The savings don't come close to justifying
  that complexity for a job whose acceptance bar (per
  `docs/decisions/playwright-docker-image-visual-regression.md`) was
  cross-platform consistency, not speed, in the first place.

## Consequences

- `.github/workflows/ci.yml` is unchanged by this decision — no self-hosted
  runner is introduced, and `visual-regression` keeps running on GitHub-hosted
  `ubuntu-latest` inside the pinned `container:` image.
- [#738](https://github.com/dfadler/zombie-mermaid/issues/738) is closed by
  this doc's PR as answered: evaluated and rejected, not deferred.
- This closes the remaining open question
  `docs/research/ci-container-overhead-investigation.md` left on the table
  (item 2: "a move to a self-hosted runner... would need its own
  measurement") — no further measurement is warranted, because the blocker
  is a documented security posture, not a number that measurement could move.
- **What would change this:** if this repo's ownership model changes (e.g. a
  second, trusted maintainer takes on host security, or the project moves to
  a private repo, or GitHub ships a genuinely ephemeral self-hosted-runner
  offering that closes the "any user can open pull requests" gap GitHub's own
  docs currently name), the calculus here should be re-run rather than
  assumed permanent. Absent one of those changes, don't re-propose this for
  the same ~92s/run saving — the security fact, not the timing number, is
  what settled it.
- The custom-image-pull-time measurement item
  (`ci-container-overhead-investigation.md`'s item 1: a chromium-only image
  built and pushed to GHCR, timed for real) remains the only still-open,
  infrastructure-free lead for reducing this cost, if anyone wants to pick it
  up later.
