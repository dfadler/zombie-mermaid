/**
 * Regression tests for the parse-correctness gaps in the flowchart syntax
 * audit (#198): parallelogram shapes, variable-length edges, invisible links,
 * and `classDef default` auto-apply.
 *
 * What these four have in common is that they previously failed *silently* —
 * mis-parsing into something else rather than raising an error — so each test
 * pins the specific wrong behavior, not just "it works now".
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '../parser.ts'
import { renderMermaidASCII, renderMermaidSVG } from '../index.ts'

/** Parse one flowchart statement and return the resulting graph. */
function parse(statement: string) {
  return parseMermaid(`flowchart TD\n  ${statement}`)
}

describe('parallelogram shapes (#198 row 2)', () => {
  it.each([
    ['A[/lean right/]', 'parallelogram'],
    ['A[\\lean left\\]', 'parallelogram-alt'],
  ])('parses %s as %s', (statement, shape) => {
    const graph = parse(`${statement} --> B`)
    expect(graph.nodes.get('A')?.shape).toBe(shape)
  })

  it.each([
    ['A[/trapezoid\\]', 'trapezoid'],
    ['A[\\trapezoid alt/]', 'trapezoid-alt'],
  ])('does not steal %s from the trapezoids', (statement, shape) => {
    // The four share a `[` prefix and differ only in which slash opens and
    // which closes; a parallelogram's delimiters mirror, a trapezoid's oppose.
    const graph = parse(`${statement} --> B`)
    expect(graph.nodes.get('A')?.shape).toBe(shape)
  })

  it('does not let one slash-bracket shape swallow the rest of the line', () => {
    /*
     * The regression that motivated capturing the closing delimiter: a
     * trapezoid pattern that merely excludes `\]` will run past a `/]` to
     * reach a `\]` later on the same line, matching the entire statement as
     * one node whose label is the whole line — silently eating the edge and
     * the second node.
     */
    const graph = parse('A[/parallelogram/] --> B[\\alt\\]')

    expect([...graph.nodes.keys()].sort()).toEqual(['A', 'B'])
    expect(graph.nodes.get('A')?.shape).toBe('parallelogram')
    expect(graph.nodes.get('A')?.label).toBe('parallelogram')
    expect(graph.nodes.get('B')?.shape).toBe('parallelogram-alt')
    expect(graph.nodes.get('B')?.label).toBe('alt')
    expect(graph.edges).toHaveLength(1)
  })

  it.each([
    ['A[/one/] --> B[\\two\\]', ['parallelogram', 'parallelogram-alt']],
    ['A[/one\\] --> B[\\two/]', ['trapezoid', 'trapezoid-alt']],
    ['A[/one/] --> B[\\two/]', ['parallelogram', 'trapezoid-alt']],
    ['A[/one\\] --> B[\\two\\]', ['trapezoid', 'parallelogram-alt']],
  ])('resolves both shapes in %s independently', (statement, shapes) => {
    const graph = parse(statement)
    expect(graph.nodes.get('A')?.shape).toBe(shapes[0])
    expect(graph.nodes.get('B')?.shape).toBe(shapes[1])
    expect(graph.edges).toHaveLength(1)
  })

  it('preserves the label text', () => {
    expect(parse('A[/lean right/] --> B').nodes.get('A')?.label).toBe(
      'lean right',
    )
    expect(parse('A[\\lean left\\] --> B').nodes.get('A')?.label).toBe(
      'lean left',
    )
  })

  it('renders a polygon in SVG, not a rectangle', () => {
    const svg = renderMermaidSVG('flowchart TD\n  A[/step/] --> B')
    expect(svg).toContain('<polygon')
  })

  /**
   * Points of the node-shape polygon.
   *
   * Not simply the first `<polygon>` in the document: the arrowhead markers
   * in `<defs>` are polygons too, and they come first. Node shapes are
   * rendered last, so take the final match.
   */
  const nodePolygonPoints = (svg: string): string | undefined => {
    const all = [...svg.matchAll(/<polygon points="([^"]+)"/g)]
    return all[all.length - 1]?.[1]
  }

  it('renders both leans as distinct SVG polygons', () => {
    // The two differ only in which corners are inset, so rendering just one
    // would leave the other's geometry unexercised.
    const right = renderMermaidSVG('flowchart TD\n  A[/step/] --> B')
    const left = renderMermaidSVG('flowchart TD\n  A[\\step\\] --> B')

    expect(nodePolygonPoints(right)).toBeDefined()
    expect(nodePolygonPoints(left)).toBeDefined()
    expect(nodePolygonPoints(right)).not.toBe(nodePolygonPoints(left))
  })

  it('gives a parallelogram four points, like the trapezoids', () => {
    const svg = renderMermaidSVG('flowchart TD\n  A[/step/] --> B')
    const points = nodePolygonPoints(svg) ?? ''
    expect(points.trim().split(/\s+/)).toHaveLength(4)
  })

  it('renders sloped corners in ASCII', () => {
    const ascii = renderMermaidASCII('flowchart TD\n  A[/step/] --> B', {
      colorMode: 'none',
    })
    expect(ascii).toContain('step')
    expect(ascii).toContain('/')
  })
})

describe('variable-length edges (#198 row 4)', () => {
  it.each([
    ['A --> B', 'solid', true],
    ['A ---> B', 'solid', true],
    ['A ----> B', 'solid', true],
    ['A -----> B', 'solid', true],
    ['A --- B', 'solid', false],
    ['A ---- B', 'solid', false],
    ['A ----- B', 'solid', false],
    ['A ==> B', 'thick', true],
    ['A ===> B', 'thick', true],
    ['A ====> B', 'thick', true],
    ['A === B', 'thick', false],
    ['A ==== B', 'thick', false],
    ['A -.-> B', 'dotted', true],
    ['A -..-> B', 'dotted', true],
    ['A -...-> B', 'dotted', true],
    ['A -.- B', 'dotted', false],
    ['A -..- B', 'dotted', false],
  ])('parses %s as one %s edge (arrowhead: %s)', (statement, style, arrow) => {
    const graph = parse(statement)

    // The old fixed alternation matched only the shortest run, stranding the
    // surplus dashes as a bogus token and corrupting the next one — which
    // showed up as extra nodes, not as an error.
    expect([...graph.nodes.keys()].sort()).toEqual(['A', 'B'])
    expect(graph.edges).toHaveLength(1)
    expect(graph.edges[0]!.style).toBe(style)
    expect(graph.edges[0]!.hasArrowEnd).toBe(arrow)
  })

  it('treats run length as a layout hint only, not a distinct style', () => {
    expect(parse('A ----> B').edges[0]!.style).toBe(
      parse('A --> B').edges[0]!.style,
    )
  })

  it('still carries a pipe label on a long edge', () => {
    const graph = parse('A ---->|yes| B')
    expect(graph.edges[0]!.label).toBe('yes')
  })
})

describe('invisible links (#198 row 4)', () => {
  it.each(['A ~~~ B', 'A ~~~~ B', 'A ~~~~~ B'])(
    'parses %s as an invisible edge',
    (statement) => {
      const graph = parse(statement)
      expect([...graph.nodes.keys()].sort()).toEqual(['A', 'B'])
      expect(graph.edges).toHaveLength(1)
      expect(graph.edges[0]!.style).toBe('invisible')
      expect(graph.edges[0]!.hasArrowEnd).toBe(false)
      expect(graph.edges[0]!.hasArrowStart).toBe(false)
    },
  )

  it('emits an SVG element that participates in layout but paints nothing', () => {
    const svg = renderMermaidSVG('flowchart TD\n  A ~~~ B')
    const edge = svg.match(/<polyline class="edge"[^>]*>/)?.[0]
    expect(edge).toBeDefined()
    // Kept in the DOM so it stays inspectable and queryable by data-style...
    expect(edge).toContain('data-style="invisible"')
    // ...but with no paint and no arrow markers.
    expect(edge).toContain('stroke="none"')
    expect(edge).not.toContain('marker-end')
    expect(edge).not.toContain('marker-start')
  })

  it('draws no line, connector, or arrowhead in ASCII', () => {
    const invisible = renderMermaidASCII('flowchart TD\n  A ~~~ B', {
      colorMode: 'none',
    })
    const visible = renderMermaidASCII('flowchart TD\n  A --- B', {
      colorMode: 'none',
    })

    // Both nodes still render, and still occupy separate ranks.
    expect(invisible).toContain('A')
    expect(invisible).toContain('B')

    // The visible control has a box connector (┬) and a vertical run (│);
    // the invisible one must have neither.
    expect(visible).toContain('┬')
    expect(invisible).not.toContain('┬')

    // Every row between the bottom of box A and the top of box B must be
    // completely blank — no line, no connector, no arrowhead.
    const rows = invisible.split('\n')
    const boxABottom = rows.findIndex((r) => r.includes('└'))
    const boxBTop = rows.findIndex((r, i) => i > boxABottom && r.includes('┌'))
    expect(boxABottom).toBeGreaterThanOrEqual(0)
    expect(boxBTop).toBeGreaterThan(boxABottom)

    const gapRows = rows.slice(boxABottom + 1, boxBTop)
    expect(gapRows.length).toBeGreaterThan(0)
    for (const row of gapRows) {
      expect(row.trim()).toBe('')
    }
  })
})

describe('classDef default auto-apply (#198 row 8)', () => {
  const source = [
    'flowchart TD',
    '  classDef default fill:#f9f,stroke:#333',
    '  classDef special fill:#bbf',
    '  A --> B',
    '  class B special',
  ].join('\n')

  /**
   * The shape element for one node.
   *
   * Whole-document `toContain` checks are useless for this cascade: with two
   * styled nodes on the page, an assertion that the SVG contains the default
   * stroke passes on node A's copy of it, proving nothing about whether node
   * B kept it while overriding fill. Every assertion below is per-node.
   *
   * Located by string search rather than a constructed regex. The id is a
   * literal here, so there is no real ReDoS exposure, but a `new RegExp` built
   * from a variable trips Semgrep's non-literal-regexp rule — and the pattern
   * bought nothing over indexOf.
   */
  const nodeShape = (svg: string, id: string): string => {
    const marker = `data-id="${id}"`
    const at = svg.indexOf(marker)
    expect(at, `no rendered node with ${marker}`).toBeGreaterThan(-1)

    // Back up to the opening <g, then take everything to its closing tag.
    const open = svg.lastIndexOf('<g', at)
    const close = svg.indexOf('</g>', at)
    expect(open, `no opening <g> for ${marker}`).toBeGreaterThan(-1)
    expect(close, `no closing </g> for ${marker}`).toBeGreaterThan(-1)

    const group = svg.slice(open, close)
    const shape = group.match(/<(rect|polygon|path|circle)[^>]*>/)?.[0]
    expect(shape, `no shape element inside node ${id}`).toBeDefined()
    return shape!
  }

  it('applies classDef default to a node with no class assignment', () => {
    // Previously `default` was inert unless a node named it explicitly, so a
    // diagram styled entirely through it rendered unstyled with no error.
    const a = nodeShape(renderMermaidSVG(source), 'A')
    expect(a).toContain('fill="#f9f"')
    expect(a).toContain('stroke="#333"')
  })

  it("lets a node's own class override the default", () => {
    expect(nodeShape(renderMermaidSVG(source), 'B')).toContain('fill="#bbf"')
  })

  it('merges rather than replaces — default properties survive', () => {
    const graph = parseMermaid(source)
    expect(graph.classDefs.get('default')).toEqual({
      fill: '#f9f',
      stroke: '#333',
    })

    // The point of the cascade: `special` sets only fill, so B must take that
    // fill AND keep the default's stroke. Asserted on B's own element, since
    // A carries both default values and would satisfy a document-wide check.
    const b = nodeShape(renderMermaidSVG(source), 'B')
    expect(b).toContain('fill="#bbf"')
    expect(b).toContain('stroke="#333"')
    expect(b).not.toContain('fill="#f9f"')
  })

  it('is a no-op when no classDef default is declared', () => {
    const svg = renderMermaidSVG('flowchart TD\n  A --> B')
    expect(svg).not.toContain('#f9f')
  })

  it('applies in the ASCII backend too', () => {
    // Both backends resolve classes independently; they must agree.
    const ascii = renderMermaidASCII(source, { colorMode: 'ansi256' })
    expect(ascii).toContain('A')
    expect(ascii).toContain('B')
  })
})

describe('no regression in existing edge forms', () => {
  it.each([
    ['A -- Yes --> B', 'solid', 'Yes'],
    ['A -. Maybe .-> B', 'dotted', 'Maybe'],
    ['A == Sure ==> B', 'thick', 'Sure'],
  ])(
    'still parses the text-embedded label form %s',
    (statement, style, label) => {
      // This is the reason an unmarked `--`/`==` must NOT be treated as an
      // open link: it is the opener of this syntax.
      const graph = parse(statement)
      expect(graph.edges).toHaveLength(1)
      expect(graph.edges[0]!.style).toBe(style)
      expect(graph.edges[0]!.label).toBe(label)
    },
  )

  it.each([
    ['A <--> B', true, true],
    ['A o--o B', true, true],
    ['A x--x B', true, true],
    ['A --o B', false, true],
    ['A --x B', false, true],
  ])('still parses marker form %s', (statement, start, end) => {
    const graph = parse(statement)
    expect(graph.edges).toHaveLength(1)
    expect(graph.edges[0]!.hasArrowStart).toBe(start)
    expect(graph.edges[0]!.hasArrowEnd).toBe(end)
  })

  /**
   * Labelled edges must accept the same run lengths as bare ones.
   *
   * Generalising ARROW_REGEX without generalising TEXT_ARROW_REGEX left
   * `A -- label ----> B` consuming only `---`, stranding `-> B`, which forms
   * no node group — so the edge AND its target node vanished silently. That
   * is the exact failure this row of the audit exists to remove, reintroduced
   * one regex over.
   */
  it.each([
    ['A -- label --> B', 'solid'],
    ['A -- label ---> B', 'solid'],
    ['A -- label ----> B', 'solid'],
    ['A -- label --- B', 'solid'],
    ['A -- label ---- B', 'solid'],
    ['A == label ==> B', 'thick'],
    ['A == label ===> B', 'thick'],
    ['A == label ====> B', 'thick'],
    ['A == label === B', 'thick'],
    ['A -. label .-> B', 'dotted'],
    ['A -. label ..-> B', 'dotted'],
    ['A -. label -.- B', 'dotted'],
  ])('keeps the edge and target for %s', (statement, style) => {
    const graph = parse(statement)
    expect([...graph.nodes.keys()].sort()).toEqual(['A', 'B'])
    expect(graph.edges).toHaveLength(1)
    expect(graph.edges[0]!.style).toBe(style)
    expect(graph.edges[0]!.label).toBe('label')
  })

  it('still parses a no-space arrow', () => {
    const graph = parse('A-->B')
    expect([...graph.nodes.keys()].sort()).toEqual(['A', 'B'])
    expect(graph.edges).toHaveLength(1)
  })

  it('still parses chained and parallel links', () => {
    expect(parse('A-->B-->C').edges).toHaveLength(2)
    expect(parse('A --> B & C').edges).toHaveLength(2)
  })
})
