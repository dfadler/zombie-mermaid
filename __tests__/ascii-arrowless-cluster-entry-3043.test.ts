/**
 * #3043: an arrowless edge into a subgraph (`api --- S`) was drawn along the
 * source group's right wall, so it read as a stub. mermaid@12.3.0
 * (`scripts/lib/real-mermaid.ts`) runs it from `api` through the gutter to S's
 * wall. The jog kept two cells clear of S's wall for an arrowhead the edge
 * does not have, which in a one-cell gutter put it on the source group's wall.
 */
import { describe, expect, it } from 'vitest'
import { renderMermaidASCII } from '../packages/ascii-renderer/src/index.ts'
import { renderMermaidSVG } from '../packages/svg-renderer/src/index.ts'

const SRC = `flowchart LR
  subgraph B
    api
    jobs
  end
  subgraph S
    db
  end
  api --- S
  jobs --> db`

const draw = (src: string, useAscii = false): string =>
  renderMermaidASCII(src, { colorMode: 'none', useAscii })

describe('arrowless edge into a subgraph reaches the gutter (#3043)', () => {
  it('LR: the stroke leaves B and runs down the gutter, not B’s wall', () => {
    const lines = draw(SRC).split('\n')
    const apiRow = lines.find((l) => l.includes('api'))!
    // Crosses B's wall (┼) and bends down in the gutter (┐); no ├─┤ stub.
    expect(apiRow).toMatch(/api\s+├─┼┐/)
    expect(apiRow).not.toContain('├─┤')
    // The bend continues below the api row.
    const below = lines[lines.indexOf(apiRow) + 1]!
    expect(below).toMatch(/│ │││/)
  })

  it('snapshots SVG and ASCII (unicode and ASCII-only)', () => {
    expect(renderMermaidSVG(SRC)).toMatchSnapshot('svg')
    expect(draw(SRC)).toMatchSnapshot('ascii')
    expect(draw(SRC, true)).toMatchSnapshot('ascii-only')
  })
})
