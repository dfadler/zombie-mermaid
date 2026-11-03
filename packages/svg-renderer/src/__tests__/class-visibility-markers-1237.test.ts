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

  // mermaid prints `+String name` with no gap after the marker (#2548)
  it('adds no spacer when the source has none', () => {
    expect(svg).not.toContain('<tspan fill="var(--_text-faint)"> </tspan>')
  })

  it('keeps a faint spacer when the source has one, and prints a return type as " : type"', () => {
    const spaced = renderMermaidSVG(`classDiagram
  class A {
    + run() void
  }`)
    expect(spaced).toContain('<tspan fill="var(--_text-faint)"> </tspan>')
    expect(spaced).toContain('<tspan fill="var(--_text-faint)"> : </tspan>')
  })
})
