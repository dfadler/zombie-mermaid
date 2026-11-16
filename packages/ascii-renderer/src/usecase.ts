// ============================================================================
// ASCII renderer — use case diagram
//
// Lowers the parsed diagram to the flowchart model (`usecaseToGraph`) and
// reuses the flowchart grid layout + drawing pipeline: a use case is a rounded
// box, a system boundary a titled frame, a note a dog-eared box. An actor is a
// box holding a three-line stick figure over its name.
// ============================================================================

import {
  USECASE_JSON_SEP,
  parseUsecase,
  usecaseToGraph,
} from '@zombie-mermaid/mermaid-parser'
import { displayWidth } from './display-width.ts'
import { renderGraphAscii } from './flowchart.ts'
import type { FlowchartAsciiExtras } from './flowchart.ts'
import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'

const FIGURE = ' O \n/|\\\n/ \\'
// Hollow, silhouette and icon actors, and a business actor's slashed head.
const FIGURES: Record<string, string> = {
  'usecase-actor-hollow': FIGURE,
  'usecase-actor-awesome': ' ● \n▟█▙\n/ \\',
  'usecase-actor-icon': '┌─┐\n│?│\n└─┘',
}
const BUSINESS_FIGURE = ' O/\n/|\\\n/ \\'

/** A json node as a table: its name over `key: value` rows, keys padded to one column. */
function jsonText(label: string): string {
  const [title = '', ...rows] = label.split('\n')
  const cells = rows.map((r) => r.split(USECASE_JSON_SEP) as [string, string])
  // Pad by display columns: a wide glyph takes two.
  const spaces = (n: number): string => ' '.repeat(Math.max(0, n))
  const pad = Math.max(0, ...cells.map(([k]) => displayWidth(k)))
  const lines = cells.map(
    ([k, v]) => `${k}${spaces(pad - displayWidth(k))} : ${v}`,
  )
  const wide = Math.max(0, ...lines.map(displayWidth))
  return [
    title,
    '',
    ...lines.map((l) => l + spaces(wide - displayWidth(l))),
  ].join('\n')
}

/** Render a `usecase-beta` diagram to ASCII/Unicode text art. */
export function renderUsecaseAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode,
  theme: AsciiTheme,
  extras: FlowchartAsciiExtras = {},
): string {
  const graph = usecaseToGraph(parseUsecase(text))
  for (const n of graph.nodes.values()) {
    if (n.shape === 'usecase-json') {
      n.label = jsonText(n.label)
      n.shape = 'rectangle'
    } else if (n.shape.startsWith('usecase-actor')) {
      const fig = n.business ? BUSINESS_FIGURE : (FIGURES[n.shape] ?? FIGURE)
      n.label = `${fig}\n${n.label}`
      n.shape = 'rectangle'
    }
  }
  return renderGraphAscii(graph, config, colorMode, theme, extras)
}
