---
'zombie-mermaid': patch
---

Fix the demo site's hero diagram getting stuck on a permanent loading spinner. `renderSample()` required an ASCII-panel element to exist before rendering, but Hero-category samples never have one — the guard clause returned early and the hero diagram never rendered. No library API changes.
