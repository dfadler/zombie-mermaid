---
title: From upstream PR to fork — cherry-picking with authorship intact
date: 2026-10-10
description: Two fixes sat unreviewed on beautiful-mermaid for weeks. Here is how they landed in zombie-mermaid as cherry-picks that keep the original authors in git history, and what both authors said when told.
---

Two pull requests on [`lukilabs/beautiful-mermaid`](https://github.com/lukilabs/beautiful-mermaid) fixed real SVG sizing bugs, came with tests, and sat with no review. One was [#135](https://github.com/lukilabs/beautiful-mermaid/pull/135), opened 2026-07-14. The other was [#139](https://github.com/lukilabs/beautiful-mermaid/pull/139), opened 2026-07-22. Neither has been merged. #139 is still open as I write this.

Both are now in `zombie-mermaid`, and both authors are still the authors in `git log`. This post is how that works mechanically, and what happened when I told them.

## The two fixes

**#135, by [@aryasaatvik](https://github.com/aryasaatvik): monospace fonts.** `RenderOptions.font` takes any family, but text measurement only modeled a proportional font calibrated for Inter. Passing a monospace font sized every box for the wrong glyph widths. The PR's own table, measured at 14px against Commit Mono, showed `iiiiiiiiiiii` estimated at 38px but actually 101px wide (-62%), and `WWWWWWWWWWWW` estimated at 138px but actually 101px (+37%). Narrow labels overflowed their boxes and wide ones were over-padded.

The PR is worth reading for one more reason. The author's first version hooked the wrong function and missed flowcharts entirely, and the first test passed vacuously, because it only asserted that two SVG strings differed (they always do, since `font-family` is in the markup). The author said so in a follow-up comment and pushed a second commit that moved the switch to the single choke point, `measureTextWidth`, and asserted on real node geometry. Both commits are in the port.

**#139, by [@OmShiv](https://github.com/OmShiv): edge-label padding.** The coarse character-class width buckets systematically underestimated Inter's real advances (spaces, `m`/`w`, digits, punctuation), and the error grew with label length. The PR measured the worst cases against real Inter in headless Chrome: `retry with exponential backoff (max 5)` had a -4.7px gap per side where 8px was intended, so the text overflowed its background rect. The fix replaces the buckets with measured per-character advances for printable ASCII, keeping the buckets as the fallback for everything else.

## How the authorship survives

Both ports were done with `git cherry-pick -x`, not by copying a diff. That does two things:

- The commit keeps its original author and author date. In this repo's history, `66e21de6` and `22af5b82` (the two #135 commits) are authored by Saatvik Arya, and `1652f0b5` (the #139 commit) is authored by OmShiv. You can check with `git log --author=Saatvik` or `git log --author=OmShiv`.
- `-x` appends a `(cherry picked from commit …)` line to the message, so the link back to the upstream commit is in the history, not just in a PR description.

Anything the fork had to change goes in its own commits, authored by the fork's maintainer and kept apart from the original:

- For #135, the test file used `bun:test`, and this repo runs Vitest. A separate commit, `8b5b6465`, adapts the test and only the test.
- For #139, a separate commit, `18db281d`, only applies this repo's Prettier formatting.

[PR #501](https://github.com/dfadler/zombie-mermaid/pull/501) (the #139 port) later grew more commits: Linux visual-baseline regenerations, an added set of missing printable-ASCII advances, and own-property checks on the lookup table. Those are separate commits with the fork's authorship. They are not folded into OmShiv's.

The two ports merged on 2026-09-05 ([#500](https://github.com/dfadler/zombie-mermaid/pull/500), merge commit `9786892`) and 2026-09-06 ([#501](https://github.com/dfadler/zombie-mermaid/pull/501), merge commit `40445c0`). Both first shipped in `v2.0.0`, tagged 2026-09-06.

The changelog credits them as well. The [2.0.0 entries](https://github.com/dfadler/zombie-mermaid/blob/main/CHANGELOG.md#200) for #500 and #501 each say "Ports lukilabs/beautiful-mermaid#135 by @aryasaatvik" or "#139 by @OmShiv", say the PR had been open and unreviewed, and say the original commits are cherry-picked with authorship intact. The changelog's automatic "Thanks" line still names the fork's maintainer, so the prose is where the credit lives.

## Telling the authors

On 2026-09-29 I left a comment on each upstream PR. Each one linked the fork's PR and merge commit, named the first release containing the fix, and showed a before and after render of a diagram that exercises it. The #135 comment said the cherry-picks preserved the author's commits; the #139 comment said the fix was credited in the commit and changelog.

Both authors replied:

- @aryasaatvik, on #135: "thank you! will switch to zombie mermaid". The PR was closed the same minute, by the author.
- @OmShiv, on #139: "Thanks!", and then asked whether beautiful-mermaid is still maintained. I replied on 2026-10-06 that it does not look maintained to me. That is my read, based on these two PRs, and not a statement from the upstream owners.

I did not ask either of them to contribute to the fork, and nothing in the replies requires it. The point of the comment was that a person who did good work and heard nothing back now knows it shipped.

## Why this is the pattern

A fork that quietly copies code out of unmerged pull requests has a credit problem, and the person who did the work has no way to know. Cherry-picking with `-x` fixes most of that for free, because git already tracks authorship per commit. The remaining steps are cheap:

1. Cherry-pick with `-x` so author, date and upstream hash stay in the commit.
2. Keep your own edits (test-runner adaptation, formatting, extra fixes) in separate commits.
3. Name the upstream PR and author in the changelog entry.
4. Tell the author, with a link they can click and a before and after that shows their fix working.

None of this needs the upstream maintainers to do anything, which is the reason for doing it.
