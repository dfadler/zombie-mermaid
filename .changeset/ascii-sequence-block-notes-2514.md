---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: ASCII sequence diagrams widen a `loop`/`alt`/`opt` block's walls to enclose every note drawn inside it (right, left and over notes), instead of letting the note box run past the wall. Block labels are also framed with a blank column each side and the condition is centred after the type tab, e.g. `┌─ loop ───── [every retry] ─────┐` ([#2514](https://github.com/dfadler/zombie-mermaid/issues/2514)).
