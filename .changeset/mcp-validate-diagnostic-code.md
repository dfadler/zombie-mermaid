---
'@zombie-mermaid/mcp': patch
---

`validate_mermaid` diagnostics now carry an optional stable `code` (`EMPTY_DIAGRAM`, the generic `PARSE_ERROR`, or a code the error carries such as `LIMIT_EXCEEDED`) so agents can branch on it.
