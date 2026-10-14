---
'@zombie-mermaid/mermaid-parser': minor
'@zombie-mermaid/mcp': patch
---

Every parser failure is now a `MermaidParseError` with `diagramType` set (and `line` where the parser knows it, now including C4 and architecture statement errors); the pie parser also sets `column`. Messages are unchanged. The MCP diagnostics read the typed `line` instead of parsing the message, so C4 and architecture errors now get a source-line diagnostic. `ElkNotRegisteredError` stays a plain `Error`: it is a missing-peer-dependency error, not a problem in the diagram. Closes [#1979](https://github.com/dfadler/zombie-mermaid/issues/1979).
