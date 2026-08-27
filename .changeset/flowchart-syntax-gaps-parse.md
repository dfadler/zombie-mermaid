---
'zombie-mermaid': minor
---

Close four flowchart syntax gaps against the Mermaid spec (from the audit in #198). Each previously failed silently — mis-parsing into something else rather than raising an error.

**Parallelogram shapes.** `A[/text/]` and `A[\text\]` are now parsed and rendered in both backends. Previously neither pattern matched any shape, so the node fell through to other parsing. Note these are distinct from the already-supported trapezoids: a parallelogram's delimiters mirror (`[/…/]`), a trapezoid's oppose (`[/…\]`).

**Variable-length edges.** `A ---- B`, `A ====> B`, `A -..-> B` and longer runs now parse as a single edge. The arrow regex matched a fixed alternation of the shortest forms, so surplus characters were stranded and corrupted the following token — surfacing as spurious extra nodes rather than an error. Run length is a layout-rank hint in Mermaid; it is now parsed without being mis-tokenized, though the rank hint itself is not yet applied to layout.

**Invisible links.** `A ~~~ B` is supported as a new `invisible` edge style. The edge participates in layout but draws no line, connector, or arrowhead. In SVG the element is retained with `stroke="none"` so it stays inspectable via `data-style`; in ASCII its cells are left blank.

**`classDef default` auto-apply.** A `classDef default` now styles every node, as in Mermaid, rather than only nodes that named it explicitly via `class X default`. A node's own class overrides it property by property, and `style` directives override both. Diagrams relying on `classDef default` previously rendered unstyled with no error.
