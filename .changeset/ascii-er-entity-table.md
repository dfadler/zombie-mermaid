---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: ASCII ER entities now draw as Mermaid 12.3.0 does: a centred name over a table with a column each for type, name, keys and comment (a keys or comment column only when some attribute uses one), dividers between columns and between rows. The comment is no longer wrapped in quotes. A horizontal relationship attaches on a text row, not on a row divider.
