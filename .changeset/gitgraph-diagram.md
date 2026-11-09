---
'zombie-mermaid': minor
'@zombie-mermaid/core': minor
'@zombie-mermaid/mermaid-parser': minor
'@zombie-mermaid/svg-renderer': minor
'@zombie-mermaid/ascii-renderer': minor
'@zombie-mermaid/mcp': patch
---

Git graphs. `gitGraph` diagrams (`gitGraph`, `gitGraph LR:`, `TB:` and `BT:`) now parse and render to SVG and ASCII/Unicode text, under the upstream-types umbrella ([#2085](https://github.com/dfadler/zombie-mermaid/issues/2085), [#2808](https://github.com/dfadler/zombie-mermaid/issues/2808)). `DiagramType` gains `'gitgraph'` and `detectDiagramType` routes a `gitGraph` header to it (case-sensitively, as Mermaid's detector does); `extractInitConfig` reads the `gitGraph` block (`mainBranchName`, `mainBranchOrder`, `showCommitLabel`, `showBranches`, `rotateCommitLabel`, `parallelCommits`). `@zombie-mermaid/mermaid-parser` adds `parseGitGraph` with the `GitGraph` and `Positioned*` types, a port of Mermaid's grammar and database: `commit` (`id:`, `msg:`, `tag:`, `type:`), `branch` (`order:`), `checkout`/`switch`, `merge` and `cherry-pick`, with Mermaid's error messages. `@zombie-mermaid/svg-renderer` adds `layoutGitGraph` and `renderGitGraphSvg`: Mermaid's geometry, arrow routing and symbols for all three orientations. `pnpm run gitgraph:oracle` compares every branch line, arrow, commit symbol, label, tag and the drawing size with real mermaid.js and agrees on all gallery samples and a sweep of other graphs with mermaid 12.3.0 (12.2.0 scores the same). The ASCII output is this library's own design (Mermaid has none): the layout of `git log --graph`, one row per commit and one column per branch. Not read yet: the `neo`/`redux` looks and themes (see `docs/known-differences.md`).
