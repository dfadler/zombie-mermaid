---
'zombie-mermaid': minor
---

Add `fontSizes` and `sequence` fields to `RenderOptions`, exposing previously hardcoded font-size and sequence-diagram layout constants for overriding.

- `fontSizes.nodeLabel` / `edgeLabel` / `groupHeader` (defaults: 13 / 11 / 12) now apply consistently across flowchart, class, ER, and sequence diagrams.
- `sequence.actorHeight` / `headerGap` / `messageRowHeight` / `noteOffsetAfterMessage` / `noteStackGap` (defaults: 40 / 20 / 40 / 8 / 4) control sequence-diagram layout spacing. The last two were previously unnamed inline magic numbers.

All fields are optional and fall back to the existing defaults, so this is fully additive and non-breaking.
