---
'zombie-mermaid': minor
'@zombie-mermaid/core': minor
'@zombie-mermaid/mermaid-parser': minor
'@zombie-mermaid/svg-renderer': minor
'@zombie-mermaid/ascii-renderer': minor
---

Add the Ishikawa (fishbone) diagram: `ishikawa` and `ishikawa-beta` are parsed, drawn to SVG and rendered to ASCII instead of being rejected with "Invalid mermaid header". The parser follows mermaid@12.3.0's grammar (the effect, then categories and causes by indentation, `%%` comments, `<br>` in labels, Mermaid's label sanitizing). The SVG uses Mermaid's geometry: bones slanted 82° and alternating above and below the spine, causes spaced evenly along their bone, nested causes hung from their parent (`pnpm run ishikawa:oracle` agrees on every sample and edge case: element order, text, bone vectors and y positions exactly, x positions and the frame within text-width tolerance); the ASCII output is this library's own, a fishbone on a character grid, as Mermaid has no text mode. Not drawn: the `handDrawn` look. New exports: `parseIshikawa` and the `Ishikawa*` types from the parser, `layoutIshikawa`, `renderIshikawaSvg`, `wrapIshikawaText` and `ISHIKAWA` from the SVG renderer, and `'ishikawa'` in `DIAGRAM_TYPES`. Output change for sources that began `ishikawa` (previously an error). Checked against mermaid@12.3.0.
