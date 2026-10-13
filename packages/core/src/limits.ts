// ============================================================================
// Input-size limits, checked before layout (#1854, umbrella #1502).
//
// ELK layout is one synchronous call that cannot be interrupted, and ASCII's
// canvas grows with the layout, so a time budget cannot work. Size limits
// can: a huge input fails fast with a typed error instead of hanging or
// killing the process with an out-of-memory abort.
// ============================================================================

export interface RenderLimits {
  /** Max source length in UTF-16 code units. Default 100,000. */
  maxInputLength?: number
  /** Max flowchart/state/architecture nodes. Default 400. */
  maxNodes?: number
  /** Max flowchart/state/architecture edges. Default 600. */
  maxEdges?: number
  /** ASCII only: max canvas cells (width x height). Default 2,000,000. */
  maxCanvasCells?: number
}

export const DEFAULT_RENDER_LIMITS: Required<RenderLimits> = {
  maxInputLength: 100_000,
  maxNodes: 400,
  maxEdges: 600,
  maxCanvasCells: 2_000_000,
}

/**
 * Thrown when an input exceeds a {@link RenderLimits} value. Stable
 * `code: 'LIMIT_EXCEEDED'`; `limit` names the option that tripped.
 */
export class LimitExceededError extends Error {
  readonly code = 'LIMIT_EXCEEDED' as const
  constructor(
    readonly limit: keyof RenderLimits,
    readonly value: number,
    readonly max: number,
  ) {
    super(`${limit} exceeded: ${value} > ${max}`)
    this.name = 'LimitExceededError'
  }
}

/** Throw {@link LimitExceededError} when `value` is over the (default-filled) limit. */
export function checkLimit(
  limit: keyof RenderLimits,
  value: number,
  limits: RenderLimits | undefined,
): void {
  const max = limits?.[limit] ?? DEFAULT_RENDER_LIMITS[limit]
  if (value > max) throw new LimitExceededError(limit, value, max)
}

/** Check node and edge counts of a parsed graph. */
export function checkGraphSize(
  nodes: number,
  edges: number,
  limits: RenderLimits | undefined,
): void {
  checkLimit('maxNodes', nodes, limits)
  checkLimit('maxEdges', edges, limits)
}
