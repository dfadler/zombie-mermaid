---
'zombie-mermaid': patch
---

Fix ASCII class-diagram cross-level relationship connectors corrupting an intervening class box's attribute/method text. A relationship between classes on different levels could jog horizontally past a taller, unrelated same-level box on its way to a child positioned far from its own parent's column — with no occupancy check, that jog silently overwrote whichever row it crossed. `src/ascii/class-diagram.ts` now snapshots occupied box cells and guards every cross-level line/corner/marker write against them (mirroring the `boxCells`/`setCGuarded` guard `er-diagram.ts` already has for issue #350), so a mis-routed segment degrades to a gap in the line instead of corrupting a box.
