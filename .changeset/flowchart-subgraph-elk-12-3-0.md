---
'@zombie-mermaid/svg-renderer': patch
---

Output change: a flowchart with subgraphs is now laid out the way mermaid@12.3.0 lays it out: one ELK pass over the whole hierarchy with mermaid's own options (cluster-first node order, ELK `DEPTH_FIRST` cycle breaking, self-loops kept in the graph, 24px subgraph padding and the spacing mermaid sets), instead of the dagre-shaped arrangement of the removed compound layout. Subgraph boxes, node positions and edge routes move on every flowchart that has a subgraph; flowcharts without one are unchanged. Pairwise node-position agreement with mermaid@12.3.0 on a 100-diagram corpus goes from 84.6% to 98.7%. Against the 12.2.0 pin, "Nested Subgraphs" now scores lower, because mermaid changed engine between 12.2.0 and 12.3.0.
