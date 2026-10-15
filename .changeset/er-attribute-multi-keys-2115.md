---
'zombie-mermaid': major
---

ER: an attribute with several keys now keeps all of them in order, in the SVG and the ASCII output. `string a PK, FK "c"` and `string b PK,FK` both render `PK,FK` (they used to show only `FK` and no key), and `UK` joins the list the same way. Like mermaid.js (12.1.0 and 12.2.0, checked with `parse`), a space-only list (`PK FK`), a dangling comma (`PK,`) or an unknown key word now raises a line-level error instead of being accepted or ignored. Output change: rows with more than one key now show `PK,FK` (they showed one key or none), in SVG and ASCII. Fixes [#2115](https://github.com/dfadler/zombie-mermaid/issues/2115).
