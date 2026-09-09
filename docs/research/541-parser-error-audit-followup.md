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
path, not by reading the error-construction code and assuming.

**Full per-diagram-type findings** — the verified example input/output for
each of the five parsers (flowchart, sequence, class, ER, xychart) — are
posted as a comment on
[#541](https://github.com/dfadler/zombie-mermaid/issues/541#issuecomment-5600101240)
rather than duplicated here. The summary below covers the conclusions; the
issue comment has the receipts.

The ASCII front door (`src/ascii/index.ts` / `src/ascii/registry.ts`) calls
the exact same parse functions as the SVG front door — confirmed by reading
both registries — so every finding applies identically to ASCII and SVG
output; it is not audited twice.

## TL;DR

- **Class diagrams are now the single worst gap.** `packages/mermaid-parser/src/class/parser.ts`
  still has **zero** `throw`/`Error` statements anywhere in the file — the
  only one of the five parsers left in that state after #722. Every
  malformed class-diagram line, no matter how broken, is silently dropped.
  Tracked as [#761](https://github.com/dfadler/zombie-mermaid/issues/761).
- **No parser anywhere reports a line or column number**, even after both
  follow-up passes. This remains a systemic, cross-parser gap. Tracked as
  [#760](https://github.com/dfadler/zombie-mermaid/issues/760).
- **ER and xychart-beta error quality is now good** for the cases #722
  targeted: both name the bad token/value, quote the offending line, and
  state the expected shape (a real "expected vs. found" message). Neither
  carries a line/column number, and both still silently drop a line that
  doesn't resemble an attempt at any recognized directive at all (unchanged,
  intentional leniency).
- **Sequence diagrams still don't detect syntax errors at all** — only
  _semantic_ errors mirrored from mermaid.js (duplicate actor id, box
  nesting, create/destroy mismatch). A typo'd arrow, an unmatched `end`, or
  a reference to a nonexistent block keyword is silently accepted or
  silently dropped, unchanged since the original audit. Tracked as
  [#762](https://github.com/dfadler/zombie-mermaid/issues/762).
- **Flowchart header errors are good** (post-#581): "Did you mean X?"
  suggestions, all six supported headers listed, direction-specific
  messages. Everything past the header line is unchanged from the original
  audit — still silently permissive (dangling arrows, unclosed subgraphs,
  malformed node syntax all parse "successfully" with content quietly
  missing). No issue filed for this one — lower priority than the three
  above; revisit if it starts blocking real usage.

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

## Follow-up issues filed

Each carries the full "what's wrong" + "suggested fix" writeup (moved out of
this doc per review feedback on #752 — see the issues for detail):

- [#760 — Parser error messages don't report line/column position (systemic)](https://github.com/dfadler/zombie-mermaid/issues/760)
- [#761 — Class-diagram parser has no error detection of any kind](https://github.com/dfadler/zombie-mermaid/issues/761)
- [#762 — Sequence-diagram parser doesn't detect syntax errors](https://github.com/dfadler/zombie-mermaid/issues/762)

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
