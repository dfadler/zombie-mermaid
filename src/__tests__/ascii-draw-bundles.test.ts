/**
 * Coverage for src/ascii/draw-bundles.ts — fan-in/fan-out edge bundle
 * rendering (shared trunks, junction characters, box-start connectors,
 * arrowheads).
 *
 * Many branches in this file are unreachable through any real Mermaid
 * diagram: edge-bundling.ts only creates bundles for TD graphs, and by
 * construction always aligns a bundle's junction/shared-trunk x (or y)
 * coordinate with the shared node's, so the shared trunk is always a
 * straight line and a fan-in edge always exits its source moving "down".
 * The tests below build a real bundle via the actual layout pipeline
 * (so canvas/grid state is authentic) and then mutate its path arrays to
 * exercise the geometry this file is documented to handle but that never
 * occurs today — verifying the drawing functions still do the right thing
 * with that input.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '../parser.ts'
import { convertToAsciiGraph } from '../ascii/converter.ts'
import { createMapping } from '../ascii/grid.ts'
import type {
  AsciiConfig,
  AsciiGraph,
  EdgeBundle,
  GridCoord,
} from '../ascii/types.ts'
import {
  drawBundledEdgeSegment,
  drawBundleSharedPath,
  drawBundleArrowhead,
  drawBundleArrowheadStart,
  drawBundledEdgeArrowhead,
  drawBundledEdgeArrowheadStart,
  drawJunctionCharacter,
} from '../ascii/draw-bundles.ts'
import { renderMermaidASCII } from '../ascii/index.ts'

function buildGraph(src: string, useAscii = false): AsciiGraph {
  const config: AsciiConfig = {
    useAscii,
    paddingX: 5,
    paddingY: 5,
    boxBorderPadding: 1,
    graphDirection: 'TD',
  }
  const graph = convertToAsciiGraph(parseMermaid(src), config)
  createMapping(graph)
  return graph
}

/** Every non-space character on the canvas, in scan order. */
function nonSpaceChars(canvas: string[][]): string {
  const found: string[] = []
  for (const col of canvas) {
    for (const ch of col) {
      if (ch !== ' ') found.push(ch)
    }
  }
  return found.join('')
}

const FAN_IN = `flowchart TD
  A[One] --> C[Target]
  B[Two] --> C`

const FAN_OUT = `flowchart TD
  C[Source] --> A[One]
  C --> B[Two]`

const BIDIRECTIONAL_FAN_IN = `flowchart TD
  A[One] <--> C[Target]
  B[Two] <--> C`

const BIDIRECTIONAL_FAN_OUT = `flowchart TD
  C[Source] <--> A[One]
  C <--> B[Two]`

const MIXED_FAN_OUT = `flowchart TD
  C[Source] --> A[One]
  C[Source] <--> B[Two]`

describe('draw-bundles: rendered fan-in/fan-out diagrams', () => {
  it('draws a fan-in bundle with a T-junction and single arrowhead (unicode)', () => {
    const out = renderMermaidASCII(FAN_IN, { useAscii: false })
    expect(out).toContain('├────────────┘')
    expect(out).toContain('▼')
    expect(out.match(/▼/g)).toHaveLength(1)
  })

  it('draws a fan-in bundle box-start and junction in ASCII charset', () => {
    const out = renderMermaidASCII(FAN_IN, { useAscii: true })
    expect(out).toContain('+----+---+')
    expect(out).toContain('+--+--+')
    expect(out).toContain('+------------+')
    expect(out).toContain('v')
  })

  it('draws a fan-out bundle with one arrowhead per target (unicode)', () => {
    const out = renderMermaidASCII(FAN_OUT, { useAscii: false })
    expect(out).toContain('├────────────┐')
    expect(out.match(/▼/g)).toHaveLength(2)
  })

  it('draws a fan-out bundle with one arrowhead per target (ASCII)', () => {
    const out = renderMermaidASCII(FAN_OUT, { useAscii: true })
    expect(out.match(/v/g)).toHaveLength(2)
  })

  it('draws a start arrowhead at each source for a bidirectional fan-in bundle', () => {
    const out = renderMermaidASCII(BIDIRECTIONAL_FAN_IN, { useAscii: false })
    // One end arrowhead at the shared target, plus one start arrowhead per source.
    expect(out.match(/▼/g)).toHaveLength(1)
    expect(out.match(/▲/g)).toHaveLength(2)
  })

  it('draws a single shared start arrowhead for a bidirectional fan-out bundle', () => {
    const out = renderMermaidASCII(BIDIRECTIONAL_FAN_OUT, { useAscii: false })
    // One end arrowhead per target, plus a single shared start arrowhead at the source.
    expect(out.match(/▼/g)).toHaveLength(2)
    expect(out.match(/▲/g)).toHaveLength(1)
  })

  it('omits the shared fan-out start arrowhead when the bundled edges disagree on hasArrowStart', () => {
    const out = renderMermaidASCII(MIXED_FAN_OUT, { useAscii: false })
    expect(out.match(/▼/g)).toHaveLength(2)
    expect(out).not.toContain('▲')
  })
})

describe('drawBundledEdgeSegment', () => {
  const graph = buildGraph(FAN_IN)
  const bundle = graph.bundles[0]!
  const junction = bundle.junctionPoint!
  const edgeTemplate = bundle.edges[0]!

  it('returns unmodified canvases when pathToJunction is empty', () => {
    const edge = { ...edgeTemplate, pathToJunction: [] }
    const result = drawBundledEdgeSegment(graph, edge, bundle)
    for (const canvas of result) {
      expect(nonSpaceChars(canvas)).toBe('')
    }
  })

  it('returns unmodified canvases when pathToJunction is undefined', () => {
    const edge = { ...edgeTemplate, pathToJunction: undefined }
    const result = drawBundledEdgeSegment(graph, edge, bundle)
    for (const canvas of result) {
      expect(nonSpaceChars(canvas)).toBe('')
    }
  })

  it.each<[string, GridCoord[], string]>([
    [
      'left-then-down bend',
      [
        { x: junction.x + 4, y: junction.y - 1 },
        { x: junction.x, y: junction.y - 1 },
        { x: junction.x, y: junction.y },
      ],
      '┌',
    ],
    [
      'up-then-right bend',
      [
        { x: junction.x, y: junction.y + 4 },
        { x: junction.x, y: junction.y - 1 },
        { x: junction.x + 4, y: junction.y - 1 },
      ],
      '┌',
    ],
    [
      'down-then-right bend',
      [
        { x: junction.x, y: junction.y - 2 },
        { x: junction.x, y: junction.y - 1 },
        { x: junction.x + 4, y: junction.y - 1 },
      ],
      '└',
    ],
    [
      'left-then-up bend',
      [
        { x: junction.x + 4, y: junction.y - 1 },
        { x: junction.x, y: junction.y - 1 },
        { x: junction.x, y: junction.y - 5 },
      ],
      '└',
    ],
    [
      'right-then-down bend',
      [
        { x: junction.x - 4, y: junction.y - 1 },
        { x: junction.x, y: junction.y - 1 },
        { x: junction.x, y: junction.y },
      ],
      '┐',
    ],
    [
      'up-then-left bend',
      [
        { x: junction.x, y: junction.y + 4 },
        { x: junction.x, y: junction.y - 1 },
        { x: junction.x - 4, y: junction.y - 1 },
      ],
      '┐',
    ],
    [
      'right-then-up bend',
      [
        { x: junction.x - 4, y: junction.y - 1 },
        { x: junction.x, y: junction.y - 1 },
        { x: junction.x, y: junction.y - 5 },
      ],
      '┘',
    ],
    [
      'down-then-left bend',
      [
        { x: junction.x, y: junction.y - 2 },
        { x: junction.x, y: junction.y - 1 },
        { x: junction.x - 4, y: junction.y - 1 },
      ],
      '┘',
    ],
    [
      'straight run (no real turn)',
      [
        { x: junction.x, y: junction.y - 2 },
        { x: junction.x, y: junction.y - 1 },
        { x: junction.x, y: junction.y },
      ],
      '+',
    ],
  ])('draws the %s corner', (_label, path, expectedChar) => {
    const edge = { ...edgeTemplate, pathToJunction: path }
    const [, , , , cornersCanvas] = drawBundledEdgeSegment(graph, edge, bundle)
    expect(nonSpaceChars(cornersCanvas)).toBe(expectedChar)
  })

  it.each<[string, GridCoord[], string]>([
    [
      'Up',
      [
        { x: junction.x, y: junction.y + 3 },
        { x: junction.x, y: junction.y },
      ],
      '┴',
    ],
    [
      'Left',
      [
        { x: junction.x + 4, y: junction.y },
        { x: junction.x, y: junction.y },
      ],
      '┤',
    ],
    [
      'Right',
      [
        { x: junction.x - 4, y: junction.y },
        { x: junction.x + 4, y: junction.y },
      ],
      '├',
    ],
  ])(
    'draws a %s-direction box-start connector',
    (_label, path, expectedChar) => {
      const edge = { ...edgeTemplate, pathToJunction: path }
      const [, boxStartCanvas] = drawBundledEdgeSegment(graph, edge, bundle)
      expect(nonSpaceChars(boxStartCanvas)).toBe(expectedChar)
    },
  )
})

describe('drawBundleSharedPath', () => {
  it('returns unmodified canvases when sharedPath has fewer than 2 points', () => {
    const graph = buildGraph(FAN_IN)
    const bundle = graph.bundles[0]!
    const shortBundle = {
      ...bundle,
      sharedPath: [bundle.junctionPoint!],
    }
    const [pathCanvas, cornersCanvas] = drawBundleSharedPath(graph, shortBundle)
    expect(nonSpaceChars(pathCanvas)).toBe('')
    expect(nonSpaceChars(cornersCanvas)).toBe('')
  })

  it.each<[string, (j: GridCoord) => GridCoord[], string]>([
    [
      'right-then-down bend',
      (j) => [j, { x: j.x + 4, y: j.y }, { x: j.x + 4, y: j.y + 1 }],
      '┐',
    ],
    [
      'right-then-up bend',
      (j) => [
        { x: j.x - 4, y: j.y + 1 },
        { x: j.x, y: j.y + 1 },
        { x: j.x, y: j.y },
      ],
      '┘',
    ],
    [
      'up-then-right bend',
      (j) => [
        { x: j.x, y: j.y + 2 },
        { x: j.x, y: j.y + 1 },
        { x: j.x + 4, y: j.y + 1 },
      ],
      '┌',
    ],
    [
      'left-then-up bend',
      (j) => [{ x: j.x + 4, y: j.y }, j, { x: j.x, y: j.y - 1 }],
      '└',
    ],
    [
      'straight run (no real turn)',
      (j) => [j, { x: j.x, y: j.y + 1 }, { x: j.x, y: j.y + 2 }],
      '+',
    ],
  ])(
    'draws a %s in the shared trunk (unicode)',
    (_label, makePath, expectedChar) => {
      const graph = buildGraph(FAN_IN)
      const bundle = graph.bundles[0]!
      const bent = {
        ...bundle,
        sharedPath: makePath(bundle.junctionPoint!),
      }
      const [, cornersCanvas] = drawBundleSharedPath(graph, bent)
      expect(nonSpaceChars(cornersCanvas)).toBe(expectedChar)
    },
  )

  it('draws a bend in the shared trunk as "+" in ASCII charset', () => {
    const graph = buildGraph(FAN_IN, true)
    const bundle = graph.bundles[0]!
    const junction = bundle.junctionPoint!
    const bent = {
      ...bundle,
      sharedPath: [
        junction,
        { x: junction.x + 4, y: junction.y },
        { x: junction.x + 4, y: junction.y + 1 },
      ],
    }
    const [, cornersCanvas] = drawBundleSharedPath(graph, bent)
    expect(nonSpaceChars(cornersCanvas)).toBe('+')
  })
})

/** A 2-point path whose last segment arrives from the given direction. */
function arrivalSharedPath(dir: 'Up' | 'Left' | 'Right'): GridCoord[] {
  switch (dir) {
    case 'Up':
      return [
        { x: 1, y: 6 },
        { x: 1, y: 4 },
      ]
    case 'Left':
      return [
        { x: 5, y: 4 },
        { x: 1, y: 4 },
      ]
    case 'Right':
      return [
        { x: 1, y: 4 },
        { x: 5, y: 4 },
      ]
  }
}

describe('drawBundleArrowhead', () => {
  const graph = buildGraph(FAN_IN)
  const bundle = graph.bundles[0]!

  it('returns an unmodified canvas when sharedPath has fewer than 2 points', () => {
    const shortBundle = {
      ...bundle,
      sharedPath: [bundle.junctionPoint!],
    }
    const canvas = drawBundleArrowhead(graph, shortBundle)
    expect(nonSpaceChars(canvas)).toBe('')
  })

  it.each<['Up' | 'Left' | 'Right', string]>([
    ['Up', '▲'],
    ['Left', '◄'],
    ['Right', '►'],
  ])(
    'draws a %s-arriving trunk as the %s arrowhead (unicode)',
    (dir, expectedChar) => {
      const b = { ...bundle, sharedPath: arrivalSharedPath(dir) }
      const canvas = drawBundleArrowhead(graph, b)
      expect(nonSpaceChars(canvas)).toBe(expectedChar)
    },
  )

  it.each<['Up' | 'Left' | 'Right', string]>([
    ['Up', '^'],
    ['Left', '<'],
    ['Right', '>'],
  ])(
    'draws a %s-arriving trunk as the %s arrowhead (ASCII)',
    (dir, expectedChar) => {
      const asciiGraph = buildGraph(FAN_IN, true)
      const asciiBundle = asciiGraph.bundles[0]!
      const b = {
        ...asciiBundle,
        sharedPath: arrivalSharedPath(dir),
      }
      const canvas = drawBundleArrowhead(asciiGraph, b)
      expect(nonSpaceChars(canvas)).toBe(expectedChar)
    },
  )

  it('falls back to the default arrowhead for a diagonal trunk direction (unicode)', () => {
    const b = {
      ...bundle,
      sharedPath: [
        { x: 1, y: 2 },
        { x: 5, y: 4 },
      ],
    }
    const canvas = drawBundleArrowhead(graph, b)
    expect(nonSpaceChars(canvas)).toBe('▼')
  })

  it('falls back to the default arrowhead for a diagonal trunk direction (ASCII)', () => {
    const asciiGraph = buildGraph(FAN_IN, true)
    const asciiBundle = asciiGraph.bundles[0]!
    const b = {
      ...asciiBundle,
      sharedPath: [
        { x: 1, y: 2 },
        { x: 5, y: 4 },
      ],
    }
    const canvas = drawBundleArrowhead(asciiGraph, b)
    expect(nonSpaceChars(canvas)).toBe('v')
  })

  it('offsets the arrowhead horizontally for an LR graph direction', () => {
    // Bundling never fires for LR graphs (see edge-bundling.ts), so this
    // exercises the function's LR branch directly rather than through a
    // real diagram. The shared node is shifted away from the canvas edge
    // first since its real (TD) attachment point sits at x=0, and the LR
    // offset (`dc.x -= 1`) would otherwise underflow the canvas.
    const shiftedNode = {
      ...bundle.sharedNode,
      drawingCoord: {
        ...bundle.sharedNode.drawingCoord!,
        x: bundle.sharedNode.drawingCoord!.x + 10,
      },
    }
    const lrGraph = {
      ...graph,
      config: { ...graph.config, graphDirection: 'LR' as const },
    }
    const b = {
      ...bundle,
      sharedNode: shiftedNode,
      sharedPath: [
        { x: 1, y: 2 },
        { x: 1, y: 4 },
      ],
    }
    const canvas = drawBundleArrowhead(lrGraph, b)
    expect(nonSpaceChars(canvas)).toBe('▼')
  })
})

describe('drawBundleArrowheadStart', () => {
  const graph = buildGraph(BIDIRECTIONAL_FAN_OUT)
  const bundle = graph.bundles[0]!

  it('returns an unmodified canvas when sharedPath has fewer than 2 points', () => {
    const shortBundle = {
      ...bundle,
      sharedPath: [bundle.junctionPoint!],
    }
    const canvas = drawBundleArrowheadStart(graph, shortBundle)
    expect(nonSpaceChars(canvas)).toBe('')
  })

  it.each<['Up' | 'Left' | 'Right', string]>([
    ['Up', '▼'],
    ['Left', '►'],
    ['Right', '◄'],
  ])(
    'draws a trunk departing %s as the reversed %s arrowhead (unicode)',
    (dir, expectedChar) => {
      const b = { ...bundle, sharedPath: arrivalSharedPath(dir) }
      const canvas = drawBundleArrowheadStart(graph, b)
      expect(nonSpaceChars(canvas)).toBe(expectedChar)
    },
  )

  it.each<['Up' | 'Left' | 'Right', string]>([
    ['Up', 'v'],
    ['Left', '>'],
    ['Right', '<'],
  ])(
    'draws a trunk departing %s as the reversed %s arrowhead (ASCII)',
    (dir, expectedChar) => {
      const asciiGraph = buildGraph(BIDIRECTIONAL_FAN_OUT, true)
      const asciiBundle = asciiGraph.bundles[0]!
      const b = {
        ...asciiBundle,
        sharedPath: arrivalSharedPath(dir),
      }
      const canvas = drawBundleArrowheadStart(asciiGraph, b)
      expect(nonSpaceChars(canvas)).toBe(expectedChar)
    },
  )

  it('falls back to the default arrowhead for a diagonal trunk direction (unicode)', () => {
    const b = {
      ...bundle,
      sharedPath: [
        { x: 1, y: 2 },
        { x: 5, y: 4 },
      ],
    }
    const canvas = drawBundleArrowheadStart(graph, b)
    expect(nonSpaceChars(canvas)).toBe('▲')
  })

  it('falls back to the default arrowhead for a diagonal trunk direction (ASCII)', () => {
    const asciiGraph = buildGraph(BIDIRECTIONAL_FAN_OUT, true)
    const asciiBundle = asciiGraph.bundles[0]!
    const b = {
      ...asciiBundle,
      sharedPath: [
        { x: 1, y: 2 },
        { x: 5, y: 4 },
      ],
    }
    const canvas = drawBundleArrowheadStart(asciiGraph, b)
    expect(nonSpaceChars(canvas)).toBe('^')
  })

  it('offsets the arrowhead horizontally for an LR graph direction', () => {
    // Bundling never fires for LR graphs (see edge-bundling.ts), so this
    // exercises the function's LR branch directly rather than through a
    // real diagram.
    const lrGraph = {
      ...graph,
      config: { ...graph.config, graphDirection: 'LR' as const },
    }
    const b = {
      ...bundle,
      sharedPath: [
        { x: 1, y: 2 },
        { x: 1, y: 4 },
      ],
    }
    const canvas = drawBundleArrowheadStart(lrGraph, b)
    expect(nonSpaceChars(canvas)).toBe('▲')
  })
})

describe('drawBundledEdgeArrowheadStart', () => {
  const graph = buildGraph(BIDIRECTIONAL_FAN_IN)
  const bundle = graph.bundles[0]!
  const edgeTemplate = bundle.edges[0]!

  it('returns an unmodified canvas when pathToJunction is undefined', () => {
    const edge = { ...edgeTemplate, pathToJunction: undefined }
    const canvas = drawBundledEdgeArrowheadStart(graph, edge)
    expect(nonSpaceChars(canvas)).toBe('')
  })

  it.each<['Up' | 'Left' | 'Right', string]>([
    ['Up', '▼'],
    ['Left', '►'],
    ['Right', '◄'],
  ])(
    'draws an edge departing %s as the reversed %s arrowhead (unicode)',
    (dir, expectedChar) => {
      const edge = {
        ...edgeTemplate,
        pathToJunction: arrivalSharedPath(dir),
      }
      const canvas = drawBundledEdgeArrowheadStart(graph, edge)
      expect(nonSpaceChars(canvas)).toBe(expectedChar)
    },
  )

  it.each<['Up' | 'Left' | 'Right', string]>([
    ['Up', 'v'],
    ['Left', '>'],
    ['Right', '<'],
  ])(
    'draws an edge departing %s as the reversed %s arrowhead (ASCII)',
    (dir, expectedChar) => {
      const asciiGraph = buildGraph(BIDIRECTIONAL_FAN_IN, true)
      const asciiBundle = asciiGraph.bundles[0]!
      const asciiEdgeTemplate = asciiBundle.edges[0]!
      const edge = {
        ...asciiEdgeTemplate,
        pathToJunction: arrivalSharedPath(dir),
      }
      const canvas = drawBundledEdgeArrowheadStart(asciiGraph, edge)
      expect(nonSpaceChars(canvas)).toBe(expectedChar)
    },
  )

  it('falls back to the default arrowhead for a diagonal edge direction (unicode)', () => {
    const edge = {
      ...edgeTemplate,
      pathToJunction: [
        { x: 1, y: 2 },
        { x: 5, y: 4 },
      ],
    }
    const canvas = drawBundledEdgeArrowheadStart(graph, edge)
    expect(nonSpaceChars(canvas)).toBe('▼')
  })

  it('falls back to the default arrowhead for a diagonal edge direction (ASCII)', () => {
    const asciiGraph = buildGraph(BIDIRECTIONAL_FAN_IN, true)
    const asciiBundle = asciiGraph.bundles[0]!
    const asciiEdgeTemplate = asciiBundle.edges[0]!
    const edge = {
      ...asciiEdgeTemplate,
      pathToJunction: [
        { x: 1, y: 2 },
        { x: 5, y: 4 },
      ],
    }
    const canvas = drawBundledEdgeArrowheadStart(asciiGraph, edge)
    expect(nonSpaceChars(canvas)).toBe('v')
  })
})

describe('drawBundledEdgeArrowhead', () => {
  const graph = buildGraph(FAN_OUT)
  const bundle = graph.bundles[0]!
  const edgeTemplate = bundle.edges[0]!

  it('returns an unmodified canvas when pathToJunction is undefined', () => {
    const edge = { ...edgeTemplate, pathToJunction: undefined }
    const canvas = drawBundledEdgeArrowhead(graph, edge)
    expect(nonSpaceChars(canvas)).toBe('')
  })

  it.each<['Up' | 'Left' | 'Right', string]>([
    ['Up', '▲'],
    ['Left', '◄'],
    ['Right', '►'],
  ])(
    'draws a %s-arriving edge as the %s arrowhead (unicode)',
    (dir, expectedChar) => {
      const edge = {
        ...edgeTemplate,
        pathToJunction: arrivalSharedPath(dir),
      }
      const canvas = drawBundledEdgeArrowhead(graph, edge)
      expect(nonSpaceChars(canvas)).toBe(expectedChar)
    },
  )

  it.each<['Up' | 'Left' | 'Right', string]>([
    ['Up', '^'],
    ['Left', '<'],
    ['Right', '>'],
  ])(
    'draws a %s-arriving edge as the %s arrowhead (ASCII)',
    (dir, expectedChar) => {
      const asciiGraph = buildGraph(FAN_OUT, true)
      const asciiBundle = asciiGraph.bundles[0]!
      const asciiEdgeTemplate = asciiBundle.edges[0]!
      const edge = {
        ...asciiEdgeTemplate,
        pathToJunction: arrivalSharedPath(dir),
      }
      const canvas = drawBundledEdgeArrowhead(asciiGraph, edge)
      expect(nonSpaceChars(canvas)).toBe(expectedChar)
    },
  )

  it('falls back to the default arrowhead for a diagonal edge direction (unicode)', () => {
    const edge = {
      ...edgeTemplate,
      pathToJunction: [
        { x: 1, y: 2 },
        { x: 5, y: 4 },
      ],
    }
    const canvas = drawBundledEdgeArrowhead(graph, edge)
    expect(nonSpaceChars(canvas)).toBe('▼')
  })

  it('falls back to the default arrowhead for a diagonal edge direction (ASCII)', () => {
    const asciiGraph = buildGraph(FAN_OUT, true)
    const asciiBundle = asciiGraph.bundles[0]!
    const asciiEdgeTemplate = asciiBundle.edges[0]!
    const edge = {
      ...asciiEdgeTemplate,
      pathToJunction: [
        { x: 1, y: 2 },
        { x: 5, y: 4 },
      ],
    }
    const canvas = drawBundledEdgeArrowhead(asciiGraph, edge)
    expect(nonSpaceChars(canvas)).toBe('v')
  })

  it('offsets the arrowhead horizontally for an LR graph direction', () => {
    // Same rationale as the drawBundleArrowhead LR test above: bundling
    // never fires for LR graphs, so this directly exercises the LR branch.
    const shiftedTo = {
      ...edgeTemplate.to,
      drawingCoord: {
        ...edgeTemplate.to.drawingCoord!,
        x: edgeTemplate.to.drawingCoord!.x + 10,
      },
    }
    const lrGraph = {
      ...graph,
      config: { ...graph.config, graphDirection: 'LR' as const },
    }
    const edge = {
      ...edgeTemplate,
      to: shiftedTo,
      pathToJunction: [
        { x: 1, y: 2 },
        { x: 1, y: 4 },
      ],
    }
    const canvas = drawBundledEdgeArrowhead(lrGraph, edge)
    expect(nonSpaceChars(canvas)).toBe('▼')
  })
})

describe('drawJunctionCharacter', () => {
  const graph = buildGraph(FAN_IN)
  const bundle = graph.bundles[0]!
  const junction = bundle.junctionPoint!

  type Dir = 'Down' | 'Up' | 'Left' | 'Right'

  /** A point that arrives at the junction moving in the given direction. */
  function arrivalPoint(dir: Dir): GridCoord {
    switch (dir) {
      case 'Down':
        return { x: junction.x, y: junction.y - 1 }
      case 'Up':
        return { x: junction.x, y: junction.y + 1 }
      case 'Right':
        return { x: junction.x - 1, y: junction.y }
      case 'Left':
        return { x: junction.x + 1, y: junction.y }
    }
  }

  /** A point the shared trunk continues to from the junction, in the given direction. */
  function sharedNextPoint(dir: Dir): GridCoord {
    switch (dir) {
      case 'Down':
        return { x: junction.x, y: junction.y + 1 }
      case 'Up':
        return { x: junction.x, y: junction.y - 1 }
      case 'Right':
        return { x: junction.x + 1, y: junction.y }
      case 'Left':
        return { x: junction.x - 1, y: junction.y }
    }
  }

  function makeBundle(sharedDir: Dir | null, arrivalDirs: Dir[]): EdgeBundle {
    const sharedPath = sharedDir ? [junction, sharedNextPoint(sharedDir)] : []
    const edges = arrivalDirs.map((d) => ({
      ...bundle.edges[0]!,
      pathToJunction: [arrivalPoint(d), junction],
    }))
    return { ...bundle, sharedPath, edges }
  }

  it.each<[string, Dir | null, Dir[], string]>([
    ['all four directions', 'Down', ['Down', 'Right', 'Left'], '┼'],
    ['down + left + right (no up)', 'Down', ['Right', 'Left'], '┬'],
    ['up + left + right (no down)', 'Up', ['Right', 'Left'], '┴'],
    ['up + down + left (no right)', 'Down', ['Down', 'Right'], '┤'],
    ['left + right only', null, ['Right', 'Left'], '─'],
    ['up + down only', 'Down', ['Down'], '│'],
    ['down + left only', 'Down', ['Right'], '┐'],
    ['up + right only', 'Up', ['Left'], '└'],
    ['up + left only', 'Up', ['Right'], '┘'],
    ['a single direction (no named shape)', 'Up', [], '┼'],
    ['no connecting directions at all', null, [], '┼'],
    [
      'shared trunk exits right, edge arrives from above',
      'Right',
      ['Down'],
      '└',
    ],
    ['shared trunk exits left, edge arrives from above', 'Left', ['Down'], '┘'],
  ])('draws %s', (_label, sharedDir, arrivalDirs, expectedChar) => {
    const b = makeBundle(sharedDir, arrivalDirs)
    const canvas = drawJunctionCharacter(graph, b)
    expect(nonSpaceChars(canvas)).toBe(expectedChar)
  })

  it('draws "+" for any connecting directions in ASCII charset', () => {
    const asciiGraph = buildGraph(FAN_IN, true)
    const asciiBundle = asciiGraph.bundles[0]!
    const asciiJunction = asciiBundle.junctionPoint!
    const b = {
      ...asciiBundle,
      sharedPath: [
        asciiJunction,
        { x: asciiJunction.x, y: asciiJunction.y + 1 },
      ],
      edges: [
        {
          ...asciiBundle.edges[0]!,
          pathToJunction: [
            { x: asciiJunction.x - 1, y: asciiJunction.y },
            asciiJunction,
          ],
        },
      ],
    }
    const canvas = drawJunctionCharacter(asciiGraph, b)
    expect(nonSpaceChars(canvas)).toBe('+')
  })

  it('returns an unmodified canvas when junctionPoint is null', () => {
    const b = { ...bundle, junctionPoint: null }
    const canvas = drawJunctionCharacter(graph, b)
    expect(nonSpaceChars(canvas)).toBe('')
  })
})
