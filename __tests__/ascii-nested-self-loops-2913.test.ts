/**
 * #2913 bullet 1 / #2028: duplicate self-loops nest.
 *
 * mermaid@12.3.0 (`scripts/lib/real-mermaid.ts`) draws one hook per self-loop
 * edge: N loops are N hooks, each a smaller hook inside the next, in the left
 * gutter of the node in TD and BT and over its top in LR and RL (ELK gives the
 * ends of N loops 2N slots on the face, the inner loop the middle two). The
 * grid used to route duplicates onto one path and draw one hook.
 * Not checked on GitHub / mermaid.live.
 */
import { describe, expect, it } from 'vitest'
import { registerAsciiLayout } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidASCII } from '../packages/ascii-renderer/src/index.ts'
import { renderMermaidSVG } from '../packages/svg-renderer/src/index.ts'
import { asciiLayoutProvider } from '../src/ascii-layout-provider.ts'
import { measureSample } from '../scripts/lib/ascii-topology.ts'

const draw = (source: string, hints: boolean): string => {
  registerAsciiLayout(hints ? asciiLayoutProvider : undefined)
  try {
    return renderMermaidASCII(source, { colorMode: 'none' })
  } finally {
    registerAsciiLayout(undefined)
  }
}

const loops = (n: number, node = 'n0'): string =>
  `  ${node} --> ${node}\n`.repeat(n)

const CASES: [string, string, number][] = []
for (const dir of ['TD', 'LR', 'RL', 'BT']) {
  for (const n of [2, 3]) {
    CASES.push([
      `${dir}: ${n} loops on a box`,
      `flowchart ${dir}\n  n0["a"]\n${loops(n)}`,
      n,
    ])
  }
  CASES.push([
    `${dir}: 2 loops on a decision`,
    `flowchart ${dir}\n  d{"x"}\n${loops(2, 'd')}`,
    2,
  ])
  CASES.push([
    `${dir}: 2 labelled loops`,
    `flowchart ${dir}\n  a["a"]\n  a -->|one| a\n  a -->|two| a`,
    2,
  ])
  CASES.push([
    `${dir}: 3 loops on a middle node, with its neighbours`,
    `flowchart ${dir}\n  a --> b\n${loops(3, 'b')}  b --> c\n  a --> c`,
    3,
  ])
}

describe('duplicate self-loops nest (#2913)', () => {
  it.each(CASES)('%s: one hook per loop, one arrowhead each', (_n, src, k) => {
    const c = measureSample(src)
    expect(c.loops).toBe(k)
    expect(c.loopHooks).toBe(k)
    const out = draw(src, true)
    // Each loop ends in its own head; a plain `a --> b` fan adds the others.
    const heads = (out.match(/[▲▼◄►]/g) ?? []).length
    expect(heads).toBeGreaterThanOrEqual(k)
    const rows = out.split('\n')
    expect(new Set(rows.map((r) => r.length)).size).toBe(1)
  })

  const trim = (out: string): string =>
    out
      .split('\n')
      .map((r) => r.trimEnd())
      .join('\n')
      .replace(/^\n+|\n+$/g, '')

  it('TD: the inner hook sits inside the outer one, start above end', () => {
    expect(trim(draw(`flowchart TD\n  n0["a"]\n${loops(2)}`, true))).toBe(
      [
        '     ┌───┐',
        ' ┌───┤   │',
        ' │   │   │',
        ' │ ┌─┤   │',
        ' │ │ │ a │',
        ' │ └►│   │',
        ' │   │   │',
        ' └──►│   │',
        '     └───┘',
      ].join('\n'),
    )
  })

  it('BT: the same hooks, flipped', () => {
    expect(trim(draw(`flowchart BT\n  n0["a"]\n${loops(2)}`, true))).toBe(
      [
        '     ┌───┐',
        ' ┌──►│   │',
        ' │   │   │',
        ' │ ┌►│   │',
        ' │ │ │ a │',
        ' │ └─┤   │',
        ' │   │   │',
        ' └───┤   │',
        '     └───┘',
      ].join('\n'),
    )
  })

  it('LR: the inner hook sits under the outer one, start left of end', () => {
    expect(trim(draw(`flowchart LR\n  n0["a"]\n${loops(2)}`, true))).toBe(
      [
        ' ┌─────┐',
        ' │     │',
        ' │ ┌─┐ │',
        ' │ │ ▼ ▼',
        '┌┴─┴────┐',
        '│       │',
        '│   a   │',
        '│       │',
        '└───────┘',
      ].join('\n'),
    )
  })

  it('RL: the same hooks, mirrored', () => {
    expect(trim(draw(`flowchart RL\n  n0["a"]\n${loops(2)}`, true))).toBe(
      [
        ' ┌─────┐',
        ' │     │',
        ' │ ┌─┐ │',
        ' ▼ ▼ │ │',
        '┌────┴─┴┐',
        '│       │',
        '│   a   │',
        '│       │',
        '└───────┘',
      ].join('\n'),
    )
  })

  it('one loop keeps the node’s own size and its single hook', () => {
    const one = draw('flowchart TD\n  n0["a"]\n  n0 --> n0', true)
    expect(one).toBe(
      ['   ┌───┐', '   │   │', ' ┌─┤ a │', ' │ │   │', ' └►└───┘'].join('\n'),
    )
    expect(measureSample('flowchart TD\n  n0["a"]\n  n0 --> n0')).toMatchObject(
      {
        loops: 1,
        loopHooks: 1,
      },
    )
  })

  it('draws the same without ELK hints as before: one hook for duplicates', () => {
    // No hints, no nesting: the grid-only path is unchanged.
    const src = 'flowchart TD\n  n0["a"]\n  n0 --> n0\n  n0 --> n0'
    expect(draw(src, false)).toBe(
      draw('flowchart TD\n  n0["a"]\n  n0 --> n0', false),
    )
  })

  it.each(CASES)(
    '%s: snapshots SVG and ASCII (grid and ELK hints)',
    (_n, src) => {
      expect(renderMermaidSVG(src)).toMatchSnapshot('svg')
      expect(draw(src, false)).toMatchSnapshot('ascii-grid')
      expect(draw(src, true)).toMatchSnapshot('ascii-hints')
    },
  )
})
