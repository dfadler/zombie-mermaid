// ============================================================================
// CSS color primitives — parse, mix, and format sRGB colors.
//
// Shared by the SVG theme system (src/theme.ts), the ASCII renderer's
// DiagramColors → AsciiTheme bridge (src/ascii/ansi.ts), and the
// `resolveColors` post-processor (src/resolve-colors.ts). All three need
// the same answer to "what does `color-mix(in srgb, fg 50%, bg)` come out
// to?", so the arithmetic lives here exactly once — the MIX percentages in
// src/theme.ts stay the single source of truth for *which* percentages the
// renderer uses, and this module is the single source of truth for what a
// percentage *means*.
// ============================================================================

/** An sRGB color: 0-255 channels plus a 0-1 alpha. */
export interface RgbaColor {
  r: number
  g: number
  b: number
  a: number
}

/** Matches #rgb, #rgba, #rrggbb, #rrggbbaa hex color literals. */
const HEX_COLOR_RE =
  /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

/**
 * Matches `rgb()` / `rgba()` in both the legacy comma syntax
 * (`rgb(1, 2, 3)`, `rgba(1, 2, 3, 0.5)`) and the modern space syntax
 * (`rgb(1 2 3 / 50%)`). Channels may be integers or percentages; alpha may
 * be a 0-1 number or a percentage.
 */
const RGB_FUNC_RE =
  /^rgba?\(\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i

/**
 * Parse a hex color string into 0-255 RGB components, ignoring any alpha
 * digits. Returns null for anything that isn't a well-formed hex literal
 * (e.g. `var(--foo)`, named CSS colors, or attribute-injection payloads) —
 * the caller should treat those as unresolvable and fall back.
 */
export function parseHexColor(value: string): [number, number, number] | null {
  const rgba = parseHexRgba(value)
  return rgba ? [rgba.r, rgba.g, rgba.b] : null
}

/** Parse a hex color literal (3/4/6/8 digits) into an RgbaColor, or null. */
export function parseHexRgba(value: string): RgbaColor | null {
  const match = HEX_COLOR_RE.exec(value.trim())
  if (!match) return null
  // HEX_COLOR_RE has exactly one, non-optional capture group, so it's always
  // populated when `match` is non-null — but that's a fact about the regex's
  // construction, not something the type checker can see. Guard explicitly
  // (falling back to "unresolvable", same as a non-match) rather than
  // asserting past it, so a future edit to the pattern can't silently turn
  // this into a runtime `undefined`.
  const captured = match[1]
  if (captured === undefined) return null
  let hex = captured
  if (hex.length === 3 || hex.length === 4) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('')
  }
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
    a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
  }
}

/** Parse one rgb()/rgba() channel token: an integer/decimal or a percentage of 255. */
function parseRgbChannel(token: string): number {
  return token.endsWith('%')
    ? (Number(token.slice(0, -1)) / 100) * 255
    : Number(token)
}

/** Parse an alpha token: a 0-1 number or a percentage. */
function parseAlpha(token: string | undefined): number {
  if (token === undefined) return 1
  return token.endsWith('%') ? Number(token.slice(0, -1)) / 100 : Number(token)
}

/**
 * Parse a concrete CSS color value into sRGB components.
 *
 * Accepts the forms this library's own theme system produces or documents:
 * hex literals (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`), `rgb()`/`rgba()`,
 * and the `transparent` keyword. Anything else — CSS named colors, `hsl()`,
 * `var(...)`, an unresolved `color-mix(...)` — returns null so the caller
 * can leave it untouched rather than guess.
 */
export function parseCssColor(value: string): RgbaColor | null {
  const trimmed = value.trim()
  if (trimmed.toLowerCase() === 'transparent') {
    return { r: 0, g: 0, b: 0, a: 0 }
  }
  const hex = parseHexRgba(trimmed)
  if (hex) return hex
  const rgb = RGB_FUNC_RE.exec(trimmed)
  if (rgb) {
    const [, rTok, gTok, bTok, aTok] = rgb
    if (rTok === undefined || gTok === undefined || bTok === undefined) {
      return null
    }
    const color = {
      r: parseRgbChannel(rTok),
      g: parseRgbChannel(gTok),
      b: parseRgbChannel(bTok),
      a: parseAlpha(aTok),
    }
    if ([color.r, color.g, color.b, color.a].some((n) => Number.isNaN(n))) {
      return null
    }
    return color
  }
  return null
}

/**
 * Evaluate `color-mix(in srgb, c1 p1%, c2 p2%)` per CSS Color Module
 * Level 5 (https://www.w3.org/TR/css-color-5/#color-mix): percentages are
 * normalized so they sum to 100 (a sum under 100 additionally scales the
 * result's alpha by `sum / 100`), and the two colors are interpolated in
 * premultiplied-alpha space, so mixing an opaque color toward
 * `transparent` fades its alpha without darkening it.
 *
 * `p1`/`p2` follow the spec's omission rules: pass `undefined` for an
 * omitted percentage (both omitted → 50/50; one omitted → 100 minus the
 * other). Returns null when both percentages are zero, which the spec
 * defines as invalid.
 */
export function mixSrgb(
  c1: RgbaColor,
  c2: RgbaColor,
  p1?: number,
  p2?: number,
): RgbaColor | null {
  let w1: number
  let w2: number
  if (p1 === undefined && p2 === undefined) {
    w1 = 50
    w2 = 50
  } else if (p1 === undefined) {
    w2 = p2 ?? 50
    w1 = 100 - w2
  } else if (p2 === undefined) {
    w1 = p1
    w2 = 100 - w1
  } else {
    w1 = p1
    w2 = p2
  }
  const sum = w1 + w2
  if (sum === 0) return null
  const alphaMultiplier = sum < 100 ? sum / 100 : 1
  w1 /= sum
  w2 /= sum

  const alpha = c1.a * w1 + c2.a * w2
  const premul = (ch1: number, ch2: number): number =>
    alpha === 0 ? 0 : (ch1 * c1.a * w1 + ch2 * c2.a * w2) / alpha

  return {
    r: premul(c1.r, c2.r),
    g: premul(c1.g, c2.g),
    b: premul(c1.b, c2.b),
    a: alpha * alphaMultiplier,
  }
}

/**
 * Mix `fg` into `bg` at `pct` percent — the shape every MIX entry in
 * src/theme.ts uses (`color-mix(in srgb, var(--fg) N%, var(--bg))`).
 * Returns `fg` unchanged when either input isn't a concrete color this
 * module can parse (a `var(...)` reference, a named color).
 */
export function mixHexColors(fg: string, bg: string, pct: number): string {
  const f = parseCssColor(fg)
  const b = parseCssColor(bg)
  if (!f || !b) return fg
  const mixed = mixSrgb(f, b, pct, 100 - pct)
  return mixed ? formatCssColor(mixed) : fg
}

const clampByte = (n: number): number =>
  Math.min(255, Math.max(0, Math.round(n)))

/**
 * Serialize a color as `#rrggbb` when fully opaque, otherwise as
 * `rgba(r, g, b, a)` — the two forms every SVG consumer (browsers, resvg,
 * librsvg, Inkscape) agrees on.
 */
export function formatCssColor(c: RgbaColor): string {
  const r = clampByte(c.r)
  const g = clampByte(c.g)
  const b = clampByte(c.b)
  const a = Math.min(1, Math.max(0, c.a))
  if (a >= 1) {
    return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')
  }
  return `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(3))})`
}
