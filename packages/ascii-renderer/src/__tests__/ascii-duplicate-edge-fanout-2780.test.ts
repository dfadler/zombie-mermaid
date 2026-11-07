import { describe, expect, it } from 'vitest'
import { renderMermaidASCII } from '../index'

// #2780: a node with a parallel (duplicated) edge to one child plus a second
// child threw "Grid block ... is already occupied" while centring the parent.
const render = (dir: string, shape: string) =>
  renderMermaidASCII(
    `flowchart ${dir}\n  a["A"]\n  p${shape}\n  c["C"]\n  p --> a\n  p --> a\n  p --> c\n`,
    { colorMode: 'none', useAscii: false },
  )

describe('duplicate edge fan-out (#2780)', () => {
  for (const dir of ['TD', 'LR', 'BT', 'RL']) {
    for (const [name, shape] of [
      ['diamond', '{"P"}'],
      ['rect', '["P"]'],
      ['rounded', '("P")'],
    ] as const) {
      it(`${dir} ${name} parent renders both children once`, () => {
        const out = render(dir, shape)
        expect(out.match(/A/g)).toHaveLength(1)
        expect(out.match(/C/g)).toHaveLength(1)
        expect(out).toContain('P')
      })
    }
  }

  it('matches the issue source (BT, stadium children)', () => {
    const out = renderMermaidASCII(
      `flowchart BT\n  n0(["n54J9wn"])\n  n1(["m"])\n  n2{"1z"}\n  n3(["5Ux716"])\n  n4("E8Hl7O")\n  n2 --> n0\n  n2 --> n0\n  n2 --> n3\n`,
      { colorMode: 'none', useAscii: false },
    )
    expect(out).toContain('n54J9wn')
    expect(out).toContain('5Ux716')
  })
})
