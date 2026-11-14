/**
 * Wardley SVG: structure, class names and the theme mapping. Agreement with
 * mermaid.js itself (every coordinate) is __tests__/wardley-agreement.test.ts.
 */
import { describe, it, expect } from 'vitest'
import { WARDLEY, renderMermaidSVG } from '../index.ts'

const SRC = `wardley-beta
  title Tea & Cups
  anchor Me [0.9, 0.5]
  component Cup [0.7, 0.4]
  component Tea [0.5, 0.6] (market)
  Me -> Cup
  Cup +> Tea; hot
  evolve Cup 0.8`

describe('renderWardleySvg', () => {
  const svg = renderMermaidSVG(SRC)

  it('uses Mermaid’s 900 x 600 canvas and class names', () => {
    expect(WARDLEY.width).toBe(900)
    expect(svg).toContain('viewBox="0 0 900 600"')
    for (const cls of [
      'wardley-map',
      'wardley-background',
      'wardley-axes',
      'wardley-stages',
      'wardley-links',
      'wardley-link-label',
      'wardley-trends',
      'wardley-trend',
      'wardley-nodes',
      'wardley-node--anchor',
      'wardley-node--component',
      'wardley-market-dot',
      'wardley-market-line',
    ])
      expect(svg).toContain(cls)
  })

  it('labels the axes and the default stages', () => {
    for (const label of [
      'Evolution',
      'Visibility',
      'Genesis',
      'Custom Built',
      'Product',
      'Commodity',
    ])
      expect(svg).toContain(`>${label}</text>`)
  })

  it('escapes the title and draws it visibly', () => {
    expect(svg).toContain('>Tea &amp; Cups</text>')
  })

  it('projects evolution to x and visibility to y inside the padding', () => {
    // Cup: evolution 40% of 804 from x=48, visibility 70% of 504 up from y=552.
    expect(svg).toMatch(/<circle cx="369\.6" cy="199\.2" r="6"\/>/)
  })

  it('points a flow arrow with a marker and rotates the label along the link', () => {
    expect(svg).toMatch(
      /<line class="wardley-link"[^>]*marker-end="url\(#[\w-]*wardley-link-arrow-end\)"/,
    )
    expect(svg).toMatch(
      /<text class="wardley-link-label"[^>]*transform="rotate\(/,
    )
  })

  it('keeps the page’s theme variables and has no interactivity', () => {
    expect(svg).toContain('--bg:')
    expect(svg).not.toMatch(/<a |onclick|tabindex/)
  })

  it('skips the background when transparent and names the diagram', () => {
    const t = renderMermaidSVG(SRC, { transparent: true })
    expect(t).not.toContain('class="wardley-background"')
    expect(renderMermaidSVG(SRC, { title: 'Tea map' })).toContain('<title')
  })

  it('draws every strategy overlay and the inertia bar', () => {
    const out = renderMermaidSVG(`wardley-beta
component A [0.9, 0.1] (build)
component B [0.8, 0.2] (buy)
component C [0.7, 0.3] (outsource) inertia
component D [0.6, 0.4] inertia`)
    for (const cls of ['build', 'buy', 'outsource'])
      expect(out).toContain(`class="wardley-${cls}-overlay"`)
    expect(out.match(/class="wardley-inertia"/g)).toHaveLength(2)
    // A label with a strategy sits 10 further out, as in Mermaid.
    expect(out).toMatch(/x="[\d.]+" y="[\d.]+">A<\/text>/)
  })

  it('draws a pipeline as a box with the parent square above it', () => {
    const out = renderMermaidSVG(`wardley-beta
component P [0.5, 0.3] inertia
component Q [0.9, 0.6]
Q -> P
pipeline P {
  component A [0.2]
  component B [0.8]
}
P -> A
A -> P`)
    expect(out).toContain('class="wardley-pipeline-box"')
    expect(out).toContain('class="wardley-pipeline-evolution-link"')
    expect(out).toMatch(
      /<rect x="[\d.]+" y="[\d.]+" width="9\.6" height="9\.6"\/>/,
    )
    // A link from a component into its pipeline's parent is not drawn; the others are.
    expect(out.match(/<line class="wardley-link"/g)).toHaveLength(2)
  })

  it('lists annotations in a box when there is an annotations line', () => {
    const out = renderMermaidSVG(`wardley-beta
annotations [0.8, 0.1]
annotation 2,[0.5, 0.5] "B"
annotation 1,[0.4, 0.4] "A"
annotation 3,[0.3, 0.3] ""
note "N" [0.2, 0.2]
accelerator Up [0.3, 0.3]
deaccelerator Down [0.6, 0.6]`)
    expect(out).toContain('class="wardley-annotations-box"')
    expect(out.indexOf('1. A')).toBeLessThan(out.indexOf('2. B'))
    expect(out).not.toContain('3. ')
    expect(out).toContain('class="wardley-notes"')
    expect(out).toContain('class="wardley-accelerators"')
    expect(out).toContain('class="wardley-deaccelerators"')
    const bare = renderMermaidSVG('wardley-beta\nannotation 1,[0.5, 0.5] "A"')
    expect(bare).toContain('class="wardley-annotation"')
    expect(bare).not.toContain('class="wardley-annotations-box"')
  })

  it('skips a link to nothing, a link between two nodes on one spot and an evolve of nothing', () => {
    const out = renderMermaidSVG(`wardley-beta
component A [0.5, 0.5]
component B [0.5, 0.5]
A -> B
A -> Nowhere
evolve Nowhere 0.9`)
    expect(out).not.toContain('<line class="wardley-link"')
    expect(out).not.toContain('<line class="wardley-trend"')
    expect(out).not.toContain('NaN')
  })

  it('stops a trend short of its target and draws an arrow for a trend of zero length', () => {
    const out = renderMermaidSVG(
      'wardley-beta\ncomponent A [0.5, 0.5]\nevolve A 0.5\ncomponent B [0.5, 0.2]\nevolve B 0.21',
    )
    expect(out.match(/<line class="wardley-trend"/g)).toHaveLength(2)
  })

  it('takes size, stages and boundaries from the diagram', () => {
    const out = renderMermaidSVG(
      'wardley-beta\nsize [500, 300]\nevolution One@0.25 -> Two@1.0\ncomponent A [0.5, 0.5]',
    )
    expect(out).toContain('viewBox="0 0 500 300"')
    expect(out).toContain('>One</text>')
    expect(out.match(/class="wardley-stage-divider"/g)).toHaveLength(1)
  })
})
