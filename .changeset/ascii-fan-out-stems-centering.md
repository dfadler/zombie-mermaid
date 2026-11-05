---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: a top-down fan-out in ASCII no longer merges edges and no longer sprawls. A straight target with bends either side now gets a stem each (the outer bend used to share the straight stem and read as one edge forking). Leaf children slide under their parent instead of pushing the parent and its ancestors right, and a labelled edge no longer stops a parent centring between its children, so the parent sits over the midpoint of its children as Mermaid draws it.
