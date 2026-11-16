---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: a labelled self-loop on a box or decision in a top-down or bottom-up flow keeps its arrowhead when the label is four characters or longer. The label sits on the hook's first leg, not over the arrowhead into the node, as mermaid@12.3.0 draws it. Needs the ELK layout provider (registered by default in `zombie-mermaid`'s entry points).
