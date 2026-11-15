// ============================================================================
// Treemap value formatting
//
// Mermaid formats treemap values with d3-format's `format(spec)`, wrapping a
// leading `$` itself (treemap/renderer.ts, mermaid@12.3.0). This is a port of
// d3-format 3.1.2 (ISC, Mike Bostock) in the en-US locale, plus Mermaid's `$`
// handling and its fall-back to `,` for a specifier d3 rejects.
// ============================================================================

const SPEC =
  /^(?:(.)?([<>=^]))?([+\-( ])?([$#])?(0)?(\d+)?(,)?(\.\d+)?(~)?([a-z%])?$/i
const PREFIXES = 'yzafpnµm kMGTPEZY'

/** `[digits, exponent]` of `x` in exponential form, or null for Infinity/NaN. */
function decimalParts(x: number, p?: number): [string, number] | null {
  const s = p ? x.toExponential(p - 1) : x.toExponential()
  const i = s.indexOf('e')
  if (i < 0) return null
  const coefficient = s.slice(0, i)
  return [
    coefficient.length > 1
      ? coefficient[0]! + coefficient.slice(2)
      : coefficient,
    +s.slice(i + 1),
  ]
}

const rounded = (x: number, p: number): string => {
  const d = decimalParts(x, p)
  if (!d) return `${x}`
  const [c, e] = d
  if (e < 0) return `0.${'0'.repeat(-e - 1)}${c}`
  return c.length > e + 1
    ? `${c.slice(0, e + 1)}.${c.slice(e + 1)}`
    : c + '0'.repeat(e - c.length + 1)
}

/** `s`: SI-prefix notation; returns the digits and the prefix exponent. */
function siPrefix(x: number, p: number): [string, number] {
  const d = decimalParts(x, p)
  if (!d) return [x.toPrecision(p), 0]
  const [c, e] = d
  const exp = Math.max(-8, Math.min(8, Math.floor(e / 3))) * 3
  const i = e - exp + 1
  const n = c.length
  if (i === n) return [c, exp]
  if (i > n) return [c + '0'.repeat(i - n), exp]
  if (i > 0) return [`${c.slice(0, i)}.${c.slice(i)}`, exp]
  return [
    `0.${'0'.repeat(-i)}${decimalParts(x, Math.max(0, p + i - 1))![0]}`,
    exp,
  ]
}

const group = (v: string, width: number): string => {
  const out: string[] = []
  let i = v.length
  let g = 3
  let len = 0
  while (i > 0 && g > 0) {
    if (len + g + 1 > width) g = Math.max(1, width - len)
    out.push(v.substring((i -= g), i + g))
    if ((len += g + 1) > width) break
    g = 3
  }
  return out.reverse().join(',')
}

/** The `~` trim of d3-format: drop insignificant zeros (and a bare `.`) of the mantissa. */
const trim = (s: string): string => {
  const e = s.indexOf('e')
  const mant = e < 0 ? s : s.slice(0, e)
  return (
    (mant.includes('.') ? mant.replace(/\.?0+$/, '') : mant) +
    (e < 0 ? '' : s.slice(e))
  )
}

const decimal = (v: number): string => {
  const x = Math.round(v)
  return Math.abs(x) >= 1e21
    ? x.toLocaleString('en').replace(/,/g, '')
    : x.toString(10)
}

const TYPES: Record<string, (x: number, p: number) => string> = {
  '%': (x, p) => (x * 100).toFixed(p),
  b: (x) => Math.round(x).toString(2),
  c: (x) => `${x}`,
  d: decimal,
  e: (x, p) => x.toExponential(p),
  f: (x, p) => x.toFixed(p),
  g: (x, p) => x.toPrecision(p),
  o: (x) => Math.round(x).toString(8),
  p: (x, p) => rounded(x * 100, p),
  r: rounded,
  s: (x, p) => siPrefix(x, p)[0],
  X: (x) => Math.round(x).toString(16).toUpperCase(),
  x: (x) => Math.round(x).toString(16),
}

/** The d3-format `format(spec)`; throws on a specifier d3 rejects. */
function d3Format(spec: string): (value: number) => string {
  const m = SPEC.exec(spec)
  if (!m) throw new Error(`invalid format: ${spec}`)
  let fill = m[1] ?? ' '
  let align = m[2] ?? '>'
  const sign = m[3] ?? '-'
  const symbol = m[4] ?? ''
  let zero = !!m[5]
  const width = m[6] === undefined ? undefined : +m[6]
  let comma = !!m[7]
  let precision = m[8] === undefined ? undefined : +m[8].slice(1)
  let doTrim = !!m[9]
  let type = m[10] ?? ''
  if (type === 'n') {
    comma = true
    type = 'g'
  } else if (!TYPES[type]) {
    precision ??= 12
    doTrim = true
    type = 'g'
  }
  if (zero || (fill === '0' && align === '=')) {
    zero = true
    fill = '0'
    align = '='
  }
  const prefix =
    symbol === '$'
      ? '$'
      : symbol === '#' && /[boxX]/.test(type)
        ? `0${type.toLowerCase()}`
        : ''
  const suffix = /[%p]/.test(type) ? '%' : ''
  const maybeSuffix = /[defgprs%]/.test(type)
  precision =
    precision === undefined
      ? 6
      : /[gprs]/.test(type)
        ? Math.max(1, Math.min(21, precision))
        : Math.max(0, Math.min(20, precision))
  return (input) => {
    let valuePrefix = prefix
    let valueSuffix = suffix
    let value: string
    if (type === 'c') {
      valueSuffix = TYPES.c!(input, 0) + valueSuffix
      value = ''
    } else {
      const v = +input
      let negative = v < 0 || 1 / v < 0
      const abs = Math.abs(v)
      value = Number.isNaN(v) ? 'NaN' : TYPES[type]!(abs, precision)
      if (type === 's' && !Number.isNaN(v)) {
        const exp = siPrefix(abs, precision)[1]
        valueSuffix = PREFIXES[8 + exp / 3]!.trim() + valueSuffix
      }
      if (doTrim) value = trim(value)
      if (negative && +value === 0 && sign !== '+') negative = false
      valuePrefix =
        (negative
          ? sign === '('
            ? sign
            : '−'
          : sign === '-' || sign === '('
            ? ''
            : sign) + valuePrefix
      valueSuffix += negative && sign === '(' ? ')' : ''
      if (maybeSuffix) {
        for (let i = 0; i < value.length; i++) {
          const c = value.charCodeAt(i)
          if (c < 48 || c > 57) {
            valueSuffix =
              (c === 46 ? `.${value.slice(i + 1)}` : value.slice(i)) +
              valueSuffix
            value = value.slice(0, i)
            break
          }
        }
      }
    }
    if (comma && !zero) value = group(value, Infinity)
    const length = valuePrefix.length + value.length + valueSuffix.length
    let padding =
      width !== undefined && length < width ? fill.repeat(width - length) : ''
    if (comma && zero) {
      value = group(
        padding + value,
        padding ? width! - valueSuffix.length : Infinity,
      )
      padding = ''
    }
    switch (align) {
      case '<':
        return valuePrefix + value + valueSuffix + padding
      case '=':
        return valuePrefix + padding + value + valueSuffix
      case '^': {
        const half = padding.length >> 1
        return (
          padding.slice(0, half) +
          valuePrefix +
          value +
          valueSuffix +
          padding.slice(half)
        )
      }
      default:
        return padding + valuePrefix + value + valueSuffix
    }
  }
}

/**
 * Mermaid's `valueFormat` handling: `$0,0` and other `$`-led specifiers prefix
 * a `$` to the rest; an invalid specifier (or an empty one) formats as `,`.
 */
export function treemapValueFormatter(spec?: string): (v: number) => string {
  try {
    const s = spec || ','
    if (s === '$0,0') {
      const f = d3Format(',')
      return (v) => `$${f(v)}`
    }
    if (s.startsWith('$') && s.includes(',')) {
      const f = d3Format(`,${/\.\d+/.exec(s)?.[0] ?? ''}`)
      return (v) => `$${f(v)}`
    }
    if (s.startsWith('$')) {
      const f = d3Format(s.substring(1) || '')
      return (v) => `$${f(v)}`
    }
    return d3Format(s)
  } catch {
    return d3Format(',')
  }
}

const DEFAULT = treemapValueFormatter()

/** The result of d3's `format(",")`: 12 significant digits, no trailing zeros, thousands separators. */
export function formatTreemapValue(v: number): string {
  return DEFAULT(v)
}
