// ============================================================================
// SVG numeric formatting — round interpolated coordinates/dimensions to 2dp.
//
// Ported from lukilabs/beautiful-mermaid#77 ("Round all floats to 2 decimal
// places in SVG output", credit: GauBen). ELK layout and the curve/bezier
// math in packages/svg-renderer/src/edge-curves.ts produce full
// floating-point precision (e.g. `142.38427299999998`), which upstream's PR
// pointed out bloats generated SVG for no visual benefit — nothing renders a
// sub-hundredth-of-a-pixel difference. `f` is a tagged template literal used
// in place of a plain template literal (`` f`<rect x="${x}" />` `` instead of
// `` `<rect x="${x}" />` ``) everywhere flowchart/ER/class/sequence markup is
// built, so every interpolated number gets rounded right where it is
// stringified, with no change to non-numeric interpolations (ids, colors,
// already-formatted strings).
//
// packages/svg-renderer/src/xychart/{renderer,layout}.ts already has its own
// rounding (`r()`, 1dp) for unrelated axis-label-formatting reasons — this
// helper is deliberately not applied there.
// ============================================================================

/**
 * Round a number to at most 2 decimal places for SVG output.
 *
 * Non-finite input (`NaN`/`Infinity`, reachable from degenerate zero-size
 * geometry — e.g. a normalized zero-length vector) is normalized to `0`
 * rather than stringified literally. This is a deliberate improvement over
 * upstream: `"NaN"`/`"Infinity"` are not valid SVG numeric attribute values,
 * so passing them through would hand the browser malformed markup instead of
 * just an odd-looking number. Every other case matches upstream exactly,
 * including collapsing `-0` to `0`.
 */
function roundCoord(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Number(n.toFixed(2))
}

/**
 * Tagged template literal: stringifies interpolated values, rounding any
 * `number` to at most 2 decimal places first. Non-number values (strings,
 * booleans, etc.) pass through `String()` unchanged, same as an untagged
 * template literal would.
 *
 * @example
 * f`<rect x="${3.14159}" y="${-0.001}" />` // '<rect x="3.14" y="0" />'
 */
export function f(strings: TemplateStringsArray, ...values: unknown[]): string {
  let out = strings[0] ?? ''
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    out += typeof v === 'number' ? String(roundCoord(v)) : String(v)
    out += strings[i + 1] ?? ''
  }
  return out
}
