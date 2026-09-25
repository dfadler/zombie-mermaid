# @zombie-mermaid/svg-renderer

[![npm version](https://img.shields.io/npm/v/@zombie-mermaid/svg-renderer.svg)](https://www.npmjs.com/package/@zombie-mermaid/svg-renderer)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

SVG layout and rendering primitives for [Mermaid](https://mermaid.js.org/) diagrams — the [ELK.js](https://github.com/kieler/elkjs)-backed layout engine and per-diagram-type SVG emitters behind [`zombie-mermaid`](https://www.npmjs.com/package/zombie-mermaid)'s SVG output.

Supports flowcharts, state diagrams, sequence diagrams, class diagrams, ER diagrams, and XY charts.

## Install

```bash
npm install @zombie-mermaid/svg-renderer
```

## Usage

```ts
import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'

const svg = renderMermaidSVG('graph LR\n  A --> B')
console.log(svg)
```

```ts
const text = 'graph LR\n  A --> B'

renderMermaidSVG(text, {
  bg: '#1a1b26', // background color
  fg: '#a9b1d6', // foreground/text/line color
  font: 'Inter',
  transparent: false,
  embedSource: true, // stamp the original text onto the root <svg> as data-src
  title: 'Flowchart: A to B', // accessible name (role="img" + aria-labelledby)
})
```

See `RenderOptions` in [`@zombie-mermaid/core`](https://www.npmjs.com/package/@zombie-mermaid/core) for the full option set. Need async? Use `renderMermaidSVGAsync()` — same output, returns a `Promise<string>`.

## Lower-level pieces

This package also exports the per-diagram-type building blocks `renderMermaidSVG` is assembled from — a `layout*Sync()` function and a `render*Svg()` function per diagram type (flowchart/state, class, ER, sequence, XY chart), plus the shared ELK.js adapter and layout engine underneath them. Reach for these directly if you're doing custom integration work — a different dispatch layer, a subset of diagram types, or reusing the ELK.js layout adapters for something else — and want to skip diagram-type detection.

Each diagram type follows the same shape: parse (from `@zombie-mermaid/mermaid-parser`) → lay out → render. Class diagrams, for example:

```ts
import { splitStatements } from '@zombie-mermaid/core'
import { THEMES } from '@zombie-mermaid/core'
import { parseClassDiagram } from '@zombie-mermaid/mermaid-parser'
import {
  layoutClassDiagramSync,
  renderClassSvg,
} from '@zombie-mermaid/svg-renderer'

const text = 'classDiagram\n  Animal <|-- Dog'
const diagram = parseClassDiagram(splitStatements(text))
const positioned = layoutClassDiagramSync(diagram)
const svg = renderClassSvg(positioned, THEMES['zinc-light'])
```

The equivalent pairs for the other diagram types: `layoutErDiagramSync`/`renderErSvg`, `layoutSequenceDiagramSync`/`renderSequenceSvg`, `layoutXYChartSync`/`renderXYChartSvg`, and flowchart/state via `layoutGraphSync` (re-exported from `layout-engine.ts`) plus `renderer.ts`'s renderer. See each module under [`src/`](src) for exact signatures — most render functions take additional optional parameters (font, transparent background, embedded source, title, CSP nonce) beyond the two shown above.

## Relationship to `zombie-mermaid`

This package is one of the internal pieces `zombie-mermaid` is built from (alongside `@zombie-mermaid/core` and `@zombie-mermaid/mermaid-parser`, which stay internal-only). Installing `zombie-mermaid` pulls in the exact same layout/render code, wired up behind `renderMermaidSVG`.

## License

MIT — see [LICENSE](LICENSE).
