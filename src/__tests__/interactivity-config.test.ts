/**
 * Tests for the interactivity and configuration rows of the flowchart syntax
 * audit (#198): `click` (row 10), markdown label strings (row 12), curve
 * styles (row 9), edge IDs and animation (row 6), and `%%{init:...}%%`
 * config directives (row 17).
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '../parser.ts'
import { renderMermaidSVG } from '../index.ts'
import {
  parseInitDirective,
  extractInitConfig,
  applyInitConfig,
  describeIgnored,
  isInitDirective,
} from '../init-directive.ts'
import { pointsToPath } from '../edge-curves.ts'

describe('%%{init: ...}%% directives (#198 row 17)', () => {
  it('recognizes both init and initialize spellings', () => {
    expect(isInitDirective('%%{init: {"theme": "dark"}}%%')).toBe(true)
    expect(isInitDirective('%%{initialize: {"theme": "dark"}}%%')).toBe(true)
    expect(isInitDirective('%% an ordinary comment')).toBe(false)
  })

  it('parses strict JSON', () => {
    expect(parseInitDirective('%%{init: {"theme": "dark"}}%%')?.theme).toBe(
      'dark',
    )
  })

  it("parses Mermaid's relaxed JSON — single quotes and bare keys", () => {
    // JSON.parse rejects both forms; Mermaid accepts them, so they are
    // normalized before parsing.
    expect(
      parseInitDirective("%%{init: {'flowchart': {'curve': 'basis'}}}%%")
        ?.curve,
    ).toBe('basis')
    expect(
      parseInitDirective('%%{init: {flowchart: {curve: step}}}%%')?.curve,
    ).toBe('step')
  })

  it('keeps a colon or brace inside a quoted value intact', () => {
    expect(parseInitDirective('%%{init: {"theme": "a:b"}}%%')?.theme).toBe(
      'a:b',
    )
  })

  it.each([
    ['escaped double quote', String.raw`{"theme": "a\"b"}`, 'a"b'],
    ['escaped backslash', String.raw`{"theme": "a\\b"}`, 'a\\b'],
    ['escaped newline', String.raw`{"theme": "a\nb"}`, 'a\nb'],
    ["single-quoted \\'", String.raw`{'theme': 'a\'b'}`, "a'b"],
  ])('preserves an %s inside a string', (_name, payload, expected) => {
    /*
     * The relaxed-JSON scanner re-emits strings with double quotes. Treating
     * a backslash as an ordinary character lets the quote it protects read as
     * the string's end, so the re-emitted payload is unbalanced and the whole
     * directive is silently dropped — including strictly valid JSON.
     */
    expect(parseInitDirective(`%%{init: ${payload}}%%`)?.theme).toBe(expected)
  })

  it('ignores a malformed directive rather than throwing', () => {
    // Config is advisory; failing a whole diagram over a stray brace would be
    // a poor trade.
    expect(parseInitDirective('%%{init: {malformed]}%%')).toBeUndefined()
    expect(() =>
      renderMermaidSVG('%%{init: {malformed]}%%\nflowchart TD\n  A --> B'),
    ).not.toThrow()
  })

  it('rejects an unrecognized curve name instead of passing it through', () => {
    expect(
      parseInitDirective('%%{init: {"flowchart": {"curve": "nope"}}}%%')?.curve,
    ).toBeUndefined()
  })

  it('reports keys it parsed but deliberately does not act on', () => {
    const config = parseInitDirective(
      '%%{init: {"securityLevel": "loose", "defaultRenderer": "dagre"}}%%',
    )
    expect(config?.ignored).toContain('securityLevel')
    expect(config?.ignored).toContain('defaultRenderer')

    const described = describeIgnored(config!)
    expect(described.join(' ')).toMatch(/never executes diagram-supplied/)
    expect(described.join(' ')).toMatch(/ELK is the only layout engine/)
  })

  it('lets a later directive override an earlier one', () => {
    const merged = extractInitConfig([
      '%%{init: {"flowchart": {"curve": "basis"}}}%%',
      '%%{init: {"flowchart": {"curve": "step"}}}%%',
    ])
    expect(merged.curve).toBe('step')
  })

  it('never overrides an explicit render option', () => {
    // A directive supplies a default. The caller is closer to the user's
    // intent than text embedded in a possibly-untrusted diagram.
    const options = applyInitConfig(
      { curve: 'linear' },
      { curve: 'basis', ignored: [] },
    )
    expect(options.curve).toBe('linear')
  })

  it('supplies a default when the caller gave none', () => {
    expect(applyInitConfig({}, { curve: 'basis', ignored: [] }).curve).toBe(
      'basis',
    )
  })

  it('is read even though it starts with the comment marker', () => {
    // `%%{init:...}%%` begins with `%%`, so it must be extracted before
    // comment lines are filtered out.
    const graph = parseMermaid(
      '%%{init: {"flowchart": {"curve": "basis"}}}%%\nflowchart TD\n  A --> B',
    )
    expect(graph.initConfig?.curve).toBe('basis')
  })
})

describe('edge curve styles (#198 row 9)', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
    { x: 20, y: 0 },
  ]

  it('produces straight segments for linear', () => {
    expect(pointsToPath(points, 'linear')).toBe('M 0 0 L 10 10 L 20 0')
  })

  it('produces cubic segments for basis', () => {
    expect(pointsToPath(points, 'basis')).toContain(' C ')
  })

  /*
   * Exact geometry, not just "contains a C". The point of `basis` is that a
   * diagram traces the path Mermaid would draw, so an approximation that
   * merely looks smooth is still wrong. These values were taken from
   * d3-shape 3.2.0's own `curveBasis` output for the same points — d3
   * serializes at 3 decimals, hence the rounding.
   *
   * An earlier implementation led in at the midpoint `(p0 + p1) / 2` and
   * emitted a single cubic ending at `(p1 + p2) / 2`; it satisfied every
   * other test in this file while drawing a different curve.
   */
  it('matches d3 curveBasis geometry exactly', () => {
    const round = (d: string) =>
      (d.match(/[MLC]|-?\d+(?:\.\d+)?/g) ?? []).map((t) =>
        /[MLC]/.test(t) ? t : +(+t).toFixed(3),
      )

    // prettier-ignore
    expect(round(pointsToPath(points, 'basis'))).toEqual([
      'M', 0, 0,
      'L', 1.667, 1.667,
      'C', 3.333, 3.333, 6.667, 6.667, 10, 6.667,
      'C', 13.333, 6.667, 16.667, 3.333, 18.333, 1.667,
      'L', 20, 0,
    ])
  })

  it('emits one basis segment per point beyond the first two', () => {
    // d3 draws a cubic per point from the third onward, plus a closing cubic
    // against a repeated last point. Four points therefore give three.
    const four = [
      { x: 0, y: 0 },
      { x: 0, y: 50 },
      { x: 60, y: 50 },
      { x: 60, y: 90 },
    ]
    const cubics = (pointsToPath(four, 'basis').match(/ C /g) ?? []).length
    expect(cubics).toBe(3)
  })

  it('produces rounded corners for natural', () => {
    // Deliberately corner-rounding rather than d3's interpolating natural
    // spline: at the 90° bends ELK produces, any C1-smooth interpolating
    // spline must overshoot the corner, which showed up as a teardrop loop
    // below a decision node. See naturalPath's comment.
    expect(pointsToPath(points, 'natural')).toContain(' Q ')
  })

  it('never overshoots a right-angle corner under natural', () => {
    // The overshoot regression: the path must stay within the bounding box
    // of the routed points, with no excursion past the corner.
    const corner = [
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 0, y: 50 },
    ]
    const path = pointsToPath(corner, 'natural')
    const coords = [...path.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)]
    for (const [, x, y] of coords) {
      expect(Number(x)).toBeGreaterThanOrEqual(0)
      expect(Number(x)).toBeLessThanOrEqual(100)
      expect(Number(y)).toBeGreaterThanOrEqual(0)
      expect(Number(y)).toBeLessThanOrEqual(50)
    }
  })

  it('never lets adjacent natural fillets overlap', () => {
    // A radius larger than half a leg would invert the path; the radius is
    // clamped to half the shorter adjacent leg.
    const tight = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 8, y: 4 },
    ]
    const path = pointsToPath(tight, 'natural')
    const xs = [...path.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map(
      (m) => Number(m[1]),
    )
    // Monotonic in x for this route — an inverted fillet would break that.
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]!).toBeGreaterThanOrEqual(xs[i - 1]!)
    }
  })

  it.each(['step', 'stepBefore', 'stepAfter'] as const)(
    'produces only right angles for %s',
    (curve) => {
      const path = pointsToPath(points, curve)
      expect(path).not.toContain('C')
      expect(path).toContain('L')
    },
  )

  it('starts and ends at the routed endpoints for every curve', () => {
    // A B-spline approximates rather than interpolates, so without explicit
    // endpoint handling a basis edge would visibly detach from its nodes.
    for (const curve of [
      'linear',
      'basis',
      'natural',
      'step',
      'stepBefore',
      'stepAfter',
    ] as const) {
      const path = pointsToPath(points, curve)
      expect(path.startsWith('M 0 0'), `${curve} start`).toBe(true)
      expect(path.trimEnd().endsWith('20 0'), `${curve} end`).toBe(true)
    }
  })

  it('degrades gracefully for short point lists', () => {
    expect(pointsToPath([], 'basis')).toBe('')
    expect(pointsToPath([{ x: 1, y: 2 }], 'basis')).toBe('M 1 2')
    expect(pointsToPath(points.slice(0, 2), 'basis')).toBe('M 0 0 L 10 10')
  })

  /*
   * State diagrams reach the flowchart branch of renderMermaidSVG's dispatch
   * via parseMermaid, so they pick up both the curve option and the init
   * directive. RenderOptions.curve documents that; these pin it, since the
   * plumbing is a fall-through rather than an explicit case.
   */
  describe('state diagrams honour curve as documented', () => {
    // Branching so ELK routes with bends — a two-point edge has no curve to
    // draw and would fall back to a straight line whatever the setting.
    const branching = [
      'stateDiagram-v2',
      '  [*] --> Idle',
      '  Idle --> Running',
      '  Idle --> Paused',
      '  Running --> Done',
      '  Paused --> Done',
    ].join('\n')

    it('draws straight polylines by default', () => {
      const svg = renderMermaidSVG(branching)
      expect(svg).toContain('<polyline class="edge"')
      expect(svg).not.toContain('<path class="edge"')
    })

    it('applies an explicit curve option', () => {
      const svg = renderMermaidSVG(branching, { curve: 'basis' })
      expect(svg).toContain('<path class="edge"')
      expect(svg).toContain(' C ')
    })

    it('applies a curve from the diagram’s own init directive', () => {
      const svg = renderMermaidSVG(
        `%%{init: {"flowchart": {"curve": "basis"}}}%%\n${branching}`,
      )
      expect(svg).toContain('<path class="edge"')
      expect(svg).toContain(' C ')
    })
  })

  it('keeps emitting <polyline> for the default linear curve', () => {
    // Changing the element for every diagram would break consumers selecting
    // `polyline.edge`, for no benefit to a diagram that asked for no curve.
    const svg = renderMermaidSVG('flowchart TD\n  A --> B')
    expect(svg).toContain('<polyline class="edge"')
    expect(svg).not.toContain('<path class="edge"')
  })

  it('switches to <path> only when a curve is requested', () => {
    const svg = renderMermaidSVG(
      '%%{init: {"flowchart": {"curve": "basis"}}}%%\nflowchart TD\n  A --> B --> C',
    )
    expect(svg).toContain('<path class="edge"')
    expect(svg).not.toContain('<polyline class="edge"')
  })
})

describe('click interactions (#198 row 10)', () => {
  const parseClick = (statement: string) =>
    parseMermaid(`flowchart TD\n  A --> B\n  ${statement}`).interactions.get(
      'A',
    )

  it.each([
    ['click A "https://example.com"', { href: 'https://example.com' }],
    [
      'click A "https://example.com" "Go to example"',
      { href: 'https://example.com', tooltip: 'Go to example' },
    ],
    [
      'click A "https://example.com" _blank',
      { href: 'https://example.com', target: '_blank' },
    ],
    [
      'click A href "https://example.com" "Tip" _blank',
      { href: 'https://example.com', tooltip: 'Tip', target: '_blank' },
    ],
    ['click A call myHandler()', { callback: 'myHandler()' }],
    [
      'click A call myHandler() "With tooltip"',
      { callback: 'myHandler()', tooltip: 'With tooltip' },
    ],
  ])('parses %s', (statement, expected) => {
    expect(parseClick(statement)).toEqual(expected)
  })

  it('renders an href as a real SVG link with target', () => {
    const svg = renderMermaidSVG(
      'flowchart TD\n  A --> B\n  click A "https://example.com" _blank',
    )
    expect(svg).toContain('<a href="https://example.com" target="_blank">')
    expect(svg).toContain('</a>')
  })

  it('renders a tooltip as a <title>, which needs no script', () => {
    const svg = renderMermaidSVG(
      'flowchart TD\n  A --> B\n  click A "https://example.com" "Helpful"',
    )
    expect(svg).toContain('<title>Helpful</title>')
  })

  it('escapes a tooltip containing markup', () => {
    const svg = renderMermaidSVG(
      'flowchart TD\n  A --> B\n  click A "https://x.test" "a <b> & c"',
    )
    expect(svg).not.toContain('<title>a <b>')
    expect(svg).toContain('&lt;b&gt;')
  })

  describe('href sanitization', () => {
    it.each([
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
    ])('drops the script-capable scheme %s', (href) => {
      const svg = renderMermaidSVG(
        `flowchart TD\n  A --> B\n  click A "${href}"`,
      )
      // Diagram text may be untrusted; an executable href would make any page
      // that inlines this SVG vulnerable.
      expect(svg).not.toContain('<a href=')
      expect(svg.toLowerCase()).not.toContain('javascript:')
      expect(svg.toLowerCase()).not.toContain('vbscript:')
    })

    /*
     * The URL parser strips tab and newline from anywhere in a URL, so a
     * blocked scheme split by one reaches the browser reassembled:
     * `java\tscript:` parses with protocol `javascript:`. The scheme match
     * meanwhile sees `java\t...`, finds no scheme, and treats the whole thing
     * as a harmless relative reference — which is the bypass.
     */
    it.each([
      ['tab', '\t'],
      ['vertical tab', '\v'],
      ['form feed', '\f'],
      ['NUL', '\x00'],
      ['unit separator', '\x1F'],
    ])('drops a scheme split by a literal %s', (_name, control) => {
      const href = `java${control}script:alert(1)`
      const svg = renderMermaidSVG(
        `flowchart TD\n  A --> B\n  click A "${href}"`,
      )
      expect(svg).not.toContain('<a href=')
    })

    it('drops the tab payload a browser would reassemble into javascript:', () => {
      const href = 'java\tscript:alert(1)'
      // Guard the premise: if the URL parser ever stops stripping tabs, this
      // payload is no longer dangerous and the test above is measuring nothing.
      expect(new URL(href, 'https://example.test/').protocol).toBe(
        'javascript:',
      )

      const svg = renderMermaidSVG(
        `flowchart TD\n  A --> B\n  click A "${href}"`,
      )
      expect(svg).not.toContain('<a href=')
    })

    it.each([
      'https://example.com',
      'http://example.com',
      'mailto:a@b.test',
      '/relative/path',
      './sibling',
      '#anchor',
    ])('keeps the safe href %s', (href) => {
      const svg = renderMermaidSVG(
        `flowchart TD\n  A --> B\n  click A "${href}"`,
      )
      expect(svg).toContain('<a href=')
    })
  })

  it('records a callback as data but never emits executable script', () => {
    const svg = renderMermaidSVG(
      'flowchart TD\n  A --> B\n  click A call handler()',
    )
    expect(svg).toContain('data-click-callback="handler()"')
    expect(svg).not.toContain('<script')
    expect(svg).not.toContain('onclick')
  })

  it('leaves nodes without a click statement untouched', () => {
    const svg = renderMermaidSVG('flowchart TD\n  A --> B')
    expect(svg).not.toContain('<a href=')
    expect(svg).not.toContain('data-click-callback')
  })
})

describe('markdown label strings (#198 row 12)', () => {
  const labelOf = (statement: string) =>
    parseMermaid(`flowchart TD\n  ${statement}`).nodes.get('A')?.label

  it.each([
    ['A["**bold**"] --> B', '<b>bold</b>'],
    ['A["*italic*"] --> B', '<i>italic</i>'],
    ['A["~~strike~~"] --> B', '<s>strike</s>'],
  ])('converts %s (already supported before this change)', (stmt, expected) => {
    expect(labelOf(stmt)).toBe(expected)
  })

  it('unwraps Mermaid’s backtick-delimited markdown string', () => {
    // This was the actual gap: the markdown conversion already ran, but the
    // backticks were left in the label as literal characters.
    expect(labelOf('A["`**bold**`"] --> B')).toBe('<b>bold</b>')
    expect(labelOf('A["`plain`"] --> B')).toBe('plain')
  })

  it('leaves an interior backtick alone', () => {
    expect(labelOf('A["use `code` here"] --> B')).toBe('use `code` here')
  })
})

describe('edge IDs and animation (#198 row 6)', () => {
  it('parses an edge id prefix', () => {
    const graph = parseMermaid('flowchart TD\n  A e1@--> B')
    expect(graph.edges[0]!.id).toBe('e1')
    // The id must not leak into the node set.
    expect([...graph.nodes.keys()].sort()).toEqual(['A', 'B'])
  })

  it.each([
    ['e1@{ animate: true }', true],
    ['e1@{ animate: false }', false],
    ['e1@{ animation: fast }', true],
  ])('applies %s', (meta, expected) => {
    const graph = parseMermaid(`flowchart TD\n  A e1@--> B\n  ${meta}`)
    expect(graph.edges[0]!.animate).toBe(expected)
  })

  it('emits the id as data-id for CSS targeting', () => {
    expect(renderMermaidSVG('flowchart TD\n  A e1@--> B')).toContain(
      'data-id="e1"',
    )
  })

  it('animates via CSS keyframes, guarded for reduced motion', () => {
    const svg = renderMermaidSVG(
      'flowchart TD\n  A e1@--> B\n  e1@{ animate: true }',
    )
    expect(svg).toContain('class="edge edge-animated"')
    expect(svg).toContain('@keyframes zm-edge-dash')
    // Users who asked the system for less movement get a still edge.
    expect(svg).toContain('prefers-reduced-motion')
    // SMIL is deprecated in browsers; CSS degrades to a first frame in
    // static rasterizers.
    expect(svg).not.toContain('<animate')
  })

  it('omits the keyframes entirely when no edge is animated', () => {
    expect(renderMermaidSVG('flowchart TD\n  A --> B')).not.toContain(
      'zm-edge-dash',
    )
  })

  it('does not mistake a node metadata block for edge metadata', () => {
    // `A@{ shape: ... }` and `e1@{ animate: ... }` share a syntax; only an
    // id already declared as an edge id routes to the edge handler.
    const graph = parseMermaid(
      'flowchart TD\n  A@{ shape: doc } e1@--> B\n  e1@{ animate: true }',
    )
    expect(graph.nodes.get('A')?.shape).toBe('document')
    expect(graph.edges[0]!.animate).toBe(true)
  })
})

describe('no regression in ordinary diagrams', () => {
  it('renders an unconfigured diagram exactly as before', () => {
    const svg = renderMermaidSVG('flowchart TD\n  A[Start] --> B{Choice}')
    expect(svg).toContain('<polyline class="edge"')
    expect(svg).not.toContain('zm-edge-dash')
    expect(svg).not.toContain('<a href=')
    expect(svg).toContain('Start')
  })

  it('still parses statements that merely start with click-like words', () => {
    const graph = parseMermaid('flowchart TD\n  clicker --> B')
    expect([...graph.nodes.keys()].sort()).toEqual(['B', 'clicker'])
  })
})
