---
'@zombie-mermaid/mcp': minor
'@zombie-mermaid/svg-renderer': minor
'zombie-mermaid': minor
---

Add a `validate_mermaid` MCP tool and a `zombie-mermaid validate [file]` CLI command (parse only, line diagnostics, exit 1 when invalid). Failed `render` runs now print the offending source line too. New `validateMermaid()` export.
