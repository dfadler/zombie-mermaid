import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import {
  stateStartRenderer,
  stateEndRenderer,
  forkJoinRenderer,
} from '../shapes/state.ts'
import { diamondRenderer } from '../shapes/index.ts'
import { canvasToString } from '../canvas.ts'
import { Up, Down, Left, Right, Middle, UpperLeft } from '../types.ts'
import type { ShapeRenderOptions } from '../shapes/types.ts'

const unicodeOptions: ShapeRenderOptions = { useAscii: false, padding: 1 }
const asciiOptions: ShapeRenderOptions = { useAscii: true, padding: 1 }

describe('stateStartRenderer (direct unit tests)', () => {
  it('is a fixed 1x1 glyph cell regardless of label', () => {
    const dims = stateStartRenderer.getDimensions('', unicodeOptions)
    expect([dims.width, dims.height]).toEqual([1, 1])
    expect(dims.gridColumns).toEqual([0, 0, 0])
    expect(dims.gridRows).toEqual([0, 0, 0])
  })

  it('renders one glyph in Unicode and ASCII mode', () => {
    for (const [options, glyph] of [
      [unicodeOptions, '●'],
      [asciiOptions, '*'],
    ] as const) {
      const dims = stateStartRenderer.getDimensions('', options)
      expect(canvasToString(stateStartRenderer.render('', dims, options))).toBe(
        glyph,
      )
    }
  })

  it('attaches every direction to the glyph cell', () => {
    const dims = stateStartRenderer.getDimensions('', unicodeOptions)
    const base = { x: 10, y: 20 }
    for (const dir of [Up, Down, Left, Right, UpperLeft, Middle])
      expect(stateStartRenderer.getAttachmentPoint(dir, dims, base)).toEqual({
        x: 10,
        y: 20,
      })
  })
})

describe('stateEndRenderer (direct unit tests)', () => {
  it('is a fixed 1x1 glyph cell regardless of label', () => {
    const dims = stateEndRenderer.getDimensions('', unicodeOptions)
    expect([dims.width, dims.height]).toEqual([1, 1])
    expect(dims.gridColumns).toEqual([0, 0, 0])
    expect(dims.gridRows).toEqual([0, 0, 0])
  })

  it('renders one glyph in Unicode and ASCII mode', () => {
    for (const [options, glyph] of [
      [unicodeOptions, '◉'],
      [asciiOptions, '@'],
    ] as const) {
      const dims = stateEndRenderer.getDimensions('', options)
      expect(canvasToString(stateEndRenderer.render('', dims, options))).toBe(
        glyph,
      )
    }
  })

  it('attaches every direction to the glyph cell', () => {
    const dims = stateEndRenderer.getDimensions('', unicodeOptions)
    const base = { x: 10, y: 20 }
    for (const dir of [Up, Down, Left, Right, UpperLeft, Middle])
      expect(stateEndRenderer.getAttachmentPoint(dir, dims, base)).toEqual({
        x: 10,
        y: 20,
      })
  })
})

describe('forkJoinRenderer (direct unit tests)', () => {
  it('is a fixed 9x1 cell when unlabeled, and draws a solid one-row bar', () => {
    const dims = forkJoinRenderer.getDimensions('', unicodeOptions)
    expect([dims.width, dims.height]).toEqual([9, 1])
    expect(
      canvasToString(forkJoinRenderer.render('', dims, unicodeOptions)),
    ).toBe('█████████')
    const ascii = forkJoinRenderer.render('', dims, asciiOptions)
    expect(canvasToString(ascii)).toContain('#########')
  })

  it('is an ordinary corner-decorated box when labeled', () => {
    const dims = forkJoinRenderer.getDimensions(
      'a long fork label',
      unicodeOptions,
    )
    expect(dims.width).toBeGreaterThan(9)
    const out = canvasToString(
      forkJoinRenderer.render('a long fork label', dims, unicodeOptions),
    )
    expect(out).toContain('a long fork label')
    expect(out).not.toContain('█')
  })

  it('attaches edges on the box border', () => {
    const dims = forkJoinRenderer.getDimensions('', unicodeOptions)
    expect(
      forkJoinRenderer.getAttachmentPoint(Up, dims, { x: 10, y: 20 }),
    ).toEqual({ x: 14, y: 20 })
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
    expect(out).toContain('◉')
    expect(out).not.toContain('╔')
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
    expect(out).toContain('@')
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
    expect(out).toContain('◉')
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
    expect(out).toContain('◉')
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
    const endGlyphCount = (out.match(/◉/g) ?? []).length
    expect(startGlyphCount).toBe(2)
    expect(endGlyphCount).toBe(2)
  })
})

describe('diamondRenderer (choice pseudo-state)', () => {
  it('is a single glyph when unlabeled, an ordinary box when labeled', () => {
    const dims = diamondRenderer.getDimensions('', unicodeOptions)
    expect([dims.width, dims.height]).toEqual([1, 1])
    expect(
      canvasToString(diamondRenderer.render('', dims, unicodeOptions)),
    ).toBe('◇')
    expect(canvasToString(diamondRenderer.render('', dims, asciiOptions))).toBe(
      'o',
    )
    const labeled = diamondRenderer.getDimensions('x', unicodeOptions)
    expect(labeled.height).toBeGreaterThan(1)
    expect(
      canvasToString(diamondRenderer.render('x', labeled, unicodeOptions)),
    ).toContain('◇')
  })
})
