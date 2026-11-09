---
'zombie-mermaid': minor
'@zombie-mermaid/core': minor
'@zombie-mermaid/mermaid-parser': minor
'@zombie-mermaid/svg-renderer': minor
'@zombie-mermaid/ascii-renderer': minor
---

Add the requirement diagram: `requirementDiagram` is parsed, drawn to SVG and rendered to ASCII instead of being rejected with "Invalid mermaid header". The parser follows mermaid@12.3.0's grammar (six requirement kinds, elements, seven relationship types, `direction`, `classDef` / `class` / `style` / `:::`), including what it rejects (`text: a-b`, a name that starts with a keyword, a relationship to an undeclared name). The SVG sizes boxes and the drawing as Mermaid does (`pnpm run requirement:oracle` agrees on every gallery sample) and lays them out with ELK; the ASCII output is this library's own, as Mermaid has no text mode. New exports: `parseRequirementDiagram`, `requirementBodyRows` and the `Requirement*` types from the parser, `layoutRequirementDiagramSync`, `renderRequirementSvg` and `REQUIREMENT` from the SVG renderer. Output change for sources that began `requirementDiagram` (previously an error). Checked against mermaid@12.3.0.
