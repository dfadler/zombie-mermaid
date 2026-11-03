---
'zombie-mermaid': patch
'@zombie-mermaid/core': patch
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/svg-renderer': patch
---

SVG architecture diagrams now draw each service as Mermaid does: an 80px blue icon tile with a white glyph for the built-in `database`, `disk`, `server`, `cloud`, `internet` and `blank` icons, a `?` tile for an icon name Mermaid does not know, and a dashed empty box for a service with no icon, with the label under the tile. Custom icon packs such as `logos:aws` still show the `?` tile. ASCII output is unchanged (#2518).
