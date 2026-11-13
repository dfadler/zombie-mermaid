// Mermaid 12.3.0 runs the packet `title` through DOMPurify (its common db's
// `setDiagramTitle`) and draws the resulting HTML string as text. DOMPurify
// returns a string without a `<` untouched; otherwise it is parsed and
// serialized, so `&` shows as `&amp;` and the tags it keeps show as literal
// markup. Mermaid's `#65;` / `#amp;` entity form is decoded afterwards. This is
// a small DOM-free stand-in for that round trip.
// shortcut: tag/attribute allowlists are the common DOMPurify set, only the
// common named entities decode, and the HTML parser's rules are limited to void
// tags, unclosed tags, `<p>` and `<tr>`.

const TAGS = new Set(
  (
    'a abbr address article aside b bdi bdo big blockquote br button caption center cite code col colgroup ' +
    'dd del details dfn div dl dt em fieldset figcaption figure font footer form h1 h2 h3 h4 h5 h6 header hr ' +
    'i img input ins kbd label legend li main mark nav ol option p pre q rp rt ruby s samp section select ' +
    'small span strike strong sub summary sup table tbody td textarea tfoot th thead tr tt u ul var wbr ' +
    'svg g path circle ellipse line polygon polyline rect text tspan defs math mi mn mo ms mtext mrow msup msub'
  ).split(' '),
)
const VOID = new Set(['br', 'hr', 'img', 'input', 'wbr', 'col'])
const FOREIGN = new Set(['svg', 'math'])
// Removed with their content.
const DROPPED = /^(?:script|style|iframe|noscript|template|object|embed)$/
const ATTRS = new Set(
  (
    'href src alt title class id style target rel color size face width height align name value type ' +
    'action method colspan rowspan lang dir role for placeholder checked disabled selected d cx cy r x y ' +
    'x1 x2 y1 y2 fill stroke points viewbox xmlns'
  ).split(' '),
)

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  copy: '\u00a9',
  reg: '\u00ae',
  hellip: '\u2026',
  mdash: '\u2014',
  ndash: '\u2013',
  trade: '\u2122',
}

/** The character for an entity name or `#N`, or undefined if unknown. */
function entity(name: string): string | undefined {
  if (/^#?\d+$/.test(name)) {
    const code = Number(name.replace('#', ''))
    return code <= 0x10ffff ? String.fromCodePoint(code) : '\ufffd'
  }
  return NAMED[name]
}

/** Parse the entities in text, then serialize it the way innerHTML does. */
const escapeText = (s: string) =>
  s
    .replace(/&(#\d+|[A-Za-z]+);/g, (m, n: string) => entity(n) ?? m)
    .replace(/&/g, '&amp;')
    .replace(/\u00a0/g, '&nbsp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

function attributes(raw: string): string {
  let out = ''
  for (const m of raw.matchAll(
    /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g,
  )) {
    const name = m[1]!.toLowerCase()
    const value = m[2] ?? m[3] ?? m[4] ?? ''
    if (!(ATTRS.has(name) || /^(?:data|aria)-/.test(name))) continue
    if (/^(?:href|src|action)$/.test(name) && /^\s*javascript:/i.test(value))
      continue
    out += ` ${name}="${value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`
  }
  return out
}

/** The text mermaid 12.3.0 draws for a packet `title` (see the file header). */
export function sanitizeTitle(title: string): string {
  const html = title.includes('<') ? purify(title) : title
  return html.replace(/#(\w+);/g, (_, n: string) => entity(n) ?? `&${n};`)
}

function purify(src: string): string {
  const open: string[] = []
  let out = ''
  let foreign = false
  let i = 0
  const close = (to: number) => {
    while (open.length > to) out += `</${open.pop()}>`
    foreign = open.some((t) => FOREIGN.has(t))
  }
  while (i < src.length) {
    const lt = src.indexOf('<', i)
    if (lt < 0 || !/[A-Za-z/!]/.test(src[lt + 1] ?? '')) {
      // Text up to the next possible tag; a lone `<` is text.
      const end = lt < 0 ? src.length : lt + 1
      out += escapeText(src.slice(i, end))
      i = end
      continue
    }
    out += escapeText(src.slice(i, lt))
    if (src.startsWith('<!--', lt)) {
      const end = src.indexOf('-->', lt + 4)
      i = end < 0 ? src.length : end + 3
      continue
    }
    const m = /^<(\/?)([A-Za-z][^\s/>]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/.exec(
      src.slice(lt),
    )
    if (!m) {
      // An unterminated tag swallows the rest of the title.
      i = src.length
      continue
    }
    i = lt + m[0].length
    const name = m[2]!.toLowerCase()
    if (m[1]) {
      const at = open.lastIndexOf(name)
      if (at >= 0) close(at)
      continue
    }
    if (DROPPED.test(name)) {
      const end = src.toLowerCase().indexOf(`</${name}`, i)
      const gt = end < 0 ? -1 : src.indexOf('>', end)
      i = gt < 0 ? src.length : gt + 1
      continue
    }
    if (!TAGS.has(name)) continue
    if (name === 'p' && open.at(-1) === 'p') close(open.length - 1)
    if (name === 'tr' && open.at(-1) === 'table') {
      out += '<tbody>'
      open.push('tbody')
    }
    out += `<${name}${attributes(m[3]!)}>`
    if (VOID.has(name)) continue
    if (foreign && m[3]!.endsWith('/')) out += `</${name}>`
    else open.push(name)
    foreign = open.some((t) => FOREIGN.has(t))
  }
  close(0)
  return out
}
