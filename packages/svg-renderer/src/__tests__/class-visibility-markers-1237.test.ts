import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../../../../src/index.ts'

// The marker used to share the faint colour and regular weight of the colon,
// so `~` read as `-` at 1x (#1237). It now gets the member-name colour and a
// bold weight, in its own tspan.
describe('class diagram visibility markers (#1237)', () => {
  const svg = renderMermaidSVG(`classDiagram
  class User {
    +String a
    -String b
    #String c
    ~String d
  }`)

  for (const marker of ['+', '-', '#', '~']) {
    it(`draws ${marker} in a bold, non-faint tspan`, () => {
      expect(svg).toContain(
        `<tspan fill="var(--_text-sec)" font-weight="700">${marker}</tspan>`,
      )
    })
  }

  it('keeps a faint spacer between marker and name', () => {
    expect(svg).toContain('<tspan fill="var(--_text-faint)"> </tspan>')
  })
})
