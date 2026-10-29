# Project objective

Status: proposal (maintainer decided the direction on 2026-10-15; the open questions below are not yet answered)

## Context

[#1564](https://github.com/dfadler/zombie-mermaid/issues/1564) asked for the
project's objective to be written down, so that "is this a gap?" has a definition
and the Mermaid-coverage review has something to measure against. Everything
below is checked against the repo as of 2026-10-29; each claim names its source.
Anything that only the maintainer can decide is marked **Open question** and
carries no position.

## Decision

### What the project is for

The maintainer's decision on #1564 (2026-10-15, "Option B"): **the best Mermaid
renderer for terminals and agents.** zombie-mermaid renders Mermaid source to
static SVG and to ASCII/Unicode text, with no DOM dependency
([README](../../README.md), "Features"), and ships a library, a CLI and an MCP
server ([`package.json`](../../package.json) `bin`; [mcp-tools.md](../mcp-tools.md)).
The slim, width-limited ASCII work follows from this choice: profile and width
options ([#2011](https://github.com/dfadler/zombie-mermaid/issues/2011),
[#2057](https://github.com/dfadler/zombie-mermaid/issues/2057), both closed) and
the open umbrella
[#2086](https://github.com/dfadler/zombie-mermaid/issues/2086).

### What "reasonably reproduce Mermaid" means

Mermaid.js is the behavioural reference. What is measured today:

- **Layout.** `scripts/layout-oracle.ts` compares relative node placement and
  containment against real mermaid for flowchart, state, class and ER samples.
  Each sample has a floor for its lowest figure (default 85%); the floors guard
  against regressions and "do not claim parity"
  ([layout-fidelity-scorecard.md](../layout-fidelity-scorecard.md)). The
  reference is the pinned `mermaid` devDependency (12.2.0), cross-checked against
  GitHub (12.1.0, inferred) and mermaid.live (12.2.0) in
  [known-differences.md](../known-differences.md).
- **Known deviations** are recorded in [known-differences.md](../known-differences.md).
  A difference not listed there, found against what users actually see, is a gap.
- **Visuals** are the project's own themeable style
  ([theming.md](../theming.md)), not a copy of mermaid.js's. The layout oracle
  compares relative placement only, so pixel parity is not something the repo
  measures or claims.

**Open question 1.** What is the fidelity order and the bar? The 2026-10 draft in
the issue proposed syntax coverage, then layout, then visuals, with pixel parity
a non-goal. That is a maintainer call, as are the numeric oracle floors (the
issue comment of 2026-10-15 lists them as still open).

**Open question 2.** The oracle covers four diagram types; sequence, C4,
architecture, pie and xychart have no layout oracle in `scripts/`. Does
"reasonably reproduce" require one for every supported type, or only where
mermaid's layout is the thing users compare?

### Scope

Supported today: flowchart (including state), sequence, class, ER, xychart,
architecture, C4 and pie ([README](../../README.md), "Features";
[diagrams.md](../diagrams.md)). Inputs: Mermaid source text. Outputs: SVG,
ASCII/Unicode, and rasterized targets through the CLI.

**Open question 3.** What qualifies a new diagram type? The issue draft proposed
"an official Mermaid type with a stable syntax; `-beta` types need an explicit
decision". Note that `xychart-beta` and `architecture-beta` are already
supported, so a literal reading of that rule is not how the repo behaves today.

**Open question 4.** ArchiMate. The CHANGELOG entry for C4 says ArchiMate "remains
open under #1167", but #1167 is now closed and
[architecture-lowered-to-flowchart-1167.md](architecture-lowered-to-flowchart-1167.md)
is the record of what shipped. Is ArchiMate in scope, out of scope, or undecided?
Mermaid.js has no ArchiMate type; it came from upstream beautiful-mermaid PRs
([#34](https://github.com/lukilabs/beautiful-mermaid/pull/34),
[#71](https://github.com/lukilabs/beautiful-mermaid/pull/71)).

### Non-goals recorded elsewhere

- **No script or JavaScript interactivity in the output**, so it is safe to inline
  and meaningful as a file or a terminal frame:
  [no-script-interactivity.md](no-script-interactivity.md).
- **The CLI and demo are apps, not libraries** to be consumed as packages:
  [cli-and-demo-stay-apps.md](cli-and-demo-stay-apps.md).
- **Pixel parity** is not measured (see above); whether it is an explicit non-goal
  is open question 1.

**Open question 5.** Is an authoring or editing UI a product goal? The repo has
`editor/` and a demo site ([editor-in-repo-module.md](editor-in-repo-module.md)),
but no document says whether that is a product surface or tooling around the
renderer.

### ASCII and SVG parity

Every one of the eight types above has an ASCII path:
`packages/ascii-renderer/src/` has `flowchart.ts`, `sequence.ts`,
`class-diagram.ts`, `er-diagram.ts`, `xychart.ts`, `pie.ts` and `c4-diagram.ts`,
and architecture is lowered to a flowchart
([architecture-lowered-to-flowchart-1167.md](architecture-lowered-to-flowchart-1167.md)).
ASCII is not feature-equal: it has no fills or strokes, no diagonals and one glyph
per corner ([diagrams.md](../diagrams.md), "ASCII rendering of these shapes",
"ASCII output is unaffected by styling"), and it does not draw sequence
activation bars. Differences of this kind are documented per type in `diagrams.md`.

**Open question 6.** Is ASCII required for every supported type (the issue
comment lists this as open), or best-effort per type with SVG as the reference?
Under the "terminals and agents" decision ASCII is a first-class output, but
whether a type without an ASCII renderer may ship is undecided.

### Relationship to beautiful-mermaid and mermaid.js

- **beautiful-mermaid** (upstream, `lukilabs/beautiful-mermaid`): zombie-mermaid is
  an independently maintained fork whose git history is upstream's. Fixes from
  upstream PRs are ported with credit, per
  [CONTRIBUTING.md](../../CONTRIBUTING.md) "Porting fixes from upstream"; triage
  state is in `docs/promotion/upstream-pr-seen.json`. See
  [provenance.md](../provenance.md) and the README's "Why This Fork Exists".
- **mermaid.js**: behavioural reference and test oracle (a devDependency,
  `mermaid` 12.2.0), not a runtime dependency.

**Open question 7.** Is there any obligation to track upstream beyond case-by-case
rescue? The issue draft proposed none. Not stated in any repo doc.

### Support policy

Verified: only the latest major is supported, and fixes land there only
([versioning-and-deprecation-policy-1568.md](versioning-and-deprecation-policy-1568.md),
section 4; [SECURITY.md](../../SECURITY.md), "Supported versions", which also says
fixes are not backported). Node 24 or newer (`engines` in `package.json`;
[consumer-node-floor-1567.md](consumer-node-floor-1567.md)). The six packages
version in lockstep ([lockstep-versioning.md](lockstep-versioning.md)). One
maintainer, no formal SLA ([provenance.md](../provenance.md), `SECURITY.md`).

No open question here: the repo already answers "latest only, no backports".

## Consequences

- Once the open questions are answered, the status moves to `accepted` and the
  README intro and `docs/README.md` can link here. Neither was changed in this PR.
- "Gap" in the Mermaid-coverage review means: supported type, valid mermaid
  syntax, and a difference from the reference not listed in
  [known-differences.md](../known-differences.md). Types and syntax outside the
  scope above are not gaps.
- This doc does not change any code or CI floor.
