---
'@zombie-mermaid/svg-renderer': patch
---

ER entity boxes are now sized for whole-pixel glyph advances, so a long attribute row (`varchar(255)  emailAddressPrimary`) keeps its padding instead of the type running into the name where the browser doesn't position glyphs at subpixel offsets (headless Chromium on Linux).
