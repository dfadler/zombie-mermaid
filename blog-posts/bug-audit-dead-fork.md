---
title: The Bug Audit That Proved a Dead Fork Was Worth Saving
date: 2026-09-06
description: On 2026-08-25, one evening of deliberate, format-by-format testing turned "upstream looks stalled" into fifteen numbered, reproducible rendering bugs. That list is the actual case for continuing the fork.
---

Adopting an abandoned library is a bet. You are trading the certainty of
"someone else maintains this" for the uncertainty of "we do, now." The
usual way people talk themselves into that bet is vibes: the code looks
clean, the last commit wasn't *that* long ago, how bad could it be. We
didn't want to find out the hard way six months in, so before doing
anything else with this fork we spent one evening — 2026-08-25 — trying to
break it on purpose.

The method was boring by design: pick both rendering backends this project
ships (SVG and ASCII), go through them diagram type by diagram type
(flowchart, sequence, class, ER, state), and for every place the output
looked wrong, file one issue with a minimal `.mmd` repro and the specific
line of code responsible. No fixing yet. Just cataloguing.

## Eighteen issues in seventeen minutes

The filing timestamps tell the story better than a summary would.
[#54](https://github.com/dfadler/zombie-mermaid/issues/54) went in at
19:32:21 UTC. By 19:49:06, eighteen issues existed — [#54](https://github.com/dfadler/zombie-mermaid/issues/54)
through [#69](https://github.com/dfadler/zombie-mermaid/issues/69), then
[#73](https://github.com/dfadler/zombie-mermaid/issues/73) and
[#74](https://github.com/dfadler/zombie-mermaid/issues/74) a few minutes
later once a nested-subgraph repro took longer to construct. Three of
those eighteen weren't rendering bugs at all — a missing `require` export
condition in `package.json` and two feature requests, filed in the same
sweep because they were also sitting right there. The other fifteen were
exactly what the method was built to produce: reproducible defects in how
the two renderers turn Mermaid source into pixels or characters.

That's fifteen, not the round "twenty" this series' outline reached for.
Real audits don't land on tidy numbers, and getting the count right
matters more here than getting a rounder one — the whole point of this
post is that the list is evidence, and evidence you've inflated stops
being evidence.

Ten of those fifteen are worth walking through, because they're not the
same bug in a trenchcoat. They span both renderers and touch parsing,
layout, and paint — which is itself informative: a fork with one deep,
narrow problem is a different kind of risk than a fork with a dozen
shallow ones scattered across every subsystem.

## What was actually broken

**SVG output lied about direction.** [#54](https://github.com/dfadler/zombie-mermaid/issues/54)
found that every `marker-start` arrowhead was double-reversed, so a
bidirectional edge (`<-->`) rendered with only its end arrowhead, and a
backward edge (`<-.-`) rendered with no arrowhead at all — just a bare
line pointing nowhere in particular. The marker's polygon was already
mirrored for `orient="auto-start-reverse"`, and the reverse orientation
mirrored it again. Two negatives that should have cancelled out didn't,
because they were applied in two different places (`src/renderer.ts`, and
mirrored again in the class and sequence renderers) that had drifted out
of sync with each other.

**SVG output was unreadable in the theme half its users would pick.**
[#55](https://github.com/dfadler/zombie-mermaid/issues/55) found that a
node with a custom `fill` from `classDef` or `style` always got its label
text painted in the theme's foreground color — meaning a light pastel fill
under a dark theme (`fg: '#FAFAFA'`) rendered white text on a light-red
background. The renderer knew the node's custom color. It just never
asked whether that color needed light or dark text on top of it.

**SVG output silently dropped styling hooks.** [#56](https://github.com/dfadler/zombie-mermaid/issues/56)
found that `:::className` shorthand correctly resolved `classDef` fill and
stroke onto a node, but never wrote the class name itself onto the
rendered `<class>` attribute — so a page embedding the SVG inline with its
own CSS had no way to select that node. mermaid.js emits the class name.
This fork's shorthand path quietly didn't.

**The ER parser sorted away information it needed.**
[#59](https://github.com/dfadler/zombie-mermaid/issues/59) found that
`parseCardinality()` normalized a cardinality token by sorting its
characters alphabetically before comparing it against a fixed set —
so `}o` (zero-or-more) and its mirror both collapsed to the same sorted
string as something else, and the wrong cardinality symbol rendered on the
wrong side of the relationship. The same issue covered entity aliases and
a `direction` directive that parsed fine and then did nothing, because
nothing downstream read the field it was parsed into.

**A trailing semicolon made styling vanish.**
[#60](https://github.com/dfadler/zombie-mermaid/issues/60) found that
`class A,B className;` — semicolon and all, which is legal Mermaid — never
matched the regex `src/parser.ts` used to detect a class assignment,
because that regex was anchored with `$` at the very end of the line. The
statement fell through to being treated as a stray node instead, so not
only did the styling never apply, the literal text `class` could show up
as a rendered label.

**Two different tokenization bugs shared one flowchart parser.**
[#61](https://github.com/dfadler/zombie-mermaid/issues/61) found that
`A-->B` with no surrounding spaces produced one bogus node (`A--`) and
zero edges — the arrow got consumed into the node id — while `A --> B`
and `A -->B` both parsed correctly. The same issue found that brackets
inside a quoted label corrupted the label text. Neither bug depended on
the other; they'd just never been noticed because most hand-written
Mermaid puts spaces around arrows.

**The ASCII layout engine crashed outright.**
[#64](https://github.com/dfadler/zombie-mermaid/issues/64) found that
`src/ascii/grid.ts` and its pathfinding and edge-bundling helpers threw a
hard `RangeError` (internally, a `Map` exceeding its maximum size) on
graphs with dense fan-in — many edges converging on one node. This is the
ASCII renderer's original custom routing code, not the ELK.js-backed
layout the SVG path had already moved to, so bugs here didn't get the
benefit of an off-the-shelf layout library's own test suite.

**Two ASCII edge styles didn't render their own target node.**
[#65](https://github.com/dfadler/zombie-mermaid/issues/65) found that
`--o` and `--x` edges — valid, documented Mermaid edge terminators —
rendered only the source box. `A --o B` printed `A` and silently dropped
`B` and the edge connecting them, no error, nothing in the output to
suggest anything was missing. Every other edge variant (`-->`, `---`,
`==>`, `-.->` , labeled edges) rendered both ends correctly.

**A self-arrow corrupted the whole canvas.**
[#68](https://github.com/dfadler/zombie-mermaid/issues/68) found that a
sequence diagram self-arrow (`A->>A: ...`) with a `<br/>` in its label
didn't just render badly — it corrupted unrelated parts of the ASCII
canvas, and self-arrows generally could render outside their enclosing
`alt`/`loop`/`opt` block instead of inside it.

**Nested subgraphs ignored their own direction.**
[#73](https://github.com/dfadler/zombie-mermaid/issues/73) found that
`direction` directives on a subgraph nested inside another subgraph were
never honored, and edges crossing that boundary either failed to route
cleanly or stair-stepped through gaps too tight to hold them. The shared
ELK-based layout code (`src/layout-engine/to-elk.ts`) used
`hierarchyHandling: 'SEPARATE'` to let subgraphs override direction — the
exact mechanism that, read closely, was already known to produce
cross-boundary routing failures.

## Two speeds of fixing, and why that split is itself informative

Of these ten, four were fixed the same evening they were filed — the
arrowhead reversal, the dark-mode label contrast, the missing class
attribute, and the trailing-semicolon parser bug, all closed within about
four hours of being opened. Those four had something in common: each was
a small, local, single-file fix once the actual defect was identified.

The other six — the ER parser bugs, the no-space-arrow tokenization bug,
the ASCII fan-in crash, the `--o`/`--x` dropped-node bug, the self-arrow
canvas corruption, and the nested-subgraph routing bug — landed the next
day, all but one by mid-afternoon. These touched shared parsing or layout
code with more surface area to get right, and in at least two cases
(the fan-in crash and the dropped-node bug) the fix commits carry test
coverage for edge cases the original bug report didn't even mention,
because fixing them properly meant understanding the whole routing path,
not just patching the one repro.

That split — same-evening for isolated defects, next-day for anything
touching shared layout or parsing code — is a more honest signal than
either "we fixed it fast" or "we fixed it thoroughly" would be on its own.
Both things were true, for different bugs, for legible reasons.

## The list is the pitch

None of this is an argument by adjective. It's not "this fork is well
maintained" or "we care about quality." It's ten dated, numbered,
independently reproducible defects, each with a file and line number, each
closed by a commit that a skeptical reader can go read right now. That's
what de-risking a bet on an abandoned library actually looks like in
practice: not a promise, a list. If the list is short and vague, the fork
probably isn't being tested hard. If it's this specific — arrowhead
polygons, cardinality-sorting collisions, `Map` size limits — it means
someone went looking with the assumption that something was broken, and
found out exactly what.

We'd go back to this well later. A handful of these same fixes — the
arrowhead reversal, the no-space-arrow bug, the ER cardinality and alias
bugs, the ASCII fan-in crash, the dropped-node bug, the nested-subgraph
routing bug — eventually got a second life as before/after entries in
`fork-fixes.html`, a page that renders each "before" from the actual
renderer as it existed immediately before its fix, not a description of it
from memory. A later post in this series goes deep on that page and why
"nothing described from memory" became a hard rule for this project's own
evidence. For this post, the numbered list from one evening in August is
the evidence on its own.
