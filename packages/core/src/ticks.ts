// ============================================================================
// Linear-axis tick values, shared by the SVG and ASCII XY chart renderers.
//
// Port of d3-array's `ticks(min, max, 10)` (the call behind Mermaid's
// `scaleLinear().ticks()` for XY chart y-axes), so tick density and positions
// match Mermaid: a step of 1, 2 or 5 x 10^n chosen for ~10 intervals, with
// every multiple that falls inside [min, max] emitted (zombie-mermaid#1705).
// ============================================================================

const E10 = Math.sqrt(50)
const E5 = Math.sqrt(10)
const E2 = Math.sqrt(2)
const TICK_COUNT = 10

/** Tick values for a numeric range, matching d3's `ticks(min, max, 10)`. */
export function niceTickValues(min: number, max: number): number[] {
  if (!(max > min)) return [min]

  const step = (max - min) / TICK_COUNT
  const power = Math.floor(Math.log10(step))
  const error = step / Math.pow(10, power)
  const factor = error >= E10 ? 10 : error >= E5 ? 5 : error >= E2 ? 2 : 1

  // Below 1 the step is an inverse integer (1/inc), which keeps 0.1 + 0.2
  // style float noise out of the emitted values.
  let i1: number, i2: number, inc: number
  if (power < 0) {
    inc = Math.pow(10, -power) / factor
    i1 = Math.round(min * inc)
    i2 = Math.round(max * inc)
    if (i1 / inc < min) ++i1
    if (i2 / inc > max) --i2
    inc = -inc
  } else {
    inc = Math.pow(10, power) * factor
    i1 = Math.round(min / inc)
    i2 = Math.round(max / inc)
    if (i1 * inc < min) ++i1
    if (i2 * inc > max) --i2
  }
  if (i2 < i1) return []

  const ticks: number[] = []
  for (let i = i1; i <= i2; i++) ticks.push(inc > 0 ? i * inc : i / -inc)
  return ticks
}
