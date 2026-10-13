---
'@zombie-mermaid/core': minor
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/mcp': patch
---

Add `MermaidParseError` (`line`, `column`, `diagramType`, `code`, all optional) to `@zombie-mermaid/core`. Line-prefixed parser errors now throw it with the message unchanged, and the MCP parse diagnostics read `line` from it before falling back to the `Line N:` message prefix. Closes [#1855](https://github.com/dfadler/zombie-mermaid/issues/1855).
