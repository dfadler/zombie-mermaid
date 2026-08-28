/**
 * Tests for the SVG accessible-name feature (GitHub issue #215).
 *
 * Without a `role`/`aria-labelledby`/`<title>` on the root `<svg>`, assistive
 * tech either treats an inlined diagram as a plain group — announcing every
 * node/edge label individually and out of reading order — or skips it
 * entirely. This is the well-documented WAI-ARIA `img` role technique for
 * naming inline SVG (see MDN "SVG accessibility" and the WAI-ARIA `img` role
 * spec: `role="img"` + `aria-labelledby` pointing at a `<title>` child is the
 * standard way to give an inline SVG a computed accessible name).
 *
 * Covers:
 *  - `svgOpenTag()` unit behavior (theme.ts) for all three states: no name,
 *    named, decorative.
 *  - `renderMermaidSVG()` wiring the `title`/`decorative` RenderOptions
 *    through to every diagram type's SVG-root entry point (they all funnel
 *    through the single shared `svgOpenTag()`).
 *  - id uniqueness across multiple renders (mirrors how multiple diagrams
 *    inlined into one HTML page must not collide on ids).
 *  - interplay with the per-node/per-point `<title>` tooltips added for
 *    click interactions and xychart hover tips: those are unid'd children
 *    nested in `<g>` elements, so a root `<title id="zm-title-N">` can never
 *    collide with them, and nesting multiple `<title>` elements at different
 *    levels of an SVG document is valid per the SVG spec.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { svgOpenTag, __resetSvgTitleIdCounterForTests } from '../theme.ts'
import type { DiagramColors } from '../theme.ts'
import { renderMermaidSVG } from '../index.ts'

const colors: DiagramColors = { bg: '#FFFFFF', fg: '#27272A' }

beforeEach(() => {
  __resetSvgTitleIdCounterForTests()
})

// ============================================================================
// svgOpenTag — unit behavior
// ============================================================================

describe('svgOpenTag – accessible name', () => {
  it('adds role="img" with no name when neither title nor decorative is given', () => {
    const tag = svgOpenTag(400, 300, colors)
    expect(tag).toContain('role="img"')
    expect(tag).not.toContain('aria-labelledby')
    expect(tag).not.toContain('<title')
    expect(tag).not.toContain('aria-hidden')
  })

  it('adds role="img" + aria-labelledby + a <title> child when title is given', () => {
    const tag = svgOpenTag(
      400,
      300,
      colors,
      false,
      'Flowchart: Build → Test → Ship',
    )
    expect(tag).toContain('role="img"')
    expect(tag).toMatch(/aria-labelledby="zm-title-\d+"/)
    expect(tag).toMatch(
      /<title id="zm-title-\d+">Flowchart: Build → Test → Ship<\/title>/,
    )

    // The aria-labelledby value and the <title> id must match.
    const labelledbyId = tag.match(/aria-labelledby="([^"]+)"/)?.[1]
    const titleId = tag.match(/<title id="([^"]+)"/)?.[1]
    expect(labelledbyId).toBe(titleId)
  })

  it('escapes XML-sensitive characters in the title text', () => {
    const tag = svgOpenTag(400, 300, colors, false, 'A <script> & "quotes"')
    expect(tag).not.toContain('<script>')
    expect(tag).toContain('&lt;script&gt;')
    expect(tag).toContain('&amp;')
  })

  it('generates unique, incrementing ids across multiple calls', () => {
    const first = svgOpenTag(400, 300, colors, false, 'Diagram one')
    const second = svgOpenTag(400, 300, colors, false, 'Diagram two')

    const firstId = first.match(/zm-title-(\d+)/)?.[1]
    const secondId = second.match(/zm-title-(\d+)/)?.[1]
    expect(firstId).toBeDefined()
    expect(secondId).toBeDefined()
    expect(firstId).not.toBe(secondId)
  })

  it('never reuses an id even when two diagrams share the same title text', () => {
    const first = svgOpenTag(400, 300, colors, false, 'Same title')
    const second = svgOpenTag(400, 300, colors, false, 'Same title')
    const firstId = first.match(/id="([^"]+)"/)?.[1]
    const secondId = second.match(/id="([^"]+)"/)?.[1]
    expect(firstId).not.toBe(secondId)
  })

  it('emits aria-hidden="true" and omits role/aria-labelledby/title when decorative', () => {
    const tag = svgOpenTag(400, 300, colors, false, undefined, true)
    expect(tag).toContain('aria-hidden="true"')
    expect(tag).not.toContain('role=')
    expect(tag).not.toContain('aria-labelledby')
    expect(tag).not.toContain('<title')
  })

  it('ignores a supplied title when decorative is true', () => {
    const tag = svgOpenTag(400, 300, colors, false, 'Ignored title', true)
    expect(tag).toContain('aria-hidden="true"')
    expect(tag).not.toContain('Ignored title')
    expect(tag).not.toContain('role=')
    expect(tag).not.toContain('aria-labelledby')
  })
})

// ============================================================================
// svgOpenTag – hasInteractiveLinks overrides role/aria-hidden (issue #239)
//
// role="img" tells assistive tech to stop descending into children, and
// aria-hidden="true" on an ancestor of a focusable element is an explicit
// WAI-ARIA violation. A `click A "url"` link renders as a real, focusable
// <a href> inside the SVG, so neither is safe to apply when one exists.
// ============================================================================

describe('svgOpenTag – hasInteractiveLinks (issue #239)', () => {
  it('omits role="img" even with no title or decorative flag', () => {
    const tag = svgOpenTag(400, 300, colors, false, undefined, undefined, true)
    expect(tag).not.toContain('role=')
    expect(tag).not.toContain('aria-hidden')
  })

  it('overrides decorative — no aria-hidden when links are present', () => {
    const tag = svgOpenTag(400, 300, colors, false, undefined, true, true)
    expect(tag).not.toContain('aria-hidden')
    expect(tag).not.toContain('role=')
  })

  it('still applies title/aria-labelledby when links are present', () => {
    const tag = svgOpenTag(
      400,
      300,
      colors,
      false,
      'Flow with a link',
      false,
      true,
    )
    expect(tag).not.toContain('role="img"')
    expect(tag).toMatch(/aria-labelledby="zm-title-\d+"/)
    expect(tag).toContain('<title id="zm-title-')
    expect(tag).toContain('Flow with a link')
  })

  it('applies title even when decorative was also requested, since decorative is overridden', () => {
    const tag = svgOpenTag(
      400,
      300,
      colors,
      false,
      'Flow with a link',
      true,
      true,
    )
    expect(tag).not.toContain('aria-hidden')
    expect(tag).not.toContain('role="img"')
    expect(tag).toContain('Flow with a link')
  })

  it('behaves exactly as before when hasInteractiveLinks is false', () => {
    const withoutFlag = svgOpenTag(400, 300, colors, false, 'A title')
    __resetSvgTitleIdCounterForTests()
    const withFalseFlag = svgOpenTag(
      400,
      300,
      colors,
      false,
      'A title',
      false,
      false,
    )
    expect(withFalseFlag).toBe(withoutFlag)
  })
})

// ============================================================================
// renderMermaidSVG – wiring across every diagram type
// ============================================================================

describe('renderMermaidSVG – accessible name across diagram types', () => {
  it('flowchart: applies title', () => {
    const svg = renderMermaidSVG('graph TD\n  A --> B', {
      title: 'Flow: A to B',
    })
    expect(svg).toContain('role="img"')
    expect(svg).toMatch(/aria-labelledby="zm-title-\d+"/)
    expect(svg).toContain('Flow: A to B')
  })

  it('flowchart: decorative omits name and adds aria-hidden', () => {
    const svg = renderMermaidSVG('graph TD\n  A --> B', { decorative: true })
    expect(svg).toContain('aria-hidden="true"')
    expect(svg).not.toContain('aria-labelledby')
  })

  it('flowchart: default (no options) has role="img" but no claimed name', () => {
    const svg = renderMermaidSVG('graph TD\n  A --> B')
    expect(svg).toContain('role="img"')
    expect(svg).not.toContain('aria-labelledby')
    expect(svg).not.toContain('aria-hidden')
  })

  it('sequence diagram: applies title', () => {
    const svg = renderMermaidSVG(
      `sequenceDiagram
      Alice->>Bob: Hello`,
      { title: 'Sequence: Alice greets Bob' },
    )
    expect(svg).toContain('role="img"')
    expect(svg).toMatch(/aria-labelledby="zm-title-\d+"/)
    expect(svg).toContain('Sequence: Alice greets Bob')
  })

  it('sequence diagram: decorative', () => {
    const svg = renderMermaidSVG(
      `sequenceDiagram
      Alice->>Bob: Hello`,
      { decorative: true },
    )
    expect(svg).toContain('aria-hidden="true"')
    expect(svg).not.toContain('aria-labelledby')
  })

  it('class diagram: applies title', () => {
    const svg = renderMermaidSVG(
      `classDiagram
      class Animal {
        +String name
      }`,
      { title: 'Class: Animal' },
    )
    expect(svg).toContain('role="img"')
    expect(svg).toMatch(/aria-labelledby="zm-title-\d+"/)
    expect(svg).toContain('Class: Animal')
  })

  it('class diagram: decorative', () => {
    const svg = renderMermaidSVG(
      `classDiagram
      class Animal {
        +String name
      }`,
      { decorative: true },
    )
    expect(svg).toContain('aria-hidden="true"')
    expect(svg).not.toContain('aria-labelledby')
  })

  it('er diagram: applies title', () => {
    const svg = renderMermaidSVG(
      `erDiagram
      CUSTOMER ||--o{ ORDER : places`,
      { title: 'ER: Customer places Order' },
    )
    expect(svg).toContain('role="img"')
    expect(svg).toMatch(/aria-labelledby="zm-title-\d+"/)
    expect(svg).toContain('ER: Customer places Order')
  })

  it('er diagram: decorative', () => {
    const svg = renderMermaidSVG(
      `erDiagram
      CUSTOMER ||--o{ ORDER : places`,
      { decorative: true },
    )
    expect(svg).toContain('aria-hidden="true"')
    expect(svg).not.toContain('aria-labelledby')
  })

  it('xychart: applies title (RenderOptions.title, distinct from the chart-internal `title` statement)', () => {
    const svg = renderMermaidSVG(
      `xychart-beta
      title "Sales Revenue"
      x-axis [jan, feb]
      y-axis "Revenue" 0 --> 120
      bar [50, 60]`,
      { title: 'XY chart: Sales revenue by month' },
    )
    expect(svg).toContain('role="img"')
    expect(svg).toMatch(/aria-labelledby="zm-title-\d+"/)
    expect(svg).toContain('XY chart: Sales revenue by month')
    // The chart's own in-plot title text is unrelated and still renders.
    expect(svg).toContain('Sales Revenue')
  })

  it('xychart: decorative', () => {
    const svg = renderMermaidSVG(
      `xychart-beta
      x-axis [jan, feb]
      y-axis "Revenue" 0 --> 120
      bar [50, 60]`,
      { decorative: true },
    )
    expect(svg).toContain('aria-hidden="true"')
    expect(svg).not.toContain('aria-labelledby')
  })
})

// ============================================================================
// id uniqueness across multiple diagrams inlined into one page
// ============================================================================

describe('renderMermaidSVG – id uniqueness across multiple renders', () => {
  it('gives each rendered diagram a distinct title id, even with identical titles', () => {
    const first = renderMermaidSVG('graph TD\n  A --> B', {
      title: 'Same name',
    })
    const second = renderMermaidSVG('graph TD\n  C --> D', {
      title: 'Same name',
    })
    const firstId = first.match(/zm-title-(\d+)/)?.[1]
    const secondId = second.match(/zm-title-(\d+)/)?.[1]
    expect(firstId).toBeDefined()
    expect(secondId).toBeDefined()
    expect(firstId).not.toBe(secondId)

    // Concatenating both (as a page inlining two diagrams would) must not
    // produce a duplicate id anywhere in the combined markup.
    const combined = first + second
    const ids = [...combined.matchAll(/id="(zm-title-\d+)"/g)].map((m) => m[1])
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// ============================================================================
// Interplay with per-node/per-point <title> tooltips
// ============================================================================

describe('renderMermaidSVG – accessible name alongside click/tooltip <title> elements', () => {
  it('root title and a node click-tooltip <title> coexist without id collision', () => {
    const svg = renderMermaidSVG(
      'flowchart TD\n  A --> B\n  click A "https://example.com" "Node tooltip"',
      { title: 'Flowchart with a tooltip node' },
    )

    // Root accessible name is present, but role="img" is not: this diagram
    // has a real click-based <a href>, and role="img" would hide it from
    // assistive tech while leaving it Tab-reachable (see #239).
    expect(svg).not.toContain('role="img"')
    expect(svg).toMatch(/aria-labelledby="zm-title-\d+"/)
    expect(svg).toContain('Flowchart with a tooltip node')

    // The node's tooltip <title> (from click interactions) has no id — it's
    // a plain per-element tooltip, not an accessible-name reference — so it
    // can never collide with the root title's generated id.
    expect(svg).toContain('<title>Node tooltip</title>')

    // Exactly one <title> in the whole document carries the generated
    // zm-title-N id — the root's — and it's unique.
    const idsWithZmTitle = [...svg.matchAll(/<title id="(zm-title-\d+)">/g)]
    expect(idsWithZmTitle.length).toBe(1)

    // Every id in the document is unique.
    const allIds = [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])
    expect(new Set(allIds).size).toBe(allIds.length)
  })

  it('#239 repro: decorative + a click link no longer emits aria-hidden on a focusable ancestor', () => {
    const svg = renderMermaidSVG(
      'flowchart TD\n  click A "https://example.com"\n  A --> B',
      { decorative: true },
    )

    // Before the fix: aria-hidden="true" on the root, with a focusable
    // <a href> nested inside — an explicit WAI-ARIA violation (aria-hidden
    // must not contain a focusable descendant) and a silent accessibility
    // regression (the link vanishes from the a11y tree but stays Tab-reachable).
    expect(svg).not.toContain('aria-hidden')
    expect(svg).not.toContain('role="img"')
    expect(svg).toContain('<a href="https://example.com">')
  })
})
