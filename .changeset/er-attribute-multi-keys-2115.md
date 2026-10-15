---
'zombie-mermaid': major
---

**BREAKING:** ER: an attribute's key list is now parsed like mermaid.js (12.1.0 and 12.2.0, checked with `parse`): comma-separated `PK` / `FK` / `UK`, space after the comma optional. A space-only list (`PK FK`), a dangling comma (`PK,`) or an unknown key word now raises a line-level error; `PK FK` used to render and the others were ignored. Attributes with several keys now keep all of them in order, in the SVG and the ASCII output: `string a PK, FK "c"` and `string b PK,FK` both render `PK,FK` (they used to show only `FK` and no key), and `UK` joins the list the same way. Fixes [#2115](https://github.com/dfadler/zombie-mermaid/issues/2115).
