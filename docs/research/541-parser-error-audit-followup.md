# Research: parser error-message quality — current-state audit (#541 follow-up)

Status: **research, not a decision.** Written for
[#541](https://github.com/dfadler/zombie-mermaid/issues/541) ("Improve parser
error-message quality (DX differentiator)", split from
[#536](https://github.com/dfadler/zombie-mermaid/issues/536)).

This is a **follow-up** to the original audit in
[`docs/parser-error-audit-541.md`](../parser-error-audit-541.md) (merged in
[#581](https://github.com/dfadler/zombie-mermaid/pull/581)), not a
replacement. That doc is now partially stale: it states flatly that
`class`/`er`/`xychart` parsers have "zero `throw`/`Error` statements" — true
when it was written, but no longer true for `er` and `xychart` after
[#722](https://github.com/dfadler/zombie-mermaid/pull/722) (merged
2026-09-09, same day as this audit) added targeted throws to both. This doc
re-audits all five diagram-type parsers against the code as it stands today
(after #581 and #722), using the same method as the original: writing
deliberately-broken `.mmd` snippets and running them through the real parse
path — `parseMermaid`, `parseSequenceDiagram`, `parseClassDiagram`,
`parseErDiagram`, `parseXYChart`, and `renderMermaidSVG` (the public
entry point that routes via `detectDiagramType`) — not by reading the
error-construction code and assuming. Every error string quoted below is
copy-pasted from an actual thrown `Error.message`, captured via a throwaway
`tsx` harness script against this branch.

The ASCII front door (`src/ascii/index.ts` / `src/ascii/registry.ts`) calls
the exact same parse functions as the SVG front door — confirmed by reading
both registries — so every finding below applies identically to ASCII and
SVG output; it is not audited twice.

## TL;DR

- **Class diagrams are now the single worst gap.** `packages/mermaid-parser/src/class/parser.ts`
  still has **zero** `throw`/`Error` statements anywhere in the file — the
  only one of the five parsers left in that state after #722. Every
  malformed class-diagram line, no matter how broken, is silently dropped.
- **No parser anywhere reports a line or column number**, even after both
  follow-up passes. This remains a systemic, cross-parser gap — see
  [Follow-up: line/column position](#follow-up-1-no-parser-reports-lineconumn-position-systemic)
  below.
- **ER and xychart-beta error quality is now good** for the cases #722
  targeted: both name the bad token/value, quote the offending line, and
  state the expected shape (a real "expected vs. found" message). Neither
  carries a line/column number, and both still silently drop a line that
  doesn't resemble an attempt at any recognized directive at all (unchanged,
  intentional leniency — see the per-type section).
- **Sequence diagrams still don't detect syntax errors at all** — only
  _semantic_ errors mirrored from mermaid.js (duplicate actor id, box
  nesting, create/destroy mismatch). A typo'd arrow, an unmatched `end`, or
  a reference to a nonexistent block keyword is silently accepted or
  silently dropped, unchanged since the original audit.
- **Flowchart header errors are good** (post-#581): "Did you mean X?"
  suggestions, all six supported headers listed, direction-specific
  messages. Everything past the header line is unchanged from the original
  audit — still silently permissive (dangling arrows, unclosed subgraphs,
  malformed node syntax all parse "successfully" with content quietly
  missing).

## Per-diagram-type findings (current state, 2026-09-09)

### Flowchart / state diagrams (`src/parser.ts`)

Unchanged from the original audit except the header-error fix already
covered there. Header validation is solid; body-line validation still does
not exist.

```
> renderMermaidSVG('classDiagrm\n  class Animal')
THREW: Invalid mermaid header: "classDiagrm". Did you mean "classDiagram"?
Supported headers: "graph <dir>"/"flowchart <dir>" (dir: TD, TB, LR, BT, RL),
"stateDiagram-v2", "sequenceDiagram", "classDiagram", "erDiagram", "xychart-beta".
  → good: names the typo, suggests the fix, lists every supported header.
  → still no line/column (moot here — header is always line 1 — but see below).

> parseMermaid('flowchart TD\n  subgraph sg1\n  A --> B')   // unclosed subgraph
NO ERROR THROWN. Nodes/edges inside the subgraph are kept, but the subgraph
grouping itself silently vanishes — no warning "sg1" was never closed with "end".

> parseMermaid('flowchart TD\n  A -->')                     // dangling arrow, no target
NO ERROR THROWN. Node A is created; the dangling edge is silently dropped.
```

### Sequence diagrams (`src/sequence/parser.ts`)

Unchanged from the original audit. 8 throw sites, all copied verbatim from
mermaid.js's _semantic_ error wording (duplicate actor id, box nesting,
create/destroy mismatch, unknown actor) — genuinely good messages on their
own terms, actionable and specific — but none carry a position, and no
_syntactic_ error is detected at all.

```
> parseSequenceDiagram(['sequenceDiagram', 'create participant A', 'create participant A'])
THREW: It is not possible to have actors with the same id, even if one is
destroyed before the next is created. Use 'AS' aliases to simulate the behavior
  → good message, no line number (which of the two "create participant A"
    lines is the offender is left for the reader to find).

> parseSequenceDiagram(['sequenceDiagram', 'Alice->>>Bob: Hello'])   // typo'd triple arrow
NO ERROR THROWN. Parses ">Bob" as the recipient's literal actor id — the
stray ">" is silently absorbed into the actor name instead of being
rejected as a malformed arrow.

> parseSequenceDiagram(['sequenceDiagram', 'Alice->>Bob: Hi', 'end'])  // unmatched "end"
NO ERROR THROWN. The stray "end" (nothing open) is silently ignored.
```

### Class diagrams (`packages/mermaid-parser/src/class/parser.ts`) — worst remaining gap

**Still zero `throw`/`Error` statements in the entire file**, confirmed by
`grep -n "throw\|Error" packages/mermaid-parser/src/class/parser.ts`
returning no matches. Every malformed line, however broken, is silently
dropped with no signal.

```
> parseClassDiagram(['classDiagram', 'Animal <|--'])   // dangling relationship, no target
NO ERROR THROWN. Result: {"classes":[],"relationships":[]} — the entire
line silently produces nothing.

> parseClassDiagram(['classDiagram', 'class Animal {', '+String name'])
  // unclosed class body (missing closing brace)
NO ERROR THROWN. The attribute is still captured, but nothing flags the
missing "}" — a later, unrelated line could silently get absorbed as if it
were still inside Animal's body, or (as tested) simply never closes and the
diagram "succeeds" with an invisible dangling block.

> parseClassDiagram(['classDiagram', '@#$%^&*()'])   // pure garbage
NO ERROR THROWN. Empty classes/relationships, no complaint.
```

Note: `detectDiagramType`'s header-routing fix (#581) means a _typo'd_
`classDiagram` header (e.g. `classDiagrm`) now gets the good flowchart-path
error described above — it never reaches this function at all. The gap
here is specifically the body: once routing correctly identifies "this is a
class diagram," nothing inside this parser ever objects to anything.

### ER diagrams (`packages/mermaid-parser/src/er/parser.ts`) — fixed for the two most concrete cases

Two throw sites now exist, both added in #722. Message quality is good:
both name the bad token, quote the full offending line, and state the
expected shape.

```
> parseErDiagram(['erDiagram', 'CUSTOMER ??--?? ORDER : places'])
THREW: Invalid ER relationship cardinality "??--??" in "CUSTOMER ??--??
ORDER : places". Left side must be one of ||, |o, }|, }o; right side must
be one of ||, o|, |{, o{ (e.g. "||--o{").

> parseErDiagram(['erDiagram', 'CUSTOMER ||--o{ ORDER :'])   // missing label
THREW: ER relationship "CUSTOMER ||--o{ ORDER" is missing a ": label" —
expected e.g. "CUSTOMER ||--o{ ORDER : label".
```

Remaining leniency (unchanged, and arguably reasonable): a line that
doesn't match the "two tokens flanking a `--`/`..`-based marker" shape at
all — i.e. doesn't look like an attempted relationship — still falls
through silently rather than throwing, same as an attribute line inside an
entity block that doesn't match `type name [keys] ["comment"]`. Neither of
these was in scope for #722 and neither is flagged as a priority follow-up
here; they're "this clearly isn't ER syntax, ignore it" leniency rather
than "this looks like an attempt and is broken."

### XY charts (`packages/mermaid-parser/src/xychart/parser.ts`) — best of the five post-fix

Now the strongest error output in the codebase: every one of the five
directive keywords (`x-axis`, `y-axis`, `bar`, `line`, `title`) has a
dedicated expected-syntax hint, and numeric-series validation names the bad
value and its 1-based position in the list.

```
> parseXYChart(['xychart-beta', 'x-axis [a, b, c]', 'bar [1, "two", 3]'])
THREW: Invalid numeric value "\"two\"" at position 2 in "bar [1, "two", 3]".
Every value in a bar [...] list must be a number.

> parseXYChart(['xychart-beta', 'x-axis [a, b, c', 'bar [1, 2, 3]'])   // unclosed bracket
THREW: Malformed xychart-beta "x-axis" directive: "x-axis [a, b, c".
Expected: x-axis [A, B, C] (categories) or x-axis 0 --> 100 (numeric
range), either optionally preceded by a quoted title.
```

Same remaining leniency as ER: a line matching none of the five known
keywords falls through silently, unchanged and out of scope.

## Scorecard

| Diagram type        | Line/column?     | Expected-vs-found? | Suggested fix?                  | Worst gap                                          |
| ------------------- | ---------------- | ------------------ | ------------------------------- | -------------------------------------------------- |
| Flowchart (header)  | No               | Yes                | Yes ("Did you mean")            | —                                                  |
| Flowchart (body)    | No               | No                 | No                              | Silently drops dangling arrows, unclosed subgraphs |
| Sequence (semantic) | No               | Yes                | Partial (states the rule)       | —                                                  |
| Sequence (syntax)   | N/A — undetected | N/A                | N/A                             | No syntax validation at all                        |
| Class               | N/A — undetected | N/A                | N/A                             | **Zero error detection of any kind**               |
| ER                  | No               | Yes                | Yes (shows valid tokens/format) | Only for relationship-shaped lines                 |
| XY chart            | No               | Yes                | Yes (per-keyword hint)          | Only for the 5 known keywords                      |

No diagram type in this codebase reports a line or column number today.

## Follow-up items (not filed — filing needs separate explicit permission)

### Follow-up 1: No parser reports line/column position (systemic)

**What's wrong:** Every error message across all five parsers — flowchart,
sequence, class (once it has any), ER, xychart — identifies the offending
_line's content_ (by quoting it back) but never its _position_ in the
source. For a multi-hundred-line diagram, a user has to manually search the
source for the quoted text to find where to fix it. Confirmed the
information isn't silently available somewhere and just unsurfaced: grepped
the whole `src/`/`packages/*/src/` tree for `lineNumber`/`lineIndex`/
`sourceLine`/`position` — no such tracking exists anywhere. The root cause
is `splitStatements` (`packages/core/src/statements.ts`), used by all five
parsers, which returns a bare `string[]` of statements with blank lines and
comment lines already dropped — so a statement's array index no longer
corresponds to its original 1-based source line number by the time any
parser sees it.

**Suggested fix:** Change `splitStatements` (and the `Statement[]` shape it
produces) to carry `{ text: string; line: number }` instead of a bare
`string`, computed once while splitting (before comments/blanks are
dropped, so the original line number survives). Every one of the five
parsers' many regex-match call sites would then have a line number
available to interpolate into its existing error-message text (e.g. `at
line 14: Invalid ER relationship cardinality "??--??" in "..."`). This is
larger than a single-parser fix — it touches a shared module all five
parsers depend on — but is mechanical (thread one extra field through) once
the type change is made, and doesn't require rewriting any parser's actual
matching logic. Column position is a separate, smaller follow-on (regex
`.match()` doesn't give a match offset by default; `RegExp.prototype.exec`'s
`.index` does and could be substituted where a message currently just
re-quotes the whole line).

### Follow-up 2: Class-diagram parser has no error detection of any kind

**What's wrong:** `packages/mermaid-parser/src/class/parser.ts` has zero
`throw`/`Error` statements. Every malformed construct — a dangling
relationship arrow with no target, an unclosed `class X { ... }` body, a
line that isn't valid class-diagram syntax at all — is silently dropped
with no error, no warning, and no trace in the output. This is now the
single worst per-type gap in the codebase: ER and xychart both got targeted
fixes for their most common broken-input shapes in #722; class diagrams got
none. A user who mistypes a relationship arrow or forgets a closing brace
gets a diagram that's silently missing content, with nothing to indicate
anything went wrong.

**Suggested fix:** Mirror the pattern #722 already established for ER
(`parseRelationshipLine`) and xychart (`malformedDirectiveError`): for a
line that already _looks like_ an attempt at a known class-diagram
construct — a relationship line (two class names flanking a UML
relationship marker: `<|--`, `*--`, `o--`, `-->`, `..>`, `..|>`), a
`class X {` block opener never matched by a closing `}` before EOF, an
attribute line inside a class body that doesn't match the expected
`[+#-~]?type name` shape — throw a targeted error naming what was found and
what was expected, in the same style as the ER/xychart messages above.
Lines that don't resemble any known construct at all can keep falling
through silently, consistent with the leniency ER/xychart still have for
their own unrecognized lines.

### Follow-up 3: Sequence-diagram parser doesn't detect syntax errors at all

**What's wrong:** All 8 existing throw sites in
`packages/mermaid-parser/src/sequence/parser.ts` guard _semantic_ rules
mirrored from mermaid.js (duplicate actor ids, box nesting, create/destroy
message mismatch) — genuinely good, specific messages. But no _syntactic_
error is ever raised: a malformed arrow (`->>>` instead of `->>`) silently
absorbs the extra character into the actor name instead of being rejected;
an unmatched `end` (closing a block that was never opened) is silently
ignored; a line that isn't valid sequence-diagram syntax at all produces an
empty diagram with no complaint. This is the same "silently drops anything
it doesn't recognize" pattern class diagrams have, just with the added
wrinkle that a malformed arrow can silently produce a _wrong_ actor rather
than merely a missing one — the `->>>` example creates an actor literally
named `">Bob"`, which would then render as a garbled name in the diagram
with no error pointing at the typo that caused it.

**Suggested fix:** Two independently shippable pieces: (1) validate arrow
syntax against the known set (`->`, `-->`, `->>`, `-->>`, `-x`, `--x`, `-)`,
`--)`) before falling back to the loose `MESSAGE_ANY_ARROW_RE`, and throw
when a line looks like an attempted message (`A?something?B: text` shape)
but the arrow token isn't one of the known set — instead of the loose regex
silently absorbing the malformed portion into an actor id. (2) Track the
open-block stack's state at EOF and throw if it's non-empty (unclosed
`alt`/`loop`/`opt`/`par`/`box`), and throw on an `end` encountered with an
empty stack, mirroring the "no error for garbage today" pattern the other
parsers have already had callouts for.

## Sources

- `packages/mermaid-parser/src/class/parser.ts`, `packages/mermaid-parser/src/er/parser.ts`,
  `packages/mermaid-parser/src/sequence/parser.ts`, `packages/mermaid-parser/src/xychart/parser.ts`,
  `src/parser.ts`, `packages/core/src/statements.ts`, `packages/core/src/diagram-type.ts`,
  `src/diagram-registry.ts`, `src/ascii/registry.ts` (this repo, read directly)
- Real parser output captured via a throwaway `tsx` harness invoking
  `parseMermaid`, `parseSequenceDiagram`, `parseClassDiagram`,
  `parseErDiagram`, `parseXYChart`, and `renderMermaidSVG` directly against
  this branch (2026-09-09)
- [`docs/parser-error-audit-541.md`](../parser-error-audit-541.md) — the
  original audit this follow-up extends
- [#541](https://github.com/dfadler/zombie-mermaid/issues/541),
  [#581](https://github.com/dfadler/zombie-mermaid/pull/581),
  [#722](https://github.com/dfadler/zombie-mermaid/pull/722)
