/**
 * DOM-level normalisation for comparing two HTML documents that should be
 * equivalent but were serialised differently — the hand-written template
 * a page generator used to emit versus the React `renderToStaticMarkup`
 * output that replaced it (see #423).
 *
 * Parses with jsdom and re-serialises the tree one node per line so a
 * plain string diff of two results is readable. What it deliberately
 * ignores, because none of it changes what a browser renders:
 *
 * - Attribute order (sorted by name) and quoting/escaping style
 *   (`&#x27;` vs `'`, `crossorigin` vs `crossorigin=""`) — compared as
 *   parsed DOM values, and `style` through the CSSOM (`style.cssText`), so
 *   `min-width: 11rem;` and `min-width:11rem` agree.
 * - Whitespace: runs collapse to one space, a block element's leading/
 *   trailing text whitespace is trimmed, and whitespace-only text nodes
 *   are dropped. Note the last point means whitespace *between* inline
 *   elements is ignored too, so this alone does not prove two inline runs
 *   are spaced the same — a visual check covers that. Text inside raw-text
 *   elements (`<style>`, `<script>`, `<pre>`, `<textarea>`) is kept
 *   verbatim apart from trimming its ends.
 * - Comments.
 * - The order of `<head>` children, when `unorderedHead` is set: React 19
 *   hoists `<title>`/`<meta>`/`<link>` into a fixed position within the
 *   head, and their relative order has no rendering meaning (the font
 *   stylesheet `<link>` and the page's `<style>` keep their relative order
 *   regardless, since neither is hoisted).
 */
import { JSDOM } from 'jsdom'

const BLOCK_ELEMENTS = new Set([
  'html',
  'head',
  'body',
  'div',
  'p',
  'section',
  'header',
  'footer',
  'nav',
  'main',
  'article',
  'aside',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'title',
  'style',
  'script',
  'pre',
  'figure',
  'figcaption',
  'blockquote',
])

const RAW_TEXT_ELEMENTS = new Set(['style', 'script', 'pre', 'textarea'])

const ELEMENT_NODE = 1
const TEXT_NODE = 3

export interface NormalizeHtmlOptions {
  /** Compare `<head>` children as an unordered set (see the module comment). */
  unorderedHead?: boolean
}

/** Parses `html` and returns its canonical one-node-per-line serialisation. */
export function normalizeHtml(
  html: string,
  options: NormalizeHtmlOptions = {},
): string {
  const { document } = new JSDOM(html).window
  const lines: string[] = []
  if (document.doctype) lines.push(`<!DOCTYPE ${document.doctype.name}>`)
  serializeElement(document.documentElement, 0, lines, options)
  return lines.join('\n')
}

function serializeElement(
  el: Element,
  depth: number,
  lines: string[],
  options: NormalizeHtmlOptions,
): void {
  const tag = el.tagName.toLowerCase()
  const indent = '  '.repeat(depth)
  const attrs = [...el.attributes]
    .map((attr): [string, string] => [
      attr.name,
      attr.name === 'style' &&
      el instanceof el.ownerDocument.defaultView!.HTMLElement
        ? el.style.cssText
        : attr.value,
    ])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, value]) => ` ${name}=${JSON.stringify(value)}`)
    .join('')
  lines.push(`${indent}<${tag}${attrs}>`)

  if (RAW_TEXT_ELEMENTS.has(tag)) {
    const text = el.textContent.trim()
    if (text !== '') lines.push(`${indent}  ${JSON.stringify(text)}`)
    lines.push(`${indent}</${tag}>`)
    return
  }

  const children = normalizedChildren(el, BLOCK_ELEMENTS.has(tag))
  if (tag === 'head' && options.unorderedHead) {
    const blocks = children.map((child) => {
      const childLines: string[] = []
      serializeChild(child, depth + 1, childLines, options)
      return childLines.join('\n')
    })
    blocks.sort()
    lines.push(...blocks)
  } else {
    for (const child of children) {
      serializeChild(child, depth + 1, lines, options)
    }
  }
  lines.push(`${indent}</${tag}>`)
}

type NormalizedChild =
  { kind: 'element'; el: Element } | { kind: 'text'; text: string }

function serializeChild(
  child: NormalizedChild,
  depth: number,
  lines: string[],
  options: NormalizeHtmlOptions,
): void {
  if (child.kind === 'element') {
    serializeElement(child.el, depth, lines, options)
  } else {
    lines.push(`${'  '.repeat(depth)}${JSON.stringify(child.text)}`)
  }
}

/**
 * Element and text children with whitespace normalised as described in the
 * module comment; comments and other node types are dropped.
 */
function normalizedChildren(el: Element, isBlock: boolean): NormalizedChild[] {
  const raw: NormalizedChild[] = []
  for (const node of el.childNodes) {
    if (
      node.nodeType === ELEMENT_NODE &&
      node instanceof el.ownerDocument.defaultView!.Element
    ) {
      raw.push({ kind: 'element', el: node })
    } else if (node.nodeType === TEXT_NODE) {
      raw.push({
        kind: 'text',
        text: (node.textContent ?? '').replace(/\s+/g, ' '),
      })
    }
  }

  if (isBlock) {
    const first = raw[0]
    if (first?.kind === 'text') first.text = first.text.trimStart()
    const last = raw[raw.length - 1]
    if (last?.kind === 'text') last.text = last.text.trimEnd()
  }

  return raw.filter(
    (child) => child.kind === 'element' || child.text.trim() !== '',
  )
}
