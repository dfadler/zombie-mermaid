---
'@zombie-mermaid/mermaid-parser': minor
---

Sequence: `participant X@{ "type": "database" }` and `actor X@{ ... }` (Mermaid 12 participant config) now parse instead of failing with a misleading `unclosed "par" block` error. The type is kept on `Actor.participantType`; the icon is not drawn yet, so both renderers draw the plain participant. A malformed `@{ ... }` reports a precise parse error.
