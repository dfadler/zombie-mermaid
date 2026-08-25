---
'zombie-mermaid': patch
---

Fix sequence diagram notes placed before the first message (e.g. `Note over A: ...` written before any `A->>B: ...` line) being silently dropped from both the SVG and ASCII/Unicode renderers. Notes are parsed with `afterIndex: -1` for this case, but the layout code only ever looked up notes keyed by an actual message index, so `afterIndex === -1` notes were never positioned or rendered — including in notes-only diagrams with zero messages.
