---
title: 294 PRs, 14 Days — What Agent-Driven OSS Maintenance Actually Looks Like
date: 2026-09-06
description: The real daily merge-count histogram behind two weeks of reviving a dead fork — not the rounder number the tracking issue guessed — and what it does and doesn't tell you about agent-driven maintenance.
---

Every other post in this series zooms into one thing: a day of tooling
bring-up, an evening of deliberate bug-hunting, a display-width bug that kept
coming back in new disguises, a coverage backlog shaped so a dozen agents
could burn it down at once, a refactor timed to come after the audit instead
of before it, a release, an accessibility push, a marketing habit, a judge
that grades the renderer against real Mermaid output while nobody's watching.
This post pulls back from all of that and asks a duller, more falsifiable
question: how much actually got merged, on which days, and does the shape of
that curve match the story the other eight posts are telling?

## How this was checked

The issue tracking this post ([#527](https://github.com/dfadler/zombie-mermaid/issues/527))
was drafted at 03:04 UTC on 2026-09-06 with a claimed histogram — 5, 28, 64,
19, 23, 9, 21, 9, 30, 15, 18, 17, 22, 4 merges per day, 284 total — and an
explicit instruction not to trust it. Good instinct. Running the same kind of
query fresh, well after that draft:

```bash
gh pr list --state merged --limit 500 --json mergedAt \
  --jq '.[].mergedAt' | cut -c1-10 | sort | uniq -c
```

At 17:04 UTC on 2026-09-06, that returns 294 merged pull requests across the
same fourteen calendar dates, 2026-08-24 through 2026-09-06 — this fork's
entire history; nothing in this repository's PR list predates the rebrand
commit that [day zero](https://github.com/dfadler/zombie-mermaid/issues/518)
describes. Thirteen of the fourteen daily counts match the tracking issue's
claim exactly. The fourteenth doesn't, and the reason is more interesting
than a transcription error: 2026-09-06 is *today*. The tracking issue was
drafted at 03:04 UTC, when four PRs had merged so far that day. This post is
being written as part of the same oldest-first backlog sweep that's still
producing those merges, so by 17:04 UTC the day-14 count had already climbed
to fourteen — and by the time anyone reads this sentence, it will be higher
again. A capstone post about verified throughput numbers almost shipped with
a stale count of its own final day, for the most on-theme possible reason:
the process generating the data hadn't stopped.

So: **294 merged PRs, not 284**, as of a snapshot taken mid-sweep, with the
last of the fourteen days still open. The other number the outline issue
([#528](https://github.com/dfadler/zombie-mermaid/issues/528)) cited — 176
closed issues over the same window — has the identical problem for the
identical reason; `gh issue list --state closed --limit 500` returns 181 as
of the same snapshot. Both undercounts are real, both are small, and both
point the same direction: any number pulled from an in-progress sweep is a
floor, not a total.

## The verified histogram

| Date (2026) | Merged PRs |
| ----------- | ---------: |
| Aug 24      |          5 |
| Aug 25      |         28 |
| Aug 26      |     **64** |
| Aug 27      |         19 |
| Aug 28      |         23 |
| Aug 29      |          9 |
| Aug 30      |         21 |
| Aug 31      |          9 |
| Sep 1       |         30 |
| Sep 2       |         15 |
| Sep 3       |         18 |
| Sep 4       |         17 |
| Sep 5       |         22 |
| Sep 6       |    14, and still climbing at the time of writing |

That is not a clean staircase, and it shouldn't be presented as one. It's a
rhythm of pushes and lulls: two single-digit days (Aug 29, Aug 31) sitting
right next to two of the four highest days (Aug 26 at 64, Sep 1 at 30). The
rest of this post is about what produced that specific shape, day by day,
cross-referenced against the grounding issues the other posts in this series
cite.

## What actually happened, day by day

**Aug 24 — 5 merges.** [Day zero](https://github.com/dfadler/zombie-mermaid/issues/518):
package manager, lint, coverage reporting, CONTRIBUTING.md, a PR template.
Nothing here touches diagram rendering. Five is the right number for a day
that's entirely process — this is the slowest day in the whole window on
purpose, and the series' first post argues for exactly why that ordering
mattered.

**Aug 25 — 28 merges.** The tooling list closes out (security scanning,
CI-enforced lint and format, the coverage gate), and in the same day the
[bug audit](https://github.com/dfadler/zombie-mermaid/issues/519) starts:
eighteen issues filed in seventeen minutes that evening, and the first four
fixes — the double-reversed SVG arrowheads, unreadable dark-mode label text,
a dropped `:::className` attribute, a trailing-semicolon parser bug — land
before midnight. Tooling and diagnosis in the same 24 hours; the first real
rendering fix follows within minutes of the last tooling PR, per that post.

**Aug 26 — 64 merges, the highest day by a wide margin.** Three
independent, non-overlapping workstreams landed the same day, each shaped so
a dozen worktree-isolated agents could work them in parallel without
touching each other's files: the remaining audit-driven bug fixes (PRs
77 through 98 — ER parser bugs, ASCII edge-routing crashes, subgraph
direction overrides, CJK box-alignment); a one-issue-per-file test coverage
backlog (issue #102's umbrella scope, closed by roughly twenty individual
`test: improve coverage for <file>` PRs, #123 through #142); and a
non-null-assertion audit spanning the whole codebase, subsystem by
subsystem (issue #100, PRs #146 through #167). That's the concrete evidence
for the coverage-backlog post's actual thesis: a granular, one-file-per-issue
backlog isn't just tidier project management, it's what lets a fleet of
agents land nearly triple any other day's output without merge collisions.
No single person or process wrote 64 things that day. Sixty-some
non-conflicting, independently-scoped tickets got worked at once.

**Aug 27 — 19 merges.** The architecture refactors this series' fifth post
covers — unifying diagram-type detection, one shared box-drawing seam, one
edge-routing seam, a bounds-checked ASCII canvas primitive — land here,
deliberately *after* the audit and the recurring bug pattern had already
shown which abstractions were missing. The same day, release prep starts:
rebranding the demo site, deciding on `package.json` authorship, moving
hosting to GitHub Pages. Refactor and release-prep overlapping on one day
is itself informative — the codebase had to be trustworthy before the demo
site was worth polishing, but the two didn't have to be sequential.

**Aug 28 — 23 merges.** Release work continues (the three-part flowchart
syntax-gap closure, `#198`), and the first accessibility fixes show up —
`role="img"` and an accessible-name option on rendered SVGs — well before
the dedicated accessibility push. Bugs don't wait for their themed week.

**Aug 29 — 9 merges, the first lull.** Small, single-threaded work: hero
image fixes, CI/coverage badges, one accessibility regression fix. No
parallel batch landed this day, and it shows in the count.

**Aug 30 — 21 merges, the accessibility push concentrated into one day.**
Dialog announcement for assistive tech, ARIA state on the theme-picker
dropdown, a consistent focus-visible ring, a skip-to-content link, WCAG AA
contrast fixes on two separate elements, a visual-regression test suite.
Most of the individual defects the accessibility post walks through as
"bug reports" get fixed on this single day.

**Aug 31 — 9 merges, the second lull.** A README rewrite, CLI ergonomics,
enabling the issue-bot workflow, and the documentation rule requiring real
terminal captures for ASCII visual verification — the rule this very
project's `CLAUDE.md` still enforces, and the reason none of the
before/after images in the sibling ASCII-focused posts in this series were
ever allowed to come from a browser mockup.

**Sep 1 — 30 merges, the second peak.** Release and promotion converge: an
MCP server exposing render calls to agents, generated SEO landing pages per
diagram type, a public maintenance-transparency dashboard, and — closing the
accessibility arc from two days earlier — a published accessibility
conformance statement backed by a CI check, plus the rule making
`fork-fixes.ts` entries a standing habit for every bug-fix PR rather than a
one-time backfill. Two separate posts' closing arguments both land on this
single day.

**Sep 2 through Sep 5 — 15, 18, 17, 22 merges.** The recursive-QA
infrastructure this series' ninth post covers — the weekly LLM judge that
compares ASCII output against real mermaid.js, and the bot that turns PR
review comments into tracked issues automatically — gets built and hardened
here, interleaved with a long tail of specific rendering bugs the judge
itself started finding (nested-subgraph ordering, class-diagram stacking,
sequence-diagram `actor` styling, ER label collisions). This is the steadiest
stretch of the whole window: no day above 22, none below 15. A judge finding
issues on a schedule and a backlog of medium-sized, independently fixable
bugs produces a flatter curve than either a single audit day or a single
parallel-batch day does.

**Sep 6 — 14 merges and counting.** Today. The day this post is being
written, as part of the same sweep, is not yet finished being measured.

## What the curve actually tracks

Line the eight prior posts' dates up against the histogram and the phases
line up close to exactly: tooling (Aug 24, the slowest day) → audit (Aug 25,
ramping) → the parallel-backlog spike (Aug 26, the peak) → refactor
overlapping release-prep (Aug 27) → release and early accessibility (Aug 28)
→ a lull (Aug 29) → the accessibility push (Aug 30) → a second lull (Aug 31)
→ release-and-promotion convergence (Sep 1, the second peak) → a steadier
recursive-QA-and-bugfix tail (Sep 2 onward). The lulls are not a weakness in
the data or a sign velocity was fake on those days — they're what a day
without a ready-made parallel batch looks like, next to what a day *with*
one looks like. The difference between 9 and 64 isn't effort. It's whether
that day had a backlog shaped so many agents could work it at once.

## What this throughput requires, and what it doesn't replace

None of the 64-PR day happens without three things this series has already
argued for individually: a governance-first CI gate that made a fast fix
trustworthy instead of reckless (the first post), a backlog shaped as
independent, non-conflicting tickets rather than one broad "improve
coverage" issue (the fourth post), and a worktree-per-batch workflow so a
dozen agents editing overlapping subsystems don't collide on the same files.
Take any one of those away and Aug 26 becomes a multi-week slog instead of a
single day.

It's just as important to be specific about what none of that throughput
replaces, because "284 PRs in 14 days" on its own reads like an autonomy
claim this project doesn't actually want to make:

- **Which of the audit's ~15 findings mattered enough to justify continuing
  the fork at all** was a human call, not a mechanical one — the audit
  produced the list, a person decided the list was convincing.
- **The label taxonomy, the rebrand voice, and which upstream bugs were
  worth fixing versus documenting as a known limitation** were all decided
  by a person, not inferred from a diff.
- **Which accessibility findings to prioritize, and when "fixed" becomes
  "worth a published conformance statement,"** is a judgment call about
  what a guarantee is worth making, not a checklist item.
- **The recursive-QA judge's rubric — what counts as a genuine structural
  discrepancy against real mermaid.js, and what's deliberately out of
  scope (color, line-smoothness, corner-roundedness)** — is a design
  decision about where false positives are worse than false negatives. An
  agent didn't arrive at that trade-off by running more PRs faster.

The mechanical, parallelizable work is genuinely most of the *count* in this
histogram. The audit, the branding, the accessibility priorities, and the
judge's rubric are most of what makes the count worth anything. Both halves
are true at once, and a post that only reported the first would be the vibes
claim this one was supposed to be the corrective for.

## The series, in order of what actually happened

1. [Day zero](https://github.com/dfadler/zombie-mermaid/issues/518) — the
   tooling bring-up that made the next thirteen days trustworthy.
2. [The bug audit](https://github.com/dfadler/zombie-mermaid/issues/519) —
   one evening turning "looks stalled" into a numbered, reproducible list.
3. [Terminal rendering is secretly about Unicode](https://github.com/dfadler/zombie-mermaid/issues/520) —
   the one bug category that kept resurfacing in new disguises.
4. [Turning a coverage gap into a parallelizable backlog](https://github.com/dfadler/zombie-mermaid/issues/521) —
   the ticket shape behind this post's single highest day.
5. [Refactor after the audit, not before](https://github.com/dfadler/zombie-mermaid/issues/522) —
   why the seams got extracted only once the audit proved they were real.
6. [Shipping v1 of a zombie](https://github.com/dfadler/zombie-mermaid/issues/523) —
   the unglamorous branding and release-readiness work.
7. [Accessibility isn't a checkbox, it's a CI gate](https://github.com/dfadler/zombie-mermaid/issues/524) —
   from individual defects to an enforced guarantee.
8. [Show, don't tell](https://github.com/dfadler/zombie-mermaid/issues/525) —
   why every marketing claim here ships with a real before/after render.
9. [The judge that never sleeps](https://github.com/dfadler/zombie-mermaid/issues/526) —
   using an LLM to keep auditing LLM-assisted code after the humans stop
   looking.
10. This post — the raw histogram behind all nine, corrected against the
    claim that started it, because a data-backed close only works if the
    data actually checks out.

294 merged PRs over 14 days is a real, verified, still-growing number. It is
not, on its own, evidence that any of this ran itself. It's evidence that
once the groundwork from the first eight posts was in place, the mechanical
share of the work could move at a pace no single reviewer could match — and
that the judgment calls threaded through all nine of those posts are exactly
what decided which mechanical work was worth doing in the first place.
