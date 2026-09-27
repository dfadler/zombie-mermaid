---
'@zombie-mermaid/ascii-renderer': patch
---

Fix ER diagram attribute columns rendering in the wrong left-to-right order, found by the weekly form-judge audit ([#1119](https://github.com/dfadler/zombie-mermaid/issues/1119)). An attribute like `int id PK` rendered as `PK int id` — keys, then type, then name — while real mermaid's SVG lays these columns out as type, name, then keys. Attribute lines now render as `int id PK`, matching that order; a keyless attribute also no longer reserves unused padding for an empty key column.
