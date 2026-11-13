---
'zombie-mermaid': patch
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/svg-renderer': patch
---

Sankey: node names go through the same DOMPurify round trip as in mermaid@12.3.0 (`<script>` is dropped, `<img onerror>` loses the handler, other tags show as text, names that sanitise alike are one node), and a label that reaches past the bars is sized with the Inter font metrics it is drawn in, so the viewBox no longer clips it. New `pnpm run sankey:oracle` compares bars, labels, ribbons and the viewBox with real mermaid.
