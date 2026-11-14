// ============================================================================
// Wardley map types
//
// The parsed model of a Mermaid `wardley-beta` diagram (mermaid 12.3.0's
// `WardleyBuilder` output, minus the config). Coordinates are percentages of
// the chart: `x` is evolution (0 left, 100 right), `y` is visibility (0 bottom,
// 100 top). The SVG and ASCII renderers both draw from this model directly.
// ============================================================================

export type WardleyNodeKind = 'anchor' | 'component' | 'pipeline-component'

export type WardleyStrategy = 'build' | 'buy' | 'outsource' | 'market'

export interface WardleyNode {
  /** The name; a pipeline component's is `<parent>_<name>`. */
  id: string
  label: string
  x: number
  y: number
  kind: WardleyNodeKind
  /** `label [x, y]`: where the label sits relative to the default spot. */
  labelOffsetX?: number
  labelOffsetY?: number
  inertia?: boolean
  strategy?: WardleyStrategy
  /** A pipeline's parent: drawn as a square above the pipeline box. */
  isPipelineParent?: boolean
}

export type WardleyFlow = 'forward' | 'backward' | 'bidirectional'

export interface WardleyLink {
  /** Node ids (a name that matches no id but a label is resolved to the id). */
  source: string
  target: string
  dashed: boolean
  label?: string
  flow?: WardleyFlow
}

/** `evolve <component> <target>`: an arrow from the component to the target evolution, same visibility. */
export interface WardleyTrend {
  nodeId: string
  targetX: number
  targetY: number
}

export interface WardleyPipeline {
  nodeId: string
  componentIds: string[]
}

export interface WardleyAnnotation {
  number: number
  x: number
  y: number
  text: string
}

export interface WardleyNote {
  text: string
  x: number
  y: number
}

/** An accelerator or deaccelerator arrow. */
export interface WardleyArrow {
  name: string
  x: number
  y: number
}

/** A parsed Mermaid Wardley map. */
export interface WardleyMap {
  /** `title …`; the last one wins. */
  title?: string
  /** `size [w, h]`; mermaid's default is 900 x 600. */
  size?: { width: number; height: number }
  /** `evolution` stage names (`A / B` for a stage with two names); the default four are applied by the renderers. */
  stages?: string[]
  /** `@<fraction>` ends of the stages, only when every stage has one. */
  stageBoundaries?: number[]
  nodes: WardleyNode[]
  links: WardleyLink[]
  trends: WardleyTrend[]
  pipelines: WardleyPipeline[]
  annotations: WardleyAnnotation[]
  /** Where the numbered annotation texts are listed (`annotations [x, y]`). */
  annotationsBox?: { x: number; y: number }
  notes: WardleyNote[]
  accelerators: WardleyArrow[]
  deaccelerators: WardleyArrow[]
}

/** Mermaid's default stage names for the evolution axis. */
export const WARDLEY_DEFAULT_STAGES = [
  'Genesis',
  'Custom Built',
  'Product',
  'Commodity',
] as const
