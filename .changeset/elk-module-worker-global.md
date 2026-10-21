---
'@zombie-mermaid/svg-renderer': patch
'zombie-mermaid': patch
---

Fix ELK layout failing inside a browser module Worker (`Cannot set properties of undefined (setting 'stackTraceLimit')`): `ensureElk()` now defines `globalThis.global` while it hides `self`, so elk-worker.min.js can find its global object. (#2219)
