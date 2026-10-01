---
'zombie-mermaid': patch
'@zombie-mermaid/mermaid-parser': patch
---

Class diagram attributes now render as written, matching Mermaid. `-data Map` used to be flipped to `- Map: data`; `-data Map`, `+String name` and `+name: Type` now all keep their source order (methods still render as `name(): type`).
