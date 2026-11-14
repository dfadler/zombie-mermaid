// ============================================================================
// ASCII renderer — use case diagram
//
// Lowers the parsed diagram to the flowchart model (`usecaseToGraph`) and
// reuses the flowchart grid layout + drawing pipeline: a use case is a rounded
// box, a system boundary a titled frame, a note a dog-eared box. An actor is a
// box holding a three-line stick figure over its name.
// ============================================================================

import { parseUsecase, usecaseToGraph } from '@zombie-mermaid/mermaid-parser'
import { renderGraphAscii } from './flowchart.ts'
import type { FlowchartAsciiExtras } from './flowchart.ts'
import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'

const FIGURE = ' O \n/|\\\n/ \\'

/** Render a `usecase-beta` diagram to ASCII/Unicode text art. */
export function renderUsecaseAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode,
  theme: AsciiTheme,
  extras: FlowchartAsciiExtras = {},
): string {
  const graph = usecaseToGraph(parseUsecase(text))
  for (const n of graph.nodes.values())
    if (n.shape === 'usecase-actor') {
      n.label = `${FIGURE}\n${n.label}`
      n.shape = 'rectangle'
    }
  return renderGraphAscii(graph, config, colorMode, theme, extras)
}
