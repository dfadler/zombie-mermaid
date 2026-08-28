---
'zombie-mermaid': minor
---

Add `embedSource` render option to stamp the diagram source onto the root `<svg>`.

Once a diagram is rendered to SVG, the Mermaid source that produced it is gone. Consumers building a "copy source" button or an "open in Mermaid Live Editor" link had to re-attach the source themselves by regex-splicing a `data-src` attribute into the finished SVG string — and doing that safely requires a replacer _function_, not a string, since a string second argument to `.replace()` interprets `$`-sequences (`$1`, `$&`, `$'`) found in the source as replacement patterns. `$'` in particular would splice the remainder of the SVG into the attribute, corrupting it.

Passing `embedSource: true` to `renderMermaidSVG` / `renderMermaidSVGAsync` now stamps the original, un-decoded diagram source onto the root `<svg>` as `data-src`, HTML-escaped, across every diagram type (flowchart, sequence, class, ER, xychart). Default is `false` — no behavior change unless you opt in.
