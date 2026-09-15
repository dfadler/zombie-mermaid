---
'@zombie-mermaid/ascii-renderer': patch
---

Fix a bogus diagonal arrowhead (`↘`) on the last edge in a mixed-style
fan-out (e.g. solid/dotted/thick siblings from the same source), even
when that edge's line was perfectly vertical (#1083). The edge's route
had fallen through to `determinePath`'s Case-4 direct fallback, which
`draw-lines.ts` draws as an L-shaped path (horizontal run, then vertical
run) folded into one segment; `drawArrowHead` derived direction from that
segment's first and last point, spanning both legs and reading as
diagonal. It now derives direction from the final step into the
arrowhead instead.
