---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: flowchart and state ASCII placement follows Mermaid 12.3.0's layout when elkjs is available (the root entry, CLI and MCP register it). Each node takes its layer, its order in the layer and its cross-axis offset from the ELK layout, so a labelled edge takes its own layer, siblings are ordered as Mermaid orders them, and a parent sits over its children. Without a registered layout provider, placement is unchanged. Class, architecture and ER diagrams are untouched.
