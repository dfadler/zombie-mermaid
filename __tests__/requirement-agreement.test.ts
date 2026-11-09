import { describe, expect, it } from 'vitest'
import { renderMermaidSVG } from '../src/index.ts'
import {
  parseOfficialRequirementSvg,
  parseOurRequirementSvg,
  requirementAgreement,
  requirementBreaches,
  summarizeRequirement,
  worstRequirement,
  type RequirementLayout,
} from '../scripts/lib/requirement-agreement.ts'

// Trimmed from mermaid 12.3.0's render of the "Requirement: Basic" sample.
const OFFICIAL = `<svg viewBox="4 4 173.734375 416"><g><g class="root"><g class="edges edgePaths"><path d="M90.8671875,124L90.8671875,228" id="r0-test_entity-test_req-0" class="edge-thickness-normal edge-pattern-dashed relationshipLine" style="" data-edge="true" data-points="${btoa(
  JSON.stringify([
    { x: 90.8671875, y: 124 },
    { x: 90.8671875, y: 228 },
  ]),
)}" data-look="neo" marker-end="url(#a)"></path></g><g class="edgeLabels"><g class="edgeLabel" transform="translate(90.625, 176)"><g class="label"><foreignObject><div><span class="edgeLabel"><p>&lt;&lt;satisfies&gt;&gt;</p></span></div></foreignObject></g></g></g><g class="nodes"><g class="node default" id="r0-test_req" data-look="neo" transform="translate(90.8671875, 320)"><g class="basic label-container outer-path" style=""><path d="M-78.8671875 -92 L78.8671875 -92 L78.8671875 92 L-78.8671875 92" fill="#ECECFF"></path></g><p>&lt;&lt;Requirement&gt;&gt;</p><p>test_req</p><p>ID: 1</p></g><g class="node default" id="r0-test_entity" data-look="neo" transform="translate(90.8671875, 68)"><g class="basic label-container outer-path" style=""><path d="M-69.046875 -56 L69.046875 -56 L69.046875 56 L-69.046875 56" fill="#ECECFF"></path></g><p>&lt;&lt;Element&gt;&gt;</p><p>test_entity</p><p>Type: simulation</p></g></g></g></g></svg>`

const base = (): RequirementLayout => parseOfficialRequirementSvg(OFFICIAL)

describe('parseOfficialRequirementSvg', () => {
  it('reads boxes relative to the view box, rows, relationships and size', () => {
    const l = base()
    expect(l.size).toEqual({ width: 173.734375, height: 416 })
    expect(l.boxes).toEqual([
      {
        id: 'test_req',
        cx: 86.8671875,
        cy: 316,
        width: 157.734375,
        height: 184,
        rows: ['<<Requirement>>', 'test_req', 'ID: 1'],
      },
      {
        id: 'test_entity',
        cx: 86.8671875,
        cy: 64,
        width: 138.09375,
        height: 112,
        rows: ['<<Element>>', 'test_entity', 'Type: simulation'],
      },
    ])
    expect(l.edges).toEqual([
      { type: 'satisfies', dashed: true, from: 'test_entity', to: 'test_req' },
    ])
  })
})

describe('parseOurRequirementSvg', () => {
  it('reads our own markup', () => {
    const l = parseOurRequirementSvg(
      renderMermaidSVG(
        'requirementDiagram\nrequirement a {\nid: 1\n}\nelement b {\n}\nb - contains -> a',
      ),
    )
    expect(l.boxes.map((b) => [b.id, b.rows])).toEqual([
      ['a', ['<<Requirement>>', 'a', 'ID: 1']],
      ['b', ['<<Element>>', 'b']],
    ])
    expect(l.edges).toEqual([
      { type: 'contains', dashed: false, from: 'b', to: 'a' },
    ])
    expect(l.size?.width).toBeGreaterThan(0)
  })
})

describe('requirementAgreement', () => {
  it('is 1 for identical layouts, and our basic render matches the official one', () => {
    const a = requirementAgreement(base(), base())
    expect(a).toMatchObject({
      boxes: 1,
      edges: 1,
      positions: 1,
      frame: 1,
      nodes: 2,
    })
    expect(worstRequirement(a)).toBe(1)
    const ours = parseOurRequirementSvg(
      renderMermaidSVG(
        'requirementDiagram\nrequirement test_req {\nid: 1\ntext: the test text.\nrisk: high\nverifymethod: test\n}\nelement test_entity {\ntype: simulation\n}\ntest_entity - satisfies -> test_req',
      ),
    )
    expect(ours.boxes.map((b) => [b.width.toFixed(0), b.height])).toEqual([
      ['158', 184],
      ['138', 112],
    ])
  })

  it('counts a resized box and moved box apart', () => {
    const ours = base()
    ours.boxes[0]!.width += 5
    ours.boxes[1]!.cx += 5
    const a = requirementAgreement(base(), ours)
    expect(a.boxes).toBe(0.5)
    expect(a.positions).toBe(0.5)
  })

  it('counts different text, a dashed or reversed line, and a missing box', () => {
    const ours = base()
    ours.boxes[0]!.rows = ['x']
    ours.edges[0]!.dashed = false
    ours.boxes.pop()
    const a = requirementAgreement(base(), ours)
    expect(a.boxes).toBe(0)
    expect(a.edges).toBe(0)
    const reversed = base()
    ;[reversed.edges[0]!.from, reversed.edges[0]!.to] = [
      reversed.edges[0]!.to,
      reversed.edges[0]!.from,
    ]
    expect(requirementAgreement(base(), reversed).edges).toBe(0)
  })

  it('fails the frame when the size differs, and has nothing to compare when empty', () => {
    const size = base()
    size.size!.height += 10
    expect(requirementAgreement(base(), size).frame).toBe(0)
    const e: RequirementLayout = { boxes: [], edges: [] }
    const a = requirementAgreement(e, e)
    expect(a.boxes).toBeNull()
    expect(a.frame).toBe(0)
    expect(worstRequirement(a)).toBe(0)
    expect(worstRequirement({ ...a, frame: null }, ['boxes'])).toBeNull()
  })
})

describe('summaries', () => {
  const ok = { boxes: 1, edges: 1, positions: 1, frame: 1, nodes: 2 }
  const bad = { boxes: 0.5, edges: 1, positions: null, frame: 1, nodes: 2 }

  it('averages figures and names breaches', () => {
    const entry = summarizeRequirement(
      { a: ok, b: bad },
      { date: '2026-11-08', commit: 'abc', mermaid: '12.3.0' },
    )
    expect(entry).toMatchObject({
      kind: 'requirement',
      samples: 2,
      boxes: 0.75,
      positions: 1,
    })
    expect(requirementBreaches({ a: ok, b: bad }, ['c'])).toEqual([
      'c (error)',
      'b (50% < 100%)',
    ])
    expect(requirementBreaches({ a: ok })).toEqual([])
  })
})
