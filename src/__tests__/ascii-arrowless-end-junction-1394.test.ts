import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../index.ts'

// An arrowless edge end tees into the border it runs up to, in every
// direction, so a dotted stroke (┆ doesn't fill its cell) still meets the node.
const render = (src: string, useAscii = false) =>
  renderMermaidASCII(src, { colorMode: 'none', useAscii })

describe('arrowless edge end joins the target border (#1394)', () => {
  it('down: ┴ on the top border', () => {
    expect(render('graph TD\n  A -.- B')).toContain('┴')
  })

  it('up: ┬ on the bottom border', () => {
    expect(render('graph BT\n  A --- B')).toMatch(/└─┬─┘\n  │/)
  })

  it('right: ┤ on the left border', () => {
    expect(render('graph LR\n  A --- B')).toContain('┤')
  })

  it('left: ├ on the right border', () => {
    expect(render('graph RL\n  A --- B')).toMatch(/├─+┤/)
  })

  it('ascii mode uses +', () => {
    expect(render('graph TD\n  A -.- B', true)).toMatch(/\+-+\+/)
    expect(render('graph TD\n  A -.- B', true)).toContain('-+-')
  })

  it('arrowed and invisible ends are untouched', () => {
    expect(render('graph TD\n  A --> B')).not.toContain('┴')
    expect(render('graph TD\n  A ~~~ B')).not.toContain('┴')
  })
})
