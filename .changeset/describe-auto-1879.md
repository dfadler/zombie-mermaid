---
'zombie-mermaid': minor
'@zombie-mermaid/core': minor
'@zombie-mermaid/svg-renderer': minor
---

SVG: opt-in `describe: 'auto'` adds a deterministic, 500-character-capped `<desc>` built from a flowchart or state diagram's parsed nodes and edges. Off by default (default output is unchanged); never supplies the accessible name, and `accDescr` wins (#1879).
