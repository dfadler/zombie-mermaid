# Holding queued major PRs without staleness

Status: proposal

Tracks [#1940](https://github.com/dfadler/zombie-mermaid/issues/1940), a
follow-up to [#1925](https://github.com/dfadler/zombie-mermaid/issues/1925) and
[#1757](https://github.com/dfadler/zombie-mermaid/issues/1757). This doc
proposes; it changes no policy, release config or CI. Everything in the
"Maintainer questions" section is the maintainer's call.

## Context

[`versioning-and-deprecation-policy-1568.md`](versioning-and-deprecation-policy-1568.md)
(section 3) allows at most one major per 30 days. `docs/RELEASING.md`
("Batching majors") implements the hold by hand: a PR with a `major` changeset
gets the `breaking` label, stays open, and is kept green and current with
`main` (merge `main` in, do not rebase) until the gate opens. The reason it is
a held PR and not a merged one: Changesets has no way to keep a merged
changeset out of the Version Packages PR, so a merged major would publish.
Lockstep versioning ([`lockstep-versioning.md`](lockstep-versioning.md)) means
that major is a major for all seven packages in the `fixed` group.

The issue asked for a decision "after the first real queued major (or if two
are ever queued at once)" and said "no breaking PR is queued today". Both
premises have moved. Facts checked on 2026-10-29:

- **One major is queued.** [#2119](https://github.com/dfadler/zombie-mermaid/pull/2119)
  (draft, `breaking`, `feat(ascii)!: maxWidth hard limit`, closes
  [#2057](https://github.com/dfadler/zombie-mermaid/issues/2057)). Opened
  2026-10-15, last updated the same day. It is the only open PR with the
  `breaking` label.
- **It is already stale.** `origin/main` is 706 commits ahead of the branch,
  and `git merge-tree origin/main origin/feat/2057-ascii-max-width` reports
  content conflicts in `src/cli.ts`, `src/cli/render.ts` and
  `src/__tests__/cli-render.test.ts`. That is 14 days into a hold that can run 30. These are the CLI render path files #2119 rewrites; `main` moved there.
  The refresh `RELEASING.md` asks for has not happened. The count and the
  conflicts are a snapshot and change with every merge to `main`.
- **The gate.** The last major is `zombie-mermaid@5.0.0`, tagged 2026-10-10.
  `2026-10-10 + 30 days = 2026-11-09`, so the gate opens 2026-11-09, 11 days
  from now. Latest published is 5.11.2 (2026-10-29), minor and patch releases
  continue meanwhile as intended.
- **Deferred majors are issues, not PRs.**
  [#1873](https://github.com/dfadler/zombie-mermaid/issues/1873) (drop CJS
  output) and [#1874](https://github.com/dfadler/zombie-mermaid/issues/1874)
  (named exports instead of `export *`) are both open, labeled `question`,
  and say "revisit at the next planned major" / "when the api-extractor
  baseline exists". No branch or PR exists for either. They are the
  cross-cutting kind: #1873 touches every package's build output and tarball
  contents, #1874 touches `index.ts` of at least core, mermaid-parser and
  svg-renderer (counts in the issue, not re-measured here).

Mechanics that matter for any option, checked in the repo:

- `.github/workflows/ci.yml` triggers on `pull_request` and `push` for
  `branches: [main]` only (plus `merge_group`). The `changeset` job diffs
  against `origin/main` and `pnpm changeset status --since origin/main`.
  A PR targeting another base branch would get no CI as configured.
- `.github/workflows/publish.yml` runs on `push` to `main` and is what
  publishes (changesets/action, OIDC). Nothing publishes from other branches.
- `.changeset/config.json` has `baseBranch: "main"`.
- Changesets pre mode exists (`changeset pre enter <tag>`), and its own docs
  recommend running it only from a non-default branch and warn that mistakes
  leave states that are hard to fix
  ([prereleases.md](https://github.com/changesets/changesets/blob/main/docs/prereleases.md)).
  How it interacts with a `fixed` group and this repo's npm trusted-publisher
  setup was not tested here.

Terms used below. **Queued major**: an open PR whose changeset has a `major`
bump (or should), labeled `breaking`, not merged. **Stale**: has a merge
conflict with `main`, or a required check red because `main` moved. **The
gate**: `today - last major publish date >= 30` calendar days, UTC, as in
`RELEASING.md`.

## Options

### A. Keep the current process (hold the PR open)

What it is: today's `RELEASING.md` process, optionally with a lighter
refresh rule (see question 3).

- For: no new branch, no CI or config change, no policy change. The cost is
  paid only when something is queued. With one queued PR and 11 days to the
  gate, the cost is one conflict resolution in three files.
- Against: the cost scales with queue length and with how much `main` moves
  under the touched files. Two queued PRs that touch the same files conflict
  with each other only at gate time, when they merge in one go, so that is
  when the surprise lands (and the gate day is the worst day to find one).
  Nothing checks that the held PR stays green.
- Risk: the hold only works if someone refreshes the PR. #2119 shows that does
  not happen by itself.

### B. A `next` integration branch

What it is: breaking PRs merge into `next` on review. `next` is merged into
`main` when the gate opens. `main` is merged into `next` regularly.

- For: staleness moves from N PRs to one branch, and from "30 days of drift
  waiting for one deadline" to "small, regular syncs". A PR that builds on
  another queued major (a stacked change) works naturally. Conflicts between
  queued majors surface at merge to `next`, not on gate day.
- Against, and what it would take (none of it done here):
  1. `ci.yml` must run on PRs and pushes for `next` (`branches: [main]`
     today), including the `changeset` job's `origin/main` base. This is a
     workflow edit, which the maintainer merges by hand.
  2. Branch protection or rulesets for `next`, and merge-queue handling.
  3. A sync routine, manual or a workflow, for `main` into `next`. A sync
     that conflicts stops until a human resolves it, which is the same work as
     option A, only earlier and in one place.
  4. Security fixes and upstream-breakage fixes are exempt from the gate and go
     straight to `main`; they must then reach `next` by the same sync.
  5. `RELEASING.md` and `CONTRIBUTING.md` change (the issue already says so),
     and the `breaking` label's meaning changes from "held open" to "target
     `next`".
  6. When `next` merges to `main`, its major changesets arrive together, so the
     Version Packages PR is unchanged in shape. Whether the final merge is a
     merge commit or a squash matters for changeset history; undecided.
- Risk: a long-lived `next` that nobody syncs is the same staleness with a
  harder merge. With an empty queue it is dead weight to maintain.

### C. B plus Changesets pre mode (publish prereleases from `next`)

What it is: `next` also publishes `-next.N` prereleases to an npm dist-tag so
users can try the breaking changes early.

- For: real consumer feedback before the major.
- Against: all of B, plus pre mode's documented hazards, `fixed`-group and
  trusted-publishing behaviour untested, and a second publish path. Nothing in
  the issue or the repo's history asks for prereleases. Not recommended unless
  early consumer testing becomes a goal of its own.

### D. Shrink what is held (a per-change tactic, composes with A or B)

What it is: where a breaking change can be split, land the non-breaking part
now as a minor (for example, the option or API, defaulting to the old
behaviour) and hold only the flip. The held PR becomes a few lines that rarely
conflict.

- For: the held diff stays small, and consumers get the capability a release
  earlier.
- Against: only some changes split cleanly. #2119 changes the CLI's behavior
  for `--max-width` from warn-and-continue to fail, so there is an
  opt-in-first path (a flag or `maxWidth` option that fails, with the CLI
  switching at the major), but whether that is worth a second PR for one flag is
  the author's call. The policy still counts the default flip as a major.

## Recommendation

**Option A now, with D encouraged where a change splits, and a written
trigger for B.** Reasons, from the facts above:

1. One queued PR, 11 days to the gate. Building option B (CI change, branch
   rules, sync routine, docs) costs more than refreshing three conflicted
   files once, and it would not be ready before the gate anyway.
2. The issue's own condition for deciding ("the first real queued major, or two
   at once") is half met: there is a first queued major, and it is the
   evidence for what the cost really is. The gate opening on 2026-11-09 is the
   natural point to measure it: how long the refresh and merge of #2119 took,
   and what broke.
3. The real risk with A is that nobody refreshes, which is a process gap not
   a branch-topology gap. A named owner and a refresh date fix that for free
   (questions 2 and 3).

**Trigger to move to B** (proposed, maintainer to set the numbers, question 4):
adopt `next` when any of these holds: two or more queued majors touch
overlapping files; a queued major is something other work needs to build on;
or #1873 or #1874 is scheduled, since each is cross-cutting and would conflict
with most of `main` for the full hold. If the trigger fires, B is done as its
own PR set (CI, rules, docs), not folded into a feature PR.

Not recommended: C (see above), and dropping the gate (a policy change, out of
scope for this doc).

## Maintainer questions (open)

1. **Decision:** keep A for now (recommended), or build B before the next
   major?
2. **#2119 refresh timing.** Refresh now (it is already conflicted), or at a
   fixed point just before the gate, for example 2026-11-06? Proposed: the
   latter, then merge on or after 2026-11-09 per `RELEASING.md`.
3. **Refresh rule in `RELEASING.md`.** Current text says keep it "up to date
   with `main`" continuously. Change it to "refresh in the 3 days before the
   gate, and whenever a conflict is reported"? That edits `RELEASING.md`, so
   it is not done here.
4. **B trigger.** Are the three conditions above the right ones, and is "two
   queued" the right count?
5. **If B:** who syncs `main` into `next`, how often, and may CI and branch
   rules for `next` be changed (maintainer-merged workflow edit)? Merge commit
   or squash for `next` into `main`?
6. **Which deferred majors join the 2026-11-09 batch**, if any. #1873 and
   #1874 have no PR; if either is to ship with #2119, it needs to start now,
   which would trigger B by the proposal above.

## Observations outside this doc's surface

Not fixed here: `docs/RELEASING.md` says "all seven packages", while
`lockstep-versioning.md` and `versioning-and-deprecation-policy-1568.md` say
six. `.changeset/config.json` lists seven in the `fixed` group (the CLI was
added later, [#1946](https://github.com/dfadler/zombie-mermaid/issues/1946)),
so those two docs lag the config. A follow-up edit would correct them.

## Consequences

- If accepted as recommended: no change to release config, CI or branches.
  `RELEASING.md` gains at most a refresh-date rule (question 3). The issue
  stays open as a watch item until #2119 ships, then closes with the measured
  cost.
- If B is chosen: a workflow edit, branch rules and a docs change are needed
  first, and the `breaking` label's meaning changes.
- This doc does not change the 30-day gap, the exemptions, or lockstep.

## Self-review (decision-doc checklist, #977)

- **Edge cases.** Empty queue: nothing to hold; under A nothing to do, under B
  `next` sits idle and still needs syncs (a cost with no benefit). Single
  queued PR: A is cheapest (this case, now). Two queued PRs that conflict with
  each other: A finds out on gate day, B at merge to `next`. A PR that depends
  on another queued PR: under A it must be stacked on that PR's branch, under
  B it is ordinary. A security or upstream-breakage major: exempt, merges to
  `main` directly under both. Under B it then has to be synced into `next`.
  Maximally asymmetric: one tiny PR and one PR touching every package (#1873
  scale) is exactly why the trigger names #1873 and #1874.
- **Boundaries.** Gate: 2026-10-10 plus 30 days is 2026-11-09 (October has 31
  days: 21 days to 10-31, 9 more); the gate is `>= 30`, so 2026-11-09 is the
  first allowed day and 2026-11-08 is not. "11 days from now" counts from
  2026-10-29: 11-09 minus 10-29 is 11. The 706-commit and conflict figures
  are a point-in-time snapshot (2026-10-29, `git rev-list --left-right
  --count` and `git merge-tree`), not a stable property.
- **Terminology.** "Queued major", "stale" and "the gate" are defined in
  Context. "Held" means open and unmerged, not merged-and-reverted.
- **Sub-issue scope.** #1873 and #1874 are issues with no branch, so the claim
  that they would conflict with most of `main` rests on their own descriptions
  (CJS output for every package; `export *` in three packages' `index.ts`),
  not on a diff. The doc does not claim they are queued. #1925 and #1757 were
  not re-read beyond what #1940 quotes of them.
- **Cited precedent.** Read and confirmed: policy section 3 (30 days, security
  and upstream exemptions), `RELEASING.md` "Batching majors" (label, merge
  `main` in, gate arithmetic, 5.0.0 on 2026-10-10), `ci.yml` and `publish.yml`
  triggers (`branches: [main]`), `.changeset/config.json` (`fixed`,
  `baseBranch`), the 5.0.0 tag date from `git for-each-ref`, and the
  Changesets pre-mode page (non-default branch recommendation, warnings). Not
  verified: pre mode with `fixed` groups and npm trusted publishing, and the
  merge-versus-squash effect on changeset history (both marked above).
