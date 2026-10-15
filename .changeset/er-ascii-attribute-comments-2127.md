---
'@zombie-mermaid/ascii-renderer': patch
---

fix(ascii): render ER attribute comments (#2127). Output change: an attribute with a comment, such as `string a PK "the key"`, now ends its row with the comment in quotes (`string a PK "the key"`), where it was dropped before. Mermaid shows the comment as a fourth column and does not wrap it; neither does this, so the entity box grows to the widest row, and a `<br>` becomes a space. Entities without comments render exactly as before. Patch because it fixes missing content and no documented output contract (accessibility, theming keys, documented options) changes (versioning policy section 1, "Output changes"). Checked against mermaid 12.1.0 and 12.2.0.
