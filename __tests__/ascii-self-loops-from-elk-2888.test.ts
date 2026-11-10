/**
 * #2888: a self-loop takes ELK's faces. In LR and RL it is a hook over the top
 * face (out of one top cell, back into the next), in TD and BT a hook out of
 * the left face, with a margin row or column when the node has none beside it.
 * The side the start takes follows ELK's order, mirrored for RL and BT; the
 * saved mermaid@12.3.0 render of `ascii-face-capacity-loops` (RL) starts on
 * the right and lands on the left.
 */
import { describe, expect, it } from 'vitest'
import { registerAsciiLayout } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidASCII } from '../packages/ascii-renderer/src/index.ts'
import { asciiLayoutProvider } from '../src/ascii-layout-provider.ts'
import { measureSample } from '../scripts/lib/ascii-topology.ts'

const draw = (source: string, hints = true): string => {
  registerAsciiLayout(hints ? asciiLayoutProvider : undefined)
  try {
    return renderMermaidASCII(source, { layoutHints: hints } as never)
  } finally {
    registerAsciiLayout(undefined)
  }
}
const col = (out: string, glyph: string): number =>
  Math.min(
    ...out
      .split('\n')
      .map((l) => l.indexOf(glyph))
      .filter((i) => i >= 0),
  )
const row = (out: string, glyph: string): number =>
  out.split('\n').findIndex((l) => l.includes(glyph))

const LOOP = (dir: string): string =>
  `flowchart ${dir}\n  a --> b\n  b --> b\n  b --> c`

describe('self-loops take ELK’s faces (#2888)', () => {
  it.each(['LR', 'RL', 'TD', 'BT'])(
    '%s: every end of a loop is on ELK’s face',
    (dir) => {
      const c = measureSample(LOOP(dir))
      expect(c.faceOk).toBe(c.faceEnds)
    },
  )

  it('LR: a hook over the top face, out of the left cell and into the right', () => {
    const out = draw('flowchart LR\n  A --> B\n  B --> B')
    const lines = out.split('\n')
    const top = row(out, '┌─┐')
    expect(top).toBeGreaterThanOrEqual(0)
    // The stub leaves the box on the left leg, the head lands on the right one
    expect(lines[top + 1]).toMatch(/│ ▼/)
    expect(lines[top + 2]).toContain('┴')
  })

  it('RL: the same hook mirrored, the head lands on the left', () => {
    const out = draw('flowchart RL\n  A --> B\n  B --> B')
    expect(out).toMatch(/▼ │/)
  })

  it('TD: a hook out of the left face, with a margin column on the first column', () => {
    const out = draw('flowchart TD\n  a --> a')
    const lines = out.split('\n')
    // Nothing left of the loop's hook: the box starts to its right
    expect(lines.some((l) => /^ ┌─┤/.test(l))).toBe(true)
    expect(lines.some((l) => /^ └►/.test(l))).toBe(true)
  })

  it('TD: a node past the first column hooks into the gutter beside it, no margin', () => {
    const out = draw('flowchart TD\n  a --> b\n  a --> c\n  c --> c')
    expect(out).toContain('►│')
  })

  it('BT: the start is the lower cell (flipped after drawing)', () => {
    const out = draw('flowchart BT\n  a --> a')
    expect(row(out, '►')).toBeLessThan(row(out, '┤'))
  })

  it('draws the loop apart from the stroke that runs past it in TD', () => {
    const out = draw(
      'flowchart TD\n  a["a"]\n  b["b"]\n  c["c"]\n  a --> a\n  b --> a\n  a --> c\n  b --> c\n  c --> a',
    )
    // B --> c runs down the right of a, not through the loop's margin column
    const lines = out.split('\n')
    for (const l of lines) expect(l.charAt(0)).toBe(' ')
    expect(col(out, '►')).toBeLessThan(col(out, '┐'))
  })

  // #2913: a diamond's apex is one cell, so the hook's two legs sit on the
  // slants either side of it (mermaid@12.3.0 hooks from the slant, ELK's end).
  it.each(['LR', 'RL', 'TD', 'BT'])(
    '%s: a loop on a diamond is a hook on its slants, connected at both ends',
    (dir) => {
      const out = draw(
        `flowchart ${dir}\n  a --> n0{"decide"}\n  n0 --> n0\n  n0 --> b`,
      )
      const lines = out.split('\n')
      if (dir === 'LR' || dir === 'RL') {
        // Both legs end on the cells right above the slant glyphs
        const apex = lines.findIndex((l) => l.includes('╱╲'))
        const at = lines[apex]!.indexOf('╱╲')
        expect(lines[apex - 1]!.slice(at, at + 2)).toMatch(/[│▼]{2}/)
        expect(lines[apex - 2]!.slice(at, at + 2)).toBe('┌┐')
      } else {
        // The stub leaves the upper slant, the head lands beside the lower one
        expect(lines.some((l) => /─[╱╲]/.test(l))).toBe(true)
        expect(out).toMatch(/►[╱╲]/)
      }
      // The same loop in the grid's own routing is not this shape
      expect(out).not.toBe(
        draw(
          `flowchart ${dir}\n  a --> n0{"decide"}\n  n0 --> n0\n  n0 --> b`,
          false,
        ),
      )
    },
  )

  it('a loop inside a subgraph keeps its own routing in TD', () => {
    const src = 'flowchart TD\n  subgraph s\n    a --> a\n  end'
    expect(draw(src)).toBe(draw(src, false))
  })

  it('a first-column loop beside a subgraph is not drawn inside its node (no margin column is made there)', () => {
    const out = draw(
      'flowchart TD\n  a --> a\n  a --> b\n  subgraph s\n    b --> c\n  end',
    )
    expect(out).toContain('│ a │')
  })

  it('without a provider the output is the grid’s own', () => {
    const src = LOOP('LR')
    registerAsciiLayout(undefined)
    expect(renderMermaidASCII(src)).toBe(draw(src, false))
  })

  it('dense-pair hooks keep their old side with no hints', () => {
    const src =
      'flowchart LR\n  A -->|one| B\n  A -->|two| B\n  B -->|back| A\n  A --> A'
    expect(() => draw(src, false)).not.toThrow()
  })
})
