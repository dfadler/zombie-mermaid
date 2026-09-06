/**
 * Tests for `RenderOptions.direction` / `AsciiRenderOptions.direction`
 * (issue #276) — a render-time override of a diagram's top-level layout
 * direction.
 *
 * Covers:
 *   - flowchart, state, and ER diagrams re-lay out along the overridden
 *     axis (asserted geometrically from node/entity positions in the SVG,
 *     and from the output shape in ASCII)
 *   - the override is exactly equivalent to writing that direction in the
 *     source header — byte-identical output to the rewritten source
 *   - a nested subgraph's own `direction` still applies on top of the
 *     override, the same way it applies on top of the header
 *   - `parseMermaid()` output and the parsed object handed to layout are
 *     never mutated
 *   - sequence, class, and xychart diagrams ignore the option (byte-identical
 *     output), as does the ASCII ER renderer (which has no direction concept)
 *   - an unrecognized value from a plain-JS caller is ignored, not thrown on
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG, renderMermaidASCII, parseMermaid } from '../index.ts'
import { withDirectionOverride } from '../direction-override.ts'
import type { Direction, RenderOptions } from '../types.ts'
import type { AsciiRenderOptions } from '../ascii/index.ts'

/**
 * Top-left corner of the first `<rect>` inside the `<g class="{cls}"
 * data-id="{id}">` group — a node (flowchart/state) or an entity (ER).
 * Plain string search rather than a dynamically-built RegExp, matching the
 * convention in `nested-subgraph-direction-crossing.test.ts`.
 */
function boxOrigin(
  svg: string,
  cls: string,
  id: string,
): { x: number; y: number } {
  const marker = `<g class="${cls}" data-id="${id}"`
  const groupStart = svg.indexOf(marker)
  if (groupStart < 0) throw new Error(`${cls} ${id} not found in SVG`)
  const rectStart = svg.indexOf('<rect', groupStart)
  const rectEnd = svg.indexOf('>', rectStart)
  const rectTag = svg.slice(rectStart, rectEnd + 1)
  const num = (attr: string): number => {
    const needle = `${attr}="`
    const start = rectTag.indexOf(needle)
    if (start < 0) throw new Error(`attribute ${attr} not found on ${rectTag}`)
    const valueStart = start + needle.length
    return Number(rectTag.slice(valueStart, rectTag.indexOf('"', valueStart)))
  }
  return { x: num('x'), y: num('y') }
}

/** True when `b` sits strictly below `a` on the same column. */
function isBelow(a: { x: number; y: number }, b: { x: number; y: number }) {
  return b.y > a.y && b.x === a.x
}

/** True when `b` sits strictly right of `a` on the same row. */
function isRightOf(a: { x: number; y: number }, b: { x: number; y: number }) {
  return b.x > a.x && b.y === a.y
}

/** Line index (0-based) of the first output line containing `label`. */
function asciiRowOf(ascii: string, label: string): number {
  const row = ascii.split('\n').findIndex((line) => line.includes(label))
  if (row < 0) throw new Error(`label ${label} not found in ASCII output`)
  return row
}

const FLOWCHART_LR = 'graph LR\n  A --> B'
const FLOWCHART_TD = 'graph TD\n  A --> B'
const STATE_LR = 'stateDiagram-v2\n  direction LR\n  A --> B'
const STATE_TB = 'stateDiagram-v2\n  direction TB\n  A --> B'
const ER_TB = 'erDiagram\n  direction TB\n  A ||--o{ B : has'
const ER_LR = 'erDiagram\n  direction LR\n  A ||--o{ B : has'
const ER_NO_DIRECTION = 'erDiagram\n  A ||--o{ B : has'

const ASCII_PLAIN = { colorMode: 'none' } as const

// ============================================================================
// SVG — flowchart
// ============================================================================

describe('RenderOptions.direction – flowchart (SVG)', () => {
  it('lays an LR source out top-down under { direction: "TB" }', () => {
    const svg = renderMermaidSVG(FLOWCHART_LR, { direction: 'TB' })
    expect(
      isBelow(boxOrigin(svg, 'node', 'A'), boxOrigin(svg, 'node', 'B')),
    ).toBe(true)
  })

  it('lays a TD source out left-to-right under { direction: "LR" }', () => {
    const svg = renderMermaidSVG(FLOWCHART_TD, { direction: 'LR' })
    expect(
      isRightOf(boxOrigin(svg, 'node', 'A'), boxOrigin(svg, 'node', 'B')),
    ).toBe(true)
  })

  it('without the option the source direction still applies', () => {
    const svg = renderMermaidSVG(FLOWCHART_LR)
    expect(
      isRightOf(boxOrigin(svg, 'node', 'A'), boxOrigin(svg, 'node', 'B')),
    ).toBe(true)
  })

  it('is byte-identical to writing the direction in the header', () => {
    expect(renderMermaidSVG(FLOWCHART_LR, { direction: 'TD' })).toBe(
      renderMermaidSVG(FLOWCHART_TD),
    )
    expect(renderMermaidSVG(FLOWCHART_TD, { direction: 'LR' })).toBe(
      renderMermaidSVG(FLOWCHART_LR),
    )
  })

  it('accepts every Direction value', () => {
    const directions: Direction[] = ['TD', 'TB', 'BT', 'LR', 'RL']
    for (const direction of directions) {
      expect(renderMermaidSVG(FLOWCHART_LR, { direction })).toBe(
        renderMermaidSVG(`graph ${direction}\n  A --> B`),
      )
    }
  })

  it('a nested subgraph direction still applies on top of the override', () => {
    // Top-level LR in the source; S keeps its own LR; T inherits the top level.
    const source = [
      'graph LR',
      '  subgraph S',
      '    direction LR',
      '    A --> B',
      '  end',
      '  subgraph T',
      '    C --> D',
      '  end',
    ].join('\n')
    const svg = renderMermaidSVG(source, { direction: 'TB' })
    // S's own `direction LR` wins locally: A → B stays horizontal.
    expect(
      isRightOf(boxOrigin(svg, 'node', 'A'), boxOrigin(svg, 'node', 'B')),
    ).toBe(true)
    // T has no override, so it follows the (overridden) top level: C → D
    // is now vertical.
    expect(
      isBelow(boxOrigin(svg, 'node', 'C'), boxOrigin(svg, 'node', 'D')),
    ).toBe(true)
    // …and this is exactly what the source with a TB header produces.
    expect(svg).toBe(renderMermaidSVG(source.replace('graph LR', 'graph TB')))
  })
})

// ============================================================================
// SVG — state diagram
// ============================================================================

describe('RenderOptions.direction – state diagram (SVG)', () => {
  it('overrides a top-level `direction LR` line', () => {
    const svg = renderMermaidSVG(STATE_LR, { direction: 'TB' })
    expect(
      isBelow(boxOrigin(svg, 'node', 'A'), boxOrigin(svg, 'node', 'B')),
    ).toBe(true)
  })

  it('overrides a top-level `direction TB` line', () => {
    const svg = renderMermaidSVG(STATE_TB, { direction: 'LR' })
    expect(
      isRightOf(boxOrigin(svg, 'node', 'A'), boxOrigin(svg, 'node', 'B')),
    ).toBe(true)
  })

  it('is byte-identical to writing the direction in the source', () => {
    expect(renderMermaidSVG(STATE_LR, { direction: 'TB' })).toBe(
      renderMermaidSVG(STATE_TB),
    )
  })

  it('a composite state direction still applies on top of the override', () => {
    const source = [
      'stateDiagram-v2',
      '  direction LR',
      '  state S {',
      '    direction LR',
      '    A --> B',
      '  }',
      '  state T {',
      '    C --> D',
      '  }',
    ].join('\n')
    const svg = renderMermaidSVG(source, { direction: 'TB' })
    expect(
      isRightOf(boxOrigin(svg, 'node', 'A'), boxOrigin(svg, 'node', 'B')),
    ).toBe(true)
    expect(
      isBelow(boxOrigin(svg, 'node', 'C'), boxOrigin(svg, 'node', 'D')),
    ).toBe(true)
    expect(svg).toBe(
      renderMermaidSVG(
        source.replace(
          '  direction LR\n  state S',
          '  direction TB\n  state S',
        ),
      ),
    )
  })
})

// ============================================================================
// SVG — ER diagram
// ============================================================================

describe('RenderOptions.direction – ER diagram (SVG)', () => {
  it('overrides a top-level `direction TB` line', () => {
    const svg = renderMermaidSVG(ER_TB, { direction: 'LR' })
    expect(
      isRightOf(boxOrigin(svg, 'entity', 'A'), boxOrigin(svg, 'entity', 'B')),
    ).toBe(true)
  })

  it('overrides a top-level `direction LR` line', () => {
    const svg = renderMermaidSVG(ER_LR, { direction: 'TB' })
    expect(
      isBelow(boxOrigin(svg, 'entity', 'A'), boxOrigin(svg, 'entity', 'B')),
    ).toBe(true)
  })

  it('applies to an ER diagram with no `direction` line of its own', () => {
    // ER diagrams default to LR; the option supplies a direction where the
    // source had none.
    const svg = renderMermaidSVG(ER_NO_DIRECTION, { direction: 'TB' })
    expect(
      isBelow(boxOrigin(svg, 'entity', 'A'), boxOrigin(svg, 'entity', 'B')),
    ).toBe(true)
    expect(svg).toBe(renderMermaidSVG(ER_TB))
  })

  it('is byte-identical to writing the direction in the source', () => {
    expect(renderMermaidSVG(ER_TB, { direction: 'LR' })).toBe(
      renderMermaidSVG(ER_LR),
    )
  })
})

// ============================================================================
// SVG — diagram types with no direction concept
// ============================================================================

describe('RenderOptions.direction – ignored by sequence/class/xychart', () => {
  const cases: Array<[string, string]> = [
    ['sequence', 'sequenceDiagram\n  A->>B: hi\n  B-->>A: ok'],
    ['class', 'classDiagram\n  class A\n  class B\n  A <|-- B'],
    ['xychart', 'xychart-beta\n  x-axis [a, b, c]\n  bar [1, 2, 3]'],
  ]

  it.each(cases)(
    '%s output is byte-identical with the option set',
    (_, source) => {
      expect(renderMermaidSVG(source, { direction: 'LR' })).toBe(
        renderMermaidSVG(source),
      )
      expect(renderMermaidSVG(source, { direction: 'TB' })).toBe(
        renderMermaidSVG(source),
      )
    },
  )
})

// ============================================================================
// Parsed output is untouched
// ============================================================================

describe('RenderOptions.direction – parse output is unaffected', () => {
  it('parseMermaid still reports the source direction', () => {
    expect(parseMermaid(FLOWCHART_LR).direction).toBe('LR')
    expect(parseMermaid(STATE_LR).direction).toBe('LR')
  })

  it('withDirectionOverride clones rather than mutating the parsed graph', () => {
    const graph = parseMermaid(FLOWCHART_LR)
    const overridden = withDirectionOverride(graph, 'TB')
    expect(overridden).not.toBe(graph)
    expect(overridden.direction).toBe('TB')
    expect(graph.direction).toBe('LR')
    // Everything else is shared, not deep-copied.
    expect(overridden.nodes).toBe(graph.nodes)
    expect(overridden.edges).toBe(graph.edges)
    expect(overridden.subgraphs).toBe(graph.subgraphs)
  })

  it('withDirectionOverride returns the same object when there is nothing to apply', () => {
    const graph = parseMermaid(FLOWCHART_LR)
    expect(withDirectionOverride(graph, undefined)).toBe(graph)
  })

  it('an unrecognized runtime value is ignored rather than thrown on', () => {
    // `Direction` is a compile-time guarantee only. Options that arrive as
    // JSON (a config file, an HTTP body, a plain-JS caller) can carry any
    // string — `JSON.parse` here models exactly that untyped boundary,
    // which is why no `as Direction` assertion is needed to reach it.
    const untypedOptions: RenderOptions = JSON.parse('{"direction":"lr"}')
    expect(renderMermaidSVG(FLOWCHART_LR, untypedOptions)).toBe(
      renderMermaidSVG(FLOWCHART_LR),
    )
    const untypedAsciiOptions: AsciiRenderOptions = JSON.parse(
      '{"direction":"lr","colorMode":"none"}',
    )
    expect(renderMermaidASCII(FLOWCHART_LR, untypedAsciiOptions)).toBe(
      renderMermaidASCII(FLOWCHART_LR, ASCII_PLAIN),
    )
  })

  it('a second render without the option sees the source direction again', () => {
    const withOverride = renderMermaidSVG(FLOWCHART_LR, { direction: 'TB' })
    const plain = renderMermaidSVG(FLOWCHART_LR)
    expect(withOverride).not.toBe(plain)
    expect(plain).toBe(renderMermaidSVG(FLOWCHART_LR))
  })
})

// ============================================================================
// ASCII
// ============================================================================

describe('AsciiRenderOptions.direction – flowchart/state (ASCII)', () => {
  it('stacks an LR source vertically under { direction: "TB" }', () => {
    const ascii = renderMermaidASCII(FLOWCHART_LR, {
      ...ASCII_PLAIN,
      direction: 'TB',
    })
    expect(asciiRowOf(ascii, 'B')).toBeGreaterThan(asciiRowOf(ascii, 'A'))
    expect(ascii).toBe(renderMermaidASCII(FLOWCHART_TD, ASCII_PLAIN))
  })

  it('lays a TD source out on one row under { direction: "LR" }', () => {
    const ascii = renderMermaidASCII(FLOWCHART_TD, {
      ...ASCII_PLAIN,
      direction: 'LR',
    })
    expect(asciiRowOf(ascii, 'B')).toBe(asciiRowOf(ascii, 'A'))
    expect(ascii).toBe(renderMermaidASCII(FLOWCHART_LR, ASCII_PLAIN))
  })

  it('applies BT (the post-draw vertical flip) from the override', () => {
    const ascii = renderMermaidASCII(FLOWCHART_LR, {
      ...ASCII_PLAIN,
      direction: 'BT',
    })
    // Flow runs bottom→top: B (the target) is drawn above A.
    expect(asciiRowOf(ascii, 'B')).toBeLessThan(asciiRowOf(ascii, 'A'))
    expect(ascii).toBe(renderMermaidASCII('graph BT\n  A --> B', ASCII_PLAIN))
  })

  it('overrides a state diagram top-level `direction` line', () => {
    const ascii = renderMermaidASCII(STATE_LR, {
      ...ASCII_PLAIN,
      direction: 'TB',
    })
    expect(asciiRowOf(ascii, 'B')).toBeGreaterThan(asciiRowOf(ascii, 'A'))
    expect(ascii).toBe(renderMermaidASCII(STATE_TB, ASCII_PLAIN))
  })

  it('a nested subgraph direction still applies on top of the override', () => {
    const source = [
      'graph LR',
      '  subgraph S',
      '    direction LR',
      '    A --> B',
      '  end',
      '  subgraph T',
      '    C --> D',
      '  end',
    ].join('\n')
    expect(
      renderMermaidASCII(source, { ...ASCII_PLAIN, direction: 'TB' }),
    ).toBe(
      renderMermaidASCII(source.replace('graph LR', 'graph TB'), ASCII_PLAIN),
    )
  })

  it('is ignored by sequence, class, xychart, and ER ASCII output', () => {
    const sources = [
      'sequenceDiagram\n  A->>B: hi',
      'classDiagram\n  class A\n  class B\n  A <|-- B',
      'xychart-beta\n  x-axis [a, b, c]\n  bar [1, 2, 3]',
      // The ASCII ER layout has no direction concept — it already ignores
      // the source's own `direction` line — so the override is a no-op too.
      ER_TB,
      ER_LR,
    ]
    for (const source of sources) {
      expect(
        renderMermaidASCII(source, { ...ASCII_PLAIN, direction: 'TB' }),
      ).toBe(renderMermaidASCII(source, ASCII_PLAIN))
      expect(
        renderMermaidASCII(source, { ...ASCII_PLAIN, direction: 'LR' }),
      ).toBe(renderMermaidASCII(source, ASCII_PLAIN))
    }
  })
})
