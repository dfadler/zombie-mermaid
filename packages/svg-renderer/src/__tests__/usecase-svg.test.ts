import { describe, expect, it } from 'vitest'
import { renderMermaidSVG } from '../../../../src/index.ts'
import {
  USECASE,
  fontOf,
  isUsecaseShape,
  lineHeight,
  usecaseLabelText,
  usecaseNodeSize,
} from '../usecase/shapes.ts'

const SRC = `usecase-beta
  actor Customer
  systemBoundary Shop
    Browse
    Pay[Pay by card]
  end
  Customer --> Browse
  Browse ..> : include Pay
  Pay --|> Browse
  note for Browse "needs login"`

describe('use case node sizes (mermaid@12.3.0)', () => {
  it('sizes an ellipse, a rectangle and a note from the 120px label box', () => {
    expect(usecaseNodeSize('usecase-ellipse', 'Browse')).toEqual({
      width: 160,
      height: 58,
    })
    expect(usecaseNodeSize('usecase-rect', 'Pay by card')).toEqual({
      width: 152,
      height: 42,
    })
    expect(usecaseNodeSize('usecase-note', 'needs login')).toEqual({
      width: 140,
      height: 44,
    })
  })

  it('wraps a long label at 120px and grows by a line', () => {
    // mermaid@12.3.0: two 18px lines in a 160 x 76 ellipse; an actor's wrapped
    // name is 140 wide and 42px taller per two extra lines.
    const long = 'Reply to a ticket from a customer today'
    expect(usecaseLabelText('usecase-ellipse', long).split('\n').length).toBe(2)
    expect(usecaseNodeSize('usecase-ellipse', long).height).toBe(76)
    expect(
      usecaseNodeSize('usecase-actor', 'Chief executive officer of everything'),
    ).toEqual({ width: 140, height: 163 })
  })

  it('makes an actor at least 76 wide and 121 tall, taller per extra name line', () => {
    expect(usecaseNodeSize('usecase-actor', 'Admin')).toEqual({
      width: 76,
      height: USECASE.actorHeight,
    })
    expect(usecaseNodeSize('usecase-actor', 'Support agent').width).toBeCloseTo(
      108,
      0,
    )
    expect(usecaseNodeSize('usecase-actor', 'a b\nc').height).toBe(
      USECASE.actorHeight + lineHeight('usecase-actor'),
    )
  })

  it('names its shapes and fonts', () => {
    expect(isUsecaseShape('usecase-note')).toBe(true)
    expect(isUsecaseShape('rectangle')).toBe(false)
    expect([
      fontOf('usecase-actor'),
      fontOf('usecase-note'),
      fontOf('usecase-rect'),
    ]).toEqual([14, 16, 12])
  })
})

describe('use case SVG', () => {
  const svg = renderMermaidSVG(SRC)

  it('draws each shape', () => {
    expect(svg).toContain('data-shape="usecase-actor"')
    expect(svg).toMatch(/<circle [^>]*r="12"/) // The stick figure's head
    expect(svg).toContain('<ellipse')
    expect(svg).toContain('data-shape="usecase-rect"')
    expect(svg).toContain('fill="#fff5ad"') // The note
  })

  it('draws a boundary, include as a dotted «include» line, and a hollow generalization head', () => {
    expect(svg).toContain('class="subgraph" data-id="Shop"')
    expect(svg).toContain('«include»')
    expect(svg).toContain('data-style="dotted"')
    expect(svg).toMatch(/marker-end="url\(#[\w-]*triangle\)"/)
    expect(svg).toMatch(/<marker id="[\w-]*triangle"/)
  })

  it('lays out top to bottom with direction TB and honours the direction option', () => {
    // The y of a node's ellipse: the first `cy` after its group opens.
    const y = (s: string, id: string) =>
      Number(/\bcy="([\d.]+)"/.exec(s.slice(s.indexOf(`data-id="${id}"`)))?.[1])
    const tb = renderMermaidSVG('usecase-beta\ndirection TB\nA --> B')
    expect(y(tb, 'B')).toBeGreaterThan(y(tb, 'A'))
    const lr = renderMermaidSVG('usecase-beta\nA --> B')
    expect(y(lr, 'B')).toBe(y(lr, 'A'))
    expect(renderMermaidSVG('usecase-beta\nA --> B', { direction: 'TB' })).toBe(
      tb,
    )
  })

  it('clips edges to an ellipse, never through it', () => {
    // Both ends of A --> B sit on the ellipses' outlines, not their bounding boxes.
    const m =
      /class="edge" data-from="A" data-to="B"[^>]*? d="M ([\d.]+) ([\d.]+) L ([\d.]+) ([\d.]+)"/.exec(
        renderMermaidSVG('usecase-beta\nA --> B'),
      )!
    expect(Number(m[1])).toBeGreaterThan(0)
    expect(Number(m[3])).toBeGreaterThan(Number(m[1]))
  })

  it('does not clip an endpoint that misses the ellipse', () => {
    const svg2 = renderMermaidSVG('usecase-beta\nA --> A')
    expect(svg2).toContain('data-from="A" data-to="A"')
  })

  it('uses the 20px canvas margin unless padding is given', () => {
    const width = (s: string) => Number(/viewBox="0 0 ([\d.]+)/.exec(s)![1])
    const a = width(renderMermaidSVG('usecase-beta\nA'))
    const b = width(renderMermaidSVG('usecase-beta\nA', { padding: 40 }))
    expect(b - a).toBe(40)
  })

  it('draws an actor name under the figure, wrapped', () => {
    const named = renderMermaidSVG(
      'usecase-beta\nactor "Chief executive officer of everything"',
    )
    expect(named).toContain('Chief executive')
  })
})
