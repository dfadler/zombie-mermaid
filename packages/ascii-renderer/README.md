# @zombie-mermaid/ascii-renderer

[![npm version](https://img.shields.io/npm/v/@zombie-mermaid/ascii-renderer.svg)](https://www.npmjs.com/package/@zombie-mermaid/ascii-renderer)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Render [Mermaid](https://mermaid.js.org/) diagrams to ASCII or Unicode box-drawing art — the standalone renderer behind [`zombie-mermaid`](https://www.npmjs.com/package/zombie-mermaid)'s `zombie-mermaid/ascii` entry point. Pure TypeScript, no DOM, no `elkjs`/SVG layout dependency — pull this in on its own when all you need is terminal output.

Supports flowcharts, state diagrams, sequence diagrams, class diagrams, ER diagrams, and XY charts.

## Install

```bash
npm install @zombie-mermaid/ascii-renderer
```

## Usage

```ts
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const ascii = renderMermaidASCII('graph LR\n  A --> B')
console.log(ascii)
```

```ts
renderMermaidASCII(text, {
  useAscii: false, // true = plain ASCII (+,-,|,>), false = Unicode box-drawing (┌,─,│,►)
  paddingX: 5,
  paddingY: 5,
  boxBorderPadding: 1,
  colorMode: 'auto', // 'none' | 'auto' | 'ansi16' | 'ansi256' | 'truecolor' | 'html'
  theme: {/* partial AsciiTheme override */},
})
```

See `AsciiRenderOptions` in [`src/index.ts`](src/index.ts) for the full option set (color mode, theme, hyperlinks, direction override, coordinate overlay).

## Relationship to `zombie-mermaid`

This package is one of the internal pieces `zombie-mermaid` is built from (alongside `@zombie-mermaid/core` and `@zombie-mermaid/mermaid-parser`, which stay internal-only). Installing `zombie-mermaid` and using `zombie-mermaid/ascii` pulls in the exact same renderer — reach for this package directly only when you specifically don't want the SVG-rendering half of the umbrella package.

## License

MIT — see [LICENSE](LICENSE).
