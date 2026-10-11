---
title: Four Upstream ER Diagram Reports, Three Pull Requests
date: 2026-10-10
description: Between 2026-05-31 and 2026-06-22, four people reported ER diagram bugs to beautiful-mermaid. All four are still open upstream. Here is what each one was, what fixed it here, and what the fixes do not cover.
---

Most of the bug reports on the upstream
[`beautiful-mermaid`](https://github.com/lukilabs/beautiful-mermaid)
tracker are about flowcharts. ER diagrams are the exception: four separate
reports in three weeks, from three different people, all hitting a
different part of the same renderer. This post is the case study for that
one diagram type. As of 2026-10-10 all four upstream issues are open, and
none has a maintainer reply. Each got a comment from this fork pointing at
the fix.

## 1. Relationship labels cut off (upstream #121)

[Upstream #121](https://github.com/lukilabs/beautiful-mermaid/issues/121),
filed 2026-05-31, is a bundle of ASCII glitches across several diagram
types. The ER part: a relationship label was clamped to a fixed six-character
gap between the two entity boxes, so `ordered in` came out as `ordere`, and
what survived sat flush against the box corners.

Our [PR #88](https://github.com/dfadler/zombie-mermaid/pull/88) widens the
gap per relationship so the full label fits, and keeps one character of
padding from each box. The same input from the issue, rendered by the
current tree:

```text
┌──────────┐        ┌───────┐
│ CUSTOMER │─│────○╟│ ORDER │
└──────────┘ places └───────┘
┌─────────┐            ┌───────────┐
│ PRODUCT │─│────────○╟│ LINE_ITEM │
└─────────┘ ordered in └───────────┘
```

The other items in #121 (the stray `├` on flowchart labels, the
empty class compartment) are not ER bugs and went through separate PRs
([#95](https://github.com/dfadler/zombie-mermaid/pull/95),
[#92](https://github.com/dfadler/zombie-mermaid/pull/92)).

## 2. `}o` parsed as nothing (upstream #124)

[Upstream #124](https://github.com/lukilabs/beautiful-mermaid/issues/124) was filed on 2026-06-03 by a
user who compared against the Mermaid docs: the left-hand symbols `}o` and
`}|` were not recognized. The parser normalized each notation by sorting its
characters so that `o|` and `|o` shared a lookup key. Sorting `}o` gives
`o}`, which the table never checked, so the cardinality silently became
`null`.

[PR #51](https://github.com/dfadler/zombie-mermaid/pull/51) replaced the
sorted key with separate left-side and right-side matchers. The same PR
fixed a mirror image of the bug in the ASCII renderer, where the
zero-or-one marker was always drawn as `o|` regardless of side. Current
output for the reporter's three valid lines:

```text
┌─────┐             ┌─────┐
│ foo │╢○─────────│─│ bar │
└─────┘ should work └─────┘
┌───┐             ┌───┐
│ a │╢───────────╟│ b │
└───┘ should work └───┘
```

The reporter also showed that the invalid `{o--||` was accepted when
Mermaid itself rejects it. We did not fix that. Today it does not throw
either; it is read as the start of an entity block with a strange attribute
line.

## 3 and 4. Aliases and direction (upstream #129, #131)

[Upstream #129](https://github.com/lukilabs/beautiful-mermaid/issues/129)
(2026-06-16) asked for entity aliases, `p[Person] { ... }`. The entity
header regex only accepted a bare token, so it never saw the brackets.
[Upstream #131](https://github.com/lukilabs/beautiful-mermaid/issues/131)
(2026-06-22) asked for `direction TB` to do anything in an `erDiagram`.
It was parsed as nothing and had no effect on layout.

Both went into [PR #81](https://github.com/dfadler/zombie-mermaid/pull/81).
Aliases are stored as the entity label while the id stays the raw token, so
relationships still resolve by id. The parser also reads a `direction` line
and passes it to ELK as the layout direction. Diagrams with no `direction`
keep the old left-to-right default.

```text
┌──────────────────┐      ┌──────────────────┐
│ Person           │      │ Customer Account │
├──────────────────┤─│─○│─├──────────────────┤
│ string firstName │ has  │ string email     │
└──────────────────┘      └──────────────────┘
```

With `direction TB`, `ORDER ||--|{ LINE-ITEM` now drops to a second row
instead of staying on one line. The rendering is not pretty: the connector
that turns the corner draws a `┼` and the label sits on the bend. It is
correct in structure, and tidying it is open work.

## What this says

Three PRs, one diagram type. The four reports share no common
cause, which is the point: the ER renderer had many small gaps, and each reporter found a different one. That is the case for
keeping a fork around that triages them. The fixes shipped in
[v1.2.0](https://github.com/dfadler/zombie-mermaid/releases/tag/v1.2.0)
on 2026-08-27.
