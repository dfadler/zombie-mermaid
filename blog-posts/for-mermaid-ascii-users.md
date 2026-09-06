---
title: zombie-mermaid for mermaid-ascii users
date: 2026-09-05
description: A same-input comparison against mermaid-ascii 1.5.0 — where the two renderers match character for character, where they diverge, and what each does better.
---

If you render Mermaid in a terminal, you have probably used
[mermaid-ascii](https://github.com/AlexanderGrooff/mermaid-ascii), Alexander
Grooff's Go CLI. zombie-mermaid's ASCII renderer started life as a
TypeScript port of that codebase (see the
[attribution](https://github.com/dfadler/zombie-mermaid#attribution)), so for
plain flowcharts the two produce the same characters. This post is about the
places where they don't, and it's written for people who already have
mermaid-ascii in their toolbox and want to know what switching would actually
change.

The short version: you can run zombie-mermaid without installing anything
permanently,

```bash
npx zombie-mermaid render diagram.mmd --ascii
```

and it is worth doing if you hit any of the cases below. If you don't, there
is less reason to switch than a comparison post might suggest, and the last
section says where mermaid-ascii is still the better tool.

## How this was checked

Every output block below was produced on 2026-09-05 by running the same
`.mmd` file through both tools:

- **mermaid-ascii 1.5.0**, the `Darwin_arm64` release binary (tag `b1b35f6`,
  published 2026-08-11), verified against the release's checksum file.
  The `master` branch had moved past that release by 14 commits at the time
  of writing (tip `aa31760`): sequence-diagram activation, `create`/`destroy`,
  `box` groups, and the extended flowchart arrow patterns from their
  [#81](https://github.com/AlexanderGrooff/mermaid-ascii/issues/81). None of
  those touch the cases in this post.
- **zombie-mermaid 1.8.0**, run from the repository at commit `ede76ba` with
  `pnpm exec tsx src/cli.ts render <file> --ascii`. That is what
  `npx zombie-mermaid render <file> --ascii` runs.

Where an issue number from mermaid-ascii's tracker is cited, the claim is
about what the 1.5.0 binary does today, not about the issue's open/closed
label. Several of their fixed issues are still marked open, and several
features that look blocked on stalled PRs have already shipped through other
commits, so open/closed status is not a reliable signal there. Two examples
of that are in the next section.

## What is the same

Start with what does not differ, because a fair amount doesn't.

### Basic flowcharts are character-for-character identical

```mermaid
graph LR
A --> B & C
B --> C & D
D --> C
```

Both tools print exactly this (trailing whitespace aside). These are real
terminal captures (`asciinema` + `agg` against an actual PTY), not a
browser's approximation of one — see "How this was checked" for why that
distinction matters for the sections below with wide characters.

| mermaid-ascii                                                                                                             | zombie-mermaid                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| ![mermaid-ascii terminal output of the A/B/C/D flowchart](../mermaid-ascii-comparison-screenshots/basic-flowchart-ma.png) | ![zombie-mermaid terminal output of the A/B/C/D flowchart](../mermaid-ascii-comparison-screenshots/basic-flowchart-zm.png) |

Same box style, same `-x`/`-y`/`-p` spacing flags with the same defaults,
same edge routing. If your existing diagrams are simple flowcharts, expect
them to look the same.

### Flowchart CJK labels work in both

mermaid-ascii's PR [#49](https://github.com/AlexanderGrooff/mermaid-ascii/pull/49)
("Fix graph diagram CJK/Unicode character rendering") is still open and
conflicting, which makes it look like wide characters are broken in
flowcharts. They aren't, in 1.5.0: the fix landed separately in March 2026
(`ee20c36`, "preserve graph label widths for wide runes"), and the PR was
simply never closed.

```mermaid
flowchart LR
  A["开始"] --> B["处理数据"] --> C["结束"]
```

Both tools, captured from a real terminal:

| mermaid-ascii                                                                                                                | zombie-mermaid                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| ![mermaid-ascii terminal output of the CJK-labelled flowchart](../mermaid-ascii-comparison-screenshots/cjk-flowchart-ma.png) | ![zombie-mermaid terminal output of the CJK-labelled flowchart](../mermaid-ascii-comparison-screenshots/cjk-flowchart-zm.png) |

Bare CJK node IDs (`开始 --> 结束`, no brackets) also render correctly in
both. zombie-mermaid had its own bug there until 1.7.0
([#328](https://github.com/dfadler/zombie-mermaid/issues/328)).

### Multi-line labels work in both

Likewise PR [#47](https://github.com/AlexanderGrooff/mermaid-ascii/pull/47)
(multi-line labels via `<br/>`) is open and conflicting, but the feature
shipped through `6ab2af2` in March 2026.

```mermaid
flowchart LR
  A["First<br/>Second"] --> B["Line 1<br>Line 2<br>Line 3"]
```

mermaid-ascii 1.5.0 puts a blank row between each line; zombie-mermaid
keeps them adjacent. Both captured from a real terminal:

| mermaid-ascii (blank row between lines)                                                                                      | zombie-mermaid (adjacent lines)                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| ![mermaid-ascii terminal output of the multi-line-label flowchart](../mermaid-ascii-comparison-screenshots/multiline-ma.png) | ![zombie-mermaid terminal output of the multi-line-label flowchart](../mermaid-ascii-comparison-screenshots/multiline-zm.png) |

That is a spacing preference, not a capability gap.

### Sequence-diagram fragments work in both

Their [#68](https://github.com/AlexanderGrooff/mermaid-ascii/issues/68)
(`alt`/`else`/`opt`/`loop`/`par`/`critical`/`break`/`rect` all failing to
parse) is still open, but 1.5.0 renders every one of those as a labelled
frame. Not a differentiator.

## Where they differ

### Sequence diagrams with wide characters

This is the one to check first if your diagrams contain CJK text.
mermaid-ascii's README lists "Unicode support (emojis, CJK characters, etc.)"
under sequence diagrams, and the characters do come out intact. But the
layout measures them as one column each, and a CJK character occupies two,
so every line that contains one is pushed right.

```mermaid
sequenceDiagram
  participant 客户端
  participant 服务器
  客户端->>服务器: 请求数据
  服务器-->>客户端: 返回结果
```

A plain-text code block can't actually show this bug — a proportional or
approximated rendering can hide exactly the column-drift that's being
claimed here — so both sides below are real terminal captures
(`asciinema` + `agg` against a genuine PTY), not a browser mockup. Look at
where the right-hand box and the arrowheads land relative to the left
column:

| mermaid-ascii (drifts right)                                                                                                                                           | zombie-mermaid (stays aligned)                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| ![mermaid-ascii terminal output of the CJK sequence diagram, showing the right column drifting rightward](../mermaid-ascii-comparison-screenshots/sequence-cjk-ma.png) | ![zombie-mermaid terminal output of the same CJK sequence diagram, staying aligned](../mermaid-ascii-comparison-screenshots/sequence-cjk-zm.png) |

Measured by display width (East Asian Wide characters counted as two
columns), mermaid-ascii's lines come out at 25, 28, 25, 21, 25, 21, 21, 25,
21, 21 columns; zombie-mermaid's lifeline rows are all 20 and its box rows
all 24. The same thing happens with Japanese participant names and with a
Latin diagram whose message text is CJK. zombie-mermaid had exactly this bug
until 1.7.0 ([#334](https://github.com/dfadler/zombie-mermaid/issues/334));
the fix was to measure text by display width everywhere the sequence
renderer sizes or positions it.

(One stylistic difference is visible above and is not a bug: zombie-mermaid
repeats the participant boxes at the bottom, the way mermaid.js does.)

### Subgraphs containing a node with no edges

Their [#91](https://github.com/AlexanderGrooff/mermaid-ascii/issues/91),
reported against both 1.5.0 and `master`. Two subgraphs, one edge between
them, and one node (`b2`) that nothing connects to.

```mermaid
flowchart TB
  subgraph a["Frontend tier"]
    a1["load balancer"]
  end
  subgraph b["Application tier"]
    b1["worker pool"]
    b2["api server"]
  end
  a1 --> b1
```

mermaid-ascii 1.5.0 merges the two frames, overwrites one title with the
other ("FrontenApplication tier"), and draws `worker pool` in the frontend
column. Real terminal captures:

| mermaid-ascii (frames merged, title overwritten)                                                                                                                                                              | zombie-mermaid (two clean frames)                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![mermaid-ascii terminal output of the edge-less-subgraph-node flowchart, showing the two subgraph titles merged into one corrupted string](../mermaid-ascii-comparison-screenshots/subgraph-edgeless-ma.png) | ![zombie-mermaid terminal output of the same flowchart, showing two distinct subgraph frames](../mermaid-ascii-comparison-screenshots/subgraph-edgeless-zm.png) |

### Three labelled edges out of one node, top-down

Their [#70](https://github.com/AlexanderGrooff/mermaid-ascii/issues/70): in
`TB` layout the middle label disappears. The edge is drawn, the label isn't.

```mermaid
flowchart TB
    A -->|alpha| B
    A -->|beta| C
    A -->|gamma| D
```

mermaid-ascii 1.5.0 drops `beta`; zombie-mermaid keeps all three (`beta`
and `gamma` share the horizontal run out of `A`, which is cramped but
complete). Real terminal captures:

| mermaid-ascii (no `beta`)                                                                                                                                     | zombie-mermaid (all three labels)                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![mermaid-ascii terminal output of the three-labelled-edge flowchart, missing the beta label](../mermaid-ascii-comparison-screenshots/tb-three-labels-ma.png) | ![zombie-mermaid terminal output of the same flowchart, showing all three labels](../mermaid-ascii-comparison-screenshots/tb-three-labels-zm.png) |

### Node shapes, and labels that aren't IDs

mermaid-ascii's README lists "Shapes other than rectangles" as unsupported,
and their [#46](https://github.com/AlexanderGrooff/mermaid-ascii/issues/46)
tracks the consequence: `B{Decision?}` is parsed as a node whose ID is the
literal string `B{Decision?}`, so a later reference to `B` creates a second
node. Square-bracket labels were fixed; braces and parentheses were not, per
a later comment on that issue, and 1.5.0 behaves the same way.

```mermaid
graph TD
    A["Start"] --> B{Decision?}
    B -->|yes| C(Done)
    B -->|no| A
```

mermaid-ascii 1.5.0 renders four nodes for a three-node graph, with the
brace and parenthesis syntax printed verbatim (`B{Decision?}`, `C(Done)`).
zombie-mermaid renders three nodes, with the diamond and the rounded box
marked as such. Real terminal captures:

| mermaid-ascii (four nodes, literal `{}`/`()`)                                                                                                                                                  | zombie-mermaid (three nodes, real shapes)                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ![mermaid-ascii terminal output of the label-vs-ID flowchart, showing B{Decision?} and C(Done) printed literally as a fourth node](../mermaid-ascii-comparison-screenshots/label-vs-id-ma.png) | ![zombie-mermaid terminal output of the same flowchart, rendering a diamond decision shape and a rounded Done box](../mermaid-ascii-comparison-screenshots/label-vs-id-zm.png) |

### Diagram types beyond flowchart, sequence and ER

mermaid-ascii supports graphs/flowcharts, sequence diagrams, and ER
diagrams. Anything else is a hard error:

```text
level=fatal msg="failed to parse graph diagram: unsupported graph type 'stateDiagram-v2'. Supported types: 'graph' or 'flowchart' with an optional direction (TD, TB, BT, LR, RL)"
```

That is their [#61](https://github.com/AlexanderGrooff/mermaid-ascii/issues/61),
still open. `classDiagram` fails the same way. zombie-mermaid renders
`stateDiagram-v2`, `classDiagram`, and `xychart-beta` in ASCII, in addition
to the three both tools share:

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Running : start
    Running --> Idle : stop
    Running --> [*]
```

zombie-mermaid, captured from a real terminal (mermaid-ascii can't render
this diagram type at all, per the error above):

![zombie-mermaid terminal output of the stateDiagram-v2 example, showing the start/end markers and two labelled states](../mermaid-ascii-comparison-screenshots/state-diagram-zm.png)

### Fitting a terminal width

mermaid-ascii has "Prevent rendering more than X characters wide" on its
TODO list, and PR #47 proposed a `-w/--maxWidth` flag that never merged;
1.5.0 rejects `-w` as an unknown flag. zombie-mermaid has `-w`/`--max-width
<n|auto>`: if the output at the requested spacing is wider than the limit,
it retries with compact spacing (`-x 1 -y 1 -p 0`) and tells you on stderr.

```mermaid
flowchart LR
  A[Parse] --> B[Layout] --> C[Route edges] --> D[Draw boxes] --> E[Draw edges] --> F[Print]
```

`zombie-mermaid render chain.mmd --ascii --max-width 70`, captured from a
real terminal:

![zombie-mermaid terminal output of the six-node chain flowchart at --max-width 70, showing the compact-spacing note and the resulting narrower diagram](../mermaid-ascii-comparison-screenshots/max-width-zm.png)

`auto` reads the terminal's width. Be clear about the limit, though: compact
spacing is the only strategy. If the diagram still doesn't fit (this one is
64 columns at its narrowest, so `--max-width 40` cannot succeed), you get the
compact rendering plus a warning, not wrapped labels or a flipped direction.
That is tracked in
[#335](https://github.com/dfadler/zombie-mermaid/issues/335).

### SVG output and themes from the same source

This isn't a comparison so much as a category difference: mermaid-ascii is
an ASCII renderer, and zombie-mermaid is an SVG renderer that also does
ASCII. The same file that produced any of the text above can produce an SVG:

```bash
zombie-mermaid render diagram.mmd --svg -o diagram.svg --theme tokyo-night
zombie-mermaid themes   # lists the built-in themes
```

There's also an MCP server (`zombie-mermaid mcp`) exposing the same render
calls to an agent, and a local web UI (`zombie-mermaid web`), which
mermaid-ascii also has.

## Where mermaid-ascii is better, or just as good

- **ER diagrams.** mermaid-ascii's ER renderer (added in July 2026) draws
  crow's-foot cardinality tokens and gives every relationship its own
  routing lane so labels never collide. For the same two-relationship
  schema, its output is easier to read than zombie-mermaid's:

  ```mermaid
  erDiagram
      CUSTOMER ||--o{ ORDER : places
      ORDER ||--|{ LINE_ITEM : contains
  ```

  Real terminal captures, for the same two claims above:

  | mermaid-ascii                                                                                                                                                                                          | zombie-mermaid                                                                                                      |
  | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
  | ![mermaid-ascii terminal output of the CUSTOMER/ORDER/LINE_ITEM ER diagram, with dedicated crow's-foot routing lanes for each relationship](../mermaid-ascii-comparison-screenshots/er-diagram-ma.png) | ![zombie-mermaid terminal output of the same ER diagram](../mermaid-ascii-comparison-screenshots/er-diagram-zm.png) |

- **A plain-ASCII charset switch on the CLI.** `mermaid-ascii --ascii`
  swaps box-drawing characters for `+`, `-`, `|` and `>`. zombie-mermaid
  exposes that only through the library (`renderMermaidASCII(src, { useAscii:
true })`); the CLI's `--ascii` flag means "print the terminal rendering",
  not "restrict to 7-bit ASCII".
- **A single static binary.** mermaid-ascii is one file with no runtime.
  `npx zombie-mermaid` needs Node.js and downloads the package on first run.
- **Everything both tools share renders about the same.** Flowcharts,
  labelled edges, `A & B` fan-out, sequence messages, notes, `autonumber`,
  fragments: the defaults match closely enough that a side-by-side is mostly
  a diff of whitespace.

## Trying it

```bash
npx zombie-mermaid render diagram.mmd --ascii
cat diagram.mmd | npx zombie-mermaid render --ascii --max-width auto
```

If a diagram renders worse in zombie-mermaid than in mermaid-ascii, that's a
bug here, and a
[minimal `.mmd` in an issue](https://github.com/dfadler/zombie-mermaid/issues)
is the fastest way to get it fixed. The two ER outputs above are already
that kind of report against ourselves.
