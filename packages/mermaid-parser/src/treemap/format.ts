/** The result of d3's `format(",")`: 12 significant digits, no trailing zeros, thousands separators. */
export function formatTreemapValue(v: number): string {
  let s = v.toPrecision(12)
  const e = s.indexOf('e')
  const mant = e < 0 ? s : s.slice(0, e)
  const trimmed = mant.includes('.') ? mant.replace(/\.?0+$/, '') : mant
  if (e >= 0) return trimmed + s.slice(e)
  s = trimmed
  const [int = '', frac] = s.split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return frac === undefined ? grouped : `${grouped}.${frac}`
}
