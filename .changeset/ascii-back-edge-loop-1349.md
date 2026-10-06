---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: a back edge that has to go round a node is now one clean loop instead of a staircase with an extra jog. A rerouted edge prefers fewest bends in every graph (it did so only with cluster exits), two edges that meet at one node port and turn at different corners no longer force each other round the diagram, and a long label on a short hop no longer widens a node's own border column and inflates its box (#1349).
