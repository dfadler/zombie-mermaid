---
'@zombie-mermaid/svg-renderer': patch
---

An edge that runs over a subgraph's title text no longer obscures it. The edge is not painted over the text itself and carries on past it, using an SVG mask, so its path and element are unchanged (the `No` edge into "Fix & Retry" in the CI/CD sample, the edges into the "US West Region" and "US East Region" subgraphs). Diagrams where no edge crosses a title are unchanged.
