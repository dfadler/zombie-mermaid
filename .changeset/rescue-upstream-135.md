---
'zombie-mermaid': patch
---

Fix SVG box sizing when `RenderOptions.font` names a monospace family. Text was always measured with proportional (Inter-calibrated) glyph-width buckets, so under a monospace font narrow labels like `iiii` under-measured and overflowed their boxes while wide labels like `WWWW` over-measured. `measureTextWidth` — the single choke point every diagram type measures through — now switches to a uniform 0.6em advance when the configured font is monospace (detected by name: `mono`, `consol`, `menlo`, `courier`, or the word `code`; "Mona Sans" deliberately does not match). Output for the default font is unchanged.

Ports [lukilabs/beautiful-mermaid#135](https://github.com/lukilabs/beautiful-mermaid/pull/135) by [@aryasaatvik](https://github.com/aryasaatvik), which has been open and unreviewed upstream since July 2026. The original commits are cherry-picked with their authorship intact; only the test file was adapted from `bun:test` to Vitest.
