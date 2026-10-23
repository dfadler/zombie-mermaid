---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII class diagrams now stack namespace frames whose edges all run one way (the source frame above the target frame, as mermaid draws them) instead of interleaving their classes, which made the frames overlap. An edge entering a class at the top of a frame no longer runs along that frame's border.
