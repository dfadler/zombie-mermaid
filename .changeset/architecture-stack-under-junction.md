---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
---

Architecture diagrams: a service stacked under a junction (`fan:B --> T:replica`) now lands under it even when the group beside it sits a pixel or two short of the usual 16px margin, by tightening the group's margin to 8px instead of leaving the service in its group's column. The Nested Groups And Junction sample now agrees with mermaid 12.2.0 on every pairwise relation (#2557).
