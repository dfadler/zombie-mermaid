// ============================================================================
// ASCII renderer — ArchiMate diagram
//
// Lowers the parsed diagram to the flowchart model (`archimateToGraph`) and
// reuses the flowchart grid layout + drawing pipeline, the same way C4 does.
// See docs/decisions/archimate-lowering-1167.md.
// ============================================================================

import { splitStatements, withDirectionOverride } from '@zombie-mermaid/core'
import {
  parseArchimate,
  archimateToGraph,
} from '@zombie-mermaid/mermaid-parser'
import { renderGraphAscii } from './flowchart.ts'
import type { FlowchartAsciiExtras } from './flowchart.ts'
import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'

/** Render an `archimate-layered` diagram to ASCII/Unicode text art. */
export function renderArchimateAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode,
  theme: AsciiTheme,
  extras: FlowchartAsciiExtras = {},
): string {
  const graph = archimateToGraph(parseArchimate(splitStatements(text)), {
    bands: false,
  })
  return renderGraphAscii(
    withDirectionOverride(graph, extras.direction),
    config,
    colorMode,
    theme,
    extras,
  )
}
