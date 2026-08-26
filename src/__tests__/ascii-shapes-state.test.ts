import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'
import { stateStartRenderer, stateEndRenderer } from '../ascii/shapes/state.ts'
import { canvasToString } from '../ascii/canvas.ts'
import { Up, Down, Left, Right, Middle, UpperLeft } from '../ascii/types.ts'
import type { ShapeRenderOptions } from '../ascii/shapes/types.ts'

const unicodeOptions: ShapeRenderOptions = { useAscii: false, padding: 1 }
const asciiOptions: ShapeRenderOptions = { useAscii: true, padding: 1 }

describe('stateStartRenderer (direct unit tests)', () => {
  it('reports fixed 5x3 dimensions regardless of label', () => {
    const dims = stateStartRenderer.getDimensions('', unicodeOptions)
    expect(dims.width).toBe(5)
    expect(dims.height).toBe(3)
    expect(dims.labelArea).toEqual({ x: 2, y: 1, width: 1, height: 1 })
    expect(dims.gridColumns).toEqual([1, 3, 1])
    expect(dims.gridRows).toEqual([1, 1, 1])
  })

  it('renders a rounded box with a filled circle in Unicode mode', () => {
    const dims = stateStartRenderer.getDimensions('', unicodeOptions)
    const canvas = stateStartRenderer.render('', dims, unicodeOptions)
    expect(canvasToString(canvas)).toBe('╭───╮\n│ ● │\n╰───╯')
  })

  it('renders a rounded box with an asterisk in ASCII mode', () => {
    const dims = stateStartRenderer.getDimensions('', asciiOptions)
    const canvas = stateStartRenderer.render('', dims, asciiOptions)
    expect(canvasToString(canvas)).toBe(".---.\n| * |\n'---'")
  })

  it('computes attachment points on each cardinal border', () => {
    const dims = stateStartRenderer.getDimensions('', unicodeOptions)
    const base = { x: 10, y: 20 }

    expect(stateStartRenderer.getAttachmentPoint(Up, dims, base)).toEqual({
      x: 12,
      y: 20,
    })
    expect(stateStartRenderer.getAttachmentPoint(Down, dims, base)).toEqual({
      x: 12,
      y: 22,
    })
    expect(stateStartRenderer.getAttachmentPoint(Left, dims, base)).toEqual({
      x: 10,
      y: 21,
    })
    expect(stateStartRenderer.getAttachmentPoint(Right, dims, base)).toEqual({
      x: 14,
      y: 21,
    })
  })

  it('falls back to the center point for diagonal/middle directions', () => {
    const dims = stateStartRenderer.getDimensions('', unicodeOptions)
    const base = { x: 10, y: 20 }

    expect(
      stateStartRenderer.getAttachmentPoint(UpperLeft, dims, base),
    ).toEqual({ x: 12, y: 21 })
    expect(stateStartRenderer.getAttachmentPoint(Middle, dims, base)).toEqual({
      x: 12,
      y: 21,
    })
  })
})

describe('stateEndRenderer (direct unit tests)', () => {
  it('reports fixed 5x3 dimensions regardless of label', () => {
    const dims = stateEndRenderer.getDimensions('', unicodeOptions)
    expect(dims.width).toBe(5)
    expect(dims.height).toBe(3)
    expect(dims.labelArea).toEqual({ x: 2, y: 1, width: 1, height: 1 })
    expect(dims.gridColumns).toEqual([1, 3, 1])
    expect(dims.gridRows).toEqual([1, 1, 1])
  })

  it('renders a double-bordered box with a bullseye in Unicode mode', () => {
    const dims = stateEndRenderer.getDimensions('', unicodeOptions)
    const canvas = stateEndRenderer.render('', dims, unicodeOptions)
    expect(canvasToString(canvas)).toBe('╔═══╗\n║ ◎ ║\n╚═══╝')
  })

  it('renders a double-bordered box with an asterisk in ASCII mode', () => {
    const dims = stateEndRenderer.getDimensions('', asciiOptions)
    const canvas = stateEndRenderer.render('', dims, asciiOptions)
    expect(canvasToString(canvas)).toBe('#===#\n# * #\n#===#')
  })

  it('computes attachment points on each cardinal border', () => {
    const dims = stateEndRenderer.getDimensions('', unicodeOptions)
    const base = { x: 10, y: 20 }

    expect(stateEndRenderer.getAttachmentPoint(Up, dims, base)).toEqual({
      x: 12,
      y: 20,
    })
    expect(stateEndRenderer.getAttachmentPoint(Down, dims, base)).toEqual({
      x: 12,
      y: 22,
    })
    expect(stateEndRenderer.getAttachmentPoint(Left, dims, base)).toEqual({
      x: 10,
      y: 21,
    })
    expect(stateEndRenderer.getAttachmentPoint(Right, dims, base)).toEqual({
      x: 14,
      y: 21,
    })
  })

  it('falls back to the center point for diagonal/middle directions', () => {
    const dims = stateEndRenderer.getDimensions('', unicodeOptions)
    const base = { x: 10, y: 20 }

    expect(stateEndRenderer.getAttachmentPoint(UpperLeft, dims, base)).toEqual({
      x: 12,
      y: 21,
    })
    expect(stateEndRenderer.getAttachmentPoint(Middle, dims, base)).toEqual({
      x: 12,
      y: 21,
    })
  })
})

describe('stateDiagram-v2 rendering (integration)', () => {
  it('renders a single regular state with start and end pseudostates (Unicode)', () => {
    const out = renderMermaidASCII(
      `stateDiagram-v2
  [*] --> Idle
  Idle --> [*]`,
      { colorMode: 'none' },
    )
    expect(out).toContain('●')
    expect(out).toContain('Idle')
    expect(out).toContain('╔')
    expect(out).toContain('╝')
  })

  it('renders a single regular state with start and end pseudostates (ASCII)', () => {
    const out = renderMermaidASCII(
      `stateDiagram-v2
  [*] --> Idle
  Idle --> [*]`,
      { colorMode: 'none', useAscii: true },
    )
    expect(out).toContain('*')
    expect(out).toContain('Idle')
    expect(out).toContain('#')
  })

  it('renders a multi-state chain with labeled transitions', () => {
    const out = renderMermaidASCII(
      `stateDiagram-v2
  [*] --> Idle
  Idle --> Processing: start
  Processing --> Complete: done
  Complete --> [*]`,
      { colorMode: 'none' },
    )
    expect(out).toContain('Idle')
    expect(out).toContain('Processing')
    expect(out).toContain('Complete')
    expect(out).toContain('start')
    expect(out).toContain('done')
  })

  it('renders a longer state label at a larger box size without breaking the pseudostate glyphs', () => {
    const out = renderMermaidASCII(
      `stateDiagram-v2
  [*] --> AwaitingConfirmationFromUser
  AwaitingConfirmationFromUser --> [*]`,
      { colorMode: 'none' },
    )
    expect(out).toContain('AwaitingConfirmationFromUser')
    expect(out).toContain('●')
    expect(out).toContain('╔')
    expect(out).toContain('╝')
  })

  it('renders fan-out from the start pseudostate to multiple states', () => {
    const out = renderMermaidASCII(
      `stateDiagram-v2
  [*] --> Idle
  [*] --> Error`,
      { colorMode: 'none' },
    )
    expect(out).toContain('Idle')
    expect(out).toContain('Error')
    expect(out).toContain('●')
  })

  it('renders fan-in from multiple states into the end pseudostate', () => {
    const out = renderMermaidASCII(
      `stateDiagram-v2
  Idle --> [*]
  Error --> [*]`,
      { colorMode: 'none' },
    )
    expect(out).toContain('Idle')
    expect(out).toContain('Error')
    expect(out).toContain('╔')
    expect(out).toContain('╝')
  })

  it('renders multiple distinct start/end pseudostates with unique ids', () => {
    const out = renderMermaidASCII(
      `stateDiagram-v2
  [*] --> A
  A --> [*]
  [*] --> B
  B --> [*]`,
      { colorMode: 'none' },
    )
    expect(out).toContain('A')
    expect(out).toContain('B')
    const startGlyphCount = (out.match(/●/g) ?? []).length
    const endBorderCount = (out.match(/[╔╚╝╗]/g) ?? []).length
    expect(startGlyphCount).toBeGreaterThan(0)
    expect(endBorderCount).toBeGreaterThan(0)
  })
})
