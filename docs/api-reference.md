# API Reference

## `renderMermaidSVG(text, options?): string`

Render a Mermaid diagram to SVG. Synchronous. Auto-detects diagram type.

**Parameters:**

- `text` — Mermaid source code
- `options` — Optional `RenderOptions` object

**RenderOptions:**

| Option         | Type      | Default   | Description                                                                       |
| -------------- | --------- | --------- | --------------------------------------------------------------------------------- |
| `bg`           | `string`  | `#FFFFFF` | Background color (or CSS variable)                                                |
| `fg`           | `string`  | `#27272A` | Foreground color (or CSS variable)                                                |
| `line`         | `string?` | —         | Edge/connector color                                                              |
| `accent`       | `string?` | —         | Arrow heads, highlights                                                           |
| `muted`        | `string?` | —         | Secondary text, labels                                                            |
| `surface`      | `string?` | —         | Node fill tint                                                                    |
| `border`       | `string?` | —         | Node stroke color                                                                 |
| `font`         | `string`  | `Inter`   | Font family                                                                       |
| `transparent`  | `boolean` | `false`   | Render with transparent background                                                |
| `padding`      | `number`  | `40`      | Canvas padding in px (flowchart/state only)                                       |
| `nodeSpacing`  | `number`  | `28`      | Horizontal spacing between sibling nodes (flowchart/state only)                   |
| `layerSpacing` | `number`  | `48`      | Vertical spacing between layers (flowchart/state only)                            |
| `mergeEdges`   | `boolean` | `true`    | Bundle overlapping fan-out/fan-in edges into shared trunks (flowchart/state only) |
| `interactive`  | `boolean` | `false`   | Enable hover tooltips on XY chart bars and data points                            |

Class and ER diagrams use their own fixed internal spacing and currently ignore `padding`, `nodeSpacing`, `layerSpacing`, and `mergeEdges`.

Two more advanced options exist — `fontSizes` (per-element font size overrides) and `sequence` (sequence-diagram row/gap tuning) — see the `RenderOptions` JSDoc in [`src/types.ts`](../src/types.ts) for their fields and defaults.

**XY Charts:** Diagrams starting with `xychart-beta` are auto-detected — no separate function needed. The `accent` color option drives the chart series color palette.

## `renderMermaidSVGAsync(text, options?): Promise<string>`

Async version of `renderMermaidSVG()`. Same output, returns a `Promise<string>`. Useful in async server handlers or data loaders.

## `renderMermaidASCII(text, options?): string`

Render a Mermaid diagram to ASCII/Unicode text. Synchronous.

**AsciiRenderOptions:**

| Option             | Type                  | Default  | Description                                                             |
| ------------------ | --------------------- | -------- | ----------------------------------------------------------------------- |
| `useAscii`         | `boolean`             | `false`  | Use ASCII instead of Unicode                                            |
| `paddingX`         | `number`              | `5`      | Horizontal node spacing                                                 |
| `paddingY`         | `number`              | `5`      | Vertical node spacing                                                   |
| `boxBorderPadding` | `number`              | `1`      | Inner box padding                                                       |
| `colorMode`        | `string`              | `'auto'` | `'none'`, `'auto'`, `'ansi16'`, `'ansi256'`, `'truecolor'`, or `'html'` |
| `theme`            | `Partial<AsciiTheme>` | —        | Override default colors for ASCII output                                |

## `parseMermaid(text): MermaidGraph`

Parse Mermaid source into a structured graph object (for custom processing).

## `fromShikiTheme(theme): DiagramColors`

Extract diagram colors from a Shiki theme object. See [theming.md](theming.md) for how it maps editor colors to diagram roles.

## `THEMES: Record<string, DiagramColors>`

Object containing all 15 built-in themes. See [theming.md](theming.md) for the full list.

## `DEFAULTS: { bg: string, fg: string }`

Default colors (`#FFFFFF` / `#27272A`).
