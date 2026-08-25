---
'zombie-mermaid': patch
---

Fix flowchart `class` assignment statements with a trailing semicolon (e.g. `class B highlight;`), which Mermaid treats as valid/optional syntax. The class-assignment regex was anchored on `(\w+)$` and didn't match the semicolon, so the statement fell through to node parsing and rendered a stray node labelled "class" instead of applying the class. `classDef`/`style` statements already tolerated a trailing semicolon; `class` now matches them.
