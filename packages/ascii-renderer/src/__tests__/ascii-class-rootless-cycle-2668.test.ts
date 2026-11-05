/**
 * #2668: a rootless relationship cycle (every class is some relationship's
 * target) put all its classes on one row and left the forward edges
 * undrawn. The leveling now drops each cycle's back edge, so the cycle stacks
 * and the back edge runs upward, as in Mermaid 12.3.0 (C steps aside, D
 * stays under B).
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const NAMES = ['B', 'C', 'D', 'E', 'F', 'G']
/** `X --> Y` for each neighbour pair round the ring, starting at `start`. */
const ring = (n: number, start: number, root: boolean): string => {
  const ids = Array.from({ length: n }, (_, i) => NAMES[(i + start) % n]!)
  const lines = ids.map((id, i) => `  ${id} --> ${ids[(i + 1) % n]!}`)
  if (root) lines.unshift(`  Z --> ${ids[0]!}`)
  return `classDiagram\n${lines.join('\n')}`
}
/** Every relationship here is a plain `-->`, so each target shows one head. */
const heads = (ascii: string): number => (ascii.match(/[v^]/g) ?? []).length

describe('ASCII class diagram: no relationship is dropped from a cycle (#2668)', () => {
  for (const useAscii of [false, true]) {
    for (let n = 2; n <= 6; n++) {
      for (let start = 0; start < n; start++) {
        for (const root of [false, true]) {
          it(`${n}-cycle from ${NAMES[start]}${root ? ' with a root' : ''} draws every edge (useAscii=${useAscii})`, () => {
            const out = renderMermaidASCII(ring(n, start, root), {
              useAscii,
              colorMode: 'none',
            })
            expect(heads(out)).toBe(n + (root ? 1 : 0))
          })
        }
      }
    }
  }

  it('stacks the cycle and steps C aside from the back edge, as Mermaid does', () => {
    const lines = renderMermaidASCII(
      'classDiagram\n  B --> C\n  C --> D\n  D --> B : one',
      { colorMode: 'none' },
    ).split('\n')
    const row = (name: string) =>
      lines.findIndex((l) => l.includes(`│ ${name} │`))
    const col = (name: string) => lines[row(name)]!.indexOf(`│ ${name} │`)
    expect(row('B')).toBeLessThan(row('C'))
    expect(row('C')).toBeLessThan(row('D'))
    expect(col('D')).toBe(col('B'))
    expect(col('C')).toBeLessThan(col('B'))
    expect(lines.some((l) => l.includes('one'))).toBe(true)
  })
})
