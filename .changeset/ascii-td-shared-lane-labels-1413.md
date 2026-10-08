---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: in a TD flowchart, two labelled edges sharing a lane no longer pick the same segment for their labels, so the later label no longer overwrites (and hides) the earlier one (#1413).
