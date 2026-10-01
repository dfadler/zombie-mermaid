---
'@zombie-mermaid/svg-renderer': patch
---

Class diagram boxes are now sized for whole-pixel glyph advances, so a long member line (`+ handleInput(event): void`) keeps its right padding instead of running into the border where the browser doesn't position glyphs at subpixel offsets (headless Chromium on Linux).
