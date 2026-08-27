// ============================================================================
// zombie-mermaid — expanded node syntax  A@{ shape: ..., label: ... }
//
// Mermaid v11.3.0 added a metadata form for node definitions:
//
//   A@{ shape: rounded, label: "Start here" }
//   B@{ shape: doc }
//   C@{ icon: "fa:bell", form: "circle", label: "Alert" }
//   D@{ img: "https://example.com/a.png", label: "Diagram", w: 120, h: 80 }
//
// It exposes ~30 semantic shape names (many with several aliases) that the
// classic bracket syntax cannot express. This module owns both halves of
// supporting it: parsing the metadata block, and resolving a semantic name to
// the geometry this renderer draws.
// ============================================================================

import type { NodeShape } from './types.ts'

/**
 * Every documented Mermaid shape name (and alias) mapped to the geometry this
 * renderer draws for it.
 *
 * Mermaid's list is deliberately semantic — `database`, `manual-input`,
 * `paper-tape` — while a renderer only has so many distinct outlines. Names
 * that share an outline map to the same `NodeShape`; that is a rendering
 * choice, not a parse failure, and it is documented in docs/diagrams.md so
 * the collapse is discoverable rather than surprising.
 *
 * Keys are lowercase; lookup lowercases its input.
 */
const SHAPE_ALIASES: Record<string, NodeShape> = {
  // --- Rectangle family ---
  rect: 'rectangle',
  rectangle: 'rectangle',
  proc: 'rectangle',
  process: 'rectangle',
  'normal-rect': 'rectangle',

  // --- Rounded ---
  rounded: 'rounded',
  event: 'rounded',
  'rounded-rect': 'rounded',

  // --- Stadium / terminal ---
  stadium: 'stadium',
  pill: 'stadium',
  terminal: 'stadium',

  // --- Subroutine / framed rectangle ---
  subproc: 'subroutine',
  subprocess: 'subroutine',
  subroutine: 'subroutine',
  'framed-rectangle': 'subroutine',
  'fr-rect': 'subroutine',

  // --- Cylinder / database ---
  cyl: 'cylinder',
  cylinder: 'cylinder',
  db: 'cylinder',
  database: 'cylinder',
  'h-cyl': 'cylinder',
  das: 'cylinder',
  'horizontal-cylinder': 'cylinder',
  'lin-cyl': 'cylinder',
  'lined-cylinder': 'cylinder',
  disk: 'cylinder',

  // --- Circle ---
  circ: 'circle',
  circle: 'circle',
  start: 'circle',

  // --- Double circle ---
  'dbl-circ': 'doublecircle',
  'double-circle': 'doublecircle',
  stop: 'doublecircle',

  // --- Filled / crossed circles ---
  'f-circ': 'filled-circle',
  'filled-circle': 'filled-circle',
  junction: 'filled-circle',
  'cross-circ': 'crossed-circle',
  'crossed-circle': 'crossed-circle',
  summary: 'crossed-circle',

  // --- Diamond / decision ---
  diam: 'diamond',
  diamond: 'diamond',
  decision: 'diamond',
  question: 'diamond',

  // --- Hexagon / prepare ---
  hex: 'hexagon',
  hexagon: 'hexagon',
  prepare: 'hexagon',

  // --- Asymmetric / odd ---
  odd: 'asymmetric',
  'rect-left-inv-arrow': 'asymmetric',

  // --- Parallelograms ---
  'lean-r': 'parallelogram',
  'lean-right': 'parallelogram',
  'in-out': 'parallelogram',
  'lean-l': 'parallelogram-alt',
  'lean-left': 'parallelogram-alt',
  'out-in': 'parallelogram-alt',

  // --- Trapezoids ---
  'trap-b': 'trapezoid',
  'trapezoid-bottom': 'trapezoid',
  priority: 'trapezoid',
  'trap-t': 'trapezoid-alt',
  'trapezoid-top': 'trapezoid-alt',
  manual: 'trapezoid-alt',
  'curv-trap': 'trapezoid-alt',
  'curved-trapezoid': 'trapezoid-alt',
  display: 'trapezoid-alt',

  // --- Document family ---
  doc: 'document',
  document: 'document',
  'lin-doc': 'document',
  'lined-document': 'document',
  'tag-doc': 'document',
  'tagged-document': 'document',
  docs: 'stacked-document',
  documents: 'stacked-document',
  'st-doc': 'stacked-document',
  'stacked-document': 'stacked-document',

  // --- Card / notched rectangle ---
  'notch-rect': 'card',
  card: 'card',
  'notched-rectangle': 'card',

  // --- Lined / divided / tagged rectangles ---
  'lin-rect': 'lined-process',
  'lined-rectangle': 'lined-process',
  'lin-proc': 'lined-process',
  'shaded-process': 'lined-process',
  'div-rect': 'divided-process',
  'divided-rectangle': 'divided-process',
  'div-proc': 'divided-process',
  'tag-rect': 'rectangle',
  'tagged-rectangle': 'rectangle',
  'tag-proc': 'rectangle',
  procs: 'stacked-process',
  processes: 'stacked-process',
  'st-rect': 'stacked-process',
  'stacked-rectangle': 'stacked-process',

  // --- Triangles ---
  tri: 'triangle',
  triangle: 'triangle',
  extract: 'triangle',
  'flip-tri': 'flipped-triangle',
  'flipped-triangle': 'flipped-triangle',
  'manual-file': 'flipped-triangle',

  // --- Window pane / internal storage ---
  'win-pane': 'window-pane',
  'window-pane': 'window-pane',
  'internal-storage': 'window-pane',

  // --- Fork / join ---
  fork: 'fork-join',
  join: 'fork-join',
  'long-rect': 'fork-join',

  // --- Notched pentagon / loop limit ---
  'notch-pent': 'notched-pentagon',
  'loop-limit': 'notched-pentagon',
  'notched-pentagon': 'notched-pentagon',

  // --- Sloped rectangle / manual input ---
  'sl-rect': 'sloped-rectangle',
  'sloped-rectangle': 'sloped-rectangle',
  'manual-input': 'sloped-rectangle',

  // --- Flag / paper tape ---
  flag: 'flag',
  'paper-tape': 'flag',

  // --- Bow-tie rectangle / stored data ---
  'bow-rect': 'bow-tie-rectangle',
  'bow-tie-rectangle': 'bow-tie-rectangle',
  'stored-data': 'bow-tie-rectangle',

  // --- Delay / half-rounded rectangle ---
  delay: 'half-rounded-rectangle',
  'half-rounded-rectangle': 'half-rounded-rectangle',

  // --- Braces / comment ---
  brace: 'brace',
  'brace-l': 'brace',
  comment: 'brace',
  'brace-r': 'brace-right',
  braces: 'braces',

  // --- Lightning bolt / communication link ---
  bolt: 'bolt',
  'com-link': 'bolt',
  'lightning-bolt': 'bolt',

  // --- Bare text, no outline ---
  text: 'text',

  // --- Anchor / hidden ---
  anchor: 'anchor',
}

/**
 * Resolve a Mermaid shape name to the geometry this renderer draws.
 * Returns `undefined` for an unrecognized name so the caller can decide
 * whether to fall back or report it.
 */
export function resolveShapeName(name: string): NodeShape | undefined {
  return SHAPE_ALIASES[name.trim().toLowerCase()]
}

/** Every shape name this renderer accepts, for documentation and tests. */
export function knownShapeNames(): string[] {
  return Object.keys(SHAPE_ALIASES).sort()
}

/** The metadata a `@{ ... }` block can carry. */
export interface ExpandedNodeMeta {
  shape?: string
  label?: string
  icon?: string
  img?: string
  /** Outline drawn around an icon or image: `square`, `circle`, `rounded`. */
  form?: string
  /** Explicit width/height for an image node. */
  w?: string
  h?: string
  /** Image fit mode Mermaid accepts alongside `img`. */
  constraint?: string
  /** Any other key seen, preserved rather than dropped. */
  [key: string]: string | undefined
}

/**
 * Parse the body of a `@{ ... }` block into key/value pairs.
 *
 * The body is a comma-separated list of `key: value`. Values may be quoted
 * with `"` or `'`, and a quoted value may contain commas, colons, and braces
 * — which is why this is a scanner rather than a `split(',')`.
 *
 * Mermaid also accepts a bare value with no key as shorthand for the shape
 * (`A@{ rounded }`); that is handled by the caller, which sees an entry with
 * an empty key.
 */
export function parseExpandedMeta(body: string): ExpandedNodeMeta {
  const meta: ExpandedNodeMeta = {}

  for (const entry of splitTopLevel(body, ',')) {
    const trimmed = entry.trim()
    if (trimmed.length === 0) continue

    const colon = indexOfTopLevel(trimmed, ':')
    if (colon === -1) {
      // Bare value — Mermaid's shorthand for `shape: <value>`.
      meta.shape ??= stripQuotes(trimmed)
      continue
    }

    const key = trimmed.slice(0, colon).trim().toLowerCase()
    const value = stripQuotes(trimmed.slice(colon + 1).trim())
    if (key.length > 0) meta[key] = value
  }

  return meta
}

/** Split on `separator`, ignoring separators inside quotes. */
function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = []
  let current = ''
  let quote: string | null = null

  for (const ch of text) {
    if (quote !== null) {
      current += ch
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      current += ch
      continue
    }
    if (ch === separator) {
      parts.push(current)
      current = ''
      continue
    }
    current += ch
  }

  parts.push(current)
  return parts
}

/** Index of the first `needle` outside quotes, or -1. */
function indexOfTopLevel(text: string, needle: string): number {
  let quote: string | null = null
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (quote !== null) {
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }
    if (ch === needle) return i
  }
  return -1
}

/** Remove one layer of matching wrapping quotes. */
function stripQuotes(value: string): string {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1)
  }
  return value
}

/**
 * Find the `@{ ... }` block at the start of `text`, returning its body and
 * total length.
 *
 * Brace matching is depth-aware and quote-aware, so a label containing `}`
 * (`A@{ label: "a } b" }`) does not terminate the block early. Returns
 * `undefined` if `text` does not open with `@{` or the block is unterminated.
 */
export function matchExpandedBlock(
  text: string,
): { body: string; length: number } | undefined {
  if (!text.startsWith('@{')) return undefined

  let depth = 0
  let quote: string | null = null

  for (let i = 1; i < text.length; i++) {
    const ch = text[i]!

    if (quote !== null) {
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }
    if (ch === '{') {
      depth++
      continue
    }
    if (ch === '}') {
      depth--
      if (depth === 0) {
        return { body: text.slice(2, i), length: i + 1 }
      }
    }
  }

  return undefined
}
