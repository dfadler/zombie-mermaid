/**
 * #2906: the `c4` block of `%%{init}%%` / front-matter `config:`. Measured
 * against mermaid 12.3.0 (headless Chromium, each key rendered with and
 * without it; viewBox heights/widths below are mermaid's, ours within 1px).
 * Keys that change output: diagramMarginX/Y, c4ShapeMargin, c4ShapePadding,
 * width, nextLinePaddingX, wrap. c4ShapeInRow, c4BoundaryInRow, height,
 * boxMargin and wrapPadding render identically to the default.
 */
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractInitConfig } from '@zombie-mermaid/core'
import { renderMermaidASCII, renderMermaidSVG } from '../index.ts'

const SRC = `C4Container
  title T
  Person(u, "User", "A user of the system with a long description here")
  System_Boundary(b, "Boundary") {
    Container(web, "Web App", "React", "Serves the UI to browsers and talks to the API over HTTPS")
    ContainerDb(db, "Database", "Postgres", "Stores data")
    Container(api, "API", "Node", "Business logic")
    Container(q, "Queue", "SQS")
    Container(w, "Worker", "Go", "Background jobs")
  }
  System_Ext(ext, "Email", "Sends mail")
  Rel(u, web, "Uses", "HTTPS")
  Rel(web, api, "Calls a very long relationship label that may wrap", "JSON")
  Rel(api, db, "Reads")
  Rel(ext, u, "Emails")`

const init = (c4: object, body = SRC) =>
  `%%{init: ${JSON.stringify({ c4 })}}%%\n${body}`
const vb = (svg: string) =>
  /viewBox="\S+ \S+ (\S+) (\S+)"/.exec(svg)!.slice(1).map(Number) as [
    number,
    number,
  ]

const [W0, H0] = vb(renderMermaidSVG(SRC))

describe('c4 init keys (#2906)', () => {
  it('parses valid keys, renames the c4Shape* ones and drops bad values', () => {
    const c = extractInitConfig([
      '%%{init: {"c4": {"diagramMarginX": 80, "c4ShapeMargin": 70, "c4ShapePadding": 30, "width": 300, "nextLinePaddingX": 5, "wrap": false, "c4ShapeInRow": 2, "diagramMarginY": -1, "height": "x"}}}%%',
    ])
    expect(c.c4Layout).toEqual({
      diagramMarginX: 80,
      shapeMargin: 70,
      shapePadding: 30,
      width: 300,
      nextLinePaddingX: 5,
      wrap: false,
    })
    expect(
      extractInitConfig(['%%{init: {"c4": {"width": 0, "wrap": 1}}}%%'])
        .c4Layout,
    ).toEqual({})
  })

  it('merges later directives over earlier ones', () => {
    const c = extractInitConfig([
      '%%{init: {"c4": {"width": 300, "wrap": false}}}%%',
      '%%{init: {"c4": {"width": 250}}}%%',
    ])
    expect(c.c4Layout).toEqual({ width: 250, wrap: false })
  })

  // Mermaid 12.3.0: [width, height] of the viewBox with each key set.
  it.each([
    ['diagramMarginX', { diagramMarginX: 80 }, 1368, 1084.54],
    ['diagramMarginY', { diagramMarginY: 40 }, 1564, 1204.54],
    ['c4ShapeMargin', { c4ShapeMargin: 70 }, 1408, 1284.54],
    ['c4ShapePadding', { c4ShapePadding: 30 }, 1564, 1134.54],
    ['width', { width: 300 }, 1500, 1088.28],
    ['wrap', { wrap: false }, 1372.59, 1082.84],
  ])('%s moves the viewBox as in mermaid', (_k, cfg, w, h) => {
    const [width, height] = vb(renderMermaidSVG(init(cfg)))
    expect(Math.abs(width - w)).toBeLessThan(2)
    expect(Math.abs(height - h)).toBeLessThan(2)
  })

  it('keys that do not change mermaid output leave ours unchanged', () => {
    for (const cfg of [
      { c4ShapeInRow: 2 },
      { c4BoundaryInRow: 1 },
      { height: 100 },
      { boxMargin: 30 },
      { wrapPadding: 30 },
      { nextLinePaddingX: 25 },
    ]) {
      expect(vb(renderMermaidSVG(init(cfg)))).toEqual([W0, H0])
    }
  })

  it('nextLinePaddingX shifts the wrapped row right', () => {
    const x = (svg: string) =>
      Number(/data-id="w"[\s\S]*?<rect x="([\d.]+)"/.exec(svg)![1])
    expect(x(renderMermaidSVG(init({ nextLinePaddingX: 25 })))).toBeCloseTo(
      x(renderMermaidSVG(SRC)) + 25,
    )
  })

  it('front matter config equals the init directive', () => {
    const fm = `---\nconfig:\n  c4:\n    width: 300\n    c4ShapePadding: 30\n---\n${SRC}`
    const same = (svg: string) => svg.replace(/zm-title-\d+/g, 'zm-title')
    expect(same(renderMermaidSVG(fm))).toBe(
      same(renderMermaidSVG(init({ width: 300, c4ShapePadding: 30 }))),
    )
  })

  it('a narrow width wraps the ASCII rows sooner', () => {
    const rows = `C4Context
  System(a, "A")
  System(b, "B")
  System(c, "C")
  System(d, "D")`
    const base = renderMermaidASCII(rows)
    const narrow = renderMermaidASCII(init({ width: 700 }, rows))
    expect(narrow.split('\n').length).toBeGreaterThan(base.split('\n').length)
  })
})

describe('c4 init snapshots (SVG and ASCII)', () => {
  const cfg = {
    width: 300,
    c4ShapePadding: 30,
    wrap: false,
    diagramMarginX: 80,
  }
  const small = `C4Context
  Person(u, "User", "Uses the system")
  System(s, "System", "Does the work in a long description")
  System_Ext(e, "Email")
  Rel(u, s, "Uses")
  Rel(s, e, "Sends")`
  const dir = join(import.meta.dirname, '__snapshots__')

  it('svg', async () => {
    await expect(renderMermaidSVG(init(cfg, small))).toMatchFileSnapshot(
      join(dir, 'c4-init-2906.svg'),
    )
  })
  it('ascii', async () => {
    await expect(
      renderMermaidASCII(init(cfg, small), { colorMode: 'none' }),
    ).toMatchFileSnapshot(join(dir, 'c4-init-2906.txt'))
  })
})
