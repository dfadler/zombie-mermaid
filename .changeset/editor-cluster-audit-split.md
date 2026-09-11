---
---

No release: audits and partially splits the editor component cluster
(zombie-mermaid#935, part of #931). `editor-page.tsx`'s hero and feature
strip, and `editor-config.tsx`'s `ColorField`/`ColorPopup`/`FontPopup`/
`NumberSliderField` plus their shared pure helpers, move to their own
files, following the same one-component-per-file pattern as #932/#933.
`editor-app.tsx`'s state/reducer/DOM-ref core is left untouched -- the
audit found it to be one genuinely cohesive deep module, not a bundle of
unrelated concerns. No behavior or rendered-output change: the full
`__tests__/dom/editor-*.test.ts` suite passes unmodified, and a real
`editor.ts` build's server-rendered markup is byte-identical before/after
(only the client bundle's own minified internals differ, as expected from
the changed module graph). Nothing here touches the published
`zombie-mermaid` package.
