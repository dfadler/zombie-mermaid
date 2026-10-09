---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: edge-label placement is memoised within each placement call, cutting render time on graphs with many labelled edges on shared vertical legs (about 45x at 29 edges; it was growing roughly cubically). Output is unchanged (#1466).
