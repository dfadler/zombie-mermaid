/**
 * Regression tests (#1421): an honored `direction RL`/`BT` inside a subgraph
 * mirrors that subgraph's box, relative to the direction the surrounding
 * output already shows.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (src: string, useAscii = false) =>
  renderMermaidASCII(src, { colorMode: 'none', useAscii })
const col = (out: string, needle: string) =>
  Math.max(...out.split('\n').map((l) => l.indexOf(needle)))
const row = (out: string, needle: string) =>
  out.split('\n').findIndex((l) => l.includes(needle))

describe('nested subgraph direction RL/BT (#1421)', () => {
  it('RL inside TD draws C, B, A left to right with left-pointing arrows', () => {
    const out = render(
      'graph TD\n  subgraph S\n    direction RL\n    A --> B --> C\n  end',
    )
    expect(col(out, 'C')).toBeLessThan(col(out, 'B'))
    expect(col(out, 'B')).toBeLessThan(col(out, 'A'))
    expect(out).toContain('◄')
    expect(out).not.toContain('►')
  })

  it('BT inside TD stacks C, B, A top to bottom with up-pointing arrows', () => {
    const out = render(
      'graph TD\n  subgraph S\n    direction BT\n    A -->|go| B --> C\n  end',
    )
    expect(row(out, 'C')).toBeLessThan(row(out, 'B'))
    expect(row(out, 'B')).toBeLessThan(row(out, 'A'))
    expect(out).toContain('▲')
    expect(out).toContain('go')
  })

  it('is RL-in-RL a no-op and LR-in-RL a flip back', () => {
    const rl = render(
      'graph RL\n  subgraph S\n    direction RL\n    A --> B\n  end',
    )
    expect(col(rl, 'B')).toBeLessThan(col(rl, 'A'))
    const lr = render(
      'graph RL\n  subgraph S\n    direction LR\n    A --> B\n  end',
    )
    expect(col(lr, 'A')).toBeLessThan(col(lr, 'B'))
  })

  it('leaves a subgraph with a boundary-crossing edge alone', () => {
    const out = render(
      'graph TD\n  subgraph S\n    direction RL\n    A --> B\n  end\n  X --> A',
    )
    expect(col(out, 'A')).toBe(col(out, 'B'))
  })

  it('keeps nested boxes and labels readable', () => {
    const out = render(
      'graph TD\n  subgraph S [Outer]\n    direction RL\n    subgraph T [Inner]\n      direction LR\n      P --> Q\n    end\n    A["x<br/>y"] --> B\n  end',
    )
    expect(out).toContain('Outer')
    expect(out).toContain('Inner')
    expect(col(out, 'P')).toBeLessThan(col(out, 'Q'))
    // A is a two-line label, so its column is not searchable by letter.
    expect(col(out, 'x')).toBeGreaterThan(col(out, 'B'))
  })
})
