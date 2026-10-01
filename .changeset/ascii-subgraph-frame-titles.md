---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII subgraph frames: an edge entering a titled frame no longer splits the title (`Layer│Two`); the frame widens so the title sits beside the edge. A node that is not a member of a subgraph is no longer drawn inside its frame. An edge label no longer overwrites a letter of a frame title, and a frame is widened rather than clipping a title wider than its nodes (`Layer T`).
