// ============================================================================
// Class diagrams with `direction LR` / `direction RL` in ASCII (issue #2158)
//
// TB and BT are drawn by the level-row layout in class-diagram.ts. LR and RL
// are lowered onto the flowchart grid (class-flow.ts): each level is a
// column, RL is the LR drawing mirrored, and the class-specific parts (box
// compartments, UML end markers, cardinalities, notes, lollipops, frames)
// follow the axis. mermaid.js 12.1.0 and 12.2.0 put each level in a column
// the same way.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { drawMultiBox } from '../draw-boxes.ts'
import { markerArrowChar } from '../draw-arrows.ts'
import { Down, Left, Right, Up } from '../types.ts'

const render = (body: string, dir: string, useAscii = false, extra = {}) =>
  renderMermaidASCII(`classDiagram\n  direction ${dir}\n${body}`, {
    useAscii,
    colorMode: 'none',
    ...extra,
  })

const rows = (s: string) => s.split('\n')

/** Column of the first occurrence of `needle`, and its row. */
function at(out: string, needle: string): { x: number; y: number } {
  const r = rows(out)
  const y = r.findIndex((l) => l.includes(needle))
  if (y < 0) throw new Error(`"${needle}" not found in\n${out}`)
  return { x: r[y]!.indexOf(needle), y }
}

const INHERIT = `  class Animal {
    +String name
    +eat() void
  }
  Animal <|-- Dog
  Animal <|-- Cat
  Animal "1" --> "*" Toy : owns`

describe('class diagram direction LR / RL in ASCII (#2158)', () => {
  describe('layout', () => {
    it('puts each level in a column: parent left, children stacked right (LR)', () => {
      const out = render(INHERIT, 'LR')
      const animal = at(out, 'Animal')
      const dog = at(out, 'Dog')
      const cat = at(out, 'Cat')
      const toy = at(out, 'Toy')
      expect(dog.x).toBeGreaterThan(animal.x + 'Animal'.length)
      expect(cat.x).toBe(dog.x)
      expect(toy.x).toBe(dog.x)
      expect(cat.y).toBeGreaterThan(dog.y)
      expect(toy.y).toBeGreaterThan(cat.y)
    })

    it('RL mirrors the columns: parent right, children left', () => {
      const out = render(INHERIT, 'RL')
      const animal = at(out, 'Animal')
      const dog = at(out, 'Dog')
      expect(dog.x).toBeLessThan(animal.x)
      expect(at(out, 'Cat').x).toBe(dog.x)
    })

    it('is a mirror image in structure: same words, same rows, no reversed text', () => {
      const lr = render(INHERIT, 'LR')
      const rl = render(INHERIT, 'RL')
      for (const word of [
        'Animal',
        '+ String name',
        '+ eat(): void',
        'Dog',
        'owns',
      ]) {
        expect(lr).toContain(word)
        expect(rl).toContain(word)
      }
      expect(rows(rl)).toHaveLength(rows(lr).length)
      // The same box rows, left to right swapped: the header row of Animal
      // sits on one row in both.
      expect(at(rl, 'Animal').y).toBe(at(lr, 'Animal').y)
    })

    it('keeps TB, BT and no-direction output exactly as before', () => {
      const none = renderMermaidASCII(`classDiagram\n${INHERIT}`)
      expect(render(INHERIT, 'TB')).toBe(none)
      expect(render(INHERIT, 'LR')).not.toBe(none)
      // a top-down drawing stacks Dog and Cat on one row
      expect(at(none, 'Dog').y).toBe(at(none, 'Cat').y)
      expect(render(INHERIT, 'BT')).not.toBe(none)
    })

    it('draws an empty diagram as before', () => {
      expect(renderMermaidASCII('classDiagram\n  direction LR')).toBe('')
    })

    it('uses the same compartment box as the top-down drawing', () => {
      const body = '  class A {\n    +int x\n    +run() void\n  }'
      const top = renderMermaidASCII(`classDiagram\n${body}`)
      // (the top-down canvas keeps a blank margin the flowchart one trims)
      const trim = (o: string) => o.replace(/ +$/gm, '').trimEnd()
      expect(trim(render(body, 'LR'))).toBe(trim(top))
      expect(trim(render(body, 'LR', true))).toBe(
        trim(renderMermaidASCII(`classDiagram\n${body}`, { useAscii: true })),
      )
      expect(rows(top).filter((l) => l.startsWith('├'))).toHaveLength(2)
    })
  })

  describe('relationship markers and lines', () => {
    const cases: [string, string, string, string, string, string][] = [
      // [label, source, LR glyph, RL glyph, ascii LR glyph, stroke]
      ['inheritance', 'A <|-- B', '◁', '▷', '<', '─'],
      ['realization', 'A <|.. B', '◁', '▷', '<', '┄'],
      ['composition', 'A *-- B', '◆', '◆', '*', '─'],
      ['aggregation', 'A o-- B', '◇', '◇', 'o', '─'],
      ['association', 'A --> B', '▶', '◀', '>', '─'],
      ['dependency', 'A ..> B', '▶', '◀', '>', '┄'],
    ]
    for (const [name, src, lr, rl, asciiLr, stroke] of cases) {
      it(`${name}: glyph at the marked end, ${stroke === '┄' ? 'dashed' : 'solid'} line`, () => {
        const a = render(`  ${src}`, 'LR')
        const b = render(`  ${src}`, 'RL')
        expect(a).toContain(lr)
        expect(b).toContain(rl)
        expect(a).toContain(stroke)
        const ascii = render(`  ${src}`, 'LR', true)
        expect(ascii).toContain(asciiLr)
        expect(ascii).not.toMatch(/[┌─│▶◁◆]/)
      })
    }

    it('marks the from end for `<|--` and the to end for `..|>`', () => {
      const from = render('  A <|-- B', 'LR')
      // the head sits against A's right border, on the line to B
      expect(from).toMatch(/│ A │◁─+┤ B │/)
      const to = render('  A ..|> B', 'LR')
      expect(to).toMatch(/│ A ├┄+▷│ B │/)
    })

    it('draws both ends of a two-ended relationship', () => {
      expect(render('  A <|--|> B', 'LR')).toMatch(/│ A │◁─+▷│ B │/)
      expect(render('  A <--> B', 'RL')).toMatch(/│ B │◀─+▶│ A │/)
    })

    it('points a vertical head into its box (lines that leave by a side face)', () => {
      const out = render(
        '  Animal <|-- Dog\n  Animal <|-- Cat\n  Animal <|-- Duck\n  Animal <|-- Bird',
        'LR',
      )
      expect(out).toContain('△')
      const { x, y } = at(out, '△')
      // a vertical stroke continues below the head
      expect(rows(out)[y + 1]![x]).toBe('│')
    })

    it('writes a label on its own line', () => {
      expect(render('  A --> B : uses', 'LR')).toMatch(/uses/)
      expect(render('  A --> B : uses', 'RL')).toMatch(/uses/)
    })

    it('hangs a multi-line label from <br>', () => {
      const out = render('  A --> B : first<br>second', 'LR')
      expect(out).toContain('first')
      expect(out).toContain('second')
    })
  })

  describe('cardinalities', () => {
    it('sets each beside its own end: source above the line, target below (LR)', () => {
      const out = render('  A "1" --> "many" B : owns', 'LR')
      const line = at(out, '▶')
      const one = at(out, '1')
      const many = at(out, 'many')
      expect(one.y).toBe(line.y - 1)
      expect(many.y).toBe(line.y + 1)
      // hugging their boxes
      expect(one.x).toBeLessThan(many.x)
    })

    it('mirrors to RL', () => {
      const out = render('  A "1" --> "many" B : owns', 'RL')
      const line = at(out, '◀')
      const one = at(out, '1')
      const many = at(out, 'many')
      expect(one.y).toBe(line.y - 1)
      expect(many.y).toBe(line.y + 1)
      expect(one.x).toBeGreaterThan(many.x)
      // text still reads left to right
      expect(out).toContain('many')
    })

    it('leaves a cardinality beside a vertical run, one blank column off', () => {
      const out = render(INHERIT, 'LR')
      expect(out).toContain('1')
      expect(out).toContain('*')
      const { x, y } = at(out, '*')
      expect(rows(out)[y]![x - 1]).not.toMatch(/[─│]/)
    })

    it('keeps every cardinality of a diagram', () => {
      const out = render(
        '  Teacher "1" --> "*" Course : teaches\n  Teacher "1" --> "*" Lab\n  Course "1" --> "1..*" Syllabus',
        'LR',
      )
      expect(out.match(/1\.\.\*/g)).toHaveLength(1)
      expect(out.match(/\*/g)!.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('namespaces', () => {
    const NS = `  namespace Domain {
    class Order
    class Item
  }
  namespace Infra {
    class Repo
  }
  Order "1" --> "*" Item : contains
  Repo ..> Order : stores`

    for (const dir of ['LR', 'RL']) {
      it(`frames each namespace around its members (${dir})`, () => {
        const out = render(NS, dir)
        const r = rows(out)
        const domain = r.findIndex((l) => l.includes('Domain'))
        expect(domain).toBeGreaterThanOrEqual(0)
        const order = at(out, 'Order')
        const item = at(out, 'Item')
        const repo = at(out, 'Repo')
        // Domain's frame is the one holding Order and Item, Infra's holds Repo
        const dx = r[domain]!.indexOf('Domain')
        const ix =
          r[domain]!.indexOf('Infra') >= 0
            ? r[domain]!.indexOf('Infra')
            : r.find((l) => l.includes('Infra'))!.indexOf('Infra')
        expect(Math.abs(order.x - dx)).toBeLessThan(40)
        expect(Math.abs(repo.x - ix)).toBeLessThan(20)
        expect(order.y).toBe(item.y)
        if (dir === 'LR') {
          expect(repo.x).toBeLessThan(order.x)
          expect(order.x).toBeLessThan(item.x)
        } else {
          expect(repo.x).toBeGreaterThan(order.x)
          expect(order.x).toBeGreaterThan(item.x)
        }
      })
    }
  })

  describe('notes', () => {
    const NOTE = '  class A\n  class B\n  A <|-- B\n  note for A "about A"'

    it('sits left of its class in LR, right in RL, joined by a dotted link', () => {
      const lr = render(NOTE, 'LR')
      expect(at(lr, 'about A').x).toBeLessThan(at(lr, '┤ A │').x)
      expect(lr).toContain('╭')
      expect(lr).toMatch(/┄/)
      const rl = render(NOTE, 'RL')
      expect(at(rl, 'about A').x).toBeGreaterThan(at(rl, '│ A ├').x)
    })

    it('draws a free note without a link', () => {
      const out = render('  class A\n  note "free"', 'LR')
      expect(out).toContain('free')
      expect(out).not.toContain('┄')
    })

    it('uses rounded corners in the ASCII charset too', () => {
      const out = render(NOTE, 'LR', true)
      expect(out).toContain('.')
      expect(out).toContain("'")
      expect(out).toContain('about A')
    })
  })

  describe('lollipops', () => {
    it('sets the interface name against its circle: name, circle, line, host (LR)', () => {
      const out = render('  Shape ()-- Drawable', 'LR')
      expect(out).toMatch(/Shape○─+┤ Drawable │/)
    })

    it('mirrors it for RL', () => {
      const out = render('  Shape ()-- Drawable', 'RL')
      expect(out).toMatch(/│ Drawable ├─+○Shape/)
    })

    it('handles the suffix form and the ASCII charset', () => {
      expect(render('  Drawable --() Shape', 'LR')).toMatch(
        /│ Drawable ├─+○Shape/,
      )
      expect(render('  Shape ()-- Drawable', 'LR', true)).toMatch(
        /ShapeO-+\+ Drawable \|/,
      )
    })
  })

  describe('self-loops', () => {
    it('loops back into the same class with the head on the box', () => {
      const out = render('  class A\n  A --> A : self', 'LR')
      expect(out).toContain('self')
      expect(out).toMatch(/[▲▼]/)
      expect(out).toContain('┘')
    })
  })

  describe('hyperlinks', () => {
    for (const dir of ['LR', 'RL']) {
      it(`links only the class name lines (${dir})`, () => {
        const out = render(
          '  class A {\n    <<service>>\n    +int x\n  }\n  A --> B\n  click A href "https://example.com/a"',
          dir,
          false,
          { hyperlinks: true },
        )
        const open = '\u001b]8;;https://example.com/a\u001b\\'
        expect(out).toContain(`${open}A`)
        expect(out).not.toContain(`${open}<<service>>`)
        expect(out).not.toContain(`${open}+`)
        expect(out.split(open)).toHaveLength(2)
        // stripping the links leaves the unlinked drawing
        const plain = render(
          '  class A {\n    <<service>>\n    +int x\n  }\n  A --> B\n  click A href "https://example.com/a"',
          dir,
        )
        // eslint-disable-next-line no-control-regex
        expect(out.replace(/\u001b\]8;;[^\u001b]*\u001b\\/g, '')).toBe(plain)
      })
    }
  })

  describe('dividers and crossings', () => {
    it('joins a line that meets a compartment divider into a cross', () => {
      const out = render(
        '  Animal <|-- Dog\n  class Dog {\n    +bark() void\n  }',
        'LR',
      )
      expect(out).toContain('┼')
      // never a bare `─├` / `┤─`: a stroke into a divider is joined
      expect(out).not.toMatch(/[─┄]├|┤[─┄]/)
    })

    it('colours a divider like the rest of the border', () => {
      const out = renderMermaidASCII(
        'classDiagram\n  direction LR\n  class A {\n    +int x\n    +run() void\n  }',
        { colorMode: 'ansi16' },
      )
      const divider = rows(out).find((l) => l.includes('├'))!
      // eslint-disable-next-line no-control-regex
      expect(divider).toMatch(/^\u001b\[\d+m├─+┤\u001b\[0m$/)
    })
  })

  describe('stretched boxes', () => {
    it('drawMultiBox fits a larger cell: wider is blank on the right', () => {
      const box = drawMultiBox([['A'], ['x']], false, 1, {
        width: 9,
        height: 7,
      })
      expect(box).toHaveLength(9)
      expect(box[0]).toHaveLength(7)
      expect(box[8]![2]).toBe('┤')
      expect(box[8]![0]).toBe('┐')
      // the extra rows sit at the bottom of the last compartment
      expect(box[2]![1]).toBe('A')
      expect(box[2]![3]).toBe('x')
      expect(box[2]![4]).toBe(' ')
      expect(box[2]![5]).toBe(' ')
      expect(box[2]![6]).toBe('─')
    })

    it('centres a single compartment in a taller cell', () => {
      const box = drawMultiBox([['A']], false, 1, { width: 5, height: 7 })
      expect(box[2]![3]).toBe('A')
    })

    it('never shrinks below its own size', () => {
      const box = drawMultiBox([['A']], false, 1, { width: 1, height: 1 })
      expect(box).toHaveLength(5)
    })
  })

  describe('marker glyphs', () => {
    it('picks the head by the way the line arrives', () => {
      expect(markerArrowChar(false, 'class-triangle', Up)).toBe('△')
      expect(markerArrowChar(false, 'class-triangle', Down)).toBe('▽')
      expect(markerArrowChar(false, 'class-triangle', Left)).toBe('◁')
      expect(markerArrowChar(false, 'class-triangle', Right)).toBe('▷')
      expect(markerArrowChar(false, 'class-arrow', Up)).toBe('▲')
      expect(markerArrowChar(false, 'class-arrow', Down)).toBe('▼')
      expect(markerArrowChar(false, 'class-arrow', Left)).toBe('◀')
      expect(markerArrowChar(false, 'class-arrow', Right)).toBe('▶')
      expect(markerArrowChar(true, 'class-arrow', Up)).toBe('^')
      expect(markerArrowChar(true, 'class-triangle', Down)).toBe('v')
      expect(markerArrowChar(true, 'class-triangle', Left)).toBe('<')
      expect(markerArrowChar(true, 'class-triangle', Right)).toBe('>')
    })

    it('defaults to pointing right and knows the omnidirectional ones', () => {
      expect(markerArrowChar(false, 'class-arrow')).toBe('▶')
      expect(markerArrowChar(false, 'class-diamond-filled')).toBe('◆')
      expect(markerArrowChar(true, 'class-diamond-filled')).toBe('*')
      expect(markerArrowChar(false, 'class-diamond')).toBe('◇')
      expect(markerArrowChar(true, 'class-diamond')).toBe('o')
      expect(markerArrowChar(false, 'class-circle')).toBe('○')
      expect(markerArrowChar(true, 'class-circle')).toBe('O')
      expect(markerArrowChar(false, 'circle')).toBe('○')
      expect(markerArrowChar(false, 'cross')).toBe('✕')
      expect(markerArrowChar(false, undefined)).toBeUndefined()
    })
  })
})
