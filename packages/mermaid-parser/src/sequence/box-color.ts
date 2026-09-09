// ============================================================================
// `box <color?> <label?>` header parsing
//
// Mermaid's sequenceDb.parseBoxData takes the first word of the header (or a
// leading `rgb(...)`/`hsl(...)` call), asks the browser whether it is a valid
// CSS colour, and — if it isn't — treats the whole header as the label. There
// is no browser here, so "is a colour" is decided by a fixed list of CSS
// named colours plus the hex / rgb() / hsl() function forms. That list is
// also what keeps a diagram-supplied string safe to emit inside an SVG
// attribute: anything not matching it never reaches the renderer as a colour.
// ============================================================================

/** The CSS Color Module Level 4 named colours (plus `transparent`, handled separately). */
const CSS_NAMED_COLORS = new Set(
  (
    'aliceblue antiquewhite aqua aquamarine azure beige bisque black ' +
    'blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse ' +
    'chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan ' +
    'darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta ' +
    'darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen ' +
    'darkslateblue darkslategray darkslategrey darkturquoise darkviolet ' +
    'deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite ' +
    'forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green ' +
    'greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender ' +
    'lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan ' +
    'lightgoldenrodyellow lightgray lightgreen lightgrey lightpink ' +
    'lightsalmon lightseagreen lightskyblue lightslategray lightslategrey ' +
    'lightsteelblue lightyellow lime limegreen linen magenta maroon ' +
    'mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen ' +
    'mediumslateblue mediumspringgreen mediumturquoise mediumvioletred ' +
    'midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive ' +
    'olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise ' +
    'palevioletred papayawhip peachpuff peru pink plum powderblue purple ' +
    'rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown ' +
    'seagreen seashell sienna silver skyblue slateblue slategray slategrey ' +
    'snow springgreen steelblue tan teal thistle tomato turquoise violet ' +
    'wheat white whitesmoke yellow yellowgreen'
  ).split(' '),
)

// `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`. Mermaid itself can't accept hex
// here (upstream's lexer treats `#` as a comment); this parser has no such
// comment syntax, so hex is accepted as a strict superset.
const HEX_COLOR_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
// `rgb(33,66,99)`, `rgba(33,66,99,0.5)`, `hsl(10, 40%, 90%)`, `hsla(...)`,
// including the modern space-separated / slash-alpha forms. The argument
// character class is the safety boundary: digits, `.`, `%`, `,`, `/`, and
// whitespace only.
const FUNCTION_COLOR_RE =
  /^(?:rgba?|hsla?)\(\s*[\d.%]+(?:[\s,/]+[\d.%]+){2,3}\s*\)$/i

/** Whether `value` is a colour this renderer will emit as-is (case-insensitive). */
export function isCssColor(value: string): boolean {
  return (
    CSS_NAMED_COLORS.has(value.toLowerCase()) ||
    HEX_COLOR_RE.test(value) ||
    FUNCTION_COLOR_RE.test(value)
  )
}

/**
 * Split the text after the `box` keyword into a colour and a label, per
 * Mermaid's `parseBoxData`: the leading word (or function call) is the
 * colour if it is one, otherwise the whole header is the label. An explicit
 * `transparent` is consumed as "no colour" so `box transparent Aqua` yields
 * a colourless box labelled `Aqua`, exactly as upstream documents.
 */
export function parseBoxHeader(header: string): {
  color?: string
  label: string
} {
  const trimmed = header.trim()
  const match = trimmed.match(
    /^((?:rgba?|hsla?)\s*\([^)]*\)|#[0-9a-fA-F]+|\S+)?(.*)$/,
  )
  const candidate = match?.[1] ?? ''
  const rest = match?.[2]?.trim() ?? ''
  if (candidate.toLowerCase() === 'transparent') {
    return { label: rest }
  }
  if (candidate !== '' && isCssColor(candidate)) {
    return { color: candidate, label: rest }
  }
  return { label: trimmed }
}
