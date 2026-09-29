# @zombie-mermaid/mcp

## 3.1.0

### Minor Changes

- [#1173](https://github.com/dfadler/zombie-mermaid/pull/1173) [`1357207`](https://github.com/dfadler/zombie-mermaid/commit/1357207528b0cfee8fa7fb43513813a5f714a36e) Thanks [@dfadler](https://github.com/dfadler)! - MCP server: `render_mermaid_svg` gains optional `bg`/`fg` hex color overrides (applied on top of `theme`) and an optional `outputPath` that writes the SVG to a `.svg` file and returns `{ saved, size }`. `outputPath` is path-safe: it must resolve inside the server's working directory, the parent must already exist, and symlinks, `..` traversal, and non-regular files are refused. Because it can write files, `render_mermaid_svg` is now annotated `readOnlyHint: false, destructiveHint: true`. Two new tools, `list_themes` and `list_diagram_types`, list the valid `theme` names and the supported diagram types. `@zombie-mermaid/core` now exports a runtime `DIAGRAM_TYPES` array that `DiagramType` is derived from.

  Adapted by hand (not imported) from upstream lukilabs/beautiful-mermaid#120 (by LordCasser) and [#42](https://github.com/dfadler/zombie-mermaid/issues/42) (by manuareraa), keeping this fork's camelCase inputs and enum theme validation.

### Patch Changes

- Updated dependencies [[`1357207`](https://github.com/dfadler/zombie-mermaid/commit/1357207528b0cfee8fa7fb43513813a5f714a36e), [`14c5945`](https://github.com/dfadler/zombie-mermaid/commit/14c59452176f73e171aa459f69d2cee2ad7e7b34)]:
  - @zombie-mermaid/core@3.1.0
  - @zombie-mermaid/svg-renderer@3.1.0
  - @zombie-mermaid/ascii-renderer@3.1.0
  - @zombie-mermaid/mermaid-parser@3.1.0

## 3.0.0

### Patch Changes

- Updated dependencies [[`508b508`](https://github.com/dfadler/zombie-mermaid/commit/508b5083e74088b1a6163016b24cfc4c32f93ebb), [`451b981`](https://github.com/dfadler/zombie-mermaid/commit/451b98195e3370eb4a3beb66071396d5c616dbad), [`0849aba`](https://github.com/dfadler/zombie-mermaid/commit/0849abafc62e6cd94e38318e9edf6fe27634b49a), [`28698cd`](https://github.com/dfadler/zombie-mermaid/commit/28698cd7d706bb429f56edc0d38a185fde65120e), [`d7777fe`](https://github.com/dfadler/zombie-mermaid/commit/d7777fe87a500c6b402c48b298d096f26ef6e130), [`c2a190d`](https://github.com/dfadler/zombie-mermaid/commit/c2a190df3c86e7b3394e853d437fc3d11b7634e4), [`87f74e4`](https://github.com/dfadler/zombie-mermaid/commit/87f74e42c9cccbdd677ab2af17f4b3c415350948), [`d9e306f`](https://github.com/dfadler/zombie-mermaid/commit/d9e306f91003c9e47da10944833f76c2b87ace22)]:
  - @zombie-mermaid/ascii-renderer@3.0.0
  - @zombie-mermaid/core@3.0.0
  - @zombie-mermaid/mermaid-parser@3.0.0
  - @zombie-mermaid/svg-renderer@3.0.0

## 2.2.6

### Patch Changes

- Updated dependencies []:
  - @zombie-mermaid/ascii-renderer@2.2.6
  - @zombie-mermaid/core@2.2.6
  - @zombie-mermaid/mermaid-parser@2.2.6
  - @zombie-mermaid/svg-renderer@2.2.6

## 2.2.5

### Patch Changes

- Updated dependencies [[`43bac5a`](https://github.com/dfadler/zombie-mermaid/commit/43bac5abfb13064623ad94042b20ca9f4251fdaf)]:
  - @zombie-mermaid/ascii-renderer@2.2.5
  - @zombie-mermaid/core@2.2.5
  - @zombie-mermaid/mermaid-parser@2.2.5
  - @zombie-mermaid/svg-renderer@2.2.5

## 2.2.1

### Patch Changes

- Updated dependencies [[`dc6d5e9`](https://github.com/dfadler/zombie-mermaid/commit/dc6d5e9e4c9a90f06aebb56ff3a41fc47439ae66), [`7b32f48`](https://github.com/dfadler/zombie-mermaid/commit/7b32f48fa2a9488b66a94bdd43ad4be134d74349), [`7500604`](https://github.com/dfadler/zombie-mermaid/commit/750060424601ebe99e72a3d3c65384f96bc1d043)]:
  - @zombie-mermaid/ascii-renderer@2.2.1
  - @zombie-mermaid/core@2.2.1
  - @zombie-mermaid/mermaid-parser@2.2.1
  - @zombie-mermaid/svg-renderer@2.2.1
