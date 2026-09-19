# @zombie-mermaid/svg-renderer

[![npm version](https://img.shields.io/npm/v/@zombie-mermaid/svg-renderer.svg)](https://www.npmjs.com/package/@zombie-mermaid/svg-renderer)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

SVG layout and rendering primitives for [Mermaid](https://mermaid.js.org/) diagrams — the [ELK.js](https://github.com/kieler/elkjs)-backed layout engine and per-diagram-type SVG emitters behind [`zombie-mermaid`](https://www.npmjs.com/package/zombie-mermaid)'s SVG output.

## What this package is (and isn't)

**Just want SVG output from Mermaid text?** Use [`zombie-mermaid`](https://www.npmjs.com/package/zombie-mermaid)'s `renderMermaidSVG(text)` instead — it's simpler and does exactly that.

This package does **not** currently include that single entry point. It exports the lower-level pieces the umbrella assembles it from: a `layout*Sync()` function and a `render*Svg()` function per diagram type (flowchart/state, class, ER, sequence, XY chart), plus the shared ELK.js adapter and layout engine underneath them. Diagram-type dispatch (detecting which diagram type a given Mermaid source is, and routing to the right layout/render pair) still lives in the umbrella. Adding a `renderMermaidSVG` front door here, for parity with `@zombie-mermaid/ascii-renderer`, is tracked separately — see [zombie-mermaid#1111](https://github.com/dfadler/zombie-mermaid/issues/1111).

Reach for this package directly if you're doing custom integration work — a different dispatch layer, a subset of diagram types, or reusing the ELK.js layout adapters for something else — and want to skip the umbrella package's own dispatch and ASCII-rendering code.

## Install

```bash
npm install @zombie-mermaid/svg-renderer @zombie-mermaid/mermaid-parser @zombie-mermaid/core
```

## Usage

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
