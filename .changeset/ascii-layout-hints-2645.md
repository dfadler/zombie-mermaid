---
'@zombie-mermaid/ascii-renderer': minor
'zombie-mermaid': minor
---

Add `registerAsciiLayout(provider)` and the layout-hint types (`AsciiLayoutProvider`, `AsciiLayoutHints`, and related) to `@zombie-mermaid/ascii-renderer`, so a layout engine can supply layer, order and edge-face hints. The `zombie-mermaid` entry, the CLI and MCP register an ELK-backed provider. The grid does not read the hints yet, so ASCII output does not change.
