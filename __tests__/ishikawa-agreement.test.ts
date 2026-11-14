import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  ishikawaMismatches,
  ishikawaSvgMismatches,
  parseIshikawaSvg,
} from '../scripts/lib/ishikawa-agreement.ts'

// Mermaid 12.3.0's render of every `Ishikawa:` sample and of the edge cases in
// ISHIKAWA_EXTRA_SOURCES, without its CSS (scripts/ishikawa-oracle.ts --write-fixture).
const FIXTURE = JSON.parse(
  readFileSync(
    new URL('./fixtures/ishikawa-official-12.3.0.json', import.meta.url),
    'utf8',
  ),
) as Record<string, { source: string; official: string }>

describe('ishikawa oracle agreement', () => {
  for (const [title, { source, official }] of Object.entries(FIXTURE)) {
    it(`agrees with mermaid 12.3.0 on "${title}"`, () => {
      expect(ishikawaMismatches(source, official)).toEqual([])
    })
  }

  const basic = FIXTURE['Ishikawa: Basic']!
  const reparse = () => parseIshikawaSvg(basic.official)

  it('reads the drawing in order', () => {
    const svg = reparse()
    expect(svg.classes[0]).toBe('line.ishikawa-spine')
    expect(
      svg.classes.filter((c) => c === 'line.ishikawa-branch'),
    ).toHaveLength(3)
    expect(
      svg.classes.filter((c) => c === 'line.ishikawa-sub-branch'),
    ).toHaveLength(6)
    expect(svg.texts[0]).toBe('Blurry\nPhoto')
    expect(svg.lines[0]).toMatchObject({ cls: 'ishikawa-spine', y: 0 })
    expect(svg.height).toBeGreaterThan(500)
  })

  it('reports a different element count, text, bone vector, height and width', () => {
    const o = reparse()
    const u = reparse()
    u.classes.pop()
    u.texts[1] = 'Other'
    u.lines[1] = {
      ...u.lines[1]!,
      dx: u.lines[1]!.dx + 5,
      y: u.lines[1]!.y + 9,
    }
    u.height = o.height * 1.2
    u.width = o.width * 1.5
    const out = ishikawaSvgMismatches(o, u).join('\n')
    expect(out).toMatch(/elements: \d+ official, \d+ ours/)
    expect(out).toMatch(/text: \[/)
    expect(out).toMatch(/ishikawa-branch 1: vector/)
    expect(out).toMatch(/ishikawa-branch 1: .* below the spine/)
    expect(out).toMatch(/height: /)
    expect(out).toMatch(/width: /)
  })

  it('treats a zero official size as a mismatch only when ours is not zero', () => {
    const o = { ...reparse(), width: 0, height: 0 }
    const u = { ...reparse(), width: 0, height: 5 }
    const out = ishikawaSvgMismatches(o, u).join('\n')
    expect(out).toMatch(/height: 0 official, 5 ours/)
    expect(out).not.toMatch(/width: /)
  })
})
