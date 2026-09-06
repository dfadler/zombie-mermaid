---
title: Adopting a Dead Fork — Day Zero of the Toolchain
date: 2026-09-06
description: Before a single Mermaid rendering bug got fixed in this fork, roughly twenty hours went into package managers, lint, coverage gates, and security scanning. Here's the verified timeline and the case for why that ordering wasn't optional.
---

`zombie-mermaid` exists because [`beautiful-mermaid`](https://github.com/lukilabs/beautiful-mermaid) stopped moving: dozens of pull requests sitting open for months, nothing merging. The rebrand commit, `be8cbbe`, landed at 10:15am on 2026-08-24. If you'd checked the repo an hour after that commit, you would have found a rendering engine with no CI gate stopping a bad diff from reaching it, no lint config, no coverage number, and a `bun.lock` tying the whole thing to a runtime the new maintainer didn't intend to keep.

None of that got fixed by writing a Mermaid parser fix. It got fixed by closing fourteen issues: #1, #3, #4, #5, #6, #7, #8, #9, #10, #11, #12, #13, #18, #20, none of which touch diagram rendering at all. That's the actual scope of this fork's day zero, and it's worth walking through both what was in it and when it really happened, because the "when" turns out to matter as much as the "what."

## The checklist

Four categories, verified against each issue's own body and its closing PR:

**Runtime and package manager.** Issue #1 asked the harder question first: swapping `bun install` for `pnpm install` is trivial, but Bun was also the test runner and the bundler (`bun test`, `Bun.build()` in `editor.ts`/`dev.ts`). The issue's own body flags this ("pnpm doesn't provide those"), and the fix (PR #23) answers it by moving the whole stack to Node, pnpm, and Vitest in one commit, closing #1 and #18 together. #13 later pins the decision down with explicit `engines` and `packageManager` fields in `package.json`, so nobody's local toolchain can silently drift from what CI uses.

**Quality gates.** ESLint (#3) and Prettier (#4) got added to the repo, then separately wired into CI as required checks (#10, #11), deliberately split so "the tool exists" and "the tool blocks a bad PR" were each their own reviewable change. Test coverage reporting (#8) came before the coverage gate (#9): measure first, enforce second. Security scanning (#12) added Semgrep SAST as a real CI job, no token and no cloud account required, running `semgrep scan --config auto --error` against Semgrep's free community rulesets, and documented Aikido Safe Chain as a local supply-chain check, with the PR explicitly deferring full Aikido SaaS scanning rather than overclaiming what shipped.

**Governance paperwork.** CONTRIBUTING.md, CHANGELOG.md, SECURITY.md, and CODEOWNERS (#5) went from stubs to real documents. A PR template (#6) and issue templates (#7) gave anyone opening a contribution a shape to fill in instead of a blank box.

**Auditing what was already there.** #20 went back over the GitHub Actions workflows that had accumulated during the day and checked them for the things that don't show up in a diff review: least-privilege `permissions:` blocks, `timeout-minutes` sized from actual run durations pulled via `gh run view --json jobs`, and a `concurrency` group so repeated pushes cancel superseded runs instead of piling up. Its closing PR (#48) folds in two issues opened later that touched the same handful of workflow files, rather than landing three overlapping diffs that would have conflicted with each other.

## What actually happened, verified

The issue tracking this post described all fourteen as closing "the same day." Checking `gh issue view --json closedByPullRequestsReferences` and each PR's `mergedAt` timestamp against that claim turns up a real correction: they don't all share a calendar date. What they share is closer to a single push with one overnight gap in the middle.

The first six went in fast, late on 2026-08-24 UTC: #1 and #18 together at 23:21:38Z (PR #23), #3 at 23:31:29Z (PR #24), #5 at 23:43:05Z (PR #25), #4 at 23:43:53Z (PR #26), and #6 at 23:59:12Z (PR #27). Five merges in 38 minutes, each one small enough to review in isolation.

Then a gap. The next merge, #7, doesn't land until 14:20:17Z the following day, 2026-08-25, about fourteen and a half hours later. From there the remaining eight go quickly again: #8 (14:21:21Z), #10 (14:24:14Z), #11 (14:30:35Z), #9 (14:30:53Z), #13 (14:35:35Z), #12 (16:30:04Z), and #20 closing out the run at 19:15:36Z. Call it a five-hour second sitting.

So "day zero" is really two sittings spanning roughly twenty hours of wall-clock time and crossing UTC midnight, not the single calendar day the tracking issue implies, but not a slow accretion over weeks either. Both readings support the same underlying point better than "one day" does on its own: this was two deliberate pushes to finish a defined list, not tooling that accumulated alongside feature work over time.

The more interesting number is what happened next. The first commit that touches actual Mermaid rendering, `fe048f6`, "Fix mergeEdges render option being ignored," has an author timestamp eight minutes after PR #48 (issue #20, the last item on the list) merged. Not eight days. Eight minutes.

## Why the order was the point

A stranger's abandoned codebase gives you no standing to trust your own changes to it. You didn't write the rendering engine, you don't yet know its edge cases, and "it looks right in this one manual check" is not evidence — that habit is exactly what a [`beautiful-mermaid` PR sitting for six months](https://github.com/lukilabs/beautiful-mermaid/pulls) probably ran into, whatever the actual reason for the stall. The fourteen issues above aren't process for its own sake; each one removes a specific way an unreviewed fix could quietly go wrong:

- **No coverage gate** means a fix can delete the one test that would have caught its own regression, and nothing says so.
- **No lint or format check in CI** means "did you follow the repo's conventions" depends on whoever happens to review the diff, if anyone does.
- **No security scan** means a fix that introduces a dynamic-`RegExp` ReDoS or an unvalidated shell call ships silently. That's the kind of finding Semgrep's PR #39 table shows getting caught and fixed within the same change that added the scanner.
- **No CONTRIBUTING.md or PR template** means every contributor, including future-you, re-derives the rules from scratch each time.

None of that is about the Mermaid parser. All of it is about whether the next hundred changes to the Mermaid parser can be trusted without re-litigating from zero each time. Once the gate exists, a fix either passes it or it doesn't, and that's a much smaller thing to reason about than "is this fix safe" from first principles.

That's the case this fork is making with its own history, not just its documentation: the eight minutes between the last tooling PR and the first real bug fix aren't a coincidence of timing. They're what the checklist was for. Two weeks of fixes moving at the pace this fork moved at afterward — the subject of the next post in this series — only look reckless if you don't know the first twenty hours happened first.
