---
'zombie-mermaid': minor
---

Opt-in layout-faithful ASCII for flowcharts: `zombie-mermaid render <file> --ascii --layout mermaid` and `renderMermaidASCIIWithLayout(src, { layout: 'mermaid' })` (new `zombie-mermaid/ascii-layout` entry) draw mermaid's own ELK layout. Subgraphs, unmodelled shapes, other diagram types, layout failures and drawings that cannot fit the 120-column cap (`-w <n>` / `maxCols` changes it) fall back to the default renderer and say so (stderr line / `fallbackReason`); `--layout mermaid-wide` / `maxCols: Infinity` draws the wide text instead. Merged parallel edges hide edge multiplicity; results depend on mermaid 12.1.0 and elkjs 0.9.3, a new optional peer dependency (`elkjs-0.9.3`, installed as `npm:elkjs@0.9.3`) that is loaded only when the option is used. Default output is unchanged and the MCP tool does not expose it. Refs [#2182](https://github.com/dfadler/zombie-mermaid/issues/2182), umbrella [#2177](https://github.com/dfadler/zombie-mermaid/issues/2177).
