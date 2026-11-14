---
'zombie-mermaid': minor
'@zombie-mermaid/core': minor
'@zombie-mermaid/mermaid-parser': minor
'@zombie-mermaid/svg-renderer': minor
'@zombie-mermaid/ascii-renderer': minor
'@zombie-mermaid/mcp': minor
'@zombie-mermaid/cli': minor
---

Use case diagrams: `usecase-beta` (the only header mermaid@12.3.0 detects) now renders to SVG and ASCII. Actors, use cases (`Name`, `Name(label)`, `Name[label]`), `systemBoundary`, `direction`, associations with labels, `include`/`extend`/generalization and `note for` are supported; metadata, stereotypes, classes, `json` nodes, circle/cross markers and edge ids are rejected with a "not supported yet" error. `parseUsecase` and `usecaseToGraph` join `@zombie-mermaid/mermaid-parser`; `DiagramType` gains `'usecase'`, `NodeShape` gains the `usecase-*` shapes and an edge `triangle` terminator.
