---
'zombie-mermaid': patch
---

ASCII renderer: `classDiagram` realization edges (`..|>`) now stack the implementing class above the interface it realizes, matching real mermaid.js's layout. The level-assignment logic previously placed whichever end carried the hollow-triangle marker on top — correct by coincidence for inheritance's `<|--` form (where the marker happens to sit at the "from" end) but reversed for `..|>` (where the marker sits at the "to" end), stacking the interface above the implementing class with the arrow pointing backwards. Layout now places "from" above "to" for every relationship type, independent of marker position — consistent with how association, dependency, composition, and aggregation already rendered.
