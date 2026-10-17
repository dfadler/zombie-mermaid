import { layoutFlowchart } from '@zombie-mermaid/elk-layout'
import {
  rasterizeLayout,
  type RasterOptions,
  type RasterResult,
} from './rasterize.ts'

export { rasterizeLayout } from './rasterize.ts'
export type {
  FacePolicy,
  RasterBox,
  RasterOptions,
  RasterResult,
  RasterStats,
} from './rasterize.ts'

/**
 * Mermaid flowchart source -> ASCII drawn from mermaid's own (ELK) layout.
 * Throws `UnsupportedFlowchartError` (from `@zombie-mermaid/elk-layout`) for input the layout
 * module does not model; callers fall back to the grid renderer.
 */
export async function renderFlowchartAscii(
  src: string,
  opts?: RasterOptions,
): Promise<RasterResult> {
  return rasterizeLayout(await layoutFlowchart(src), opts)
}
