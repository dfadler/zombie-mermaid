---
'zombie-mermaid': patch
---

Fix flowchart nodes with a custom class (via `:::className` shorthand or `class A,B className`) not emitting the class name onto the rendered SVG element. The class name was already resolved against `classDef` for inline `fill`/`stroke` styling, but never written to the element's `class` attribute, so external CSS couldn't target it — unlike mermaid.js. The rendered `<g>` now carries `class="node <className>"` (e.g. `class="node highlight"`) alongside the existing base `node` class, with the class name validated as a CSS identifier before being emitted.
