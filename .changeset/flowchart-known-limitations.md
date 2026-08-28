---
"zombie-mermaid": patch
---

Document flowchart icons, images, and subgraph collapse as intentionally unsupported.

`docs/diagrams.md` now has a "Known limitations" section under Flowcharts covering `A@{ icon: ... }` / `A@{ img: ... }` / inline `fa:name` text, and Mermaid v11.17.0's subgraph collapse syntax — what each does today (parses but draws no glyph/image; collapse syntax isn't recognized and can add a stray disconnected node rather than being a no-op) and why it's out of scope (no bundled/fetched external resources, no embedded interactivity in a static SVG/ASCII output). No rendering behavior changed.
