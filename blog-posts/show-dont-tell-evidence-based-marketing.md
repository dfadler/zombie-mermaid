---
title: Show, Don't Tell: Evidence-Based OSS Marketing
date: 2026-09-06
description: A demo page that renders real before/after diffs became a build-time guarantee, then a habit, then a hard requirement about what counts as proof. The four issues that got it there, verified against their own PRs.
---

This repo's central marketing claim is "we fix bugs upstream won't." That's an
easy thing for a fork to say and an easy thing to get wrong, because the
natural way to back it up (describe the bug, describe the fix) is also the
natural way to misremember it, round it up, or quietly stop being true once
nobody's checking. `demo/fork-fixes-data.ts` is this project's answer: a
before/after showcase where every entry names a real commit, and the build
fails if the "before" render and the "after" render come out identical. That
page didn't arrive as a finished habit. It took four issues, closed over
about eleven days, to go from a single page to something a reader can
actually verify.

## Building something real, not something plausible (#189)

[#189](https://github.com/dfadler/zombie-mermaid/issues/189) asked for a demo
page making the fork's case "before/after" instead of in prose, timed to the
~78 fixes about to ship in the first release. Its scope note is specific
about how: reuse the project's own render path against the pre-fix commit
and the current tree, rather than hand-drawing what "before" looked like.
That constraint shows up directly in `fork-fixes.ts`'s own header comment
today:

> Nothing here is hand-drawn — a "before" that stopped reproducing would show
> up as an identical pair, which the generator fails on rather than quietly
> publishing.

`demo/fork-fixes-data.ts` currently holds 28 entries (merged via
[#211](https://github.com/dfadler/zombie-mermaid/pull/211) and grown since).
Each one names a `fixCommit`, a PR number, and a minimal Mermaid source; the
generator renders it once against `fixCommit^` and once against the working
tree, so 28 entries means 56 real renders checked on every build, not 28
screenshots taken once and committed.

One entry is worth calling out on its own, because it shows the project
distrusting its own evidence a full week before that became a repo-wide rule.
The `start-arrow-markers` fix, a double-reversed SVG marker that pointed
bidirectional arrowheads the wrong way, rendered fine in Chrome and
degenerately in librsvg and Inkscape. A before/after screenshot pair taken in
a browser would have shown two identical pictures: a false negative, not
evidence the bug was gone. So that entry doesn't show a picture. It shows the
markup instead, the `<marker>` definition's `points` attribute before and
after, because that's where the real difference lives, and a rendering
that's forgiving of the bug can't be trusted to expose it.

## Deciding it was worth surfacing (#257)

Once the page existed, it was still only reachable by clicking through the
demo site's hero buttons.
[#257](https://github.com/dfadler/zombie-mermaid/issues/257) argued that a
page this credible shouldn't be a build artifact nobody finds. It asked for
a prominent README link, per-fix social posts, and comments on the upstream
`beautiful-mermaid` issues each fix addresses, crediting the original
reporters.

[PR #356](https://github.com/dfadler/zombie-mermaid/pull/356) closed the part
a code change can actually do: a badge at the top of the README next to the
Live Demo badge, and a line in "Why This Fork Exists" pointing straight at
the page:

> This isn't just a claim — see **what this fork fixes** for an
> evidence-based before/after showcase: every bug listed there is rendered by
> the actual pre-fix and post-fix code, not described from memory.

The PR is explicit about what it didn't do: the social posts and the
upstream credit comments needed accounts and repo access the change itself
didn't have, so it left them as open follow-ups rather than claiming credit
for the whole issue. That's a small thing, but it's the same discipline the
page itself practices: say what's actually verified, not what would look
better rounded up.

## Keeping it from going stale (#295)

A showcase's evidentiary value only holds if it keeps growing with the fork.
[#295](https://github.com/dfadler/zombie-mermaid/issues/295) named the risk
directly: treating the page as a one-time backfill would let it quietly stop
representing the current state of the fork, and proposed two options: a PR
template checkbox, or a lint that nudges rather than blocks.

[PR #371](https://github.com/dfadler/zombie-mermaid/pull/371) took a
deliberately non-blocking route: a CONTRIBUTING.md section on when and how
to add an entry, a PR template checklist line, and a new
`.github/workflows/fork-fixes-nudge.yml` that posts a single advisory comment
on a `bug`-labeled PR that doesn't touch `demo/fork-fixes-data.ts`, without
ever failing the build. The PR's own reasoning for skipping a hard gate is
worth keeping: auto-detecting "this is a bug fix" from labels and "did it
change rendered output" from a diff are both heuristics that get it wrong in
both directions, and a gate built on either produces either false-positive
nagging or false-negative silence. A nudge gets the reminder in front of a
contributor, including one who's never read this repo's CLAUDE.md, without
pretending a heuristic is a guarantee.

Whether that habit actually stuck is a checkable claim, not an assertion, so
here's the check: `demo/fork-fixes-data.ts`'s commit history after PR #371
merged on 2026-09-01 shows three more commits touching the file on
2026-09-05, adding entries for the #418 class-generics and edge-label fixes,
the #488/#489 class column-width fixes, and a class-label-detour-routing fix.
The habit outlived the PR that mandated it by four days before this post was
written, which is the only kind of evidence that "standing habit" means
anything more than a paragraph in CONTRIBUTING.md.

## Closing the last gap: can a reader check it without leaving the page? (#402)

The first three issues made the page real, then worth finding, then
self-sustaining. The fourth found a gap in a different direction: even a
real screenshot is unverifiable if the reader can't see what produced it.
[#402](https://github.com/dfadler/zombie-mermaid/issues/402) was filed
against [PR #387](https://github.com/dfadler/zombie-mermaid/pull/387), whose
"Visual verification" section showed before/after screenshots and said they
rendered "the exact reproduction from the issue," but the mermaid source
itself lived only in the linked issue, not the PR. A reviewer, or a reader
six months later, would have to go find that issue and hope it still
contained a matching repro.

[PR #466](https://github.com/dfadler/zombie-mermaid/pull/466) closed it in
one change to three files: this repo's CLAUDE.md, the
`verify-ascii-terminal` skill, and CONTRIBUTING.md, all updated to the same
rule. As CLAUDE.md states it today:

> Whenever a PR or issue includes a "Visual verification" (or equivalent
> before/after) section for this category of change, paste the exact Mermaid
> source used to produce both renders inline, in a fenced ` ```mermaid `
> code block directly after that heading — before the before/after image
> table, not after it — rather than only linking to a sample index or a
> separate issue's reproduction.

That ordering, source first and pictures second, is the point. A PR or issue
is supposed to be checkable from its own body, without chasing a link that
might rot or a repro that might have been edited since.

## The screenshot pipeline gets the same scrutiny

CLAUDE.md doesn't stop at requiring the source. The same section names a
second failure mode this repo had already shipped once: two of its own
tools, the Playwright visual-regression suite and `scripts/visual-diff.ts`,
render ASCII output through `ascii-html.ts`'s HTML approximation of a
terminal, never a real one. [PR #312](https://github.com/dfadler/zombie-mermaid/pull/312),
"scroll wide ASCII terminal panels instead of overflowing the card," fixed a
real bug in that approximation's own chrome while the underlying
`renderMermaidASCII` renderer had been correct the whole time. That's proof
the mockup and the real thing can drift independently, in either direction.

[PR #345](https://github.com/dfadler/zombie-mermaid/pull/345), merged four
days before #402 was even filed, had already drawn the conclusion: a
`verify-ascii-terminal` skill that renders a sample through a real PTY
(`asciinema` piped through `agg`, headlessly, so no window ever opens) on
both the base branch and the change, before any screenshot is trusted enough
to attach to a PR. CLAUDE.md now states this as a hard requirement on the
_attached image itself_, not a correctness check that gets discarded once a
prettier browser screenshot is available: the visual-regression suite and
`scripts/visual-diff.ts` stay useful for iterating locally, but neither one
is allowed to supply the picture that ends up in a PR or issue body for an
ASCII-touching change.

It's the same discipline the fork-fixes page runs on itself, one level
further down: #189 made sure the screenshot was real, and #402 made sure the
source behind it was included, but neither one checks that the pipeline
producing the picture is the one a real user actually hits. If it isn't, the
"evidence" is evidence for a mockup, not for the product.

## What four issues bought

Each of these closes a distinct way "before/after" can stop meaning
anything. #189 makes the pair real: the build fails rather than publish a
before that no longer reproduces. #257 decides a real pair sitting in a
build artifact is worth surfacing, and says plainly what it didn't get to
instead of rounding up. #295 keeps the second entry as certain as the first,
against the ordinary pull of every backlog toward "we'll add it later." #402
makes each individual claim checkable from the PR or issue body alone,
without a reader having to trust a link. None of it proves the fork fixes
more bugs than it actually does. That's still down to whoever writes the
entry. What it buys is narrower and more useful: a reader doesn't have to
take "before/after" on faith. They can check it themselves, from what's
already in front of them, against a render pipeline that matches what they'd
actually run.
