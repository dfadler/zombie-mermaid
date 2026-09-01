---
'zombie-mermaid': patch
---

ASCII renderer: bundled (fan-in/fan-out) edges now draw a start-side arrowhead when `hasArrowStart` is set, matching non-bundled edges. Previously a bidirectional edge that happened to share a source or target with another edge (e.g. `A <--> E` alongside `A <--> F`) only drew the end-side arrowhead once bundled — the start side was silently dropped. A fan-in bundle now draws a start arrowhead at each individual source; a fan-out bundle draws a single shared start arrowhead at the common source, only when every bundled edge agrees on `hasArrowStart`.
