---
'@zombie-mermaid/core': minor
'@zombie-mermaid/mermaid-parser': minor
'@zombie-mermaid/svg-renderer': minor
---

Read the `architecture` block of `%%{init}%%` and front-matter `config:` (`padding`, `iconSize`, `fontSize`, `idealEdgeLengthMultiplier`), as mermaid 12.3.0 does. The keys that do not move mermaid's output (`nodeSeparation`, `seed`, `randomize`, `useMaxWidth`) are not read; `edgeElasticity` and `numIter` are documented in docs/known-differences.md.
