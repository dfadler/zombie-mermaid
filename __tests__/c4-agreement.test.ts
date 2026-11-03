import { describe, expect, it } from 'vitest'
import { renderMermaidSVG } from '../src/index.ts'
import {
  c4Agreement,
  c4Breaches,
  parseOfficialC4,
  parseOurC4,
  strip,
  summarizeC4,
  worstC4,
  type C4Layout,
} from '../scripts/lib/c4-agreement.ts'
import {
  scorecardMarkdown,
  summarize,
  type SampleResult,
} from '../scripts/lib/layout-agreement.ts'

// Trimmed from mermaid 12.2.0's render of SRC below.
const OFFICIAL = `<svg id="c4_0" viewBox="0 -70 400 300"><defs><marker id="c4_0-arrowhead"></marker></defs>
<g transform="translate(100, 50)"><g class="node c4-shape c4-person" id="c4_0-a"><g class="label"><g class="c4-name" transform="translate(20, -1)"><text>A</text></g></g></g></g>
<g transform="translate(300, 60)"><g class="node c4-shape c4-system" id="c4_0-b"><g class="label" transform="translate(-40, -20)"><g class="c4-name" transform="translate(40, -1)"><text>B</text></g></g></g></g>
<g><rect x="200" y="0" fill="none" stroke="#444444" width="190" height="120" stroke-dasharray="7.0,7.0"></rect><text x="295" y="8" style="font-size: 16px;"><tspan>Box &amp; co</tspan></text></g>
<g><line x1="110" y1="60" x2="250" y2="70" stroke="#444" marker-end="url(#c4_0-arrowhead)"></line><text style="font-size: 12px;"><tspan>Uses</tspan></text><text style="font-size: 12px;"><tspan>[HTTPS]</tspan></text>
<path d="M250,90 Q180,90 110,90" marker-start="url(#c4_0-arrowend)"></path><text style="font-size: 12px;"><tspan>Back</tspan></text><text style="font-size: 16px;">A title</text></g></svg>`

const SRC = `C4Context
  Person(a, "A")
  Boundary(x, "Box & co") {
    System(b, "B")
  }
  Rel(a, b, "Uses", "HTTPS")
  Rel_Back(a, b, "Back")`

describe('c4 agreement (#2451)', () => {
  it('reads boxes, boundaries and relationships from official mermaid', () => {
    const l = parseOfficialC4(OFFICIAL)
    expect(l.boxes).toEqual({ a: { x: 100, y: 49 }, b: { x: 300, y: 39 } })
    expect(l.boundaries).toEqual([
      { label: 'Box & co', x: 200, y: 0, w: 190, h: 120 },
    ])
    expect(l.rels).toEqual([
      { text: 'Uses | [HTTPS]', x1: 110, y1: 60, x2: 250, y2: 70 },
      { text: 'Back', x1: 250, y1: 90, x2: 110, y2: 90 },
    ])
  })

  it('reads the same things from our SVG', () => {
    const l = parseOurC4(renderMermaidSVG(SRC))
    expect(Object.keys(l.boxes).sort()).toEqual(['a', 'b'])
    expect(l.boxes.a!.x).toBeLessThan(l.boxes.b!.x)
    expect(l.boundaries.map((b) => b.label)).toEqual(['Box & co'])
    expect(l.rels.map((r) => r.text)).toEqual(['Uses | [HTTPS]', 'Back'])
  })

  it('agrees with our own render of the same source', () => {
    const ours = parseOurC4(renderMermaidSVG(SRC))
    expect(c4Agreement(ours, ours)).toMatchObject({
      horizontal: 1,
      vertical: 1,
      containment: 1,
      relationships: 1,
      direction: 1,
      boxes: 2,
      rels: 2,
    })
  })

  it('strips nested or partial tags from text without reassembling them', () => {
    expect(strip('<scr<script>ipt>x</scr</script>ipt>')).not.toContain('<')
    expect(strip('a<tspan>b</tspan> &lt;&amp;&gt; &quot;c&quot;')).toBe(
      'ab <&> "c"',
    )
  })

  const o = parseOfficialC4(OFFICIAL)

  it('is 100% against itself and null with nothing to compare', () => {
    expect(c4Agreement(o, o)).toMatchObject({
      horizontal: 1,
      vertical: 1,
      containment: 1,
      relationships: 1,
      direction: 1,
    })
    const empty: C4Layout = { boxes: {}, boundaries: [], rels: [] }
    const a = c4Agreement(empty, empty)
    expect(a).toMatchObject({
      horizontal: null,
      vertical: null,
      containment: null,
      relationships: null,
      direction: null,
    })
    expect(worstC4(a)).toBeNull()
  })

  it('catches a moved box, a lost boundary, changed text and a flipped relationship', () => {
    const bad: C4Layout = {
      boxes: { a: { x: 300, y: 300 }, b: { x: 100, y: 49 } },
      boundaries: [],
      rels: [
        { text: 'Uses', x1: 250, y1: 70, x2: 110, y2: 60 },
        { text: 'Back', x1: 250, y1: 90, x2: 110, y2: 90 },
      ],
    }
    expect(c4Agreement(o, bad)).toEqual({
      horizontal: 0,
      vertical: 0,
      containment: 0.5,
      relationships: 0.5,
      direction: 0.5,
      boxes: 2,
      rels: 2,
    })
  })

  it('treats boxes within the tolerance as one row, and a missing box as disagreement', () => {
    const near: C4Layout = {
      ...o,
      boxes: { a: { x: 100, y: 49 }, b: { x: 300, y: 59 } },
    }
    expect(c4Agreement(o, near).vertical).toBe(1)
    expect(c4Agreement(o, { ...o, boxes: { a: o.boxes.a! } })).toMatchObject({
      horizontal: 0,
      vertical: 0,
      containment: 0.5,
    })
    expect(c4Agreement(o, { ...o, rels: [] }).relationships).toBe(0)
  })

  it('gates samples on their floor and on errors', () => {
    const ok = c4Agreement(o, o)
    const bad = c4Agreement(o, { boxes: {}, boundaries: [], rels: [] })
    expect(c4Breaches({ ok })).toEqual([])
    expect(c4Breaches({ ok, bad }, ['boom'])).toEqual([
      'boom (error)',
      'bad (0% < 100%)',
    ])
  })

  it('skips what cannot be read instead of failing', () => {
    const odd = parseOfficialC4(
      `<svg><g><rect stroke-dasharray="1"></rect></g>` +
        `<g transform="translate(1, 2)"><g class="node c4-shape" id="-nolabel"></g></g>` +
        `<g><path d="M1,1" marker-end="x"></path><text style="font-size: 12px;">early</text>` +
        `<line x1="0" y1="0" x2="1" y2="1" marker-end="x"></line><text style="font-size: 12px;">a</text>` +
        `<text style="font-size: 12px;">b</text></g></svg>`,
    )
    expect(odd.boxes).toEqual({})
    expect(odd.boundaries).toHaveLength(1)
    expect(odd.boundaries[0]).toMatchObject({ label: '', w: NaN })
    expect(odd.rels).toEqual([{ text: 'a | b', x1: 0, y1: 0, x2: 1, y2: 1 }])
    expect(
      parseOfficialC4('<svg><text style="font-size: 12px;">x</text></svg>')
        .rels,
    ).toEqual([])

    const ours = parseOurC4(
      `<svg><g class="c4-element"><text x="1" y="2">n</text></g>` +
        `<g class="c4-element" data-id="t"></g>` +
        `<g class="c4-boundary"></g>` +
        `<path class="c4-relationship" d="M 1,1"/>` +
        `<path class="c4-relationship" d="M 1,1 L 2,2"/></svg>`,
    )
    expect(ours.boxes).toEqual({})
    expect(ours.boundaries).toEqual([
      { label: '', x: NaN, y: NaN, w: NaN, h: NaN },
    ])
    expect(ours.rels).toEqual([{ text: '', x1: 1, y1: 1, x2: 2, y2: 2 }])
    expect(
      summarizeC4({}, { date: 'd', commit: 'c', mermaid: 'm' }),
    ).toMatchObject({ samples: 0, horizontal: null })
  })

  it('shows the C4 section in the scorecard only with entries', () => {
    const entry = summarizeC4(
      { a: c4Agreement(o, o) },
      { date: '2026-10-30', commit: 'abcdef0123', mermaid: '12.2.0' },
    )
    expect(entry).toMatchObject({ kind: 'c4', samples: 1, horizontal: 1 })
    const results: Record<string, SampleResult> = {}
    const run = {
      results,
      entry: summarize(results, {
        date: 'd',
        commit: 'c',
        tolerance: 20,
        type: 'flowchart',
        mermaid: '12.2.0',
      }),
    }
    const md = scorecardMarkdown(
      [run],
      [run.entry],
      undefined,
      [],
      [],
      [],
      [entry],
    )
    expect(md).toContain('## C4 diagrams (placement)')
    expect(md).toContain(
      '| 2026-10-30 | abcdef0 | 12.2.0 | 1 | 100% | 100% | 100% | 100% | 100% |',
    )
    expect(scorecardMarkdown([run], [run.entry])).not.toContain('C4 diagrams')
  })
})
