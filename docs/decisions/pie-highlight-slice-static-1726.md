# Pie `highlightSlice` in static output

Status: implemented

## Decision

- Match Mermaid, not the explode lean: a diagram that renders one way on mermaid.live and another here is what this project exists to avoid.
- SVG: the slice named by `highlightSlice` has its outer (and, with `donutHole`, inner) radius multiplied by 1.05 about the pie centre and gets `opacity: 1` via a `pie-highlight` class; growth is in the path data, not CSS `scale`.
- `hover`, a label matching no slice, a non-string value and the empty string highlight nothing. Matching is exact and case-sensitive.
- ASCII ignores the option. No new API: it rides on `%%{init}%%` only. The empty-string no-op is a deliberate difference from Mermaid.

Full write-up: https://github.com/dfadler/zombie-mermaid/issues/1726#issuecomment-6884747842
