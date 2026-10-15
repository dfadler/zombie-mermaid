---
'zombie-mermaid': minor
---

ER diagrams now apply `style`, `classDef`, `class` and the `A:::name` shorthand, as mermaid.js 12.1.0 and 12.2.0 do. `fill` paints the entity box and its header, `stroke` and `stroke-width` the outline, and `color` the text; the cascade is the one flowcharts and class diagrams use (`classDef default`, then the assigned class, then `style`), and invalid colour values are dropped like in the other diagram types. The style class is also emitted on the entity's `<g class="entity ...">`. Output change: SVG for an ER diagram that already contains these statements now carries the colours (they were silently ignored before); diagrams without them render as before. ASCII ignores colour declarations in every diagram type, ER included, and is unchanged. Minor under the versioning policy: new supported syntax, no newly throwing input. Fixes [#2107](https://github.com/dfadler/zombie-mermaid/issues/2107).
