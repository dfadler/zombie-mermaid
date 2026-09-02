---
'zombie-mermaid': patch
---

ASCII renderer: `erDiagram` relationship lines that jog or detour around another entity now draw a corner glyph (`┌`/`┐`/`└`/`┘`, or `+` in ASCII mode) at each point the routed path turns, instead of a plain `─`/`│` meeting at an unmarked right angle. In a dense diagram this previously read ambiguously — a viewer couldn't tell "this line turns here" from "this line ends here and an unrelated line begins right next to it." Covers all three routing paths that can change direction: a same-row detour beneath an obstructing entity, a vertical relationship's horizontal jog, and a vertical relationship's multi-row-obstruction bypass.
