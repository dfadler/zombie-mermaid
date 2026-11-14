import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { renderMermaidSVG } from '../src/index.ts'
import {
  USECASE_GATED,
  parseOfficialUsecaseSvg,
  parseOurUsecaseSvg,
  summarizeUsecase,
  usecaseAgreement,
  usecaseBreaches,
  worstUsecase,
  type UsecaseAgreement,
  type UsecaseLayout,
} from '../scripts/lib/usecase-agreement.ts'

// Mermaid 12.3.0's render of every `Use Case:` sample, without its CSS
// (scripts/usecase-oracle.ts --write-fixture).
const FIXTURE = JSON.parse(
  readFileSync(
    new URL('./fixtures/usecase-official-12.3.0.json', import.meta.url),
    'utf8',
  ),
) as Record<string, { source: string; official: string }>

describe('use case oracle agreement (mermaid 12.3.0)', () => {
  for (const [title, { source, official }] of Object.entries(FIXTURE)) {
    it(`agrees on box sizes, text and edges for "${title}"`, () => {
      const a = usecaseAgreement(
        parseOfficialUsecaseSvg(official),
        parseOurUsecaseSvg(renderMermaidSVG(source)),
      )
      expect(a.boxes).toBe(1)
      expect(a.edges).toBe(1)
      expect(usecaseBreaches({ [title]: a })).toEqual([])
    })
  }

  const basic = FIXTURE['Use Case: Basic']!
  const base = (): UsecaseLayout => parseOfficialUsecaseSvg(basic.official)

  it('reads boxes, kinds and edges from official markup', () => {
    const l = base()
    expect(l.boxes.map((b) => [b.id, b.kind, b.label])).toEqual([
      ['Shop', 'boundary', 'Shop'],
      ['Customer', 'actor', 'Customer'],
      ['Admin', 'actor', 'Admin'],
      ['Browse', 'usecase', 'Browse'],
      ['Checkout', 'usecase', 'Checkout'],
      ['Pay', 'usecase', 'Pay by card'],
      ['note-0', 'note', 'needs login'],
    ])
    expect(l.boxes.find((b) => b.id === 'Browse')).toMatchObject({
      width: 160,
      height: 58,
    })
    expect(l.edges.map((e) => [e.from, e.to, e.label, e.dotted])).toEqual([
      ['Customer', 'Browse', '', false],
      ['Customer', 'Checkout', '', false],
      ['Checkout', 'Pay', '«include»', true],
      ['Admin', 'Browse', 'manages', false],
      ['note-0', 'Checkout', '', true],
    ])
    expect(l.size!.width).toBeGreaterThan(0)
  })

  it('reads our own markup the same way', () => {
    const l = parseOurUsecaseSvg(renderMermaidSVG(basic.source))
    expect(l.boxes.map((b) => [b.id, b.kind]).sort()).toEqual(
      base()
        .boxes.map((b) => [b.id, b.kind])
        .sort(),
    )
  })

  it('is 1 for identical layouts and counts differences apart', () => {
    expect(usecaseAgreement(base(), base())).toMatchObject({
      boxes: 1,
      edges: 1,
      positions: 1,
      frame: 1,
      nodes: 7,
    })
    const resized = base()
    resized.boxes.find((b) => b.id === 'Browse')!.width += 5
    resized.boxes.find((b) => b.id === 'Pay')!.cx += 5
    resized.boxes.find((b) => b.id === 'Shop')!.width += 50 // a boundary's size is layout
    resized.boxes.find((b) => b.id === 'Customer')!.width += 1 // within the actor tolerance
    const a = usecaseAgreement(base(), resized)
    expect(a.boxes).toBeCloseTo(6 / 7)
    expect(a.positions).toBeCloseTo(6 / 7)
    const edges = base()
    edges.edges[2]!.dotted = false
    edges.edges.pop()
    expect(usecaseAgreement(base(), edges).edges).toBe(3 / 5)
    const text = base()
    text.boxes[1]!.label = 'x'
    expect(usecaseAgreement(base(), text).boxes).toBeCloseTo(6 / 7)
    const size = base()
    size.size!.height += 10
    expect(usecaseAgreement(base(), size).frame).toBe(0)
  })

  it('has nothing to compare for an empty diagram', () => {
    const e: UsecaseLayout = { boxes: [], edges: [] }
    const a = usecaseAgreement(e, e)
    expect(a.boxes).toBeNull()
    expect(a.edges).toBeNull()
    expect(worstUsecase(a)).toBe(0) // the frame
    expect(worstUsecase({ ...a, frame: null })).toBeNull()
  })

  it('averages figures and names breaches on the gated ones only', () => {
    const ok: UsecaseAgreement = {
      boxes: 1,
      edges: 1,
      positions: 0.5,
      frame: 0,
      nodes: 2,
    }
    const bad: UsecaseAgreement = { ...ok, boxes: 0.5, positions: null }
    expect(USECASE_GATED).toEqual(['boxes', 'edges'])
    expect(
      summarizeUsecase(
        { a: ok, b: bad },
        { date: '2026-11-13', commit: 'abc', mermaid: '12.3.0' },
      ),
    ).toMatchObject({
      kind: 'usecase',
      samples: 2,
      boxes: 0.75,
      positions: 0.5,
    })
    expect(usecaseBreaches({ a: ok, b: bad }, ['c'])).toEqual([
      'c (error)',
      'b (50% < 100%)',
    ])
    expect(usecaseBreaches({ a: ok })).toEqual([])
  })
})
