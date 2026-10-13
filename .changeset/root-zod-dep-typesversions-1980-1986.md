---
'zombie-mermaid': patch
---

Declare `zod` as a runtime dependency (the `zombie-mermaid/mcp` entry imports it) and add `typesVersions` so `zombie-mermaid/ascii` and `zombie-mermaid/mcp` resolve types under legacy `moduleResolution: node`. Fixes [#1980](https://github.com/dfadler/zombie-mermaid/issues/1980) and [#1986](https://github.com/dfadler/zombie-mermaid/issues/1986).
