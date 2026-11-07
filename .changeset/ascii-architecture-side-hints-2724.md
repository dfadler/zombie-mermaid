---
'@zombie-mermaid/ascii-renderer': patch
'@zombie-mermaid/mermaid-parser': patch
---

Output change: architecture ASCII honours the edge side hints (`T`, `B`, `L`, `R`) as Mermaid 12.3.0 does: `server:B -- T:disk` puts Disk below Server, `cloud:T <-- B:web` puts Web above Cloud, and each edge leaves and enters by the face its port names, instead of laying the lowered edges out as a flowchart.
