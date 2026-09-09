// ============================================================================
// Direction token guard
//
// Lives in `core` rather than beside the flowchart parser that used to own
// it (`src/parser.ts`) because `direction-override.ts` — also `core`, and
// reached from the ASCII entry — needs it. Left in the parser, `core` would
// import `mermaid-parser`, i.e. the shared package would depend on one of
// its own consumers (zombie-mermaid#625, umbrella #620).
//
// `toDirection` joined `isDirection` here under #624 for the identical
// reason: it used to live in `src/parser.ts` too, with that file as its
// only caller, until splitting `er/parser.ts` out into
// `packages/mermaid-parser/` gave it a second caller that cannot import the
// umbrella's `src/parser.ts` without creating the same cycle `isDirection`
// was moved to avoid. `src/parser.ts` now imports it from here instead of
// defining it.
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

/**
 * Normalize a regex-captured direction token to a `Direction`.
 *
 * Accepts `string | undefined` because every call site passes a regex
 * capture group value (`match[1]`, typed as possibly-`undefined` under
 * `noUncheckedIndexedAccess`) straight through. Each call site's regex
 * guards the capture with the same `(TD|TB|LR|BT|RL)` alternation
 * (case-insensitively), so the group always participates in the match in
 * practice — but that's a regex-structure guarantee the type checker can't
 * see across the call site. Validating `undefined` here, instead of
 * asserting non-null at each call site, turns a hypothetical violation into
 * a clear, descriptive error rather than a raw `undefined` crash.
 */
export function toDirection(raw: string | undefined): Direction {
  const upper = raw?.toUpperCase()
  if (upper === undefined || !isDirection(upper)) {
    throw new Error(`Invalid direction: "${raw}"`)
  }
  return upper
}
