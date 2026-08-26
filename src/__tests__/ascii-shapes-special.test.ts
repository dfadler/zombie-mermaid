/**
 * Coverage for src/ascii/shapes/special.ts — the "special" flowchart node
 * shapes: subroutine `[[text]]`, doublecircle `(((text)))`, cylinder
 * `[(text)]`, asymmetric `>text]`, trapezoid `[/text\]`, and trapezoid-alt
 * `[\text/]`. None of these shapes were exercised anywhere before this file.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'
import { canvasToString } from '../ascii/canvas.ts'
import { Up, Down, Left, Right } from '../ascii/types.ts'
import {
  subroutineRenderer,
  doublecircleRenderer,
  cylinderRenderer,
  asymmetricRenderer,
  trapezoidRenderer,
  trapezoidAltRenderer,
} from '../ascii/shapes/special.ts'
import type { ShapeRenderOptions } from '../ascii/shapes/types.ts'

const unicodeOpts: ShapeRenderOptions = { useAscii: false, padding: 1 }
const asciiOpts: ShapeRenderOptions = { useAscii: true, padding: 1 }

describe('subroutine shape [[text]]', () => {
  it('renders with its distinctive corner markers in a flowchart', () => {
    const src = `flowchart TD
  A[[Subroutine]]`
    const out = renderMermaidASCII(src, { useAscii: false })
    expect(out).toContain('Subroutine')
    expect(out).toContain('╟')
    expect(out).toContain('╢')
  })

  it('renders the ASCII fallback in a flowchart', () => {
    const src = `flowchart TD
  A[[Task]]`
    const out = renderMermaidASCII(src, { useAscii: true })
    expect(out).toContain('Task')
  })

  it('computes dimensions with double borders on each side', () => {
    const dims = subroutineRenderer.getDimensions('Hi', unicodeOpts)
    expect(dims.gridColumns).toEqual([2, 4, 2])
    expect(dims.gridRows).toEqual([1, 3, 1])
    expect(dims.width).toBe(8)
    expect(dims.height).toBe(5)
  })

  it('draws double vertical bars on each side and centers the label', () => {
    const dims = subroutineRenderer.getDimensions('Hi', unicodeOpts)
    const canvas = subroutineRenderer.render('Hi', dims, unicodeOpts)
    const str = canvasToString(canvas)
    const lines = str.split('\n')
    expect(lines[0]).toBe('┌┬────┬┐')
    expect(lines[lines.length - 1]).toBe('└┴────┴┘')
    expect(lines.some((l) => l.includes('Hi'))).toBe(true)
    for (const line of lines.slice(1, -1)) {
      expect(line.slice(0, 2)).toBe('││')
      expect(line.slice(-2)).toBe('││')
    }
  })

  it('draws ASCII "+" borders when useAscii is set', () => {
    const dims = subroutineRenderer.getDimensions('Hi', asciiOpts)
    const canvas = subroutineRenderer.render('Hi', dims, asciiOpts)
    const str = canvasToString(canvas)
    const lines = str.split('\n')
    expect(lines[0]).toBe('++----++')
    expect(lines[lines.length - 1]).toBe('++----++')
  })

  it('stacks multiline labels centered vertically', () => {
    const dims = subroutineRenderer.getDimensions('one\ntwo', unicodeOpts)
    const canvas = subroutineRenderer.render('one\ntwo', dims, unicodeOpts)
    const str = canvasToString(canvas)
    expect(str).toContain('one')
    expect(str).toContain('two')
  })

  it('clips label cells that fall outside the pre-computed box bounds', () => {
    const dims = subroutineRenderer.getDimensions('Hi', unicodeOpts)
    const canvas = subroutineRenderer.render(
      'Much Too Wide For This Box',
      dims,
      unicodeOpts,
    )
    expect(() => canvasToString(canvas)).not.toThrow()
  })

  it('reuses the shared box attachment point logic', () => {
    const dims = subroutineRenderer.getDimensions('Hi', unicodeOpts)
    const base = { x: 0, y: 0 }
    expect(subroutineRenderer.getAttachmentPoint(Down, dims, base)).toEqual({
      x: Math.floor(dims.width / 2),
      y: dims.height - 1,
    })
    expect(subroutineRenderer.getAttachmentPoint(Up, dims, base)).toEqual({
      x: Math.floor(dims.width / 2),
      y: 0,
    })
  })
})

describe('doublecircle shape (((text)))', () => {
  it('renders concentric-circle corner markers in a flowchart', () => {
    const src = `flowchart TD
  A(((Final)))`
    const out = renderMermaidASCII(src, { useAscii: false })
    expect(out).toContain('Final')
    expect(out).toContain('◎')
  })

  it('renders the ASCII fallback marker', () => {
    const src = `flowchart TD
  A(((Done)))`
    const out = renderMermaidASCII(src, { useAscii: true })
    expect(out).toContain('Done')
    expect(out).toContain('@')
  })

  it('delegates to the shared box renderer with doublecircle corners', () => {
    const dims = doublecircleRenderer.getDimensions('X', unicodeOpts)
    const canvas = doublecircleRenderer.render('X', dims, unicodeOpts)
    const str = canvasToString(canvas)
    const lines = str.split('\n')
    expect(lines[0]!.startsWith('◎')).toBe(true)
    expect(lines[0]!.endsWith('◎')).toBe(true)
    expect(lines[lines.length - 1]!.startsWith('◎')).toBe(true)
  })
})

describe('cylinder shape [(text)]', () => {
  it('renders a database cylinder in a flowchart', () => {
    const src = `flowchart TD
  A[(Database)]`
    const out = renderMermaidASCII(src, { useAscii: false })
    expect(out).toContain('Database')
    expect(out).toMatch(/╭─+╮/)
    expect(out).toMatch(/╰─+╯/)
  })

  it('renders ASCII-charset ellipse fallback characters', () => {
    const src = `flowchart TD
  A[(Store)]`
    const out = renderMermaidASCII(src, { useAscii: true })
    expect(out).toContain('Store')
    expect(out).toMatch(/\.-+\./)
    expect(out).toMatch(/'-+'/)
  })

  it('computes extra height for the curved top/bottom rows', () => {
    const dims = cylinderRenderer.getDimensions('DB', unicodeOpts)
    expect(dims.gridRows[0]).toBe(2)
    expect(dims.gridRows[2]).toBe(2)
    expect(dims.labelArea.y).toBe(3)
  })

  it('draws the double-row ellipse caps and centers the label', () => {
    const dims = cylinderRenderer.getDimensions('DB', unicodeOpts)
    const canvas = cylinderRenderer.render('DB', dims, unicodeOpts)
    const str = canvasToString(canvas)
    const lines = str.split('\n')
    expect(lines[0]!.startsWith('╭')).toBe(true)
    expect(lines[0]!.endsWith('╮')).toBe(true)
    expect(lines[1]).toMatch(/^│─+│$/)
    expect(lines[lines.length - 2]).toMatch(/^│─+│$/)
    expect(lines[lines.length - 1]!.startsWith('╰')).toBe(true)
    expect(lines[lines.length - 1]!.endsWith('╯')).toBe(true)
    expect(str).toContain('DB')
  })

  it('draws ASCII fallback caps', () => {
    const dims = cylinderRenderer.getDimensions('DB', asciiOpts)
    const canvas = cylinderRenderer.render('DB', dims, asciiOpts)
    const str = canvasToString(canvas)
    const lines = str.split('\n')
    expect(lines[0]!.startsWith('.')).toBe(true)
    expect(lines[0]!.endsWith('.')).toBe(true)
    expect(lines[lines.length - 1]!.startsWith("'")).toBe(true)
    expect(lines[lines.length - 1]!.endsWith("'")).toBe(true)
  })

  it('stacks multiline labels inside the cylinder body', () => {
    const dims = cylinderRenderer.getDimensions('one\ntwo', unicodeOpts)
    const canvas = cylinderRenderer.render('one\ntwo', dims, unicodeOpts)
    const str = canvasToString(canvas)
    expect(str).toContain('one')
    expect(str).toContain('two')
  })

  it('clips label cells that fall outside the pre-computed box bounds', () => {
    const dims = cylinderRenderer.getDimensions('DB', unicodeOpts)
    const canvas = cylinderRenderer.render(
      'Much Too Wide For This Cylinder',
      dims,
      unicodeOpts,
    )
    expect(() => canvasToString(canvas)).not.toThrow()
  })

  it('reuses the shared box attachment point logic', () => {
    const dims = cylinderRenderer.getDimensions('DB', unicodeOpts)
    const base = { x: 2, y: 3 }
    const left = cylinderRenderer.getAttachmentPoint(Left, dims, base)
    const right = cylinderRenderer.getAttachmentPoint(Right, dims, base)
    expect(left.x).toBe(base.x)
    expect(right.x).toBe(base.x + dims.width - 1)
  })
})

describe('asymmetric (flag) shape >text]', () => {
  it('renders arrow markers on the left corners in a flowchart', () => {
    const src = `flowchart TD
  A>Flag]`
    const out = renderMermaidASCII(src, { useAscii: false })
    expect(out).toContain('Flag')
    expect(out).toContain('▷')
  })

  it('renders the ASCII fallback marker', () => {
    const src = `flowchart TD
  A>Note]`
    const out = renderMermaidASCII(src, { useAscii: true })
    expect(out).toContain('Note')
    expect(out).toContain('>')
  })

  it('delegates to the shared box renderer with asymmetric corners', () => {
    const dims = asymmetricRenderer.getDimensions('X', unicodeOpts)
    const canvas = asymmetricRenderer.render('X', dims, unicodeOpts)
    const str = canvasToString(canvas)
    const lines = str.split('\n')
    expect(lines[0]!.startsWith('▷')).toBe(true)
    expect(lines[0]!.endsWith('┐')).toBe(true)
    expect(lines[lines.length - 1]!.startsWith('▷')).toBe(true)
    expect(lines[lines.length - 1]!.endsWith('┘')).toBe(true)
  })
})

describe('trapezoid shape [/text\\]', () => {
  it('renders slope markers on the top corners in a flowchart', () => {
    const src = `flowchart TD
  A[/Wide Bottom\\]`
    const out = renderMermaidASCII(src, { useAscii: false })
    expect(out).toContain('Wide Bottom')
  })

  it('delegates to the shared box renderer with trapezoid corners', () => {
    const dims = trapezoidRenderer.getDimensions('X', unicodeOpts)
    const canvas = trapezoidRenderer.render('X', dims, unicodeOpts)
    const str = canvasToString(canvas)
    const lines = str.split('\n')
    expect(lines[0]!.startsWith('/')).toBe(true)
    expect(lines[0]!.endsWith('\\')).toBe(true)
    expect(lines[lines.length - 1]!.startsWith('└')).toBe(true)
    expect(lines[lines.length - 1]!.endsWith('┘')).toBe(true)
  })
})

describe('trapezoid-alt shape [\\text/]', () => {
  it('renders slope markers on the bottom corners in a flowchart', () => {
    const src = `flowchart TD
  A[\\Wide Top/]`
    const out = renderMermaidASCII(src, { useAscii: false })
    expect(out).toContain('Wide Top')
  })

  it('delegates to the shared box renderer with trapezoid-alt corners', () => {
    const dims = trapezoidAltRenderer.getDimensions('X', unicodeOpts)
    const canvas = trapezoidAltRenderer.render('X', dims, unicodeOpts)
    const str = canvasToString(canvas)
    const lines = str.split('\n')
    expect(lines[0]!.startsWith('┌')).toBe(true)
    expect(lines[0]!.endsWith('┐')).toBe(true)
    expect(lines[lines.length - 1]!.startsWith('\\')).toBe(true)
    expect(lines[lines.length - 1]!.endsWith('/')).toBe(true)
  })
})

describe('special shapes connected in a diagram', () => {
  it('renders edges between multiple special shapes without diagonal artifacts', () => {
    const src = `flowchart TD
  A[[Sub]] --> B[(DB)]
  B --> C(((Done)))
  C --> D>Flag]
  D --> E[/Trap\\]
  E --> F[\\TrapAlt/]`
    const out = renderMermaidASCII(src, { useAscii: false })
    expect(out).toContain('Sub')
    expect(out).toContain('DB')
    expect(out).toContain('Done')
    expect(out).toContain('Flag')
    expect(out).toContain('Trap')
    expect(out).toContain('TrapAlt')
  })
})
