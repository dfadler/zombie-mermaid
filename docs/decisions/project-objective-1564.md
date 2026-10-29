# Project objective

Status: accepted (maintainer decided the direction on 2026-10-15, answered the seven open questions and accepted this doc on 2026-10-29)

## Context

[#1564](https://github.com/dfadler/zombie-mermaid/issues/1564) asked for the
project's objective to be written down, so that "is this a gap?" has a definition
and the Mermaid-coverage review has something to measure against. Everything
below is checked against the repo as of 2026-10-29; each claim names its source.
Points that only the maintainer could decide are marked **(decided)** with the
decision, or **Direction, not a decision** where an idea is recorded but not
committed to.

## Decision

### What the project is for

The maintainer's decision on #1564 (2026-10-15, "Option B"): **the best Mermaid
renderer for terminals and agents.** zombie-mermaid renders Mermaid source to
static SVG and to ASCII/Unicode text, with no DOM dependency
([README](../../README.md), "Features"), and ships a library, a CLI and an MCP
server ([`package.json`](../../package.json) `bin`; [mcp-tools.md](../mcp-tools.md)).
The terminal-specific work follows from this choice: opt-in profile and width
options ([#2011](https://github.com/dfadler/zombie-mermaid/issues/2011),
[#2057](https://github.com/dfadler/zombie-mermaid/issues/2057), both closed) and
the open umbrella
[#2086](https://github.com/dfadler/zombie-mermaid/issues/2086), which is about
smaller bundles through per-type entry points. The default ASCII output is not
width-limited; see "ASCII and SVG parity".

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

**Fidelity order (decided).** Syntax coverage first, then layout, then visuals.
A construct mermaid accepts that this project fails to parse is a bug. A node
placed on the wrong side of another, or in the wrong container, is a bug. A
different corner radius, font or colour is a theming choice, not a gap.
**Pixel parity is an explicit non-goal.** The layout floors are regression
guards, not parity claims, and this doc changes none of them; changing the
numeric floors is a separate change.

**Oracle coverage (decided).** The goal is to support every diagram type
mermaid.js supports, so an oracle that accounts for the fidelity details of every
supported type is eventually required, not optional. Today the layout oracle covers
four types (flowchart, state, class, ER); sequence, C4, architecture, pie and
xychart have none in `scripts/`, and chart types need measures other than relative
node placement (slice angles, axis scales). That gap is tracked as follow-up
issues, one per uncovered type, not closed by this doc.

### Scope

Supported today: flowchart (including state), sequence, class, ER, xychart,
architecture, C4 and pie ([README](../../README.md), "Features";
[diagrams.md](../diagrams.md)). Inputs: Mermaid source text. Outputs: SVG,
ASCII/Unicode, and rasterized targets through the CLI.

**New diagram types (decided).** Any diagram type that ships in mermaid.js is in
scope, including `-beta` types (`xychart-beta` and `architecture-beta` are already
supported). Order is decided case by case by demand and effort, and this doc sets
no sequence or date. A type counts as supported only when it parses what mermaid
parses, has an SVG renderer, an ASCII path (see "ASCII fidelity") and an oracle
(see "Oracle coverage"); partial support is labelled as partial. A mermaid.js type
not yet supported here is a known gap, not out of scope.

Direction, not a decision: types may eventually ship as separate sub-packages so
users import only what they need. This doc does not commit to it, and it would
interact with the lockstep versioning of the existing packages
([lockstep-versioning.md](lockstep-versioning.md)).

**Nothing beyond Mermaid (decided).** The project supports what mermaid.js
supports and nothing more. ArchiMate is out of scope: it was declined on
[#1167](https://github.com/dfadler/zombie-mermaid/issues/1167) (scope update of
2026-09-30, closed 2026-10-01) because mermaid.js has no ArchiMate type
([mermaid-js/mermaid#4007](https://github.com/mermaid-js/mermaid/issues/4007) is
an open request there), so supporting it would mean owning a custom DSL taken from
upstream beautiful-mermaid PRs
([#34](https://github.com/lukilabs/beautiful-mermaid/pull/34),
[#71](https://github.com/lukilabs/beautiful-mermaid/pull/71)). Mermaid's native
`architecture-beta` is the supported answer to that use case
([architecture-lowered-to-flowchart-1167.md](architecture-lowered-to-flowchart-1167.md)).
The C4 CHANGELOG line saying ArchiMate "remains open under #1167" is stale; release
notes change only through the Version Packages PR, so it is left as is. A new issue
with real demand can reopen the question.

### Non-goals recorded elsewhere

- **No script or JavaScript interactivity in the output**, so it is safe to inline
  and meaningful as a file or a terminal frame:
  [no-script-interactivity.md](no-script-interactivity.md).
- **The demo site is not a package** and never ships to npm
  ([cli-and-demo-stay-apps.md](cli-and-demo-stay-apps.md)). The CLI, by contrast, is
  published: `@zombie-mermaid/cli` is a public package with the `zombie-mermaid`
  bin (`packages/cli/package.json`), as is the umbrella `zombie-mermaid` package.
  That decision doc dates from before the packages split and is out of date on the
  CLI.
- **Pixel parity** is an explicit non-goal (see "Fidelity order" above).

**Editor and site (decided).** An authoring or editing UI is not a product goal.
The live editor has improved since the fork but is not a primary focus at the
moment ([editor-in-repo-module.md](editor-in-repo-module.md)). The site is a
surface that explains the project: demos, documentation, the editor and a blog. It
is not a product with its own roadmap or support commitments.

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

**ASCII fidelity (decided).** ASCII output is as true to what Mermaid renders as
the target can support. It cannot offer everything SVG does, and finding better
ways to represent Mermaid's output in text is continuing work, not a finished
feature. The renderer inherited from upstream tried to confine output to the
conventional 80 terminal columns; the current approach instead brings ASCII output
as close to the SVG as it can, and width-limiting is an opt-in (`profile:
'markdown'`, the CLI's `-w/--max-width` compact retry) rather than the default.

Direction, not a decision: a separate terminal-oriented package (working name
`zombie-mermaid-ascii-terminal`) built on a core syntax parser shared by composable
renderers, with a terminal renderer that supplies width and other bounds. How the
terminal renderer composes with the ASCII renderer is undecided. This doc commits
to none of it, and it relates to the sub-package direction under "New diagram
types".

Every supported type aims to have an ASCII path, and where ASCII cannot express
something SVG does, that limit is documented per type in
[diagrams.md](../diagrams.md). Missing but expressible features (for example
sequence activation bars) are gaps to track, not accepted differences. All eight
supported types have an ASCII path today.

### Relationship to beautiful-mermaid and mermaid.js

- **beautiful-mermaid** (upstream, `lukilabs/beautiful-mermaid`): zombie-mermaid is
  an independently maintained fork whose git history is upstream's. Fixes from
  upstream PRs are ported with credit, per
  [CONTRIBUTING.md](../../CONTRIBUTING.md) "Porting fixes from upstream"; triage
  state is in `docs/promotion/upstream-pr-seen.json`. See
  [provenance.md](../provenance.md) and the README's "Why This Fork Exists".
- **mermaid.js**: behavioural reference and test oracle (a devDependency,
  `mermaid` 12.2.0), not a runtime dependency.

**Upstream tracking (decided).** There is no obligation to track upstream beyond
case-by-case rescue. The `upstream-tracking` advisory label is an input, and a fix
is ported when it is worth it, with credit.

### Support policy

Verified: only the latest major is supported, and fixes land there only
([versioning-and-deprecation-policy-1568.md](versioning-and-deprecation-policy-1568.md),
section 4; [SECURITY.md](../../SECURITY.md), "Supported versions", which also says
fixes are not backported). Node 24 or newer (`engines` in `package.json`;
[consumer-node-floor-1567.md](consumer-node-floor-1567.md)). The seven published
packages (`zombie-mermaid` and six `@zombie-mermaid/*`, the `fixed` group in
`.changeset/config.json`) version in lockstep ([lockstep-versioning.md](lockstep-versioning.md)). One
maintainer, no formal SLA ([provenance.md](../provenance.md), `SECURITY.md`).

Nothing to decide here: the repo already answers "latest only, no backports".

## Consequences

- The README intro and `docs/README.md` can now link here. Neither was changed in
  this PR.
- Follow-up issues cover the gaps this doc names: an oracle for each type that has
  none, ASCII feature gaps, and supporting the mermaid.js types not yet handled.
- "Gap" in the Mermaid-coverage review means: valid mermaid syntax, or a diagram
  type mermaid.js ships, that this project does not yet handle, or a difference
  from the reference not listed in [known-differences.md](../known-differences.md).
  Constructs outside mermaid.js (for example ArchiMate) are not gaps.
- This doc does not change any code or CI floor.
