---
'@zombie-mermaid/ascii-renderer': patch
---

Output change (with the ELK layout provider registered, which the root entry, CLI and MCP do): a self-loop takes the faces ELK and Mermaid 12.3.0 draw. In LR and RL it is a hook over the top face, out of one cell and back into the next; in TD and BT it is a hook out of the left face, with a margin column when the node sits in the first column. Which cell starts the loop follows ELK's order, mirrored for RL and BT. A loop on a diamond keeps its own routing. Output without a provider is unchanged.
