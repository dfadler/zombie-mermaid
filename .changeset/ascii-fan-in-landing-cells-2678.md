---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII flowchart and state fan-ins give every edge into a node a landing cell and an arrowhead of its own, as mermaid 12.3.0 draws them (#2678, #2913): `A & B --> C`, a decision whose branches rejoin and a state join bar no longer merge into one trunk and one arrowhead. A node too narrow for a stroke each (three strokes need five interior cells) or holding a self-loop keeps one shared trunk. In plain grid mode an unlabeled fan-in edge now leaves its source by the flow face.
