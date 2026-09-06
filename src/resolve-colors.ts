// ============================================================================
// `resolveColors` — substitute concrete sRGB values for the CSS `var(--…)`
// and `color-mix(…)` expressions the SVG renderer emits.
//
// Browsers evaluate both natively, which is what makes the emitted SVG a
// live function of its CSS custom properties (see src/theme.ts and
// docs/theming.md). Every other consumer — resvg, librsvg, Inkscape,
// ImageMagick, anything headless-Chrome-free — implements neither, and
// rasterizes the whole theme to black (GitHub issue #456). This pass runs
// over the finished SVG string and evaluates each expression the way a
// browser would, against the same `<style>` declarations the renderer just
// wrote, so the MIX percentages in src/theme.ts stay the single source of
// truth: nothing here re-states a number.
//
// Scope, deliberately narrow — this is not a CSS engine:
//   - Custom properties are read from the root `<svg style="--bg:…">` and
//     from `svg { --_line: … }` declarations in `<style>` blocks. The
//     renderer only ever declares them on the root, so one flat scope is
//     exact; no cascade/specificity is modelled.
//   - `color-mix()` is evaluated only `in srgb` (the only space the
//     renderer emits) and only over colors `parseCssColor` understands
//     (hex, `rgb()`/`rgba()`, `transparent`). Anything else is left as-is.
//   - `var(--x)` with no declaration and no fallback is left untouched —
//     e.g. `font: 'var(--font-family-body)'`, a host-page variable this
//     library cannot know the value of.
//   - Element text content (labels, `<title>`) and the `data-src` source
//     stamp are never touched: only attribute values and `<style>` blocks
//     are CSS, so only those are rewritten.
// ============================================================================

import type { DiagramColors } from './theme.ts'
import { formatCssColor, mixSrgb, parseCssColor } from './color-utils.ts'

// ============================================================================
// Expression evaluation
// ============================================================================

/**
 * Custom-property lookup with memoization and a cycle guard. Values are
 * stored raw (as declared) and evaluated on first use, so a declaration
 * can reference another declared later in the block.
 */
class VarScope {
  private readonly raw = new Map<string, string>()
  private readonly resolved = new Map<string, string | undefined>()
  private readonly inProgress = new Set<string>()

  declare(name: string, value: string): void {
    this.raw.set(name, value)
    this.resolved.delete(name)
  }

  /** Evaluated value of `name`, or undefined when unknown or cyclic. */
  lookup(name: string): string | undefined {
    if (this.resolved.has(name)) return this.resolved.get(name)
    const rawValue = this.raw.get(name)
    if (rawValue === undefined || this.inProgress.has(name)) return undefined
    this.inProgress.add(name)
    const value = evaluateExpression(rawValue, this).trim()
    this.inProgress.delete(name)
    // A value that still contains an unresolvable reference is treated as
    // unknown, so a `var()` pointing at it keeps its own fallback instead of
    // being replaced by something a rasterizer can't parse either.
    const usable = !/\bvar\(|\bcolor-mix\(/.test(value)
    this.resolved.set(name, usable ? value : undefined)
    return usable ? value : undefined
  }
}

/** Index of the `)` matching the `(` at `open`, or -1 if unbalanced. */
function matchingParen(text: string, open: number): number {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    const ch = text[i]
    if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/** Split on top-level commas only (commas nested in parens stay put). */
function splitTopLevel(text: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === ',' && depth === 0) {
      parts.push(text.slice(start, i))
      start = i + 1
    }
  }
  parts.push(text.slice(start))
  return parts
}

/**
 * Matches the next `var(` or `color-mix(` not glued to a preceding
 * identifier character. Instantiated per `evaluateExpression` call (it's
 * recursive, and a shared global regex's `lastIndex` would be clobbered by
 * the inner call).
 */
const FUNCTION_START_SOURCE = /(?<![\w-])(var|color-mix)\(/g.source

/**
 * Evaluate `var(name[, fallback])`. Returns the replacement text, or null
 * when the reference can't be resolved and should be left verbatim.
 */
function evaluateVar(args: string, scope: VarScope): string | null {
  const [nameRaw, ...fallbackParts] = splitTopLevel(args)
  const name = (nameRaw ?? '').trim()
  const value = scope.lookup(name)
  if (value !== undefined) return value
  if (fallbackParts.length > 0) return fallbackParts.join(',').trim()
  return null
}

/** Parse one `color-mix()` operand: `<color> [<percentage>]`, in either order. */
function parseMixOperand(
  operand: string,
): { color: string; pct: number | undefined } | null {
  const tokens = operand.trim().split(/\s+/)
  let color: string | undefined
  let pct: number | undefined
  for (const token of tokens) {
    if (/^[\d.]+%$/.test(token)) {
      if (pct !== undefined) return null
      pct = Number(token.slice(0, -1))
    } else {
      if (color !== undefined) return null
      color = token
    }
  }
  if (color === undefined) return null
  return { color, pct }
}

/**
 * Evaluate `color-mix(in srgb, c1 [p1%], c2 [p2%])`. Returns the
 * replacement text, or null when the expression isn't one this module
 * can evaluate (a non-srgb space, an operand that isn't a concrete color).
 */
function evaluateColorMix(args: string): string | null {
  const parts = splitTopLevel(args)
  if (parts.length !== 3) return null
  const [space, op1, op2] = parts
  if (
    space === undefined ||
    op1 === undefined ||
    op2 === undefined ||
    !/^\s*in\s+srgb\s*$/i.test(space)
  ) {
    return null
  }
  const a = parseMixOperand(op1)
  const b = parseMixOperand(op2)
  if (!a || !b) return null
  const c1 = parseCssColor(a.color)
  const c2 = parseCssColor(b.color)
  if (!c1 || !c2) return null
  const mixed = mixSrgb(c1, c2, a.pct, b.pct)
  return mixed ? formatCssColor(mixed) : null
}

/**
 * Replace every evaluable `var()` / `color-mix()` in `text`, innermost
 * first. Expressions that can't be evaluated are kept verbatim (with their
 * arguments still evaluated as far as possible), and scanning resumes after
 * them, so an unknown variable can never stall the pass.
 */
function evaluateExpression(text: string, scope: VarScope): string {
  let out = ''
  let cursor = 0
  const functionStart = new RegExp(FUNCTION_START_SOURCE, 'g')
  let match: RegExpExecArray | null
  while ((match = functionStart.exec(text)) !== null) {
    const fn = match[1]
    if (fn === undefined) continue
    const start = match.index
    const open = start + fn.length
    const close = matchingParen(text, open)
    if (close === -1) break
    const args = evaluateExpression(text.slice(open + 1, close), scope)
    const replacement =
      fn === 'var' ? evaluateVar(args, scope) : evaluateColorMix(args)
    out += text.slice(cursor, start)
    out += replacement ?? `${fn}(${args})`
    cursor = close + 1
    functionStart.lastIndex = cursor
  }
  return out + text.slice(cursor)
}

/**
 * Evaluate one CSS value against a flat set of custom-property
 * declarations — the expression engine behind `resolveCssColors`, exposed
 * so it can be unit-tested (and reused) without building an SVG around it.
 *
 * @example
 * evaluateCssColorValue('color-mix(in srgb, var(--fg) 50%, var(--bg))',
 *   { '--fg': '#000000', '--bg': '#ffffff' }) // → '#808080'
 */
export function evaluateCssColorValue(
  value: string,
  declarations: Record<string, string>,
): string {
  const scope = new VarScope()
  for (const [name, raw] of Object.entries(declarations)) {
    scope.declare(name, raw)
  }
  return evaluateExpression(value, scope)
}

// ============================================================================
// SVG document pass
// ============================================================================

/** `--name: value` custom-property declarations inside a CSS rule body or a `style` attribute. */
const CUSTOM_PROPERTY_RE = /(--[\w-]+)\s*:\s*([^;{}]+)/g

/** `name="value"` / `name='value'` attribute pairs inside a start tag. */
const ATTRIBUTE_RE = /(\s)([\w:.-]+)(=)("[^"]*"|'[^']*')/g

/**
 * Attributes whose values are never CSS: the `embedSource` stamp holds the
 * diagram's own text, which may legitimately contain `var(` in a label.
 */
const SKIP_ATTRIBUTES = new Set(['data-src'])

function collectDeclarations(css: string, scope: VarScope): void {
  CUSTOM_PROPERTY_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = CUSTOM_PROPERTY_RE.exec(css)) !== null) {
    const [, name, value] = match
    if (name !== undefined && value !== undefined) {
      scope.declare(name, value.trim())
    }
  }
}

/** Rewrite the attribute values of one start tag (the text between `<` and `>`). */
function resolveTagAttributes(tag: string, scope: VarScope): string {
  return tag.replace(
    ATTRIBUTE_RE,
    (whole, space: string, name: string, eq: string, quoted: string) => {
      if (SKIP_ATTRIBUTES.has(name)) return whole
      const quote = quoted[0] ?? '"'
      const value = quoted.slice(1, -1)
      return `${space}${name}${eq}${quote}${evaluateExpression(value, scope)}${quote}`
    },
  )
}

/**
 * Replace every `var(--…)` and `color-mix(…)` in an SVG produced by this
 * library's renderer with its computed sRGB value (`#rrggbb`, or
 * `rgba(r, g, b, a)` when translucent).
 *
 * `colors` seeds the variable scope with the caller's palette; the SVG's
 * own declarations (the root `style` attribute and any `<style>` block)
 * are then read on top, so the derived `--_*` variables resolve through
 * exactly the `color-mix()` rules `buildStyleBlock` emitted. See the
 * module comment for what is and isn't rewritten.
 */
export function resolveCssColors(svg: string, colors: DiagramColors): string {
  const scope = new VarScope()
  scope.declare('--bg', colors.bg)
  scope.declare('--fg', colors.fg)
  if (colors.line) scope.declare('--line', colors.line)
  if (colors.accent) scope.declare('--accent', colors.accent)
  if (colors.muted) scope.declare('--muted', colors.muted)
  if (colors.surface) scope.declare('--surface', colors.surface)
  if (colors.border) scope.declare('--border', colors.border)

  // Pass 1: gather every custom-property declaration in the document —
  // `<style>` rule bodies and `style="…"` attributes — before rewriting
  // anything, so a declaration can be referenced from earlier in the text.
  for (const block of svg.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    const css = block[1]
    if (css !== undefined) collectDeclarations(css, scope)
  }
  for (const attr of svg.matchAll(/\sstyle=("[^"]*"|'[^']*')/g)) {
    const quoted = attr[1]
    if (quoted !== undefined) {
      collectDeclarations(quoted.slice(1, -1), scope)
    }
  }

  // Pass 2: rewrite. Walk the markup, evaluating `<style>` contents and
  // start-tag attribute values; leave text nodes untouched.
  let out = ''
  let cursor = 0
  while (cursor < svg.length) {
    const lt = svg.indexOf('<', cursor)
    if (lt === -1) break
    out += svg.slice(cursor, lt)

    if (svg.startsWith('<style', lt)) {
      const openEnd = svg.indexOf('>', lt)
      const closeStart = svg.indexOf('</style>', lt)
      if (openEnd === -1 || closeStart === -1) break
      out += svg.slice(lt, openEnd + 1)
      out += evaluateExpression(svg.slice(openEnd + 1, closeStart), scope)
      out += '</style>'
      cursor = closeStart + '</style>'.length
      continue
    }

    // Find the end of this tag, skipping `>` characters inside quoted
    // attribute values (escapeXml encodes them, but be safe for any raw
    // attribute the renderer passes through).
    let gt = -1
    let quote: string | null = null
    for (let i = lt + 1; i < svg.length; i++) {
      const ch = svg[i]
      if (quote !== null) {
        if (ch === quote) quote = null
      } else if (ch === '"' || ch === "'") {
        quote = ch
      } else if (ch === '>') {
        gt = i
        break
      }
    }
    if (gt === -1) break
    const tag = svg.slice(lt, gt + 1)
    out +=
      tag.startsWith('<!') || tag.startsWith('<?') || tag.startsWith('</')
        ? tag
        : resolveTagAttributes(tag, scope)
    cursor = gt + 1
  }
  return out + svg.slice(cursor)
}
