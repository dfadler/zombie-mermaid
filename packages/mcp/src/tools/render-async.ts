// ============================================================================
// Async render handlers: the sync handlers' work, run in the worker so a
// runaway render times out instead of stalling the stdio server (#1856).
// ============================================================================

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { renderErrorResult } from './parse-diagnostics.ts'
import { renderInWorker } from './render-worker-client.ts'
import { svgRenderOptions, svgResult } from './render-svg.ts'
import type { RenderSvgToolArgs } from './render-svg.ts'
import { asciiRenderOptions } from './render-ascii.ts'
import type { RenderAsciiToolArgs } from './render-ascii.ts'

export async function renderSvgHandlerAsync(
  input: RenderSvgToolArgs,
): Promise<CallToolResult> {
  try {
    const svg = await renderInWorker({
      kind: 'svg',
      diagram: input.diagram,
      options: svgRenderOptions(input),
    })
    return svgResult(input, svg)
  } catch (err) {
    return renderErrorResult(
      'Failed to render diagram to SVG',
      err,
      input.diagram,
    )
  }
}

export async function renderAsciiHandlerAsync(
  input: RenderAsciiToolArgs,
): Promise<CallToolResult> {
  try {
    const text = await renderInWorker({
      kind: 'ascii',
      diagram: input.diagram,
      options: asciiRenderOptions(input),
    })
    return { content: [{ type: 'text', text }] }
  } catch (err) {
    return renderErrorResult(
      'Failed to render diagram to ASCII',
      err,
      input.diagram,
    )
  }
}
