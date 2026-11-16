---
'zombie-mermaid': minor
'@zombie-mermaid/core': minor
'@zombie-mermaid/mermaid-parser': minor
'@zombie-mermaid/svg-renderer': minor
---

Block diagram styling and `block.padding` ([#3107](https://github.com/dfadler/zombie-mermaid/issues/3107)). `classDef`, `class` and `style` now parse and apply as Mermaid 12.3.0 does: `fill`, `stroke`, `stroke-width` and the other properties go inline on the block's rectangle, `color` on its label, and a `style` item replaces the same property from a class. `block.padding` from front matter or `%%{init}%%` sets the space between cells and inside each block (default 8). `parseBlock` returns `classDefs` and `padding` on `BlockDiagram` and `classes` and `styles` on `BlockNode`; `PositionedBlockNode` gains `classes` and `css`; `InitConfig` gains `block.padding`. `pnpm run block:oracle` now also compares each block's inline styles. A markdown label is a parse error in Mermaid 12.3.0 (`Expecting 'STR', got 'MD_STR'`), so it stays an error here, with that message.
