// ============================================================================
// Direction token guard
//
// Lives in `core` rather than beside the flowchart parser that used to own
// it (`src/parser.ts`) because `direction-override.ts` — also `core`, and
// reached from the ASCII entry — needs it. Left in the parser, `core` would
// import `mermaid-parser`, i.e. the shared package would depend on one of
// its own consumers (zombie-mermaid#625, umbrella #620).
//
// `Direction` is only a compile-time guarantee, so every entry point that
// accepts a direction from outside (`RenderOptions.direction`, the CLI's
// `--direction` flag, a parsed `graph LR` header) re-checks it at runtime
// through this guard.
// ============================================================================

import type { Direction } from './types.ts'

/** True when `value` is one of the five directions Mermaid recognizes. */
export function isDirection(value: string): value is Direction {
  return (
    value === 'TD' ||
    value === 'TB' ||
    value === 'LR' ||
    value === 'BT' ||
    value === 'RL'
  )
}
