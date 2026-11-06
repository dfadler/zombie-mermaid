---
'@zombie-mermaid/core': minor
'@zombie-mermaid/svg-renderer': patch
---

Output change: `%%{init: {"flowchart": {"curve": ...}}}%%` (and front-matter `config.flowchart.curve`) no longer changes flowchart edges, matching Mermaid 12.3.0, which draws the same rounded orthogonal edges for every value. The `curve` render option still applies. `InitConfig.curve` and `applyInitConfig` are removed; the key is reported in `InitConfig.ignored`.
