// ============================================================================
// CSS colour validation for user-authored `style` / `classDef` / `linkStyle`
// values (issue #1918).
//
// The SVG renderer writes a node's `fill` / `stroke` / `color` into presentation
// attributes. A browser treats an unparseable value there as unset: `fill`
// falls back to black and `stroke` to none. Mermaid emits the same values as
// inline CSS, which the browser drops declaration by declaration, so the
// theme paint shows through. `dropInvalidColors` gives us the same outcome.
//
// The check is deliberately permissive. Wrongly dropping a legitimate colour
// is worse than the bug it fixes, so anything that can only be resolved in
// the browser (`var()`, `calc()`, `color-mix()`, relative colour syntax,
// `url()` paints) passes as long as its parentheses balance.
// ============================================================================

const NAMED_COLORS = new Set(
  (
    'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue ' +
    'blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue ' +
    'cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey ' +
    'darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon ' +
    'darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet ' +
    'deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen ' +
    'fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew ' +
    'hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon ' +
    'lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey ' +
    'lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey ' +
    'lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine ' +
    'mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen ' +
    'mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite ' +
    'navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen ' +
    'paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple ' +
    'rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell ' +
    'sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan ' +
    'teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen ' +
    // CSS Color 4 system colours (https://www.w3.org/TR/css-color-4/#css-system-colors)
    'accentcolor accentcolortext activetext buttonborder buttonface buttontext canvas ' +
    'canvastext field fieldtext graytext highlight highlighttext linktext mark marktext ' +
    'selecteditem selecteditemtext visitedtext ' +
    // Keywords valid for any colour or SVG paint property
    'transparent currentcolor none inherit initial unset revert revert-layer ' +
    'context-fill context-stroke'
  ).split(' '),
)

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const COLOR_FUNC_RE =
  /^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(([^()]*)\)$/i
const NUMBER_TOKEN_RE =
  /^(?:[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?(?:%|deg|grad|rad|turn)?|none)$/i
const COLOR_SPACE_RE =
  /^(?:srgb|srgb-linear|display-p3|a98-rgb|prophoto-rgb|rec2020|xyz|xyz-d50|xyz-d65|--[\w-]+)$/i
const COLOR_FUNC_PREFIX_RE = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i
const DEFERRED_ARG_RE = /\b(?:var|env|calc)\(/i
/** Functions whose arguments only the browser can resolve. */
const DEFERRED_FUNC_RE = /^(?:var|color-mix|light-dark)\(/i
const URL_PAINT_RE = /^url\(\s*[^()]*\)\s*(.*)$/i

/**
 * True when no `)` is unmatched. CSS closes parentheses left open at the end
 * of a value, so a missing final `)` is still a valid colour.
 */
function balancedCall(value: string): boolean {
  let depth = 0
  for (const ch of value) {
    if (ch === '(') depth++
    else if (ch === ')' && --depth < 0) return false
  }
  return true
}

/**
 * Whether `value` is something a browser accepts for a `fill`, `stroke` or
 * `color` property: a hex literal, a named / system colour, a colour
 * function with the right number of numeric arguments, a CSS-wide or SVG
 * paint keyword, a `url()` paint (optionally with a fallback), or a deferred
 * function (`var()`, `calc()`, `color-mix()`, ...).
 */
export function isValidCssColor(value: string): boolean {
  let v = value.trim()
  // Close any parentheses left open, as CSS does at the end of a value.
  v += ')'.repeat(Math.max(0, v.split('(').length - v.split(')').length))
  if (HEX_RE.test(v) || NAMED_COLORS.has(v.toLowerCase())) return true
  if (DEFERRED_FUNC_RE.test(v)) return balancedCall(v)
  const url = URL_PAINT_RE.exec(v)
  if (url) return url[1] === '' || isValidCssColor(url[1]!)
  // `rgb(var(--r) 0 0)`: a colour function with a deferred argument.
  if (COLOR_FUNC_PREFIX_RE.test(v) && DEFERRED_ARG_RE.test(v)) {
    return balancedCall(v)
  }
  const fn = COLOR_FUNC_RE.exec(v)
  if (!fn) return false
  const name = fn[1]!.toLowerCase()
  const body = fn[2]!.trim()
  // Relative colour syntax (`rgb(from red r g b)`) resolves in the browser.
  if (/^from\s/i.test(body)) return true
  const tokens = body.split(/[\s,/]+/).filter(Boolean)
  if (name === 'color') {
    return (
      tokens.length >= 4 &&
      tokens.length <= 5 &&
      COLOR_SPACE_RE.test(tokens[0]!) &&
      tokens.slice(1).every((t) => NUMBER_TOKEN_RE.test(t))
    )
  }
  return (
    tokens.length >= 3 &&
    tokens.length <= 4 &&
    tokens.every((t) => NUMBER_TOKEN_RE.test(t))
  )
}

/** Style properties whose value must be a colour or SVG paint. */
const COLOR_PROPS = ['fill', 'stroke', 'color'] as const

/**
 * Copy of a resolved inline style with every invalid `fill` / `stroke` /
 * `color` declaration removed, like a browser dropping an invalid CSS
 * declaration. Other properties, and the valid declarations in the same
 * rule, are kept.
 */
export function dropInvalidColors(
  style: Record<string, string>,
): Record<string, string> {
  const out = { ...style }
  for (const prop of COLOR_PROPS) {
    if (prop in out && !isValidCssColor(out[prop]!)) delete out[prop]
  }
  return out
}
