---
'@zombie-mermaid/svg-renderer': patch
---

perf(svg): the embedded mono font subset is 1.4 KB gzip smaller (#2197). The `.mono` `@font-face` that class and ER SVGs embed now covers Basic Latin, U+00A0 and the Latin-1 letters (U+00C0-U+00FF) instead of all of Latin-1; the symbol block U+00A1-U+00BF (`¡ ¢ £ © « ° ± µ ¿` and similar) is dropped, 31 glyphs that identifiers and type names do not use. Output change: only the base64 font data inside the `<style>` of SVGs that carry the mono face (class and ER diagrams); layout and every retained glyph's outline and advance are byte-identical (compared with fontkit, and the 28 gallery samples with mono text render pixel-identical in Chromium). A member name or type containing one of the dropped symbols now draws that one character in the next monospace face of the `.mono` stack (`SF Mono`, `Fira Code`, `ui-monospace`, `monospace`) instead of JetBrains Mono.

Versioning: patch per docs/decisions/versioning-and-deprecation-policy-1568.md section 1, "Output changes": the embedded font bytes are not a documented output contract, and no export, option or layout changes.
