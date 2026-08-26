import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'
import { stadiumRenderer } from '../ascii/shapes/stadium.ts'
import type { Canvas } from '../ascii/types.ts'

function canvasToLines(canvas: Canvas): string[] {
  const height = canvas[0]?.length ?? 0
  const lines: string[] = []
  for (let y = 0; y < height; y++) {
    let row = ''
    for (let x = 0; x < canvas.length; x++) row += canvas[x]![y]
    lines.push(row)
  }
  return lines
}

describe('stadium shape (flowchart integration)', () => {
  it('renders a short single-line stadium label in unicode mode', () => {
    const ascii = renderMermaidASCII('graph TD\n  A([Start])', {
      useAscii: false,
    })
    expect(ascii).toContain('Start')
    expect(ascii).toContain('(')
    expect(ascii).toContain(')')
  })

  it('renders a short single-line stadium label in ascii mode', () => {
    const ascii = renderMermaidASCII('graph TD\n  A([Start])', {
      useAscii: true,
    })
    expect(ascii).toContain('Start')
    expect(ascii).toContain('(')
    expect(ascii).toContain(')')
    expect(ascii).toContain('-')
  })

  it('sizes the stadium wider for a longer label', () => {
    const shortAscii = renderMermaidASCII('graph TD\n  A([Hi])', {
      useAscii: false,
    })
    const longAscii = renderMermaidASCII(
      'graph TD\n  A([This is a fairly long stadium label])',
      { useAscii: false },
    )
    const shortWidth = Math.max(...shortAscii.split('\n').map((l) => l.length))
    const longWidth = Math.max(...longAscii.split('\n').map((l) => l.length))
    expect(longAscii).toContain('This is a fairly long stadium label')
    expect(longWidth).toBeGreaterThan(shortWidth)
  })

  it('renders a two-line stadium label with lines stacked in order', () => {
    const ascii = renderMermaidASCII('graph TD\n  A([Line1<br>Line2])', {
      useAscii: false,
    })
    expect(ascii).toContain('Line1')
    expect(ascii).toContain('Line2')
    const lines = ascii.split('\n')
    const line1Row = lines.findIndex((l) => l.includes('Line1'))
    const line2Row = lines.findIndex((l) => l.includes('Line2'))
    expect(line2Row).toBeGreaterThan(line1Row)
  })

  it('renders a three-line stadium label in ascii mode', () => {
    const ascii = renderMermaidASCII('graph TD\n  A([One<br>Two<br>Three])', {
      useAscii: true,
    })
    expect(ascii).toContain('One')
    expect(ascii).toContain('Two')
    expect(ascii).toContain('Three')
  })

  it('connects an edge between two stadium nodes', () => {
    const ascii = renderMermaidASCII('graph TD\n  A([Begin]) --> B([End])', {
      useAscii: false,
    })
    expect(ascii).toContain('Begin')
    expect(ascii).toContain('End')
  })
})

describe('stadiumRenderer.getDimensions', () => {
  it('sizes a single-line label with the given padding', () => {
    const dims = stadiumRenderer.getDimensions('Start', {
      useAscii: false,
      padding: 1,
    })
    expect(dims).toEqual({
      width: 11,
      height: 5,
      labelArea: { x: 3, y: 2, width: 5, height: 1 },
      gridColumns: [2, 7, 2],
      gridRows: [1, 3, 1],
    })
  })

  it('collapses to the minimum 3-row height with zero padding', () => {
    const dims = stadiumRenderer.getDimensions('Start', {
      useAscii: false,
      padding: 0,
    })
    expect(dims.height).toBe(3)
    expect(dims.width).toBe(9)
  })

  it('grows height for multi-line labels', () => {
    const dims = stadiumRenderer.getDimensions('Line1\nLine2', {
      useAscii: false,
      padding: 1,
    })
    expect(dims).toEqual({
      width: 11,
      height: 6,
      labelArea: { x: 3, y: 2, width: 5, height: 2 },
      gridColumns: [2, 7, 2],
      gridRows: [1, 4, 1],
    })
  })

  it('sizes width to the widest of several lines', () => {
    const dims = stadiumRenderer.getDimensions('Short\nA much longer line', {
      useAscii: false,
      padding: 1,
    })
    expect(dims.labelArea.width).toBe('A much longer line'.length)
  })
})

describe('stadiumRenderer.render', () => {
  it('renders a single-row pill when height collapses to 3', () => {
    const dims = stadiumRenderer.getDimensions('Start', {
      useAscii: false,
      padding: 0,
    })
    const canvas = stadiumRenderer.render('Start', dims, {
      useAscii: false,
      padding: 0,
    })
    expect(canvasToLines(canvas)).toEqual([
      '         ',
      '( Start )',
      '         ',
    ])
  })

  it('renders rounded corners for multi-row unicode mode', () => {
    const dims = stadiumRenderer.getDimensions('Line1\nLine2', {
      useAscii: false,
      padding: 1,
    })
    const canvas = stadiumRenderer.render('Line1\nLine2', dims, {
      useAscii: false,
      padding: 1,
    })
    expect(canvasToLines(canvas)).toEqual([
      '╭─────────╮',
      '│         │',
      '│         │',
      '│  Line1  │',
      '│  Line2  │',
      '╰─────────╯',
    ])
  })

  it('renders parentheses on all sides for multi-row ascii mode', () => {
    const dims = stadiumRenderer.getDimensions('Line1\nLine2', {
      useAscii: true,
      padding: 1,
    })
    const canvas = stadiumRenderer.render('Line1\nLine2', dims, {
      useAscii: true,
      padding: 1,
    })
    expect(canvasToLines(canvas)).toEqual([
      '(---------)',
      '(         )',
      '(         )',
      '(  Line1  )',
      '(  Line2  )',
      '(---------)',
    ])
  })

  it('centers an odd number of label lines around the vertical middle', () => {
    const dims = stadiumRenderer.getDimensions('One\nTwo\nThree', {
      useAscii: false,
      padding: 1,
    })
    const canvas = stadiumRenderer.render('One\nTwo\nThree', dims, {
      useAscii: false,
      padding: 1,
    })
    expect(canvasToLines(canvas)).toEqual([
      '╭─────────╮',
      '│         │',
      '│   One   │',
      '│   Two   │',
      '│  Three  │',
      '│         │',
      '╰─────────╯',
    ])
  })

  it('clips label characters that fall outside the canvas bounds', () => {
    const dims = {
      width: 5,
      height: 3,
      labelArea: { x: 1, y: 1, width: 3, height: 1 },
      gridColumns: [1, 3, 1] as [number, number, number],
      gridRows: [1, 1, 1] as [number, number, number],
    }
    const canvas = stadiumRenderer.render('VeryLongLabelText', dims, {
      useAscii: false,
      padding: 0,
    })
    expect(canvasToLines(canvas)).toEqual(['     ', '(gLa)', '     '])
  })
})
