/**
 * Two crashes only the ELK-hinted ASCII path had, found by the ELK-registered
 * fuzz (`__tests__/property/ascii-elk-fuzz.property.test.ts`, #3146):
 *
 * 1. `widenFrameGutters` ran out of memory (column width 1.9e11). A member
 *    self-loop routed past its frame's nodes pulls the frame's wall out to its
 *    path; a sibling edge's run inside that wall was "violating", and widening
 *    the gap moved the wall with it, so every pass doubled the width.
 * 2. `assignParallelEdgeLanes` threw `TypeError: ... reading 'start'`. A frame
 *    with its own `direction` keeps ELK hints for its loops only (#3053), and
 *    the face-lengthening step read the hint of an edge that had none.
 */
import { describe, expect, it } from 'vitest'
import {
  getAsciiLayout,
  registerAsciiLayout,
  renderMermaidASCII as render,
} from '../packages/ascii-renderer/src/index.ts'
// The root entry registers the ELK layout provider (as the CLI does).
import '../src/index.ts'
import { renderMermaidSVG } from '../packages/svg-renderer/src/index.ts'

const OOM = `flowchart BT
  subgraph G0["G0"]
    n0["x1"]
  end
  subgraph G1["G1"]
    n1(["a2"])
    n2>"ccc"]
    n3{"Check"}
  end
  n5{"a2"}
  n6{"Check"}
  n0 -->|Z| n2
  n5 -.-> n1
  n0 -.-> n0
  n1 -.->|x1| n2
  n6 -->|Check| n3
  n6 -->|Bb| n4`

const THROW = `flowchart BT
  subgraph G0["G0"]
    n0["Z"]
    n1[["Start"]]
    n2{"End"}
    direction BT
  end
  n2 -.-> n1
  n0 -.->|Long label| n2
  n0 -.->|x1| n1
  n2 -.-> n2
  n0 --> n1`

const draw = (src: string, useAscii = false): string =>
  render(src, { colorMode: 'none', useAscii })

const elk = getAsciiLayout()

/**
 * The bare grid, as with no provider registered. The ELK-hinted ASCII of the
 * first source differs by a few strokes between macOS and the Linux CI runner
 * (the SVG from the same layout does not), so the goldens pin the grid and the
 * ELK-registered renders are checked structurally above.
 */
const drawGrid = (src: string, useAscii = false): string => {
  registerAsciiLayout(undefined)
  try {
    return draw(src, useAscii)
  } finally {
    registerAsciiLayout(elk)
  }
}

const rectangular = (out: string): boolean =>
  new Set(out.split('\n').map((l) => [...l].length)).size === 1

describe('ELK-hinted ASCII crashes (#3146)', () => {
  for (const useAscii of [false, true]) {
    it(`frame gutter widening terminates (useAscii ${useAscii})`, () => {
      const out = draw(OOM, useAscii)
      expect(rectangular(out)).toBe(true)
      // Was 197 billion columns; the diagram is a few dozen wide.
      expect(out.split('\n')[0]!.length).toBeLessThan(200)
      for (const t of ['x1', 'a2', 'ccc', 'Check', 'Z', 'Bb']) {
        expect(out).toContain(t)
      }
    })

    it(`a frame with its own direction renders (useAscii ${useAscii})`, () => {
      const out = draw(THROW, useAscii)
      expect(rectangular(out)).toBe(true)
      for (const t of ['Z', 'Start', 'End', 'G0']) expect(out).toContain(t)
    })
  }

  it('snapshots SVG and ASCII (unicode and ASCII-only) of each source', () => {
    for (const [name, src] of [
      ['oom', OOM],
      ['throw', THROW],
    ] as const) {
      expect(renderMermaidSVG(src)).toMatchSnapshot(`${name}-svg`)
      expect(drawGrid(src)).toMatchSnapshot(`${name}-ascii`)
      expect(drawGrid(src, true)).toMatchSnapshot(`${name}-ascii-only`)
    }
  })
})
