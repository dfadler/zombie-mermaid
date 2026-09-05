/**
 * Class-diagram notes: `note "text"` and `note for ClassName "text"`
 * (issue #420, verified as unsupported in #422).
 *
 * Mermaid lays an attached note out as its own node joined to the class by
 * a dotted, arrowless link (classDb.getData); a free note is a lone node.
 * The SVG mirrors that through ELK; the ASCII renderer places the note
 * directly beside its class with a dashed connector.
 */
import { describe, it, expect } from 'vitest'
import { parseClassDiagram } from '../class/parser.ts'
import { layoutClassDiagramSync } from '../class/layout.ts'
import { renderMermaidSVG } from '../index.ts'
import { renderMermaidASCII } from '../ascii/index.ts'
import { splitStatements } from '../statements.ts'

/** Parse through the same statement splitter index.ts uses. */
function parse(text: string) {
  return parseClassDiagram(splitStatements(text))
}

/** Non-blank lines of an ASCII render. */
function rows(ascii: string): string[] {
  return ascii.split('\n').filter((l) => l.trim().length > 0)
}

// ============================================================================
// Parser
// ============================================================================

describe('parseClassDiagram – notes', () => {
  it('parses a free note', () => {
    const d = parse(`classDiagram
      note "This is a general note"
      class MyClass`)
    expect(d.notes).toEqual([{ text: 'This is a general note' }])
    expect(d.classes.map((c) => c.id)).toEqual(['MyClass'])
  })

  it('parses `note for X` and keeps the class reference', () => {
    const d = parse(`classDiagram
      class MyClass
      note for MyClass "This is a note for a class"`)
    expect(d.notes).toEqual([
      { text: 'This is a note for a class', forClass: 'MyClass' },
    ])
  })

  it('keeps notes in source order and does not require the class to be declared first', () => {
    const d = parse(`classDiagram
      note "first"
      note for MyClass "second"
      class MyClass{
      }`)
    expect(d.notes.map((n) => n.text)).toEqual(['first', 'second'])
    expect(d.notes[1]!.forClass).toBe('MyClass')
    // The note does not implicitly declare the class; the `class` line does
    expect(d.classes.map((c) => c.id)).toEqual(['MyClass'])
  })

  it('turns a literal \\n and a <br/> into line breaks', () => {
    const d = parse(`classDiagram
      note "line1\\nline2"
      note "a<br/>b"`)
    expect(d.notes[0]!.text).toBe('line1\nline2')
    expect(d.notes[1]!.text).toBe('a\nb')
  })

  it('does not mistake note text for a relationship or an inline member', () => {
    const d = parse(`classDiagram
      class A
      note "A -- B is not a relationship"
      note for A "type: not a member"`)
    expect(d.relationships).toHaveLength(0)
    expect(d.classes.map((c) => c.id)).toEqual(['A'])
    expect(d.classes[0]!.attributes).toHaveLength(0)
    expect(d.notes).toHaveLength(2)
  })

  it('does not treat a `note` line without a quoted string as a note', () => {
    const d = parse(`classDiagram
      class A
      note for A`)
    expect(d.notes).toHaveLength(0)
  })
})

// ============================================================================
// Layout
// ============================================================================

describe('layoutClassDiagramSync – notes', () => {
  it('positions every note and links an attached one to its class', () => {
    const p = layoutClassDiagramSync(
      parse(`classDiagram
        class A
        note for A "attached"
        note "free"`),
    )
    expect(p.notes).toHaveLength(2)
    const [attached, free] = p.notes
    expect(attached!.forClass).toBe('A')
    expect(attached!.linkPoints!.length).toBeGreaterThanOrEqual(2)
    expect(attached!.width).toBeGreaterThan(0)
    expect(attached!.height).toBeGreaterThan(0)
    expect(free!.forClass).toBeUndefined()
    expect(free!.linkPoints).toBeUndefined()
  })

  it('lays an attached note out above its class, as Mermaid does top-to-bottom', () => {
    const p = layoutClassDiagramSync(
      parse(`classDiagram
        class A
        note for A "attached"`),
    )
    const cls = p.classes.find((c) => c.id === 'A')!
    const note = p.notes[0]!
    expect(note.y + note.height).toBeLessThanOrEqual(cls.y)
  })

  it('does not link a note to a class that does not exist', () => {
    const p = layoutClassDiagramSync(
      parse(`classDiagram
        class A
        note for Missing "orphan"`),
    )
    expect(p.notes[0]!.forClass).toBeUndefined()
    expect(p.notes[0]!.linkPoints).toBeUndefined()
    expect(p.classes.map((c) => c.id)).toEqual(['A'])
  })

  it('keeps relationships positional when note links follow them', () => {
    const p = layoutClassDiagramSync(
      parse(`classDiagram
        Animal <|-- Dog
        note for Animal "n"
        Dog --> Toy : plays`),
    )
    expect(p.relationships.map((r) => `${r.from}>${r.to}`)).toEqual([
      'Animal>Dog',
      'Dog>Toy',
    ])
    expect(p.relationships[1]!.label).toBe('plays')
    expect(p.notes[0]!.linkPoints).toBeDefined()
  })

  it('lays out a diagram that is nothing but a note', () => {
    const p = layoutClassDiagramSync(parse(`classDiagram\n  note "alone"`))
    expect(p.classes).toHaveLength(0)
    expect(p.notes).toHaveLength(1)
    expect(p.width).toBeGreaterThan(0)
  })
})

// ============================================================================
// SVG
// ============================================================================

describe('renderMermaidSVG – class diagram notes', () => {
  it('renders an attached note as a dog-eared box with a dotted link', () => {
    const svg = renderMermaidSVG(`classDiagram
      class MyClass {
        +int id
      }
      note for MyClass "This is a note for a class"`)
    expect(svg).toContain('<g class="class-note" data-for="MyClass">')
    expect(svg).toContain('This is a note for a class')
    // Two polygons: the clipped body and the fold triangle
    const noteGroup = svg.slice(
      svg.indexOf('<g class="class-note"'),
      svg.indexOf('</g>', svg.indexOf('<g class="class-note"')),
    )
    expect(noteGroup.match(/<polygon/g)).toHaveLength(2)
    // Dotted, arrowless link
    const link = svg.match(/<polyline class="class-note-link"[^>]*>/)
    expect(link).not.toBeNull()
    expect(link![0]).toContain('data-for="MyClass"')
    expect(link![0]).toContain('stroke-dasharray')
    expect(link![0]).not.toContain('marker-')
  })

  it('renders a free note with no link', () => {
    const svg = renderMermaidSVG(`classDiagram
      note "This is a general note"
      class MyClass`)
    expect(svg).toContain('<g class="class-note">')
    expect(svg).toContain('This is a general note')
    expect(svg).not.toContain('class-note-link')
  })

  it('renders a multi-line note as tspans', () => {
    const svg = renderMermaidSVG(`classDiagram
      class A
      note for A "line1\\nline2"`)
    expect(svg).toContain('>line1</tspan>')
    expect(svg).toContain('>line2</tspan>')
  })

  it('escapes note text', () => {
    const svg = renderMermaidSVG(`classDiagram
      class A
      note for A "<script>alert(1)</script>"`)
    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&lt;script&gt;')
  })

  it('leaves a note on theme variables when its class is styled', () => {
    const svg = renderMermaidSVG(`classDiagram
      class Animal:::hot
      note for Animal "unstyled"
      classDef hot fill:#f96`)
    const noteGroup = svg.slice(
      svg.indexOf('<g class="class-note"'),
      svg.indexOf('</g>', svg.indexOf('<g class="class-note"')),
    )
    expect(noteGroup).toContain('fill="var(--bg)"')
    expect(noteGroup).not.toContain('#f96')
  })
})

// ============================================================================
// ASCII
// ============================================================================

describe('renderMermaidASCII – class diagram notes', () => {
  it('draws an attached note as a rounded box directly right of its class, joined by a dashed line', () => {
    const ascii = renderMermaidASCII(`classDiagram
      class MyClass {
        +int id
      }
      note for MyClass "This is a note for a class"`)
    const r = rows(ascii)
    // Row 0: class top border, then the note's rounded top border
    expect(r[0]).toMatch(/^┌─+┐\s+╭─+╮\s*$/)
    // Row 1: class name, dashed connector, note text
    expect(r[1]).toMatch(/^│ MyClass\s+│╌+│ This is a note for a class │\s*$/)
    // Row 2: the note is only 3 rows tall, so its bottom border sits here
    expect(r[2]).toMatch(/╰─+╯\s*$/)
    // The note's corners are all rounded, never square
    const noteStart = r[0]!.indexOf('╭')
    expect(r[2]!.charAt(noteStart)).toBe('╰')
  })

  it('uses ASCII rounded corners and dots in ascii mode', () => {
    const ascii = renderMermaidASCII(
      `classDiagram
        class A
        note for A "n"`,
      { useAscii: true },
    )
    const r = rows(ascii)
    expect(r[0]).toMatch(/^\+-+\+\s+\.-+\.\s*$/)
    expect(r[1]).toMatch(/^\| A \|\.+\| n \|\s*$/)
    expect(r[2]).toMatch(/^\+-+\+\s+'-+'\s*$/)
  })

  it('places a free note on the top row with no connector', () => {
    const ascii = renderMermaidASCII(`classDiagram
      note "This is a general note"
      class MyClass`)
    const r = rows(ascii)
    expect(r[1]).toMatch(/^│ MyClass │\s+│ This is a general note │\s*$/)
    expect(ascii).not.toContain('╌')
  })

  it('renders a multi-line note', () => {
    const ascii = renderMermaidASCII(`classDiagram
      class A
      note for A "Best friend\\nof humans"`)
    expect(ascii).toContain('│ Best friend │')
    expect(ascii).toContain('│ of humans   │')
  })

  it('keeps an attached note on its class’s row below a parent', () => {
    const ascii = renderMermaidASCII(`classDiagram
      Animal <|-- Dog
      note for Dog "note on Dog"`)
    const r = rows(ascii)
    const dogRow = r.findIndex((l) => l.includes('│ Dog │'))
    expect(dogRow).toBeGreaterThan(0)
    expect(r[dogRow]).toMatch(/│ Dog │╌+│ note on Dog │/)
    // Nothing on the Animal row but Animal
    expect(r[1]).toMatch(/^│ Animal │\s*$/)
  })

  it('does not overwrite a relationship line that crosses the connector gap', () => {
    const ascii = renderMermaidASCII(`classDiagram
      Base <|-- Left
      Base <|-- Right
      note for Left "note on the first child"
      Left --> Right : uses`)
    const r = rows(ascii)
    const leftRow = r.find((l) => l.includes('│ Left │'))!
    // The Base→Right vertical passes through the gap: it survives, the
    // dashes fill the blank cells around it.
    expect(leftRow).toMatch(/│ Left ││╌+│ note on the first child │/)
  })

  it('renders a note whose class does not exist as a free note', () => {
    const ascii = renderMermaidASCII(`classDiagram
      class A
      note for Missing "orphan"`)
    expect(ascii).toContain('│ orphan │')
    expect(ascii).not.toContain('╌')
    expect(ascii).not.toContain('Missing')
  })

  it('renders a diagram that is nothing but a note', () => {
    const ascii = renderMermaidASCII(`classDiagram
      note "Just a note"`)
    expect(rows(ascii).map((l) => l.trimEnd())).toEqual([
      '╭─────────────╮',
      '│ Just a note │',
      '╰─────────────╯',
    ])
  })
})
