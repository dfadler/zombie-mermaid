---
'zombie-mermaid': patch
---

Wide flowchart and state diagram samples on the samples page now render a second, top-down variant and swap to it under 640px viewport width (CSS media query), so a diagram authored left-to-right no longer overflows on mobile. Scoped to flowcharts/state diagrams declared `LR`/`RL` — other diagram types are unaffected. No library API changes.
