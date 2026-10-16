// ============================================================================
// Opt-in layout-faithful ASCII (#2182, umbrella #2177).
//
// Draws a flowchart from mermaid's own (ELK) layout instead of the grid
// renderer. The default ASCII path is untouched; this is a separate async
// entry that falls back to `renderMermaidASCII` and always reports which path
// produced the text. The private layout packages and elkjs 0.9.3 are loaded
// with a dynamic import, so they cost nothing unless this function is called.
// ============================================================================

import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import type { AsciiRenderOptions } from '@zombie-mermaid/ascii-renderer'
import { detectDiagramType } from '@zombie-mermaid/core'

/** Value of the `layout` option / `--layout` flag. `'standard'` is the default grid renderer. */
export type AsciiLayoutMode = 'mermaid' | 'standard'

export interface AsciiLayoutResult {
  text: string
  /** Which renderer produced `text`. */
  path: 'layout-faithful' | 'standard'
  /** Why the standard renderer ran although `layout: 'mermaid'` was requested. */
  fallbackReason?: string
  /** Caveat to show with layout-faithful output (merged parallel edges). */
  note?: string
}

/**
 * Render ASCII, optionally from mermaid's ELK layout (`layout: 'mermaid'`).
 *
 * Layout-faithful covers flat flowcharts only; anything else (subgraphs, unmodelled shapes,
 * other diagram types, a layout failure, elkjs 0.9.3 not installed) falls back to the standard
 * renderer and says so in `fallbackReason`. Layout-faithful output is plain text drawn on its
 * own grid, so spacing/color/profile options apply only to the fallback.
 */
export async function renderMermaidASCIIWithLayout(
  text: string,
  options: AsciiRenderOptions & { layout?: AsciiLayoutMode } = {},
): Promise<AsciiLayoutResult> {
  const { layout, ...asciiOptions } = options
  const standard = (fallbackReason?: string): AsciiLayoutResult => ({
    text: renderMermaidASCII(text, asciiOptions),
    path: 'standard',
    ...(fallbackReason === undefined ? {} : { fallbackReason }),
  })
  if (layout !== 'mermaid') return standard()

  const type = detectDiagramType(text)
  if (type !== 'flowchart') {
    return standard(`not applicable to ${type} diagrams (flowcharts only)`)
  }

  let layoutPkg: typeof import('@zombie-mermaid/elk-layout')
  let asciiLayoutPkg: typeof import('@zombie-mermaid/ascii-layout')
  try {
    ;[layoutPkg, asciiLayoutPkg] = await Promise.all([
      import('@zombie-mermaid/elk-layout'),
      import('@zombie-mermaid/ascii-layout'),
    ])
  } catch {
    return standard(
      'elkjs 0.9.3 is not installed (pnpm add elkjs-0.9.3@npm:elkjs@0.9.3)',
    )
  }
  try {
    const r = await asciiLayoutPkg.renderFlowchartAscii(text)
    return { text: r.text, path: 'layout-faithful', note: r.note }
  } catch (e) {
    if (e instanceof layoutPkg.UnsupportedFlowchartError) {
      return standard(`unsupported (${e.reasons.join('; ')})`)
    }
    return standard(
      `layout failed (${e instanceof Error ? e.message : String(e)})`,
    )
  }
}
