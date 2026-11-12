---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: duplicate self-loops on one node now draw one hook each, nested as mermaid@12.3.0 draws them (the second hook round the first, in the left gutter in TD and BT and over the top face in LR and RL), instead of collapsing onto a single hook. The node grows to give the 2N ends their own cells, a decision's hooks take its slants, and a loop label sits on its own hook's leg. Nesting needs the ELK layout provider (registered by default in `zombie-mermaid`'s entry points); without one, and for a duplicate loop inside a subgraph, duplicates still draw as one hook.
