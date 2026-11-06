---
'@zombie-mermaid/svg-renderer': patch
---

Output change: sequence SVG matches Mermaid 12.3.0 in two places. A nested activation opened or closed by a self-message (`S->>+S`, `S->>-S`) now starts below the loop and ends 30 below the closing loop's top instead of covering the wrong message. A long block tab or divider label wraps onto several lines instead of widening the participant gap.
