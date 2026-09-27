---
'@zombie-mermaid/svg-renderer': patch
---

Fix edge endpoints and labels landing off a nested subgraph's boundary instead of on it, for a flowchart with no `direction` override on any subgraph. ELK can leave a cross-hierarchy edge in an ancestor container's `edges` array while reporting its routed points/label in the coordinate space of the deeper container it actually belongs to; layout conversion now honors that declared container offset instead of the owning array's offset. (Ported from a fix by Galen Suen, upstream [lukilabs/beautiful-mermaid#152](https://github.com/lukilabs/beautiful-mermaid/pull/152).)
