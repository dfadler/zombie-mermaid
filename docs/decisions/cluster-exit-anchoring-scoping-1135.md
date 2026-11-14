# Scoping: consistent cluster-boundary edge exits in the ASCII renderer

Status: implemented

## Decision

- Not implementing a fix as part of closing out #1135. The composite-state symptom is downgraded to a known instance of a general ASCII cluster-exit-anchoring limitation.
- Root cause: `resolveSubgraphEndpoint` sends every edge leaving a cluster to one stand-in member node, then each edge is routed independently, so edges can exit through different walls.
- A future fix would add a per-cluster, per-direction "exit anchor" pass before edge routing; that is new design work, not a fix against #1135.
- Blast radius is flowchart and state diagrams only (confirmed in #1183). It is a readability nit, not a correctness regression.

Full write-up: https://github.com/dfadler/zombie-mermaid/issues/1135#issuecomment-6884748164
