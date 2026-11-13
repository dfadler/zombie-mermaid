---
'@zombie-mermaid/ascii-renderer': patch
---

The plain ASCII grid routes the cluster-boundary cycle edge `S --> X` round the outside of the cluster, as mermaid@12.3.0 does for `R, T`: the forward edge `X --> B` enters `B` by its top face, which leaves `B`'s right face to `S --> X`, up into `X`'s bottom, instead of running up through the cluster.
