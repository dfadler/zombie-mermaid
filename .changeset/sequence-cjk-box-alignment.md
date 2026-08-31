---
'zombie-mermaid': patch
---

ASCII renderer: sequence-diagram participant boxes, message labels, self-message labels, block (alt/loop/opt/par) headers and dividers, and note boxes now measure and draw text using the same display-width-aware helpers (`displayWidth`/`toDisplayCells`, `src/ascii/display-width.ts`) already used for flowchart (#66) and class/ER (#182) boxes. Previously these were measured and written by UTF-16 code unit — the box outline was sized correctly (via `maxLineWidth`, which was already display-width-aware) but the content was written one grid cell per JS character rather than one per terminal column, so a CJK/kana/hangul/fullwidth-form participant name or message label caused the box border to no longer line up with its own content. Fixes #334.
