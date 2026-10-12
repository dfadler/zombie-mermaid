import { describe, expect, it } from 'vitest'
import { renderMermaidSVG } from '../index.ts'
import { parseStyleProps } from '../../packages/core/src/style-directives.ts'

// `style A fill:rgb(255,0,0)` used to be split on the commas inside `rgb(...)`,
// so the colour was lost (#1921). Mermaid 12.1.0 does not paint these either
// (flowcharts reject any `(`, state/class split on every comma), so keeping
// them intact is a superset of Mermaid.

const FLOW = 'flowchart LR\n  A[Hello] --> B[World]\n'
const STATE = 'stateDiagram-v2\n  Idle --> Busy\n'
const CLASS = 'classDiagram\n  class A\n  class B\n  A --> B\n'

describe('parseStyleProps splits on top-level commas only (#1921)', () => {
  it('keeps commas inside colour functions, quotes and url()', () => {
    expect(
      parseStyleProps('fill:rgb(255,0,0),stroke:hsl(0, 100%, 50%);'),
    ).toEqual({ fill: 'rgb(255,0,0)', stroke: 'hsl(0, 100%, 50%)' })
    expect(parseStyleProps('stroke:rgba(0,0,0,.5),stroke-width:2px')).toEqual({
      stroke: 'rgba(0,0,0,.5)',
      'stroke-width': '2px',
    })
    expect(
      parseStyleProps('fill:color-mix(in srgb, red 50%, blue),color:#fff'),
    ).toEqual({ fill: 'color-mix(in srgb, red 50%, blue)', color: '#fff' })
    expect(parseStyleProps('font-family:"Helvetica, Arial",fill:#f00')).toEqual(
      { 'font-family': '"Helvetica, Arial"', fill: '#f00' },
    )
    expect(parseStyleProps("fill:url('a,b.svg#p'),stroke:#333")).toEqual({
      fill: "url('a,b.svg#p')",
      stroke: '#333',
    })
  })

  it('splits unbalanced input like before, so later declarations survive', () => {
    expect(parseStyleProps('fill:rgb(255,0,0,stroke:#333')).toEqual({
      fill: 'rgb(255',
      stroke: '#333',
    })
    expect(parseStyleProps('font-family:"A,fill:#f00')).toEqual({
      'font-family': '"A',
      fill: '#f00',
    })
    expect(parseStyleProps('fill:#f00),stroke:#333')).toEqual({
      fill: '#f00)',
      stroke: '#333',
    })
  })

  // Inputs without commas inside (...) or quotes must parse exactly as before.
  it.each([
    ['fill:#f00,stroke:#333', { fill: '#f00', stroke: '#333' }],
    ['fill:#f00,stroke:#333;', { fill: '#f00', stroke: '#333' }],
    ['fill: #f00 , stroke : #333', { fill: '#f00', stroke: '#333' }],
    ['fill:rgb(255 0 0),stroke:#333', { fill: 'rgb(255 0 0)', stroke: '#333' }],
    [
      'stroke-dasharray:5 5,fill:red',
      { 'stroke-dasharray': '5 5', fill: 'red' },
    ],
    ['fill:#f00,fill:#0f0', { fill: '#0f0' }],
    ['nonsense,fill:', {}],
    [':red,fill:blue', { fill: 'blue' }],
    ['', {}],
    ['fill:#f00,,stroke:#333', { fill: '#f00', stroke: '#333' }],
    ['fill:#f00 !important', { fill: '#f00 !important' }],
    ['font-family:Arial,fill:red', { 'font-family': 'Arial', fill: 'red' }],
  ])('corpus: %j', (input, expected) => {
    expect(parseStyleProps(input)).toEqual(expected)
  })
})

describe('colour functions with commas survive every style placement (#1921)', () => {
  const cases: Array<[string, string]> = [
    ['flowchart style', FLOW + '  style A fill:rgb(255,0,0),stroke-width:3px'],
    [
      'flowchart classDef',
      FLOW + '  classDef hot fill:rgb(255,0,0),stroke-width:3px\n  class A hot',
    ],
    [
      'flowchart linkStyle',
      FLOW + '  linkStyle 0 stroke:rgb(255,0,0),stroke-width:3px',
    ],
    [
      'state classDef',
      STATE +
        '  classDef hot fill:rgb(255,0,0),stroke-width:3px\n  class Idle hot',
    ],
    ['state style', STATE + '  style Idle fill:rgb(255,0,0),stroke-width:3px'],
    ['class style', CLASS + '  style A fill:rgb(255,0,0),stroke-width:3px'],
    [
      'class classDef',
      CLASS +
        '  classDef hot fill:rgb(255,0,0),stroke-width:3px\n  cssClass "A" hot',
    ],
  ]

  it.each(cases)('%s', async (_name, source) => {
    const svg = await renderMermaidSVG(source)
    expect(svg).toContain('rgb(255,0,0)')
    expect(svg).not.toMatch(/(?:fill|stroke)="rgb\(255"/)
    expect(svg).toContain('3px')
  })

  it('still drops an invalid colour function', async () => {
    const svg = await renderMermaidSVG(
      FLOW + '  style A fill:rgb(x,0,0),stroke:hsl(0,100%,50%)',
    )
    expect(svg).not.toContain('rgb(x')
    expect(svg).toContain('hsl(0,100%,50%)')
  })
})
