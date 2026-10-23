# Provenance and continuity

Status: draft for maintainer review ([#1954](https://github.com/dfadler/zombie-mermaid/issues/1954)).
Facts below are a snapshot taken on 2026-10-22 against `main`; each one names how to
re-check it. Counts change, so re-run the command rather than trusting the number.

## What this project is

`zombie-mermaid` is an independently maintained fork of
[`lukilabs/beautiful-mermaid`](https://github.com/lukilabs/beautiful-mermaid)
(MIT). It renders Mermaid diagrams to SVG or ASCII and ships a CLI and an MCP server.

## How it relates to beautiful-mermaid

- **The git history is upstream's history.** The first commit in this repository is
  upstream's `3185b9b6` ("Initial release - beautiful-mermaid v0.1.0", 2026-01-28, by
  Balint Orosz). Check: `git log --reverse --format='%h %ad %an %s' --date=short | head -1`.
- **The fork's own work starts on 2026-08-24** with the rebrand commit `be8cbbe9`
  ("rebrand: zombie-mermaid"). The first npm release under the new name is `1.1.3`,
  published 2026-08-27. Check: `npm view zombie-mermaid time`.
- **Upstream authors keep their authorship.** Commits by people other than the
  maintainer remain in history under their own names. Check:
  `git log --format='%an' | sort | uniq -c | sort -rn`.
- **Fixes taken from upstream pull requests are recorded.** Ported work links the
  upstream PR or commit in its commit message (rule: [CONTRIBUTING.md](../CONTRIBUTING.md#porting-fixes-from-upstream)).
  The triage state of upstream PRs is in
  [`docs/promotion/upstream-pr-seen.json`](promotion/upstream-pr-seen.json); the
  frozen first survey is [`258-pr-rescue-candidates.md`](promotion/258-pr-rescue-candidates.md).
  The weekly `upstream-watch` workflow lists upstream commits not yet here.
- **Upstream's state, as dated in the README.** See
  [Why This Fork Exists](../README.md#why-this-fork-exists) for the dated snapshot
  (last push, latest release, open PR and issue counts) with live links. This page does
  not repeat those numbers.
- **The ASCII engine has its own origin.** It is based on
  [`mermaid-ascii`](https://github.com/AlexanderGrooff/mermaid-ascii) (MIT, Alexander
  Grooff); see [README Attribution](../README.md#attribution).

## Licence and notices

MIT. [`LICENSE`](../LICENSE) carries both "Copyright (c) 2026 Craft Docs" and
"Copyright (c) 2026 Dustin Fadler". Third-party notices (mermaid-ascii, the JetBrains
Mono subset, the beautiful-mermaid fork notice) are in
[`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md), and each published package ships
the notices that apply to it.

## Who maintains it

One person: Dustin Fadler ([@dfadler](https://github.com/dfadler)). Check:
[`.github/CODEOWNERS`](../.github/CODEOWNERS) routes everything to `@dfadler`, and
[`SECURITY.md`](../SECURITY.md) calls this a single-maintainer project with no formal SLA.
Craft Docs and Craft Agents do not take part in this project's process (README, "Why
This Fork Exists"); this page makes no claim that they endorse it.

## AI-assisted authorship

A large share of this repository's code, tests and docs is written with an AI coding
assistant (Claude Code) working under the maintainer's direction. Commits made that way
carry a `Co-Authored-By: Claude ...` trailer. On 2026-10-22, 2335 of 4190 commits on
`main` had one. Check:
`git log --grep='Co-Authored-By: Claude' -i --format=%h | wc -l` against
`git log --format=%h | wc -l`. The trailer is applied by convention, so commits without
it are not a guarantee of human authorship. Automated checks (CI, tests, type checking)
run on every pull request; they do not replace review, and this page does not claim any
particular depth of human review.

## How releases are published

- Releases are cut by [`.github/workflows/publish.yml`](../.github/workflows/publish.yml)
  using npm trusted publishing (OIDC). There is no long-lived `NPM_TOKEN` in the flow
  ([`docs/RELEASING.md`](RELEASING.md)).
- All six packages set `publishConfig.provenance: true`. The registry holds
  attestations for all six packages at 5.8.3 (checked 2026-10-22). Check:
  `npm view zombie-mermaid@5.8.3 dist.attestations.url` (repeat per package), or
  `npm audit signatures` in a project that installs it.
- GitHub Release tarballs also get SBOM and Sigstore attestations from
  [`release-assets.yml`](../.github/workflows/release-assets.yml). That tarball is repacked
  from the tagged commit and is not guaranteed byte-identical to the npm one; npm's own
  provenance covers the npm artifact (stated in that workflow's header).
- Versioning: all six packages share one version (lockstep), see
  [`decisions/lockstep-versioning.md`](decisions/lockstep-versioning.md) and
  [`decisions/versioning-and-deprecation-policy-1568.md`](decisions/versioning-and-deprecation-policy-1568.md).
- Support: only the latest published version gets security fixes
  ([`SECURITY.md`](../SECURITY.md)).

## What we claim, and what we do not

We claim: the facts above, each re-checkable. That this is a continuation of
beautiful-mermaid's code under its MIT licence, with attribution preserved, and that the
fork fixes listed on the [fork-fixes page](https://dfadler.github.io/zombie-mermaid/fork-fixes.html)
were rendered from pre-fix and post-fix code.

We do not claim: that the project is safe from supply-chain risk (provenance shows where
a package was built, not that the code is free of defects); that it is endorsed by or
affiliated with Craft Docs or the upstream maintainers; that it will be maintained
indefinitely; or that any other fork or alternative is worse.

## If the maintainer stops

There is **no documented handover path today**: no second maintainer, no named
successor, no npm or repository transfer plan. Because the code is MIT and the history
is public, anyone can fork it. The maintainer has not yet decided what a handover should
look like (open question on [#1954](https://github.com/dfadler/zombie-mermaid/issues/1954));
this section should be updated when that decision is made, not before.

## Reporting a problem

- Bugs and questions: [open an issue](https://github.com/dfadler/zombie-mermaid/issues).
- Security: [`SECURITY.md`](../SECURITY.md), via GitHub private vulnerability reporting.
- Something on this page that you cannot reproduce: open an issue titled "provenance:
  <claim>"; a claim that cannot be checked should be fixed or removed.
