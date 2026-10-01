/**
 * Regression tests (#1231): RL is laid out as LR and the finished canvas is
 * mirrored horizontally. Nodes and edges mirror, direction glyphs swap, but
 * label text keeps reading left-to-right and is never glyph-remapped.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import {
  mkCanvas,
  flipCanvasHorizontally,
  flipRoleCanvasHorizontally,
  mirrorLabelColumns,
} from '../canvas.ts'
import { flipLinkCanvasHorizontally } from '../hyperlinks.ts'
import type { RoleCanvas } from '../types.ts'

const render = (src: string, useAscii = false) =>
  renderMermaidASCII(src, { colorMode: 'none', useAscii })
const colOf = (out: string, needle: string) =>
  Math.max(...out.split('\n').map((l) => l.indexOf(needle)))

describe('RL direction mirrors the LR layout', () => {
  it('puts the source on the right and points arrowheads left', () => {
    const out = render('graph RL\n  A --> B --> C')
    expect(colOf(out, 'C')).toBeLessThan(colOf(out, 'B'))
    expect(colOf(out, 'B')).toBeLessThan(colOf(out, 'A'))
    expect(out).toContain('◄')
    expect(out).not.toContain('►')
  })

  it('uses < arrowheads in ASCII mode', () => {
    const out = render('graph RL\n  A --> B', true)
    expect(out).toContain('<')
    expect(out).not.toContain('>')
  })

  it('is the exact mirror of LR once label glyphs are accounted for', () => {
    const mirror: Record<string, string> = {
      '►': '◄',
      '┌': '┐',
      '┐': '┌',
      '└': '┘',
      '┘': '└',
      '├': '┤',
      '┤': '├',
    }
    const lr = render('graph LR\n  A --> B --> C').split('\n')
    const rl = render('graph RL\n  A --> B --> C').split('\n')
    const width = Math.max(...lr.map((l) => l.length))
    const expected = lr.map((l) =>
      [...l.padEnd(width)]
        .reverse()
        .map((c) => mirror[c] ?? c)
        .join(''),
    )
    expect(rl.map((l) => l.padEnd(width))).toEqual(expected)
  })

  it('keeps label text unmirrored and does not remap glyphs inside it', () => {
    const out = render('graph RL\n  A["Hello a<b /x"] -->|"go left"| B')
    expect(out).toContain('Hello a<b /x')
    expect(out).toContain('go left')
    expect(colOf(out, 'B')).toBeLessThan(colOf(out, 'Hello'))
  })

  it('keeps multi-line labels and subgraph titles readable', () => {
    const out = render(
      'graph RL\n  subgraph S [My Group]\n    A["one<br/>two three"] --> B\n  end',
    )
    expect(out).toContain('My Group')
    expect(out).toContain('one')
    expect(out).toContain('two three')
  })

  it('keeps wide characters in order', () => {
    const out = render('graph RL\n  A["日本語"] --> B')
    expect(out).toContain('日本語')
  })

  it('still honors a direction override of RL', () => {
    const out = renderMermaidASCII('graph TD\n  A --> B', {
      colorMode: 'none',
      direction: 'RL',
    })
    expect(colOf(out, 'B')).toBeLessThan(colOf(out, 'A'))
  })
})

describe('RL hyperlinks', () => {
  it('keeps the OSC 8 span on the linked label after mirroring', () => {
    const out = renderMermaidASCII(
      'graph RL\n  A[Docs] --> B[Other]\n  click A "https://example.com"',
      { colorMode: 'none', hyperlinks: true },
    )
    const m = /\x1b\]8;;([^\x1b]*)\x1b\\([\s\S]*?)\x1b\]8;;\x1b\\/.exec(out)
    expect(m?.[1]).toBe('https://example.com')
    expect(m?.[2]).toBe('Docs')
  })
})

describe('horizontal flip helpers', () => {
  it('reverses columns and swaps directional glyphs, skipping text cells', () => {
    const canvas = mkCanvas(2, 0)
    canvas[0]![0] = '<'
    canvas[1]![0] = '┌'
    canvas[2]![0] = '<'
    const roles: RoleCanvas = [[null], [null], ['text']]
    flipCanvasHorizontally(canvas, roles)
    expect([canvas[0]![0], canvas[1]![0], canvas[2]![0]]).toEqual([
      '<',
      '┐',
      '>',
    ])
  })

  it('flips without a role canvas', () => {
    const canvas = mkCanvas(1, 0)
    canvas[0]![0] = '►'
    flipCanvasHorizontally(canvas)
    expect(canvas[1]![0]).toBe('◄')
  })

  it('reverses role and link canvases', () => {
    expect(
      flipRoleCanvasHorizontally([['text'], [null]] as RoleCanvas),
    ).toEqual([[null], ['text']])
    expect(flipLinkCanvasHorizontally([['a'], [null]])).toEqual([[null], ['a']])
  })

  it('mirrors label cells within a rect, permuting the link canvas too', () => {
    const canvas = mkCanvas(3, 0)
    'abcd'.split('').forEach((c, i) => (canvas[i]![0] = c))
    const roles: RoleCanvas = [['text'], ['text'], ['text'], ['text']]
    const links: (string | null)[][] = [['L'], [null], [null], [null]]
    mirrorLabelColumns(
      canvas,
      roles,
      [
        { x0: 0, x1: 3, y0: 0, y1: 0 },
        { x0: 1, x1: 1, y0: 0, y1: 0 }, // single column: skipped
      ],
      links,
    )
    expect(canvas.map((c) => c[0]).join('')).toBe('dcba')
    expect(links[3]![0]).toBe('L')
  })

  it('mirrors without a link canvas', () => {
    const canvas = mkCanvas(1, 0)
    canvas[0]![0] = 'x'
    mirrorLabelColumns(canvas, [['text'], [null]] as RoleCanvas, [
      { x0: 0, x1: 1, y0: 0, y1: 0 },
    ])
    expect(canvas[1]![0]).toBe('x')
  })
})
