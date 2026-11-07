// ============================================================================
// ASCII renderer — Mindmap
//
// Mermaid's SVG mindmap is a radial force layout with no fixed-grid analogue,
// so the text form is a top-down indented tree, like `tree`:
//
//   ((mindmap))
//   ├── Origins
//   │   ├── Long history
//   │   └── [Research]
//   └── Tools
//       └── Pen and paper
//
//   - Each label is wrapped in its shape's delimiters so shapes stay apart:
//     default bare, rect `[x]`, rounded `(x)`, circle `((x))`, cloud `)x(`,
//     bang `))x((`, hexagon `{{x}}`.
//   - A multi-line label (newline or `<br>`) continues under its first line's
//     text; the `│` rail stays for the siblings below. The opening delimiter
//     sits on the first line and the closing one on the last.
//   - Markdown emphasis shows as plain text; icons and classes are not drawn.
//   - The root is painted in the theme accent, connectors in the line colour.
//   - Nothing is aligned in columns, so wide characters need no width maths.
//   - ASCII mode (`useAscii`) uses `+--`, `` `-- `` and `|`.
// ============================================================================

import { parseMindmap, mindmapPlainLines } from '@zombie-mermaid/mermaid-parser'
import type { MindmapNode, MindmapShape } from '@zombie-mermaid/mermaid-parser'
import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'
import { colorizeText } from './ansi.ts'

const UNI = { tee: '├── ', end: '└── ', rail: '│   ', gap: '    ' }
const ASC = { tee: '+-- ', end: '`-- ', rail: '|   ', gap: '    ' }

const DELIMITERS: Record<MindmapShape, [string, string]> = {
  default: ['', ''],
  rect: ['[', ']'],
  rounded: ['(', ')'],
  circle: ['((', '))'],
  cloud: [')', '('],
  bang: ['))', '(('],
  hexagon: ['{{', '}}'],
}

export function renderMindmapAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode,
  theme: AsciiTheme,
): string {
  const { root } = parseMindmap(text)
  const ch = config.useAscii ? ASC : UNI
  const out: string[] = []

  const label = (node: MindmapNode): string[] => {
    const [open, close] = DELIMITERS[node.shape]
    const lines = mindmapPlainLines(node.text)
    lines[0] = open + lines[0]
    lines[lines.length - 1] += close
    return lines
  }

  const walk = (
    node: MindmapNode,
    first: string,
    rest: string,
    childPrefix: string,
  ) => {
    const hex = node.level === 0 ? (theme.accent ?? theme.fg) : theme.fg
    label(node).forEach((line, i) => {
      const lead = i === 0 ? first : rest
      out.push(
        (
          colorizeText(
            line === '' ? lead.trimEnd() : lead,
            theme.line,
            colorMode,
          ) + colorizeText(line, hex, colorMode)
        ).trimEnd(),
      )
    })
    node.children.forEach((child, i) => {
      const last = i === node.children.length - 1
      const pad = last ? ch.gap : ch.rail
      walk(
        child,
        childPrefix + (last ? ch.end : ch.tee),
        childPrefix + pad,
        childPrefix + pad,
      )
    })
  }
  walk(root, '', '', '')
  return out.join('\n')
}
