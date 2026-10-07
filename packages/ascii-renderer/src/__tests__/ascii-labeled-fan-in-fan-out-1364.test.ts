/**
 * #1364: a node with two labelled parents that also fans out used to draw
 * both labels on one shared run (`onetwo`). `markLabeledFanIn` in grid.ts
 * flags it so each edge takes its own side entry.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (src: string): string =>
  renderMermaidASCII(src, { colorMode: 'none' })

describe('labelled fan-in into a node that fans out', () => {
  it('keeps both parent labels readable', () => {
    const out = render(`flowchart TD
    X -->|one| A
    Y -->|two| A
    A --> B
    A --> C`)
    expect(out).toContain('one')
    expect(out).toContain('two')
    expect(out).not.toContain('onetwo')
  })

  it('leaves a labelled fan-in whose child sits on a cycle alone', () => {
    const out = render(`flowchart TD
    X -->|one| A
    Y -->|two| A
    A --> B
    A --> C
    B --> X`)
    expect(out).toContain('one')
  })
})
