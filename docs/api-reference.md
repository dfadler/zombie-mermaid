# API Reference

## `renderMermaidSVG(text, options?): string`

Render a Mermaid diagram to SVG. Synchronous. Auto-detects diagram type.

**Parameters:**

- `text` — Mermaid source code
- `options` — Optional `RenderOptions` object

**RenderOptions:**

| Option          | Type                                   | Default    | Description                                                                                                                                                                                                                                                 |
| --------------- | -------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bg`            | `string`                               | `#FFFFFF`  | Background color (or CSS variable)                                                                                                                                                                                                                          |
| `fg`            | `string`                               | `#27272A`  | Foreground color (or CSS variable)                                                                                                                                                                                                                          |
| `line`          | `string?`                              | —          | Edge/connector color                                                                                                                                                                                                                                        |
| `accent`        | `string?`                              | —          | Arrow heads, highlights                                                                                                                                                                                                                                     |
| `muted`         | `string?`                              | —          | Secondary text, labels                                                                                                                                                                                                                                      |
| `surface`       | `string?`                              | —          | Node fill tint                                                                                                                                                                                                                                              |
| `border`        | `string?`                              | —          | Node stroke color                                                                                                                                                                                                                                           |
| `font`          | `string`                               | `Inter`    | Font family                                                                                                                                                                                                                                                 |
| `transparent`   | `boolean`                              | `false`    | Render with transparent background                                                                                                                                                                                                                          |
| `padding`       | `number`                               | `40`       | Canvas padding in px (flowchart/state only)                                                                                                                                                                                                                 |
| `nodeSpacing`   | `number`                               | `28`       | Horizontal spacing between sibling nodes (flowchart/state only)                                                                                                                                                                                             |
| `layerSpacing`  | `number`                               | `48`       | Vertical spacing between layers (flowchart/state only)                                                                                                                                                                                                      |
| `mergeEdges`    | `boolean`                              | `true`     | Bundle overlapping fan-out/fan-in edges into shared trunks (flowchart/state only)                                                                                                                                                                           |
| `direction`     | `'TD' \| 'TB' \| 'BT' \| 'LR' \| 'RL'` | —          | Override the diagram's layout direction (its `graph LR` header or top-level `direction` line) at render time — see below. Flowchart, state, and ER diagrams only; sequence/class/xychart ignore it                                                          |
| `interactivity` | `'none' \| 'static' \| 'full'`         | `'static'` | Render-target-scoped interactivity level — see below                                                                                                                                                                                                        |
| `interactive`   | `boolean`                              | `false`    | **Deprecated**, use `interactivity`. Enable hover tooltips on XY chart bars and data points                                                                                                                                                                 |
| `embedSource`   | `boolean`                              | `false`    | Stamp the original diagram source onto the root `<svg>` as `data-src` (HTML-escaped)                                                                                                                                                                        |
| `title`         | `string?`                              | —          | Accessible name for the SVG: adds `role="img"` + `aria-labelledby` pointing at a `<title>` child. Without it the SVG still gets `role="img"` but no name — supply your own description; this library won't fabricate one. Ignored when `decorative` is true |
| `decorative`    | `boolean`                              | `false`    | Mark the diagram as decorative (already described in surrounding prose) — emits `aria-hidden="true"` instead of a name                                                                                                                                      |

Class and ER diagrams use their own fixed internal spacing and currently ignore `padding`, `nodeSpacing`, `layerSpacing`, and `mergeEdges`.

**`direction`:** replaces only the diagram's _top-level_ direction, after parsing and before layout — the source text is never rewritten, and `parseMermaid()` output is unaffected. It behaves exactly as if that direction had been written in the source header, and nothing more: a nested subgraph's or composite state's own `direction` line still applies on top of it, the same way it applies on top of the diagram's own header. Unset (the default) keeps the source's direction. Useful for re-laying a wide `LR` diagram out top-down for a narrow viewport without editing the source. Values are checked at compile time via the `Direction` type; an unrecognized string at runtime is ignored (the source direction stands), matching how other options treat unexpected values. See [issue #276](https://github.com/dfadler/zombie-mermaid/issues/276).

```typescript
// Same source, laid out top-down instead of left-to-right
const svg = renderMermaidSVG('graph LR\n  A --> B --> C', { direction: 'TB' })
```

**`title`/`decorative` and `click`-based links:** if the diagram has any `click A "url"` link, `role="img"` is never applied and `decorative` is silently overridden (no `aria-hidden`) — both would hide a real, focusable `<a href>` from assistive tech while leaving it reachable by Tab, which is unsafe regardless of what was requested. `title`/`aria-labelledby` still apply in that case. See [issue #239](https://github.com/dfadler/zombie-mermaid/issues/239).

**`interactivity`:** declarative-only interactivity level, scoped by output target — see [`docs/decisions/no-script-interactivity.md`](decisions/no-script-interactivity.md) for the full tier model this maps to.

- `'none'` — flowchart/state-diagram edge animation (`e1@{ animate: true }`) never renders, and `click`-based links (`<a href>`) and `<title>` tooltips are stripped. Intended for print/rasterized output, where both are meaningless.
- `'static'` (default) — `click`-based links and `<title>` tooltips still render; flowchart/state-diagram edge animation does not (motion is gated to `'full'` only). xychart hover tooltips stay off unless requested via `'full'` or the deprecated `interactive: true`.
- `'full'` — also enables flowchart/state-diagram edge animation and xychart hover tooltips.

Two more advanced options exist — `fontSizes` (per-element font size overrides) and `sequence` (sequence-diagram row/gap tuning) — see the `RenderOptions` JSDoc in [`src/types.ts`](../src/types.ts) for their fields and defaults.

**XY Charts:** Diagrams starting with `xychart-beta` are auto-detected — no separate function needed. The `accent` color option drives the chart series color palette.

## `renderMermaidSVGAsync(text, options?): Promise<string>`

Async version of `renderMermaidSVG()`. Same output, returns a `Promise<string>`. Useful in async server handlers or data loaders.

## `renderMermaidASCII(text, options?): string`

Render a Mermaid diagram to ASCII/Unicode text. Synchronous.

**AsciiRenderOptions:**

| Option             | Type                                   | Default  | Description                                                                                                                                                                                                                                                        |
| ------------------ | -------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useAscii`         | `boolean`                              | `false`  | Use ASCII instead of Unicode                                                                                                                                                                                                                                       |
| `paddingX`         | `number`                               | `5`      | Horizontal node spacing                                                                                                                                                                                                                                            |
| `paddingY`         | `number`                               | `5`      | Vertical node spacing                                                                                                                                                                                                                                              |
| `boxBorderPadding` | `number`                               | `1`      | Inner box padding                                                                                                                                                                                                                                                  |
| `colorMode`        | `string`                               | `'auto'` | `'none'`, `'auto'`, `'ansi16'`, `'ansi256'`, `'truecolor'`, or `'html'`                                                                                                                                                                                            |
| `theme`            | `Partial<AsciiTheme>`                  | —        | Override default colors for ASCII output                                                                                                                                                                                                                           |
| `direction`        | `'TD' \| 'TB' \| 'BT' \| 'LR' \| 'RL'` | —        | Override the diagram's top-level layout direction at render time, same semantics as `RenderOptions.direction` above. Flowchart and state diagrams only in ASCII output — the ASCII ER layout has no direction concept and ignores it, as do sequence/class/xychart |

ASCII-only consumers can import from `zombie-mermaid/ascii` instead of the
package root to avoid bundling `elkjs` (the SVG layout engine, statically
imported by the root entry and unused by the ASCII path):

```typescript
import { renderMermaidASCII } from 'zombie-mermaid/ascii'
```

## `parseMermaid(text): MermaidGraph`

Parse Mermaid source into a structured graph object (for custom processing).

## `fromShikiTheme(theme): DiagramColors`

Extract diagram colors from a Shiki theme object. See [theming.md](theming.md) for how it maps editor colors to diagram roles.

## `THEMES: Record<string, DiagramColors>`

Object containing all 15 built-in themes. See [theming.md](theming.md) for the full list.

## `DEFAULTS: { bg: string, fg: string }`

## `createMcpServer(): McpServer`

Build an [MCP](https://modelcontextprotocol.io/) server exposing `render_mermaid_svg` and `render_mermaid_ascii` tools, from `zombie-mermaid/mcp`. Not connected to a transport — see the [README's MCP Server section](../README.md#mcp-server) for the `zombie-mermaid mcp` CLI subcommand (the common case) or how to connect it yourself.

Default colors (`#FFFFFF` / `#27272A`).
