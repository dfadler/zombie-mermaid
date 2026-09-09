---
'zombie-mermaid': patch
---

Parser error messages now report the 1-based source line they came from (e.g. `Line 14: Invalid direction "SIDEWAYS" in header...`), instead of only quoting the offending statement's text back. `splitStatements`/`splitStatementsByLine` (`@zombie-mermaid/core`) now return `Statement[]`/`Statement[][]` (`{ text, line }`) instead of bare strings, threaded through all five diagram parsers (flowchart/state, sequence, class, ER, xychart) so every existing throw site can report position. Column position is left as a follow-up. No behavior change for valid input.
