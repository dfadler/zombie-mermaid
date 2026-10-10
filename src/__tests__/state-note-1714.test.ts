/**
 * #1714: `note left of X` / `note right of X` (one-line and `end note` block)
 * used to be dropped silently. They now render as a note box linked to the
 * state by a dotted, arrowless edge, in both SVG and ASCII.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid, renderMermaidASCII, renderMermaidSVG } from '../index.ts'

const ONE_LINE = `stateDiagram-v2
    [*] --> Active
    note right of Active : this is a note
    Active --> [*]`

const BLOCK = `stateDiagram-v2
    [*] --> Active
    note left of Active
      first line
      second line
    end note
    Active --> [*]`

describe('state diagram notes (#1714)', () => {
  it('parses a one-line note into a note node on a dotted arrowless link', () => {
    const g = parseMermaid(ONE_LINE)
    const note = g.nodes.get('Active----note-1')
    expect(note).toMatchObject({ shape: 'note', label: 'this is a note' })
    expect(g.edges.find((e) => e.target === 'Active----note-1')).toMatchObject({
      source: 'Active',
      style: 'dotted',
      hasArrowStart: false,
      hasArrowEnd: false,
    })
  })

  it('parses a block note, joining its lines', () => {
    const g = parseMermaid(BLOCK)
    expect(g.nodes.get('Active----note-1')!.label).toBe(
      'first line\nsecond line',
    )
    // The block's lines are not read as states or transitions.
    expect([...g.nodes.keys()]).toEqual([
      '_start',
      'Active',
      'Active----note-1',
      '_end',
    ])
  })

  it('creates the state a note is attached to, and numbers several notes', () => {
    const g = parseMermaid(
      'stateDiagram-v2\n  note right of A : one\n  note left of A : two',
    )
    expect(g.nodes.get('A')).toBeDefined()
    expect([...g.nodes.keys()]).toEqual(['A', 'A----note-1', 'A----note-2'])
  })

  it('keeps a note inside the composite its state is in', () => {
    const [sg] = parseMermaid(
      'stateDiagram-v2\n  state S {\n    a --> b\n    note right of b : hi\n  }',
    ).subgraphs
    expect(sg!.nodeIds).toContain('b----note-1')
  })

  it('ASCII shows the note text', () => {
    expect(renderMermaidASCII(ONE_LINE)).toContain('this is a note')
    const block = renderMermaidASCII(BLOCK)
    expect(block).toContain('first line')
    expect(block).toContain('second line')
  })

  it('SVG shows the note text in a dog-eared polygon', () => {
    const svg = renderMermaidSVG(ONE_LINE)
    expect(svg).toContain('this is a note')
    expect(svg.match(/<polygon [^>]*fill="var\(--bg\)"/g)).toHaveLength(1)
  })
})
