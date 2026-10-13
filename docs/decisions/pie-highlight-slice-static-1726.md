# Pie `highlightSlice` in static output

## Context

[#1726](https://github.com/dfadler/zombie-mermaid/issues/1726): `pie.highlightSlice`
is in Mermaid's `PieDiagramConfig` and was ignored here. Static output has no
pointer, so the semantics needed settling first. The maintainer's lean was to
offset (explode) the highlighted slice outward and ignore `hover`.

What Mermaid 12.1.0 (the pinned reference, what mermaid.live and GitHub render)
does was checked headlessly through `scripts/lib/real-mermaid.ts`, reading
`pieDiagram-*.mjs` and measuring the rendered paths with `getBoundingClientRect`:

- `highlightSlice: "<label>"` adds the class `highlighted` to the slice whose
  label equals the string exactly (`===`). The stylesheet is
  `.pieCircle.highlighted { scale: 1.05; opacity: 1; }`.
- `highlightSlice: "hover"` adds `highlightedOnHover` to every slice; the same
  scale and opacity apply only under `:hover`.
- Mermaid does **not** offset the slice. `scale: 1.05` on a path inside the
  pie group scales about the pie centre, so the slice grows 5% radially
  (radius 185 to 194.25) and keeps its angular extent. Measured: the Cats
  slice of a 386/85/15 pie went from x=55.1, w=177.9 to x=46.2, w=186.8 about
  the centre at x=233 (`(55.1 - 233) * 1.05 + 233 = 46.2`). The other slices
  keep Mermaid's 0.7 opacity; the highlighted one is fully opaque.

## Decision

Match Mermaid, not the explode lean. A diagram that renders one way on
mermaid.live and another here is the thing this project exists to avoid, and
the real behaviour is already a static emphasis.

- SVG: the slice named by `highlightSlice` is drawn with its outer (and, with
  `donutHole`, inner) radius multiplied by 1.05 about the pie centre, and gets
  `opacity: 1` through a `pie-highlight` class. The growth is in the path data
  rather than a CSS `scale`, so it does not depend on `transform-box`/origin
  support in whatever renders the SVG. The percentage label stays where
  `textPosition` puts it, as in Mermaid.
- `hover` is ignored: no slice is highlighted, the output is byte-identical to
  a chart without the option. (A slice that is literally labelled `hover` is
  not highlighted either, because Mermaid's `hover` mode wins.)
- A label that matches no slice, a non-string value, or the empty string
  highlights nothing. Matching is exact and case-sensitive, like Mermaid.
- ASCII ignores it. A bar chart has no spare dimension to grow a bar into, and
  inventing a marker would make the text output depart from the SVG's meaning.

## Consequences

- No new attribute or API: the option rides on `%%{init}%%` only, like
  `textPosition` and `donutHole`.
- One deliberate difference: Mermaid also highlights an empty-labelled slice
  when `highlightSlice` is left at its default `""`. Replicating that would
  change charts that never set the option, so the empty string is a no-op here.
- The stroke on the enlarged slice stays 2px (Mermaid's CSS scale also thickens
  it to 2.1px).
- If Mermaid later changes `highlighted` to an offset, only the radius
  multiplier in `layoutPieChart` changes.

## Self-review (decision-doc checklist, #977)

- **Edge cases:** one slice at 100% is a full circle; the highlighted circle
  has radius 194.25, still inside the 40px frame margin (225 - 194.25 = 30.75).
  Empty chart: no slices, nothing to match. A highlighted slice under 1% is not
  drawn, so there is nothing to highlight. A duplicate label keeps the first
  slice (parser rule), and that one is the match. Highlighting the smallest of
  many slices works the same way: only radius changes.
- **Boundaries:** 1.05 is applied to radii, never to angles, so the
  slice's straight edges stay on the same rays as its neighbours' and the
  enlarged slice only pokes 9.25px past the rim, as Mermaid's does. Path numbers are rounded to
  two decimals by the existing `r()`; 194.25 is exact.
- **Terminology:** "centre" is the pie centre (`cx`, `cy`), not the slice's own
  centroid; with `legendPosition: left` or `top` that is the shifted pie
  centre, not the frame centre.
- **Sub-issue scope:** #1726 is only `highlightSlice`. `legendPosition`
  ([#1725](https://github.com/dfadler/zombie-mermaid/issues/1725)) ships in the
  same PR but does not interact: highlight changes a path, legend position
  changes the frame and where the pie sits.
- **Cited precedent:** the Mermaid behaviour above was read from the shipped
  12.1.0 bundle and measured in a headless render, not recalled. The
  "match Mermaid" principle is the one `docs/diagrams.md` already states for
  pie (`Known differences from Mermaid` lists every departure).
