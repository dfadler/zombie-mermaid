# Parser error-message audit (issue #541)

Audit of parse-error quality across all five diagram-type parsers, done by
writing deliberately-broken `.mmd` snippets and running them through the
real parse paths (`parseMermaid`, `parseSequenceDiagram`,
`parseClassDiagram`, `parseErDiagram`, `parseXYChart`, and the top-level
`renderMermaidSVG` entry point that routes between them via
`detectDiagramType`) — not by reading the error-construction code and
assuming. All error text below is copy-pasted from an actual thrown
`Error.message` or an actual returned (wrong) result, captured via a
throwaway harness script executed with `tsx`.

## Summary

Every parser in this codebase currently falls into one of two buckets, and
neither is good:

1. **Throws, but with no line/column position, ever.** Every `throw new
   Error(...)` across all five parsers (`src/parser.ts`,
   `src/sequence/parser.ts`) is a bare message string with no position
   information. Zero occurrences of line/column in any thrown error.
2. **Doesn't throw at all — silently drops the malformed line and keeps
   going**, producing a diagram that's silently missing content instead of
   surfacing any error. This is not "type X is worse than type Y" — it's
   the default behavior in **all five** parsers for anything past the
   header line. `src/class/parser.ts`, `src/er/parser.ts`, and
   `src/xychart/parser.ts` contain **zero** `throw`/`Error` statements in
   the entire file — every malformed body line in those three diagram types
   is unconditionally silently ignored, full stop.

On top of that, there's a third, cross-cutting gap that surfaced during the
audit and turned out to be the single most concrete, highest-value one: the
**diagram-type routing layer itself** (`detectDiagramType` in
`src/diagram-type.ts`) silently misroutes a typo'd or malformed header for
sequence/class/ER/xychart diagrams into the *flowchart* parser as a
fallback default, which then throws a flowchart-specific error message that
never even mentions the other four diagram types exist. This was the "worst
gap" fixed directly in this pass (see below).

## Per-diagram-type findings

### Flowchart / state diagrams (`src/parser.ts`)

Two `throw` sites total (`Invalid mermaid header`, `Empty mermaid diagram`,
plus `toDirection`'s `Invalid direction`). No line/column in any of them.
Every other malformed line in the body is silently dropped.

Captured output:

```
> parseMermaid('flowchrat TD\n  A --> B')
THREW: Invalid mermaid header: "flowchrat TD". Expected "graph TD", "flowchart LR", "stateDiagram-v2", etc.
  (BEFORE this pass's fix — see below for the improved message)

> parseMermaid('flowchart\n  A --> B')
THREW: Invalid mermaid header: "flowchart". Expected "graph TD", "flowchart LR", "stateDiagram-v2", etc.
  (BEFORE — see fix)

> parseMermaid('flowchart TD\n  A -->')            // dangling arrow, no target
NO ERROR THROWN. Node A is created; the dangling edge is silently dropped.
Result: {"nodes":{"A":{...}},"edges":[], ...}

> parseMermaid('flowchart TD\n  A --> B\n  ###totally not valid###')
NO ERROR THROWN. The garbage line is silently ignored; A --> B parses fine.

> parseMermaid('flowchart TD\n  subgraph sg1\n  A --> B')   // unclosed subgraph
NO ERROR THROWN. The unclosed subgraph is silently dropped entirely — the
nodes/edges inside it are kept, but no subgraph grouping appears in output,
with no warning that "subgraph sg1" was never closed.

> parseMermaid('stateDiagramm-v2\n  [*] --> A')    // typo'd state header
THREW: Invalid mermaid header: "stateDiagramm-v2". Expected "graph TD", "flowchart LR", "stateDiagram-v2", etc.
  (BEFORE — see fix; this is doubly confusing since it correctly detected
  this ISN'T a flowchart, yet the message only talks about flowchart/graph
  syntax)
```

### Sequence diagrams (`src/sequence/parser.ts`)

8 `throw` sites, more than any other non-flowchart parser — but every one
mirrors a *semantic* Mermaid.js error (duplicate actor id, box nesting,
create/destroy mismatch, unknown actor) copied verbatim for compatibility;
none carry a line number. Syntactic errors (bad arrow, unmatched
block/`end`, unknown actor referenced in a plain message) are not detected
at all — silently accepted or silently dropped.

```
> parseSequenceDiagram(['sequenceDiagram', 'Alice->>>Bob: Hello'])   // typo'd triple->>>
NO ERROR THROWN. Parses ">Bob" as the recipient's literal actor id/label —
the extra ">" from the typo is silently absorbed into the actor name
instead of being rejected as a bad arrow.
Result: actors include {"id":">Bob","label":">Bob",...}

> parseSequenceDiagram(['sequenceDiagram','Alice->>Bob: Hi','end'])  // unmatched "end"
NO ERROR THROWN. The stray "end" (no open alt/loop/opt/etc.) is silently
ignored — no warning that it doesn't close anything.

> parseSequenceDiagram(['sequenceDiagram','Alice->>Bob: Hi','alt success','Bob-->>Alice: ok'])
  // alt opened, never closed with "end"
NO ERROR THROWN. The unterminated block is silently dropped from the
diagram's block list — messages inside it still parse, but the alt/else
grouping and its "success" label vanish with no indication anything was
wrong.

> parseSequenceDiagram(['sequenceDiagram','###nonsense###'])
NO ERROR THROWN. Empty actors/messages array, no complaint.
```

Existing throws (semantic, no position — representative sample):

```
"Sequence diagram: a box cannot be nested inside another box — close the open box with \"end\" first"
"It is not possible to have actors with the same id, even if one is destroyed before the next is created. Use 'AS' aliases to simulate the behavior"
"The created participant X does not have an associated creating message after its declaration. Please check the sequence diagram."
"A same participant should only be defined in one Box: X can't be in 'A' and in 'B' at the same time."
```

### Class diagrams (`src/class/parser.ts`)

**Zero `throw`/`Error` statements in the entire file.** Every malformed
line, no matter how broken, is silently ignored.

```
> parseClassDiagram(['classDiagrm', 'class Animal'])   // typo'd header
NO ERROR THROWN. "classDiagrm" itself isn't even validated by this
function — it's just the first line, unconditionally skipped as the
assumed header regardless of content — so this "succeeds" by accident.
(Note: in the real end-to-end pipeline this never actually reaches this
function at all — see the routing-layer finding below.)

> parseClassDiagram(['classDiagram', 'Animal <|--'])   // dangling relationship arrow
NO ERROR THROWN. Result: {"classes":[],"relationships":[]} — the entire
line silently produces nothing, no node, no relationship, no error.

> parseClassDiagram(['classDiagram', 'class Animal {', '  +String name'])
  // unclosed class body (missing closing brace)
NO ERROR THROWN. Attribute is still captured, but nothing flags the
missing "}".

> parseClassDiagram(['classDiagram', '###nonsense###'])
NO ERROR THROWN.
```

### ER diagrams (`src/er/parser.ts`)

**Zero `throw`/`Error` statements in the entire file.** Same pattern as
class diagrams.

```
> parseErDiagram(['erDiagram', 'CUSTOMER ??--?? ORDER : places'])
  // invalid cardinality tokens
NO ERROR THROWN. Result: {"entities":[],"relationships":[]} — silently
produces nothing at all for a line that's clearly attempting a
relationship.

> parseErDiagram(['erDiagram', 'CUSTOMER ||--o{ ORDER :'])  // missing label after colon
NO ERROR THROWN. Result: {"entities":[],"relationships":[]} — again,
silently dropped rather than e.g. treating it as an unlabeled relationship
or flagging the missing label.

> parseErDiagram(['erDiagram', '###nonsense###'])
NO ERROR THROWN.
```

### XY charts (`src/xychart/parser.ts`)

**Zero `throw`/`Error` statements in the entire file.** Worst *silent data
corruption* of the five: a non-numeric value inside a numeric data series
is coerced to `null` rather than rejected, which can propagate into layout
math silently.

```
> parseXYChart(['xychart-beta', 'x-axis [a, b, c', 'bar [1, 2, 3]'])
  // missing closing bracket on x-axis
NO ERROR THROWN. Result: xAxis has no "categories" at all (silently
empty) — the malformed bracket list is dropped with zero indication.

> parseXYChart(['xychart-beta', 'x-axis [a, b, c]', 'bar [1, "two", 3]'])
  // non-numeric literal inside a numeric series
NO ERROR THROWN. Result: series data is [1, null, 3] — the string "two" is
silently coerced to null with no error or warning, which will visibly break
the rendered chart (a gap in the bar) with no indication why.

> parseXYChart(['xychart-beta'])   // header only, no body at all
NO ERROR THROWN. Result: empty chart, no series, no axis — completely
silent.
```

## The worst gap, and why it's the one fixed in this pass

Every one of the four non-flowchart diagram types is only ever reached
through `detectDiagramType` (`src/diagram-type.ts`), which requires an
**exact** (trimmed, case-insensitive) match against
`sequencediagram`, `classdiagram`, `erdiagram`, or `xychart(-beta)?` as the
*entire* first statement. Anything that doesn't match exactly — a typo, a
trailing word, wrong punctuation — silently falls through to the
`'flowchart'` default and gets handed to `src/parser.ts`'s flowchart
parser, which then throws:

```
Invalid mermaid header: "<whatever the user typed>". Expected "graph TD", "flowchart LR", "stateDiagram-v2", etc.
```

This message never mentions `sequenceDiagram`, `classDiagram`, `erDiagram`,
or `xychart-beta` — even though **all four are diagram types this library
fully supports** — so a user who typo'd `classDiagrm` or wrote
`sequenceDiagram foo` gets an error that reads as if only flowchart-family
syntax exists at all. Verified end-to-end via the real public entry point,
`renderMermaidSVG` (not just the internal parser):

```
renderMermaidSVG('classDiagrm\n  class Animal')
  BEFORE: Invalid mermaid header: "classDiagrm". Expected "graph TD", "flowchart LR", "stateDiagram-v2", etc.

renderMermaidSVG('erDiagrm\n  CUSTOMER ||--o{ ORDER : places')
  BEFORE: Invalid mermaid header: "erDiagrm". Expected "graph TD", "flowchart LR", "stateDiagram-v2", etc.

renderMermaidSVG('sequenceDiagram foo\n  Alice->>Bob: Hi')
  BEFORE: Invalid mermaid header: "sequenceDiagram foo". Expected "graph TD", "flowchart LR", "stateDiagram-v2", etc.

renderMermaidSVG('xychart-bta\n  x-axis [a, b, c]\n  bar [1, 2, 3]')
  BEFORE: Invalid mermaid header: "xychart-bta". Expected "graph TD", "flowchart LR", "stateDiagram-v2", etc.
```

This is high-value (it's the very first thing a new user sees when they
get the diagram-type keyword slightly wrong — arguably the single most
common mistake) and safely small in scope: the fix is entirely inside
`src/parser.ts`'s header-validation error path (the shared fallback every
misrouted header ends up in), touches no parsing logic in any of the five
parsers, and needed no changes to `detectDiagramType` itself.

### Fix implemented in this pass

`src/parser.ts`:

- Added `suggestedHeaderFor(header)`: recognizes a header that looks like an
  attempt at `sequenceDiagram`/`classDiagram`/`erDiagram`/`xychart-beta`/
  `stateDiagram-v2` (by prefix) and returns the canonical spelling, or
  `undefined` if the header doesn't resemble any of them.
- Split the invalid-header throw into two cases:
  - Header starts with `graph`/`flowchart` but has a bad/missing direction
    token → a direction-specific message (`Invalid direction "XYZ" in
    header "graph XYZ". Expected one of: TD, TB, LR, BT, RL.` /
    `Missing direction in header "graph". Expected e.g. "graph TD" or
    "flowchart LR" — one of: TD, TB, LR, BT, RL.`).
  - Anything else → the generic message now lists **all six** supported
    header forms (previously only three, and worded as "graph TD",
    "flowchart LR", "stateDiagram-v2", "etc." with no real enumeration of
    the other types), plus a "Did you mean "X"?" hint when the header
    resembles one of the four multi-word headers. The hint is suppressed
    when the header already exactly equals the suggestion, to avoid a
    tautological "Did you mean sequenceDiagram?" on text that already says
    exactly that (reachable only via direct low-level `parseMermaid()`
    misuse, not through the real `renderMermaidSVG` routing path).

After the fix (same inputs as above, through `renderMermaidSVG`):

```
renderMermaidSVG('classDiagrm\n  class Animal')
  AFTER: Invalid mermaid header: "classDiagrm". Did you mean "classDiagram"? Supported headers: "graph <dir>"/"flowchart <dir>" (dir: TD, TB, LR, BT, RL), "stateDiagram-v2", "sequenceDiagram", "classDiagram", "erDiagram", "xychart-beta".

renderMermaidSVG('erDiagrm\n  CUSTOMER ||--o{ ORDER : places')
  AFTER: Invalid mermaid header: "erDiagrm". Did you mean "erDiagram"? Supported headers: ...

renderMermaidSVG('sequenceDiagram foo\n  Alice->>Bob: Hi')
  AFTER: Invalid mermaid header: "sequenceDiagram foo". Did you mean "sequenceDiagram"? Supported headers: ...

renderMermaidSVG('xychart-bta\n  x-axis [a, b, c]\n  bar [1, 2, 3]')
  AFTER: Invalid mermaid header: "xychart-bta". Did you mean "xychart-beta"? Supported headers: ...

parseMermaid('graph\n  A --> B')
  AFTER: Missing direction in header "graph". Expected e.g. "graph TD" or "flowchart LR" — one of: TD, TB, LR, BT, RL.

parseMermaid('graph XYZ\n  A --> B')
  AFTER: Invalid direction "XYZ" in header "graph XYZ". Expected one of: TD, TB, LR, BT, RL.
```

Tests added in `src/__tests__/parser.test.ts` (7 new cases): direction-typo
message, missing-direction message, "Did you mean" for class/ER/xychart/
sequence typos, the full supported-headers list for a totally unrecognized
header, and a regression guard against the tautological-hint edge case.
Sabotage-checked by reverting `src/parser.ts` only and re-running: all 7
new/changed assertions fail against the old message text, confirming they
exercise the real behavior change rather than passing vacuously. Full
suite (156 files / 3007 tests, 5 pre-existing expected-fails), lint, and
`tsc --noEmit` all pass; `vite build --app --config vite.config.lib.ts`
succeeds.

## What was explicitly out of scope for this pass (candidate follow-up issues)

The three items below are systemic across some or all of the five parsers
and are each bigger than a self-contained fix — deliberately not attempted
here per this issue's own "smaller, self-contained" framing. Draft issue
bodies for the two/three most concrete ones are in the task's final report;
they are **not filed** — filing needs separate explicit permission.

1. **No parser anywhere reports line/column position**, because the
   information is discarded before parsing even starts:
   `splitStatements` (`src/statements.ts`, shared by all five parsers)
   returns a bare `string[]` of statements with blank lines and comment
   lines already dropped, so a statement's array index no longer
   corresponds to its original source line number. Adding real position
   info requires `splitStatements` to return `{ text, line }[]` (or
   equivalent) and every one of the five parsers' many regex-match sites to
   thread that through into their error messages — real, valuable, but
   unambiguously a multi-parser architectural change, not a one-line fix.
   (Explicitly checked for the "line/column already computed somewhere but
   not surfaced" scenario this issue anticipated as an easy win — grepped
   the whole `src/` tree for `lineNumber`/`lineIndex`/`sourceLine`; no such
   computation exists anywhere in the codebase today.)

2. **`class`/`er`/`xychart` parsers silently drop every unrecognized body
   line with zero feedback** (no throw, no warning, nothing) — the most
   severe form of the "no error at all" gap, and arguably worse than a bad
   error message: the user gets a diagram that's silently missing content
   with no signal anything went wrong.

3. **`xychart` silently coerces non-numeric series data to `null`** instead
   of rejecting it, which is silent *data corruption* rather than just a
   dropped line, and needs its own scoped fix (validate each data point,
   throw or collect a diagnostic on a non-numeric value) rather than being
   folded into the broader silent-drop problem in (2).
