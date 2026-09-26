# @zombie-mermaid/svg-renderer

## 3.0.0

### Minor Changes

- [#1128](https://github.com/dfadler/zombie-mermaid/pull/1128) [`d9e306f`](https://github.com/dfadler/zombie-mermaid/commit/d9e306f91003c9e47da10944833f76c2b87ace22) Thanks [@dfadler](https://github.com/dfadler)! - Add `renderMermaidSVG(text, options)` — a single "Mermaid text in, SVG out" entry point, for parity with `@zombie-mermaid/ascii-renderer`'s `renderMermaidASCII`. Previously this package only exported the lower-level per-diagram-type `layout*Sync()`/`render*Svg()` pairs; diagram-type detection and dispatch had to be assembled by hand or via the `zombie-mermaid` umbrella package. Also adds `renderMermaidSVGAsync` and `themeCssVariables`, and the deprecated `renderMermaidSync`/`renderMermaid` aliases.

### Patch Changes

- Updated dependencies [[`d7777fe`](https://github.com/dfadler/zombie-mermaid/commit/d7777fe87a500c6b402c48b298d096f26ef6e130), [`c2a190d`](https://github.com/dfadler/zombie-mermaid/commit/c2a190df3c86e7b3394e853d437fc3d11b7634e4)]:
  - @zombie-mermaid/core@3.0.0
  - @zombie-mermaid/mermaid-parser@3.0.0

## 2.2.6

### Patch Changes

- Updated dependencies []:
  - @zombie-mermaid/core@2.2.6
  - @zombie-mermaid/mermaid-parser@2.2.6

## 2.2.5

### Patch Changes

- Updated dependencies []:
  - @zombie-mermaid/core@2.2.5
  - @zombie-mermaid/mermaid-parser@2.2.5

## 2.2.1

### Patch Changes

- Updated dependencies [[`dc6d5e9`](https://github.com/dfadler/zombie-mermaid/commit/dc6d5e9e4c9a90f06aebb56ff3a41fc47439ae66), [`7500604`](https://github.com/dfadler/zombie-mermaid/commit/750060424601ebe99e72a3d3c65384f96bc1d043)]:
  - @zombie-mermaid/core@2.2.1
  - @zombie-mermaid/mermaid-parser@2.2.1
