// ============================================================================
// Render-time direction override (issue #276)
//
// `RenderOptions.direction` / `AsciiRenderOptions.direction` replace the
// *top-level* direction a diagram declared in its source (a flowchart's
// `graph LR` header, a state diagram's or ER diagram's `direction LR`
// line) after parsing and before layout. Nothing here touches the source
// text, and nothing here touches a nested subgraph's or composite state's
// own `direction` — those live on the subgraph objects, not on the field
// replaced below, so they keep winning locally over the top-level
// direction exactly as they do relative to the diagram's own header.
//
// Shared by the SVG entry (src/index.ts) and the ASCII entry
// (src/ascii/index.ts). Deliberately dependency-free beyond the parser's
// own `isDirection` guard so the `zombie-mermaid/ascii` subpath stays free
// of elkjs.
// ============================================================================

import type { Direction } from './types.ts'
import { isDirection } from './parser.ts'

/**
 * Return `diagram` with its top-level `direction` replaced by `override`,
 * or `diagram` itself (same reference) when there is nothing to apply.
 *
 * The parsed diagram is never mutated — a shallow clone carries the new
 * direction, so `parseMermaid()` output a caller holds on to stays exactly
 * what the parser produced, and a second render of the same parsed object
 * without the option sees the source direction again.
 *
 * `isDirection` re-checks the value at runtime because `Direction` is only
 * a compile-time guarantee: a plain-JavaScript caller can pass any string.
 * An unrecognized value is ignored (the diagram's own direction stands)
 * rather than thrown on — the same lenient treatment every other
 * `RenderOptions` value gets, e.g. an unknown `interactivity` or `curve`
 * string falls back to its default instead of failing the render.
 */
export function withDirectionOverride<T extends { direction?: Direction }>(
  diagram: T,
  override: Direction | undefined,
): T {
  if (override === undefined || !isDirection(override)) return diagram
  return { ...diagram, direction: override }
}
