---
'@zombie-mermaid/ascii-renderer': patch
---

Fix ASCII sequence diagrams not rendering activation bars. A lifeline now switches to a double-line glyph (`║`, or `‖` in `useAscii` mode) for the rows where that participant is actively processing a call — driven by `activate`/`deactivate` statements or the `+`/`-` arrow shorthand — instead of drawing a uniform `│` for its full span regardless of activation state.
