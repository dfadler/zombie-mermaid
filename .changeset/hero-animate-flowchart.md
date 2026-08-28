---
'zombie-mermaid': patch
---

The Hero sample now animates: its marching-dash edges render live in the demo gallery and in the README. To use the existing `animate: true` edge feature (flowchart-only today), the Hero sample was converted from `stateDiagram-v2` to an equivalent `flowchart LR` using stadium-shaped nodes to approximate the original pill look. The README's hero image switched from a static PNG screenshot (`hero.png`) to a generated, animated SVG (`hero.svg`), produced by a new `pnpm generate:hero` script.
