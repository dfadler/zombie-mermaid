---
'@zombie-mermaid/ascii-renderer': patch
---

Speed up ASCII rendering of dense flowcharts: each edge's drawn path is now computed once per draw instead of once per label-placement candidate (#1458).
