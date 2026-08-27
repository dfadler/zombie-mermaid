/**
 * Tests for issue #181 — semicolon-separated statements.
 *
 * `detectDiagramType` isolated the header by splitting on `[\n;]`, so
 * `sequenceDiagram;A->>B: Hi` routed to the sequence pipeline — but every
 * parser then split the body on newlines only, discarding everything after
 * the header and rendering an empty diagram. The same gap existed on the
 * flowchart path, where `flowchart TD;A-->B` instead threw
 * "Invalid mermaid header".
 *
 * `splitStatements` is now the single definition of "what is one statement",
 * shared by the detector and all five parser entry points.
 */
import { describe, it, expect } from 'vitest'
import { splitStatements } from '../statements.ts'
import { detectDiagramType } from '../diagram-type.ts'
import { renderMermaidASCII, renderMermaidSVG } from '../index.ts'

describe('splitStatements (issue #181)', () => {
  it('splits on newlines', () => {
    expect(splitStatements('graph TD\nA-->B')).toEqual(['graph TD', 'A-->B'])
  })

  it('splits on semicolons', () => {
    expect(splitStatements('graph TD;A-->B;B-->C')).toEqual([
      'graph TD',
      'A-->B',
      'B-->C',
    ])
  })

  it('drops empty statements from trailing or repeated separators', () => {
    expect(splitStatements('graph TD;A-->B;')).toEqual(['graph TD', 'A-->B'])
    expect(splitStatements('graph TD;;;A-->B')).toEqual(['graph TD', 'A-->B'])
    expect(splitStatements('graph TD\n\n\nA-->B')).toEqual([
      'graph TD',
      'A-->B',
    ])
  })

  it('trims whitespace around each statement', () => {
    expect(splitStatements('  graph TD  ;  A-->B  ')).toEqual([
      'graph TD',
      'A-->B',
    ])
  })

  describe('does not split a semicolon that is not a separator', () => {
    it('inside a double-quoted label', () => {
      expect(splitStatements('graph TD\nA["a; b"]-->B')).toEqual([
        'graph TD',
        'A["a; b"]-->B',
      ])
    })

    it('inside a single-quoted label', () => {
      expect(splitStatements("graph TD\nA['x; y']-->B")).toEqual([
        'graph TD',
        "A['x; y']-->B",
      ])
    })

    it('terminating a named character reference', () => {
      expect(splitStatements('graph TD\nA[&amp;]-->B')).toEqual([
        'graph TD',
        'A[&amp;]-->B',
      ])
    })

    it('terminating a numeric character reference', () => {
      expect(splitStatements('graph TD\nA[&#35;]-->B')).toEqual([
        'graph TD',
        'A[&#35;]-->B',
      ])
    })

    it('terminating a hex character reference', () => {
      expect(splitStatements('graph TD\nA[&#x1F600;]-->B')).toEqual([
        'graph TD',
        'A[&#x1F600;]-->B',
      ])
    })

    it('but still splits a real separator on the same line as an entity', () => {
      expect(splitStatements('graph TD;A[&amp;]-->B;B-->C')).toEqual([
        'graph TD',
        'A[&amp;]-->B',
        'B-->C',
      ])
    })

    it('and treats a lone ampersand as an ordinary character', () => {
      // `A & B` is flowchart's parallel-link syntax, not an entity.
      expect(splitStatements('graph TD;A-->B & C')).toEqual([
        'graph TD',
        'A-->B & C',
      ])
    })
  })

  describe('comments', () => {
    it('drops whole-line comments without splitting their semicolons', () => {
      expect(splitStatements('graph TD\n%% note; not code\nA-->B')).toEqual([
        'graph TD',
        'A-->B',
      ])
    })

    it('drops a comment that only begins after a semicolon', () => {
      expect(splitStatements('graph TD\nA-->B; %% note')).toEqual([
        'graph TD',
        'A-->B',
      ])
    })
  })
})

describe('semicolon-separated diagrams render their bodies (issue #181)', () => {
  const cases = [
    {
      type: 'flowchart' as const,
      // Previously threw: the header regex saw the whole line.
      source: 'flowchart TD;A-->B;B-->C',
      expected: ['A', 'B', 'C'],
    },
    {
      type: 'sequence' as const,
      source: 'sequenceDiagram;A->>B: Hi',
      expected: ['A', 'B', 'Hi'],
    },
    {
      type: 'class' as const,
      source: 'classDiagram;class Animal;class Dog',
      expected: ['Animal', 'Dog'],
    },
    {
      type: 'er' as const,
      source: 'erDiagram;CUSTOMER ||--o{ ORDER : places',
      expected: ['CUSTOMER', 'ORDER', 'places'],
    },
    {
      type: 'xychart' as const,
      source: 'xychart-beta;title "Sales";bar [1, 2, 3]',
      expected: ['Sales'],
    },
  ]

  for (const { type, source, expected } of cases) {
    describe(type, () => {
      it('routes to the expected pipeline', () => {
        expect(detectDiagramType(source)).toBe(type)
      })

      it('renders the body to ASCII instead of an empty diagram', () => {
        const ascii = renderMermaidASCII(source, { colorMode: 'none' })
        expect(ascii.trim()).not.toBe('')
        for (const token of expected) expect(ascii).toContain(token)
      })

      it('renders the body to SVG instead of an empty diagram', () => {
        const svg = renderMermaidSVG(source)
        for (const token of expected) expect(svg).toContain(token)
      })
    })
  }

  it('accepts semicolons after a newline-separated header', () => {
    const ascii = renderMermaidASCII('sequenceDiagram\nA->>B: Hi;B->>C: Yo', {
      colorMode: 'none',
    })
    expect(ascii).toContain('Hi')
    expect(ascii).toContain('Yo')
    expect(ascii).toContain('C')
    // The old behavior swallowed the second message into the first label.
    expect(ascii).not.toContain('Hi;B')
  })

  it('leaves newline-separated sources rendering identically', () => {
    const withNewlines = renderMermaidASCII('flowchart TD\nA-->B\nB-->C', {
      colorMode: 'none',
    })
    const withSemicolons = renderMermaidASCII('flowchart TD;A-->B;B-->C', {
      colorMode: 'none',
    })
    expect(withSemicolons).toBe(withNewlines)
  })

  it('preserves a semicolon that is part of a label', () => {
    const ascii = renderMermaidASCII('flowchart TD\nA["a; b"]-->B', {
      colorMode: 'none',
    })
    expect(ascii).toContain('a; b')
  })
})
