---
'@zombie-mermaid/core': minor
'@zombie-mermaid/svg-renderer': minor
---

Move the embedded mono font subset out of `core` into `svg-renderer` (#1319). `core`'s `buildStyleBlock(font, mono, nonce?)` now takes `mono: MonoFontEmbed | false` (a `{ family, faceCss }` object) instead of a `hasMonoFont` boolean, and `core` no longer ships the base64 font data, so ASCII-only consumers never carry it. `svg-renderer` exports `buildSvgStyleBlock(font, hasMonoFont, nonce?)`, which keeps the previous boolean API and emits byte-identical SVG output.
