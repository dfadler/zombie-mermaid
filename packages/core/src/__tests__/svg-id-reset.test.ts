import { describe, expect, it } from 'vitest'
import { resetSvgIdCounters, svgOpenTag } from '../theme.ts'

const colors = { bg: '#fff', fg: '#000' }
const render = () =>
  svgOpenTag(400, 300, colors, false, 'A title', false, false, true, 'A desc')

describe('resetSvgIdCounters', () => {
  it('makes consecutive renders of the same input yield identical ids', () => {
    resetSvgIdCounters()
    const first = render()
    render() // An intervening render must not leak into the next page
    resetSvgIdCounters()
    expect(render()).toBe(first)
    expect(first).toContain('zm-title-1')
  })

  it('without a reset, ids keep counting (distinct within a page)', () => {
    resetSvgIdCounters()
    expect(render()).not.toBe(render())
  })
})
