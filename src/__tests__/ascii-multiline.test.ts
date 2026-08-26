import { describe, it, expect } from 'vitest'
import { renderMermaidAscii } from '../ascii/index.ts'
import { mkCanvas, canvasToString } from '../ascii/canvas.ts'
import {
  drawMultilineTextCentered,
  drawMultilineTextLeft,
} from '../ascii/multiline-utils.ts'

describe('ASCII multi-line labels', () => {
  describe('flowchart nodes', () => {
    it('renders multi-line node labels', () => {
      const ascii = renderMermaidAscii('graph TD\n  A[Line1<br>Line2]', {
        useAscii: false,
      })
      expect(ascii).toContain('Line1')
      expect(ascii).toContain('Line2')
      // Lines should be on different rows
      const lines = ascii.split('\n')
      const line1Row = lines.findIndex((l) => l.includes('Line1'))
      const line2Row = lines.findIndex((l) => l.includes('Line2'))
      expect(line2Row).toBeGreaterThan(line1Row)
    })

    it('handles 3+ line labels', () => {
      const ascii = renderMermaidAscii('graph TD\n  A[A<br>B<br>C]', {
        useAscii: false,
      })
      expect(ascii).toContain('A')
      expect(ascii).toContain('B')
      expect(ascii).toContain('C')
      // Verify vertical ordering
      const lines = ascii.split('\n')
      const aRow = lines.findIndex(
        (l) => l.includes('A') && !l.includes('─') && !l.includes('-'),
      )
      const bRow = lines.findIndex((l) => l.includes('B'))
      const cRow = lines.findIndex((l) => l.includes('C'))
      expect(bRow).toBeGreaterThan(aRow)
      expect(cRow).toBeGreaterThan(bRow)
    })

    it('renders in ASCII mode (not Unicode)', () => {
      const ascii = renderMermaidAscii('graph TD\n  A[Line1<br>Line2]', {
        useAscii: true,
      })
      expect(ascii).toContain('Line1')
      expect(ascii).toContain('Line2')
      // Should use ASCII box characters
      expect(ascii).toContain('+')
      expect(ascii).toContain('-')
    })
  })

  describe('flowchart edge labels', () => {
    it('renders multi-line edge labels', () => {
      const ascii = renderMermaidAscii(
        'graph TD\n  A --> B\n  A -->|Line1<br>Line2| C',
        { useAscii: false },
      )
      expect(ascii).toContain('Line1')
      expect(ascii).toContain('Line2')
    })
  })

  describe('flowchart subgraph labels', () => {
    it('renders multi-line subgraph labels', () => {
      const ascii = renderMermaidAscii(
        `graph TD
        subgraph sg [Group<br>Header]
          A[Node]
        end
      `,
        { useAscii: false },
      )
      expect(ascii).toContain('Group')
      expect(ascii).toContain('Header')
    })
  })

  describe('sequence diagram', () => {
    it('renders multi-line actor labels', () => {
      const ascii = renderMermaidAscii(
        `sequenceDiagram
        participant A as Actor<br>One
        A->>A: msg
      `,
        { useAscii: false },
      )
      expect(ascii).toContain('Actor')
      expect(ascii).toContain('One')
    })

    it('renders multi-line message labels', () => {
      const ascii = renderMermaidAscii(
        `sequenceDiagram
        participant A
        participant B
        A->>B: Line1<br>Line2
      `,
        { useAscii: false },
      )
      expect(ascii).toContain('Line1')
      expect(ascii).toContain('Line2')
    })

    it('preserves existing note multi-line support', () => {
      const ascii = renderMermaidAscii(
        `sequenceDiagram
        participant A
        A->>A: self
        Note over A: Note line 1<br>Note line 2
      `,
        { useAscii: false },
      )
      expect(ascii).toContain('Note line 1')
      expect(ascii).toContain('Note line 2')
    })
  })

  describe('class diagram', () => {
    it('renders multi-line class names', () => {
      const ascii = renderMermaidAscii(
        `classDiagram
        class MyClass["Long<br>Name"]
      `,
        { useAscii: false },
      )
      expect(ascii).toContain('Long')
      expect(ascii).toContain('Name')
    })

    it('renders multi-line relationship labels', () => {
      const ascii = renderMermaidAscii(
        `classDiagram
        A --> B : uses<br>implements
      `,
        { useAscii: false },
      )
      expect(ascii).toContain('uses')
      expect(ascii).toContain('implements')
    })
  })

  describe('ER diagram', () => {
    it('renders multi-line entity names', () => {
      const ascii = renderMermaidAscii(
        `erDiagram
        "Entity<br>Name" {
          string id
        }
      `,
        { useAscii: false },
      )
      expect(ascii).toContain('Entity')
      expect(ascii).toContain('Name')
    })

    it('renders multi-line relationship labels', () => {
      const ascii = renderMermaidAscii(
        `erDiagram
        A ||--o{ B : "has<br>many"
      `,
        { useAscii: false },
      )
      expect(ascii).toContain('has')
      expect(ascii).toContain('many')
    })
  })

  describe('edge cases', () => {
    it('handles empty lines from consecutive <br>', () => {
      const ascii = renderMermaidAscii('graph TD\n  A[Line1<br><br>Line3]', {
        useAscii: false,
      })
      expect(ascii).toContain('Line1')
      expect(ascii).toContain('Line3')
    })

    it('handles single-line labels (no <br>)', () => {
      const ascii = renderMermaidAscii('graph TD\n  A[SingleLine]', {
        useAscii: false,
      })
      expect(ascii).toContain('SingleLine')
    })

    it('handles very long lines', () => {
      const long = 'A'.repeat(30)
      const ascii = renderMermaidAscii(`graph TD\n  A[${long}<br>Short]`, {
        useAscii: false,
      })
      expect(ascii).toContain(long)
      expect(ascii).toContain('Short')
    })

    it('handles mixed short and long lines', () => {
      const ascii = renderMermaidAscii(
        'graph TD\n  A[Short<br>VeryLongSecondLine<br>Med]',
        { useAscii: false },
      )
      expect(ascii).toContain('Short')
      expect(ascii).toContain('VeryLongSecondLine')
      expect(ascii).toContain('Med')
    })
  })

  describe('multiline-utils functions', () => {
    it('splitLines splits on newlines', () => {
      // Test through the rendering pipeline
      const ascii = renderMermaidAscii('graph TD\n  A[One<br>Two<br>Three]', {
        useAscii: false,
      })
      const lines = ascii.split('\n')
      // All three words should appear on separate lines
      expect(lines.some((l) => l.includes('One'))).toBe(true)
      expect(lines.some((l) => l.includes('Two'))).toBe(true)
      expect(lines.some((l) => l.includes('Three'))).toBe(true)
    })

    it('maxLineWidth uses longest line for box sizing', () => {
      // Box should be wide enough for the longest line
      const ascii = renderMermaidAscii('graph TD\n  A[X<br>LongLine<br>Y]', {
        useAscii: false,
      })
      // The box should contain LongLine without truncation
      expect(ascii).toContain('LongLine')
    })
  })

  describe('drawMultilineTextCentered', () => {
    it('draws a single line centered at the given point', () => {
      const canvas = mkCanvas(10, 4)
      drawMultilineTextCentered(canvas, 'Hi', 5, 2)
      const lines = canvasToString(canvas).split('\n')
      expect(lines[2]).toContain('Hi')
    })

    it('centers multiple lines vertically around the point', () => {
      const canvas = mkCanvas(12, 6)
      drawMultilineTextCentered(canvas, 'One\nTwo\nThree', 6, 3)
      const lines = canvasToString(canvas).split('\n')
      const oneRow = lines.findIndex((l) => l.includes('One'))
      const twoRow = lines.findIndex((l) => l.includes('Two'))
      const threeRow = lines.findIndex((l) => l.includes('Three'))
      expect(oneRow).toBeGreaterThanOrEqual(0)
      expect(twoRow).toBe(oneRow + 1)
      expect(threeRow).toBe(twoRow + 1)
    })

    it('centers each line horizontally around the given x', () => {
      const canvas = mkCanvas(20, 2)
      drawMultilineTextCentered(canvas, 'Wide\nX', 10, 1)
      const lines = canvasToString(canvas).split('\n')
      const wideRow = lines.findIndex((l) => l.includes('Wide'))
      const xRow = lines.findIndex((l) => l.includes('X'))
      // 'Wide' (4 chars) centered on x=10 starts 2 columns left of center
      expect(lines[wideRow]!.indexOf('Wide')).toBe(8)
      // 'X' (1 char) centered on x=10 starts exactly at center
      expect(lines[xRow]!.indexOf('X')).toBe(10)
    })

    it('handles an empty label without throwing', () => {
      const canvas = mkCanvas(6, 3)
      expect(() => drawMultilineTextCentered(canvas, '', 3, 1)).not.toThrow()
    })
  })

  describe('drawMultilineTextLeft', () => {
    it('draws a single line starting at the given coordinate', () => {
      const canvas = mkCanvas(10, 4)
      drawMultilineTextLeft(canvas, 'Hello', 1, 1)
      const lines = canvasToString(canvas).split('\n')
      expect(lines[1]!.indexOf('Hello')).toBe(1)
    })

    it('places each subsequent line one row below the previous', () => {
      const canvas = mkCanvas(10, 5)
      drawMultilineTextLeft(canvas, 'Alpha\nBeta', 0, 0)
      const lines = canvasToString(canvas).split('\n')
      expect(lines[0]!.indexOf('Alpha')).toBe(0)
      expect(lines[1]!.indexOf('Beta')).toBe(0)
    })

    it('handles an empty label without throwing', () => {
      const canvas = mkCanvas(6, 3)
      expect(() => drawMultilineTextLeft(canvas, '', 0, 0)).not.toThrow()
    })
  })
})
