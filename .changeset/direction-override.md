---
'zombie-mermaid': minor
---

New `direction` render option (`RenderOptions.direction` for SVG, `AsciiRenderOptions.direction` for ASCII, `--direction <dir>` on the CLI) that overrides a diagram's layout direction at render time — `'TD' | 'TB' | 'BT' | 'LR' | 'RL'`. It replaces only the top-level direction (a flowchart's `graph LR` header, or a state/ER diagram's `direction` line) after parsing and before layout, so the source text is never rewritten and `parseMermaid()` output is unchanged; a nested subgraph's or composite state's own `direction` still applies on top of it, exactly as it does on top of the diagram's own header. Flowchart, state, and ER diagrams only — the diagram types that have a direction to override; sequence, class, and XY-chart output is byte-identical with or without it. Unset by default, so existing output is unchanged. The demo gallery's narrow-viewport orientation swap now uses this option instead of regex-rewriting the source header. Closes #276.
