---
'zombie-mermaid': minor
---

Add `title` and `decorative` render options so rendered SVGs can carry an accessible name (closes [#215](https://github.com/dfadler/zombie-mermaid/issues/215)).

The root `<svg>` had no `role`, no `aria-label`/`aria-labelledby`, and no `<title>`. Without an accessible name, assistive tech either exposes the SVG as a plain group — every node/edge label announced individually, out of reading order — or skips it entirely: a WCAG 1.1.1 (Non-text Content) failure for the library's primary use case, diagrams inlined into a page or document.

Every SVG diagram type (flowchart, state, sequence, class, ER, xychart — they all funnel through the single `svgOpenTag()` in `src/theme.ts`) now gets `role="img"` on the root. Pass `title` to also give it a name:

```ts
renderMermaidSVG('graph TD\n  A --> B', {
  title: 'Flowchart: Build → Test → Ship',
})
// <svg ... role="img" aria-labelledby="zm-title-1">
//   <title id="zm-title-1">Flowchart: Build → Test → Ship</title>
```

`aria-labelledby` points at a `<title>` child holding the text — the standard SVG/WAI-ARIA technique for naming inline SVG. The `zm-title-N` id increments per render call, so multiple diagrams inlined into one HTML page never collide, even when they share identical title text.

This library never fabricates a name: a generated "flowchart with 3 nodes" summary would be a confidently useless accessible name. When `title` is omitted, the SVG still gets `role="img"` (so it reads as a single image, not a leaky group) but claims no name — the same as an `<img>` with no `alt`.

For a diagram that's already described in surrounding prose, pass `decorative: true` instead:

```ts
renderMermaidSVG('graph TD\n  A --> B', { decorative: true })
// <svg ... aria-hidden="true">
```

This emits `aria-hidden="true"` in place of `role`/`aria-labelledby`/`<title>`; `title`, if also given, is ignored.

Both options are additive and default to their current absence (no `title`, `decorative: false`), so existing output only changes by gaining `role="img"` on the root — no breaking change. This is orthogonal to the per-node/per-point `<title>` tooltips from `click` interactions and XY chart hover tips: those are un-id'd `<title>` elements nested inside each node/point's `<g>`, so they never collide with the root's generated id, and a root `<title>` alongside descendant `<title>` elements is valid SVG.
