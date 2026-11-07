---
'@zombie-mermaid/ascii-renderer': minor
'zombie-mermaid': minor
---

ASCII flowcharts and state diagrams now take each edge end's face, and the order of the ends along a face, from the registered layout provider (the ELK layout, in the root entry, CLI and MCP). A diamond's branches leave its two slants, an edge and its return sit side by side in Mermaid's order, and an edge no longer takes a side face where Mermaid uses the flow face. Without a provider, or for a face the grid cannot honour, output is unchanged. Same-pair edge groups (duplicates and reciprocal pairs laid out side by side) and self-loops keep their own lanes.
