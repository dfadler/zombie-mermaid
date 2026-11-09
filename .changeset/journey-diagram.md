---
'zombie-mermaid': minor
'@zombie-mermaid/core': minor
'@zombie-mermaid/mermaid-parser': minor
'@zombie-mermaid/svg-renderer': minor
'@zombie-mermaid/ascii-renderer': minor
'@zombie-mermaid/mcp': patch
---

User journeys. `journey` diagrams now parse and render to SVG and ASCII/Unicode text, under the upstream-types umbrella ([#2085](https://github.com/dfadler/zombie-mermaid/issues/2085), [#2810](https://github.com/dfadler/zombie-mermaid/issues/2810)). `DiagramType` gains `'journey'` and `detectDiagramType` routes a `journey` header to it (case-sensitively, as Mermaid's detector does). `@zombie-mermaid/mermaid-parser` adds `parseJourney` with the `Journey` and `Positioned*` types, a port of Mermaid's lexer and database: `title`, `section`, tasks written `Name: score: Actor, Actor`, `%%` and `#` comments, `;` and a task without a score as parse errors. `@zombie-mermaid/svg-renderer` adds `layoutJourney` and `renderJourneySvg`: Mermaid 12.3.0's geometry (task columns, section bars, score faces, actor dots and legend, the arrowed axis). The ASCII output is this library's own design (Mermaid has none): sections, tasks with a face, score and actors. Not read yet: `journey` config in `%%{init}%%` (see `docs/known-differences.md`).
