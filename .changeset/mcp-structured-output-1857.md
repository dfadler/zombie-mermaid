---
'@zombie-mermaid/mcp': minor
---

The MCP JSON tools (`validate_mermaid`, `check_mermaid_sequence_activations`, `fix_mermaid_sequence_activations`, `list_themes`, `list_diagram_types`) now declare an `outputSchema` and return matching `structuredContent`, alongside the existing JSON text block. Fixes [#1857](https://github.com/dfadler/zombie-mermaid/issues/1857).
