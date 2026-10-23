# API Reference

This page, together with `package.json` `exports`/`bin` and the MCP schemas, defines the published surface that semver covers; see the [versioning and deprecation policy](decisions/versioning-and-deprecation-policy-1568.md).

## `renderMermaidSVG(text, options?): string`

Render a Mermaid diagram to SVG. Synchronous. Auto-detects diagram type.

**Parameters:**

- `text` — Mermaid source code
- `options` — Optional `RenderOptions` object

**RenderOptions:**

| Option                | Type                                   | Default    | Description                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------- | -------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bg`                  | `string`                               | `#FFFFFF`  | Background color (or CSS variable)                                                                                                                                                                                                                                                                                                                                                                      |
| `fg`                  | `string`                               | `#27272A`  | Foreground color (or CSS variable)                                                                                                                                                                                                                                                                                                                                                                      |
| `line`                | `string?`                              | —          | Edge/connector color                                                                                                                                                                                                                                                                                                                                                                                    |
| `accent`              | `string?`                              | —          | Arrow heads, highlights                                                                                                                                                                                                                                                                                                                                                                                 |
| `muted`               | `string?`                              | —          | Secondary text, labels                                                                                                                                                                                                                                                                                                                                                                                  |
| `surface`             | `string?`                              | —          | Node fill tint                                                                                                                                                                                                                                                                                                                                                                                          |
| `border`              | `string?`                              | —          | Node stroke color                                                                                                                                                                                                                                                                                                                                                                                       |
| `font`                | `string`                               | `Inter`    | Font family                                                                                                                                                                                                                                                                                                                                                                                             |
| `embedFont`           | `false \| 'subset'`                    | `false`    | `'subset'` inlines a base64 Inter subset (Basic Latin, weights 400-700, ~14.7 KB per SVG, SIL OFL 1.1) instead of the Google Fonts `@import`, so the font also loads when the SVG is used as an `<img>`. Only with `font: 'Inter'` (the default). `renderMermaidSVGAsync()` loads the data itself; call `await loadEmbeddedFont()` once before the sync `renderMermaidSVG()`. Not in the default bundle |
| `transparent`         | `boolean`                              | `false`    | Render with transparent background                                                                                                                                                                                                                                                                                                                                                                      |
| `padding`             | `number`                               | `40`       | Canvas padding in px (flowchart, state and architecture; see below)                                                                                                                                                                                                                                                                                                                                     |
| `nodeSpacing`         | `number`                               | `28`       | Horizontal spacing between sibling nodes (flowchart, state and architecture; see below)                                                                                                                                                                                                                                                                                                                 |
| `layerSpacing`        | `number`                               | `48`       | Vertical spacing between layers (flowchart, state and architecture; see below)                                                                                                                                                                                                                                                                                                                          |
| `mergeEdges`          | `boolean`                              | `true`     | Bundle overlapping fan-out/fan-in edges into shared trunks (flowchart, state and architecture; see below)                                                                                                                                                                                                                                                                                               |
| `layout`              | `'elk' \| 'simple'`                    | `'elk'`    | Layout engine for flowcharts. `'simple'` is a built-in layered layout that needs no `elkjs` (flowchart only; see below)                                                                                                                                                                                                                                                                                 |
| `direction`           | `'TD' \| 'TB' \| 'BT' \| 'LR' \| 'RL'` | —          | Override the diagram's layout direction (its `graph LR` header or top-level `direction` line) at render time — see below. Flowchart, state, and ER diagrams only; sequence/class/xychart ignore it                                                                                                                                                                                                      |
| `interactivity`       | `'none' \| 'static' \| 'full'`         | `'static'` | Render-target-scoped interactivity level — see below                                                                                                                                                                                                                                                                                                                                                    |
| `interactive`         | `boolean`                              | `false`    | **Deprecated**, use `interactivity`. Enable hover tooltips on XY chart bars and data points                                                                                                                                                                                                                                                                                                             |
| `embedSource`         | `boolean`                              | `false`    | Stamp the original diagram source onto the root `<svg>` as `data-src` (HTML-escaped)                                                                                                                                                                                                                                                                                                                    |
| `honorThemeVariables` | `boolean`                              | `false`    | Opt in to the diagram's own `%%{init: {"themeVariables": ...}}%%` colours (`primaryColor`, `primaryBorderColor`, `primaryTextColor`, `lineColor`, `pie1`..`pie12`); your own colours win. See [themeVariables](diagrams.md#themevariables-opt-in)                                                                                                                                                       |
| `resolveColors`       | `boolean`                              | `false`    | Replace every CSS `var(--…)`/`color-mix(…)` in the output with its computed sRGB value, for rasterizers and other non-browser SVG consumers — see below                                                                                                                                                                                                                                                 |
| `title`               | `string?`                              | —          | Accessible name for the SVG: adds `role="img"` + `aria-labelledby` pointing at a `<title>` child. Without it the SVG still gets `role="img"` but no name — supply your own description; this library won't fabricate one. Ignored when `decorative` is true                                                                                                                                             |
| `decorative`          | `boolean`                              | `false`    | Mark the diagram as decorative (already described in surrounding prose) — emits `aria-hidden="true"` instead of a name                                                                                                                                                                                                                                                                                  |
| `nonce`               | `string?`                              | —          | CSP nonce stamped on every emitted `<style>` element (attribute-escaped). Lets a host with a `style-src 'nonce-…'` policy allow the diagram's styles — see "Strict Content-Security-Policy" below                                                                                                                                                                                                       |
| `styleAttribute`      | `boolean`                              | `true`     | Emit the root `<svg style="--bg: …">` attribute. Set `false` under a strict CSP (a nonce can't authorise a `style=` attribute) and supply the same declarations from your own stylesheet via `themeCssVariables()` — see below                                                                                                                                                                          |

**`layout: 'simple'`** lays a flowchart (`graph` / `flowchart`) out without ELK, so `renderMermaidSVG` works with no `elkjs` registered or installed. It is opt-in and never a fallback: unset, or `'elk'`, keeps the existing output exactly. It supports every direction, subgraphs (nested, inside-out), edge labels, self-loops, multi-edges, cycles and disconnected components. It ignores `mergeEdges`, `layoutCache` and a subgraph's own `direction`, and draws edges as plain orthogonal polylines. State, class, ER and architecture diagrams ignore it and still need `elkjs`; a state diagram with no `[*]` marker is parsed as a flowchart and gets the simple layout. An unknown value throws. Measured placement quality against mermaid 12.1.0: [docs/decisions/simple-layout-1685.md](decisions/simple-layout-1685.md).

**Which diagram types honor the layout options.** `padding`, `nodeSpacing`, `layerSpacing`, and `mergeEdges` apply to flowchart, state and architecture diagrams (architecture is lowered to the flowchart layout). Class, ER, sequence and xychart use their own fixed internal spacing and ignore them. C4 (`c4/layout.ts`) and pie lay themselves out to Mermaid's geometry and ignore every layout option, including `direction`.

**`direction`:** replaces only the diagram's _top-level_ direction, after parsing and before layout — the source text is never rewritten, and `parseMermaid()` output is unaffected. It behaves exactly as if that direction had been written in the source header, and nothing more: a nested subgraph's or composite state's own `direction` line still applies on top of it, the same way it applies on top of the diagram's own header. Unset (the default) keeps the source's direction. Useful for re-laying a wide `LR` diagram out top-down for a narrow viewport without editing the source. Values are checked at compile time via the `Direction` type; an unrecognized string at runtime is ignored (the source direction stands), matching how other options treat unexpected values. See [issue #276](https://github.com/dfadler/zombie-mermaid/issues/276).

```typescript
// Same source, laid out top-down instead of left-to-right
const svg = renderMermaidSVG('graph LR\n  A --> B --> C', { direction: 'TB' })
```

**`title`/`decorative` and `click`-based links:** if the diagram has any `click A "url"` link, `role="img"` is never applied and `decorative` is silently overridden (no `aria-hidden`) — both would hide a real, focusable `<a href>` from assistive tech while leaving it reachable by Tab, which is unsafe regardless of what was requested. `title`/`aria-labelledby` still apply in that case. See [issue #239](https://github.com/dfadler/zombie-mermaid/issues/239).

**`resolveColors`:** the default output is a live function of its CSS custom properties — the `<style>` block derives `--_line`, `--_node-stroke`, etc. from `--bg`/`--fg` with `color-mix()`, which browsers evaluate natively (see [`docs/theming.md`](theming.md)). Rasterizers and other non-browser SVG consumers (resvg, librsvg, Inkscape, ImageMagick) implement neither `var()` nor `color-mix()` and render the whole theme as black. `resolveColors: true` runs a post-pass that evaluates each expression against the same declarations the renderer just wrote — the `MIX` percentages in `packages/core/src/theme.ts` remain the single source of truth — and substitutes `#rrggbb` (or `rgba()` when translucent). Trade-off: the result is a fixed palette; overriding `--bg`/`--fg` on the embedded SVG no longer restyles it. A `var(...)` reference this library did not declare itself — a color passed as `var(--brand)`, a host-page font variable — has nothing to resolve against and is left as-is. The CLI exposes this as `--resolve-colors`. See [issue #456](https://github.com/dfadler/zombie-mermaid/issues/456).

**`interactivity`:** declarative-only interactivity level, scoped by output target — see [`docs/decisions/no-script-interactivity.md`](decisions/no-script-interactivity.md) for the full tier model this maps to.

- `'none'` — flowchart/state-diagram edge animation (`e1@{ animate: true }`) never renders, and `click`-based links (`<a href>`) and `<title>` tooltips are stripped. Intended for print/rasterized output, where both are meaningless.
- `'static'` (default) — `click`-based links and `<title>` tooltips still render; flowchart/state-diagram edge animation does not (motion is gated to `'full'` only). xychart hover tooltips stay off unless requested via `'full'` or the deprecated `interactive: true`.
- `'full'` — also enables flowchart/state-diagram edge animation and xychart hover tooltips.

**Strict Content-Security-Policy (`nonce` / `styleAttribute`):** the renderer styles its SVG through two inline surfaces — a `<style>` element (two for xycharts and for flowcharts with an animated edge under `interactivity: 'full'`) and a `style="--bg: …; --fg: …"` attribute on the root `<svg>` that carries the theme custom properties every rule resolves against. A `style-src` without `'unsafe-inline'` blocks both, and the diagram silently renders unstyled ([issue #216](https://github.com/dfadler/zombie-mermaid/issues/216)). Nonces only ever apply to elements, so the two halves need two options:

```ts
import { renderMermaidSVG, themeCssVariables } from 'zombie-mermaid'

const opts = { bg: '#1a1b26', fg: '#a9b1d6', nonce, styleAttribute: false }
const svg = renderMermaidSVG(code, opts) // every <style> gets nonce="…", no root style=
const css = `.diagram svg { ${themeCssVariables(opts)} }` // "--bg:#1a1b26;--fg:#a9b1d6;background:var(--bg)"
// <style nonce="…">${css}</style>  …  <div class="diagram">${svg}</div>
```

`themeCssVariables(options)` returns the exact declaration list the root attribute would have carried (built by the same function), so pass the same options object to both calls. The two options are independent: a host using hashes instead of nonces can set `styleAttribute: false` alone. Neither changes the output when unset.

Two more advanced options exist — `fontSizes` (per-element font size overrides) and `sequence` (sequence-diagram row/gap tuning) — see the `RenderOptions` JSDoc in [`packages/core/src/types.ts`](../packages/core/src/types.ts) for their fields and defaults.

**XY Charts:** Diagrams starting with `xychart-beta` are auto-detected — no separate function needed. The `accent` color option drives the chart series color palette.

**Pie charts:** `accent` sets the first slice colour (the remaining slices are derived from it and `bg`). See [Accessibility](diagrams.md#accessibility).

**`accTitle` / `accDescr`:** every diagram type reads Mermaid's `accTitle:` and `accDescr:` statements. The `title` option names the SVG for assistive tech and wins over the source's `accTitle:`; `accDescr:` becomes the `<desc>`. ASCII output ignores them.

**C4 and architecture diagrams:** C4 uses the theme colours and `font` but no layout options (see above); the source `title` is its fallback accessible name when neither the `title` option nor `accTitle:` is given. Architecture diagrams take every flowchart option, including `direction` and `curve`, and are named by the `title` option or `accTitle:`.

## Size limits (`options.limits`)

Both `renderMermaidSVG()` and `renderMermaidASCII()` check input size before
layout and throw `LimitExceededError` (`code: 'LIMIT_EXCEEDED'`, plus `limit`,
`value` and `max`) instead of hanging in ELK or running out of memory. Pass
`limits: { ... }` to change any of them; `Infinity` disables one.

| Limit            | Default   | MCP tools | Applies to                                               |
| ---------------- | --------- | --------- | -------------------------------------------------------- |
| `maxInputLength` | 100,000   | 50,000    | Source length, every diagram type                        |
| `maxNodes`       | 400       | 150       | Flowchart, state and architecture diagrams               |
| `maxEdges`       | 600       | 300       | Flowchart, state and architecture diagrams               |
| `maxCanvasCells` | 2,000,000 | 1,000,000 | ASCII flowchart/state/architecture: width x height cells |

The defaults sit far above every sample in the repo (at most 12 nodes, 750
characters, 6,500 canvas cells). ELK layout time depends on topology, not
only size: random 100-node/300-edge graphs took 2 to 6 s and 150/450 took 9 to
16 s (Node 24, macOS), so raise the node and edge limits only for input you
trust. The canvas check runs after the ASCII grid is laid out, so it bounds
memory, not layout time. The MCP tools use the tighter column because one
out-of-memory abort would end the stdio server for every tool.

```ts
import { renderMermaidSVG, LimitExceededError } from 'zombie-mermaid'

try {
  renderMermaidSVG(code, { limits: { maxNodes: 1000, maxEdges: 2000 } })
} catch (e) {
  if (e instanceof LimitExceededError) console.warn(e.limit, e.value, e.max)
  else throw e
}
```

`LimitExceededError`, `DEFAULT_RENDER_LIMITS` and the `RenderLimits` type are
exported from `zombie-mermaid`; `zombie-mermaid/ascii` also exports
`LimitExceededError` and `RenderLimits`.

## `registerElk(ELK): void`

Registers the [`elkjs`](https://github.com/kieler/elkjs) layout engine, an optional
peer dependency, used for flowchart, state, class, ER and architecture diagrams.
Call it once before rendering in a browser or bundler app:

```typescript
import ELK from 'elkjs/lib/elk.bundled.js'
import { registerElk } from 'zombie-mermaid'

registerElk(ELK)
```

| Diagram type                                                    | Needs `registerElk()` in a browser/bundler? |
| --------------------------------------------------------------- | ------------------------------------------- |
| flowchart, state, class, ER, architecture (`architecture-beta`) | yes                                         |
| sequence, pie, xychart, C4                                      | no                                          |
| any ASCII output (`renderMermaidASCII`)                         | no                                          |

Pass the `ELK` class from `elkjs/lib/elk.bundled.js` or `elkjs/lib/main.js`.
Under Node and Bun the call is optional: with `elkjs` installed it is loaded on
first use. Calling it again swaps the constructor. Without a registered or
auto-loadable `elkjs`, rendering a graph diagram throws `ElkNotRegisteredError`;
sequence, pie, xychart, C4 and ASCII rendering are unaffected. Also exported by
`@zombie-mermaid/svg-renderer`. See the
[migration guide](guides/elkjs-optional-peer.md).

## `renderMermaidSVGAsync(text, options?): Promise<string>`

Async version of `renderMermaidSVG()`. Same output, returns a `Promise<string>`. Useful in async server handlers or data loaders.

## `renderMermaidASCII(text, options?): string`

Render a Mermaid diagram to ASCII/Unicode text. Synchronous.

**AsciiRenderOptions:**

| Option                | Type                                   | Default  | Description                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------- | -------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useAscii`            | `boolean`                              | `false`  | Use ASCII instead of Unicode                                                                                                                                                                                                                                                                                                                                                               |
| `paddingX`            | `number`                               | `5`      | Horizontal node spacing                                                                                                                                                                                                                                                                                                                                                                    |
| `paddingY`            | `number`                               | `5`      | Vertical node spacing                                                                                                                                                                                                                                                                                                                                                                      |
| `boxBorderPadding`    | `number`                               | `1`      | Inner box padding                                                                                                                                                                                                                                                                                                                                                                          |
| `colorMode`           | `string`                               | `'auto'` | `'none'`, `'auto'`, `'ansi16'`, `'ansi256'`, `'truecolor'`, or `'html'`                                                                                                                                                                                                                                                                                                                    |
| `theme`               | `Partial<AsciiTheme>`                  | —        | Override default colors for ASCII output. The default theme gives text (labels) no colour of its own, so it shows in the terminal's own foreground (`color:inherit` for `html`) and reads on dark and light backgrounds; pass `fg` to force one                                                                                                                                            |
| `direction`           | `'TD' \| 'TB' \| 'BT' \| 'LR' \| 'RL'` | —        | Override the diagram's top-level layout direction at render time, same semantics as `RenderOptions.direction` above. Flowchart and state diagrams only in ASCII output — the ASCII ER layout has no direction concept and ignores it, as do sequence/class/xychart                                                                                                                         |
| `honorThemeVariables` | `boolean`                              | `false`  | Opt in to the diagram's `themeVariables` for `line`, `border`, `fg` and pie slices (hex only); a key in `theme` wins. See [themeVariables](diagrams.md#themevariables-opt-in)                                                                                                                                                                                                              |
| `showCoords`          | `boolean`                              | `false`  | Internal debugging aid: overlays row/column indices on the output. Not a stable API                                                                                                                                                                                                                                                                                                        |
| `hyperlinks`          | `boolean`                              | `false`  | Wrap `click` hrefs in OSC 8 terminal hyperlinks (see [ASCII terminal hyperlinks](diagrams.md#ascii-terminal-hyperlinks))                                                                                                                                                                                                                                                                   |
| `profile`             | `'markdown'`                           | —        | Preset for plain, paste-safe output (issues, commits, fenced blocks): defaults `useAscii: true`, `colorMode: 'none'`, `hyperlinks: false`, `showCoords: false`; explicit options still win. Labels are not transliterated, and CJK/emoji column width stays font-dependent ([UAX #11](https://www.unicode.org/reports/tr11/)), so such labels can misalign on proportional fallback fonts. |

ASCII-only consumers can import from `zombie-mermaid/ascii` instead of the
package root to skip loading the SVG renderer (the root entry no longer
includes `elkjs` unless you call `registerElk()`):

```typescript
import { renderMermaidASCII } from 'zombie-mermaid/ascii'
```

## `parseMermaid(text): MermaidGraph`

Parse Mermaid source into a structured graph object (for custom processing).
Handles flowchart and state diagram sources. The returned
`MermaidGraph.interactions` (`Map<string, NodeInteraction>`, keyed by node
id) carries every `click` statement's href, tooltip, and `call`/`callback`
expression — and is the only place a callback surfaces, since the rendered
SVG never carries it. See the flowchart
[Interactions](diagrams.md#interactions) section for how a host binds it.

## `themeCssVariables(options?): string`

The CSS declaration list the root `<svg style="…">` attribute carries for the given `RenderOptions` — `--bg`, `--fg`, whichever enrichment colours were set, and (unless `transparent`) `background: var(--bg)` — as one compact string, e.g. `--bg:#FFFFFF;--fg:#27272A;background:var(--bg)`. For hosts that render with `styleAttribute: false` and define the theme variables from their own stylesheet instead; see the strict-CSP note under `renderMermaidSVG` above.

## `fromShikiTheme(theme): DiagramColors`

Extract diagram colors from a Shiki theme object. See [theming.md](theming.md) for how it maps editor colors to diagram roles.

## `THEMES: Record<string, DiagramColors>`

Object containing all 15 built-in themes. See [theming.md](theming.md) for the full list.

## `DEFAULTS: { bg: string, fg: string }`

## `createMcpServer(): McpServer`

Build an [MCP](https://modelcontextprotocol.io/) server (also exported as `createMcpServer` from `@zombie-mermaid/mcp`) exposing `render_mermaid_svg`, `render_mermaid_ascii`, `check_mermaid_sequence_activations`, `fix_mermaid_sequence_activations`, `list_themes`, and `list_diagram_types` tools, from `zombie-mermaid/mcp`. Not connected to a transport — see the [MCP tool reference](mcp-tools.md) for every tool's arguments and the [README's MCP Server section](../README.md#mcp-server) for the `zombie-mermaid mcp` CLI subcommand (the common case) or how to connect it yourself.

Default colors (`#FFFFFF` / `#27272A`).

The `render_mermaid_svg` tool takes `diagram`, plus optional `theme`, `transparent`, `font`, `bg` and `fg` (hex `#rgb`/`#rrggbb`, applied on top of the theme), and `outputPath`. With `outputPath` the SVG is written to a `.svg` file inside the server's working directory (parent directory must exist; an existing `.svg` is overwritten; symlinks refused) and the tool returns `{ saved, size }` instead of the SVG text. `render_mermaid_ascii` takes `diagram` and the ASCII options listed in its schema.

## Other exports

Also exported from the package root:

| Export                                                                                                                                    | Kind            | Description                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createLayoutCache(maxSize?)` / `LayoutCache`                                                                                             | function / type | Bounded LRU cache (default 20 entries) for ELK layout results. Pass it as `RenderOptions.layoutCache` to memoize layout across repeated renders of the same diagram and options. Throws unless `maxSize` is a positive integer |
| `ElkNotRegisteredError`                                                                                                                   | class           | Thrown when a graph diagram is rendered with no registered or auto-loadable `elkjs` (see `registerElk`)                                                                                                                        |
| `ElkConstructor`                                                                                                                          | type            | The constructor type `registerElk` accepts                                                                                                                                                                                     |
| `renderMermaidSync`, `renderMermaid`                                                                                                      | function        | **Deprecated** aliases of `renderMermaidSVG` and `renderMermaidSVGAsync`                                                                                                                                                       |
| `renderMermaidAscii`                                                                                                                      | function        | **Deprecated** alias of `renderMermaidASCII`                                                                                                                                                                                   |
| `Direction`                                                                                                                               | type            | `'TD' \| 'TB' \| 'BT' \| 'LR' \| 'RL'`, the type of the `direction` option                                                                                                                                                     |
| `DiagramColors`, `ThemeName`                                                                                                              | type            | Colour set for a theme and the key type of `THEMES`                                                                                                                                                                            |
| `CommonRenderOptions`, `FlowchartRenderOptions`, `SequenceRenderOptions`, `ClassRenderOptions`, `ErRenderOptions`, `XyChartRenderOptions` | type            | The per-diagram slices of `RenderOptions`                                                                                                                                                                                      |
| `MermaidGraph`, `NodeInteraction`, `PositionedGraph`                                                                                      | type            | Parser and layout result types                                                                                                                                                                                                 |

`DiagramType` is internal and not exported from the root.
