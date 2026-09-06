---
title: Turning a Coverage Gap into a Parallelizable Backlog
date: 2026-09-06
description: Instead of one "improve test coverage" ticket, this repo filed nineteen — one per file, all in a 25-second burst — and closed all nineteen in under four minutes each. The backlog shape did more work than any individual fix did.
---

The obvious way to write a coverage ticket is: "Improve test coverage." One
issue, whatever files happen to be thin, whoever picks it up figures out
scope as they go. It reads fine. It also produces exactly one thing you can
work on at a time, because the ticket doesn't say where one person's work
ends and another's begins.

[#102](https://github.com/dfadler/zombie-mermaid/issues/102) didn't do that.
It started as a review, not a fix: run `pnpm run test:coverage`, list every
file dragging the aggregate down, and decide file by file whether the gap
was worth closing or worth accepting. The output was a table — `src/browser.ts`
at 0% statements, `src/ascii/ansi.ts` at 5.2%, the whole `src/ascii/shapes/`
directory averaging 13% — and instead of leaving that table as a to-do list
inside one issue, it became the spec for nineteen separate ones, each scoped
to a single file. No shared branch, no shared PR, no single person or
session who had to hold all nineteen files in their head at once to make
progress on any of them.

## Nineteen issues, one 25-second window

The filing timestamps are almost comically tight.
[#104](https://github.com/dfadler/zombie-mermaid/issues/104) (`src/browser.ts`)
went in at 17:17:41 UTC on 2026-08-26. Issue
[#122](https://github.com/dfadler/zombie-mermaid/issues/122)
(`src/ascii/shapes/state.ts`), the last of the batch, went in at 17:18:06 —
twenty-five seconds later. In between: `src/cli.ts`, `src/ascii/validate.ts`,
`src/xychart/layout.ts`, `src/layout-engine.ts`, and every file in
`src/ascii/shapes/` (circle, diamond, hexagon, rounded, rectangle, special,
stadium, in addition to state), each as its own numbered issue with its own
before-numbers table lifted straight from the coverage run. Nineteen
independent units of work, none of which referenced or blocked any other,
all traceable back to the same umbrella issue as their parent.

That shape is what makes "embarrassingly parallel" more than a turn of
phrase here. A ticket that says "raise coverage on the ascii/ directory" has
an implicit ordering problem the moment two people (or two agent sessions)
pick it up at once — whoever finishes first has to rebase past the other's
changes to the same files, or the two efforts silently duplicate work on
the same function. A ticket scoped to exactly one file has no such problem,
because two files' tests essentially never touch the same lines.

## Nineteen PRs, each on its own branch, merged in under four minutes

The close side of the ledger is just as tight, and just as informative
about mechanism, not just speed. Every one of the nineteen issues was
closed by its own pull request — `test: improve coverage for src/browser.ts`
closing [#104](https://github.com/dfadler/zombie-mermaid/issues/104), `test:
improve coverage for src/ascii/shapes/circle.ts` closing
[#115](https://github.com/dfadler/zombie-mermaid/issues/115), and so on
through all nineteen — and every one of those PRs branched from `main`
under its own name:
`test-coverage/src-browser-ts`, `test-coverage/src-ascii-line-utils-ts`,
`test-coverage/src-ascii-draw-bundles-ts`. Nineteen branches, nineteen PRs,
zero shared diffs to conflict over. The first of them
([#123](https://github.com/dfadler/zombie-mermaid/pull/123)) merged at
17:51:10; the last
([#142](https://github.com/dfadler/zombie-mermaid/pull/142)) merged at
17:55:17. Four minutes and seven seconds covers all nineteen merges, and
the ordering inside that window is arbitrary — CI finishing, not
dependency, decided who landed first.

Every one of the nineteen chose the same fork in the road, too. Issue
#102's original ask was explicit about the alternative: write missing
tests, or add the file to `vitest.config.ts`'s coverage `exclude` list with
a one-line justification if it wasn't worth testing directly. All nineteen
went with real tests, including the ones that looked like prime
exclude-list candidates on paper — `src/browser.ts` and `src/cli.ts` are
both thin entrypoints, and both got a real (if minimal) smoke test instead
of a shrug and an exclude rule.

## The backlog caught its own labeling mistake

One of the nineteen is worth a closer look, because it shows the shape
paying for itself in a way "improve coverage" never would have surfaced.
Issue [#108](https://github.com/dfadler/zombie-mermaid/issues/108) was
titled `src/ascii/line-utils.ts`. No such file exists in this repo — it
never has. What the PR that closed it
([#132](https://github.com/dfadler/zombie-mermaid/pull/132)) found was that
the coverage numbers cited in #108's own table (29.41% statements, 100%
branch, 66.66% functions) matched `src/ascii/multiline-utils.ts` exactly,
and documented that match explicitly in the PR description rather than
silently retitling the issue or guessing. The likeliest explanation is a
truncation artifact from however the coverage table got assembled — both
names end the same way. Because the ticket was scoped to one file's worth
of numbers instead of a paragraph of prose about "the ascii utilities,"
the mismatch was checkable in one command (`pnpm run test:coverage`) and
fixable without anyone needing to first untangle which of several
plausible files the original report meant. A paragraph-length ticket
covering several files wouldn't have been wrong exactly, but nothing
about it would have forced anyone to actually run the numbers and notice
they pointed somewhere else.

The same close reading turns up one more correction worth being honest
about: the eight files under `src/ascii/shapes/` run from
[#115](https://github.com/dfadler/zombie-mermaid/issues/115) through
[#122](https://github.com/dfadler/zombie-mermaid/issues/122) — circle,
diamond, hexagon, rounded, rectangle, special, stadium, and state — not
`#115`–`#121`. `state.ts` lives under `shapes/` alongside the rest, easy to
undercount by one if you're going from memory of the umbrella issue instead
of the actual sub-issue list.

## Closing the loop

Issue #102 itself didn't close until 18:31:17 — exactly 36 minutes after
the last of the nineteen sub-issues merged — because closing it meant one
more step none of the individual file-level PRs owned: re-running
`pnpm run test:coverage` against the new baseline and raising the
repository-wide thresholds in `vitest.config.ts` to match, which happened
in [#144](https://github.com/dfadler/zombie-mermaid/pull/144), merged at
18:30:50. That ordering isn't incidental. The per-file tickets were
deliberately scoped so that finishing all of them didn't automatically
finish the umbrella — someone still had to look at the aggregate result and
decide the new floor was real, not just eyeball nineteen individually green
PRs and assume the whole was better than the sum of its parts.

## Why this is the reusable part

None of the individual test files here are interesting on their own — a
`Canvas`-based smoke test for `drawMultilineTextCentered`, a handful of
edge cases for `src/ascii/ansi.ts`'s color codes. What's reusable is the
backlog shape: an umbrella issue that does the *reviewing* (what's low,
what's worth fixing, what's acceptable to exclude) and stops there, plus
one child issue per unit of work small enough that two people picking up
two different children can never step on each other. That's the same
principle behind sweeping a backlog oldest-first across a fleet of
isolated worktree sessions rather than one long-running branch touching
everything at once — the granularity is what makes the parallelism safe,
not any cleverness in the individual fixes. Nineteen files, filed in
twenty-five seconds, closed inside a single evening, is what that
principle looks like when you actually measure it instead of just claiming
it.
