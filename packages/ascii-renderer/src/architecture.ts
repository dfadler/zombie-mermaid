// ============================================================================
// ASCII renderer — architecture diagram
//
// Lowers the parsed diagram to the flowchart model (`architectureToGraph`)
// and reuses the flowchart grid layout + drawing pipeline.
// ============================================================================

import { splitStatements, withDirectionOverride } from '@zombie-mermaid/core'
import {
  parseArchitecture,
  architectureToGraph,
} from '@zombie-mermaid/mermaid-parser'
import { renderGraphAscii } from './flowchart.ts'
import type { FlowchartAsciiExtras } from './flowchart.ts'
import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'

/** Render an `architecture-beta` diagram to ASCII/Unicode text art. */
export function renderArchitectureAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode,
  theme: AsciiTheme,
  extras: FlowchartAsciiExtras = {},
): string {
  const graph = architectureToGraph(parseArchitecture(splitStatements(text)))
  return renderGraphAscii(
    withDirectionOverride(graph, extras.direction),
    config,
    colorMode,
    theme,
    extras,
  )
}
