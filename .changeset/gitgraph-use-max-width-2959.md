---
'zombie-mermaid': patch
'@zombie-mermaid/core': patch
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/svg-renderer': patch
---

Output change, SVG: `gitGraph` reads `useMaxWidth` from `%%{init}%%` and front matter. Its default, `true`, is mermaid's own and what GitHub and mermaid.live render: the `<svg>` gets `width="100%"` and a `max-width` style instead of fixed `width` and `height`; `useMaxWidth: false` keeps the fixed size. Other diagram types are unchanged. Refs [#2959](https://github.com/dfadler/zombie-mermaid/issues/2959) and [#3015](https://github.com/dfadler/zombie-mermaid/issues/3015).
