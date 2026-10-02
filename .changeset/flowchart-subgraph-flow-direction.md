---
'@zombie-mermaid/svg-renderer': patch
---

A flowchart whose subgraph feeds a node declared after it is no longer drawn upside down. In the CI/CD sample, "Deploy Staging" used to sit above the "CI Pipeline" subgraph that feeds it; the diagram now flows top to bottom, as in mermaid.js. Top-level nodes are now laid out after subgraphs in the ELK input, so a subgraph-to-node edge no longer points against model order and gets reversed by cycle breaking.
