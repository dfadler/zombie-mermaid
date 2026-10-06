import { describe, it, expect } from 'vitest'
import { parseMermaid } from '../flowchart-parser.ts'

// Upstream lukilabs/beautiful-mermaid#156: `A --> |label| B` (space before the
// label pipe) used to drop the target and label.
describe('edge label with a space before the pipe', () => {
  const cases = [
    ['-->', 'solid', true],
    ['---', 'solid', false],
    ['-.->', 'dotted', true],
    ['==>', 'thick', true],
  ] as const

  for (const [op, style, hasArrowEnd] of cases) {
    it(`parses A ${op} |deploy| B`, () => {
      const g = parseMermaid(`graph LR\n  A ${op} |deploy| B`)
      expect(g.edges).toHaveLength(1)
      expect(g.edges[0]).toMatchObject({
        source: 'A',
        target: 'B',
        label: 'deploy',
        style,
        hasArrowEnd,
      })
    })

    it(`parses A ${op}  |deploy| B identically to the no-space form`, () => {
      const spaced = parseMermaid(`graph LR\n  A ${op}  |deploy| B`)
      const tight = parseMermaid(`graph LR\n  A ${op}|deploy| B`)
      expect(spaced.edges).toEqual(tight.edges)
    })
  }

  it('still parses the no-space form', () => {
    const g = parseMermaid('graph LR\n  A -->|deploy| B')
    expect(g.edges[0]).toMatchObject({ target: 'B', label: 'deploy' })
  })

  it('does not treat an unmarked `--`/`==` before a pipe as an arrow', () => {
    // `--`/`==` unmarked is the text-label opener, so this must not become a
    // labelled link with target B and label `x`.
    for (const src of ['graph LR\n  A -- |x| B', 'graph LR\n  A == |x| B']) {
      const g = parseMermaid(src)
      expect(g.edges.some((e) => e.label === 'x' && e.target === 'B')).toBe(false)
    }
  })

  it('keeps text-embedded labels working', () => {
    const g = parseMermaid('graph LR\n  A -- Yes --> B')
    expect(g.edges[0]).toMatchObject({ target: 'B', label: 'Yes' })
  })
})
