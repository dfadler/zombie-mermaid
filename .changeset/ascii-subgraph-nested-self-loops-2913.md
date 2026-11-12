---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: duplicate self-loops on a node inside a subgraph now draw one nested hook each, as mermaid@12.3.0 draws them (in the left gutter in TD and BT, over the top face in LR and RL), and the frame grows to hold the hooks and their labels instead of the hook crossing its wall. A self-loop in a frame no longer widens the gap beside another frame without end (a lone loop made one diagram 551 columns wide). Nesting needs the ELK layout provider (registered by default in `zombie-mermaid`'s entry points); without one a duplicate still draws as one hook. A subgraph with its own `direction` override is unchanged.
