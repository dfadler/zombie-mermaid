import type { C4Boundary, C4Element, C4Relationship } from './types.ts'

// ============================================================================
// C4 text and layout-hint helpers shared by the SVG and ASCII renderers, so
// both draw the same words and honor the same `Rel_U/D/L/R` hints.
// ============================================================================

/** Greedy word wrap; a word longer than `width` stays on its own line. */
export function wrapC4Text(text: string, width: number): string[] {
  const out: string[] = []
  for (const paragraph of text.split('\n')) {
    let cur = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (cur && cur.length + 1 + word.length > width) {
        out.push(cur)
        cur = word
      } else {
        cur = cur ? `${cur} ${word}` : word
      }
    }
    out.push(cur)
  }
  return out
}

/**
 * The bracketed type line under an element's name, e.g. `[Person]`,
 * `[External System]`, `[Container Database: PostgreSQL]`.
 */
export function c4TypeLine(el: C4Element): string {
  const ext = el.external ? 'External ' : ''
  const suffix =
    el.shape === 'db' ? ' Database' : el.shape === 'queue' ? ' Queue' : ''
  const kind = el.kind.charAt(0).toUpperCase() + el.kind.slice(1)
  const tech =
    (el.kind === 'container' || el.kind === 'component') && el.technology
      ? `: ${el.technology}`
      : ''
  const noun = el.kind === 'person' ? kind : `${kind}${suffix}`
  return `[${ext}${noun}${tech}]`
}

/** A boundary's type line (`[Enterprise]`, `[Ubuntu]`), when it has a type. */
export function c4BoundaryTypeLine(b: C4Boundary): string | undefined {
  return b.type ? `[${b.type}]` : undefined
}

/**
 * The text lines of a relationship label: the label itself (prefixed with the
 * `RelIndex` sequence number, if any), then the technology in brackets on its
 * own line. Empty when the relationship has neither.
 */
export function c4RelLabelLines(rel: C4Relationship): string[] {
  const lines: string[] = []
  const head = [rel.index ? `${rel.index}:` : '', rel.label]
    .filter(Boolean)
    .join(' ')
  if (head) lines.push(head)
  if (rel.technology) lines.push(`[${rel.technology}]`)
  return lines
}

/**
 * How a relationship constrains placement. `source` is meant to sit before
 * `target` along `axis`: above it for `'vertical'`, left of it for
 * `'horizontal'`. `Rel_U`/`Rel_L` reverse the pair (the target sits above /
 * left of the source); plain `Rel` is a vertical hint, since C4 diagrams flow
 * top to bottom by default.
 */
export interface C4Placement {
  source: string
  target: string
  axis: 'vertical' | 'horizontal'
  /** True when the hint came from an explicit `Rel_U/D/L/R`. */
  explicit: boolean
}

export function c4Placement(rel: C4Relationship): C4Placement {
  switch (rel.layout) {
    case 'up':
      return {
        source: rel.to,
        target: rel.from,
        axis: 'vertical',
        explicit: true,
      }
    case 'left':
      return {
        source: rel.to,
        target: rel.from,
        axis: 'horizontal',
        explicit: true,
      }
    case 'right':
      return {
        source: rel.from,
        target: rel.to,
        axis: 'horizontal',
        explicit: true,
      }
    case 'down':
      return {
        source: rel.from,
        target: rel.to,
        axis: 'vertical',
        explicit: true,
      }
    default:
      return {
        source: rel.from,
        target: rel.to,
        axis: 'vertical',
        explicit: false,
      }
  }
}
