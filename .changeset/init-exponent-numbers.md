---
'@zombie-mermaid/core': patch
---

Fix `%%{init}%%` directives dropping entirely when they contain an exponent-form number such as `1e2` (#2922).
