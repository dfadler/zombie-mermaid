import { describe, expect, it } from 'vitest'
import { renderMermaidSVG } from '../index.ts'
import { layoutPacket, PACKET } from '../packet/layout.ts'
import { parsePacket } from '@zombie-mermaid/mermaid-parser'

describe('packet SVG', () => {
  it('lays out Mermaid geometry: 47px rows, 1px inset, 5px gaps', () => {
    const l = layoutPacket(parsePacket('packet\n0-15: "a"\n16-31: "b"'))
    expect(l.width).toBe(1026)
    expect(l.height).toBe(47 * 2 - 32)
    expect(l.rows[0]!.map((b) => [b.x, b.y, b.width, b.height])).toEqual([
      [1, 15, 507, 32],
      [513, 15, 507, 32],
    ])
    expect(
      l.rows[0]![0]!.bits!.map((n) => [n.text, n.x, n.y, n.anchor]),
    ).toEqual([
      ['0', 1, 13, 'start'],
      ['15', 508, 13, 'end'],
    ])
  })

  it('puts the title under the last row and grows the canvas for it', () => {
    const l = layoutPacket(parsePacket('packet\ntitle T\n0: "a"'))
    expect(l.height).toBe(94)
    expect(l.title).toEqual({ text: 'T', x: 513, y: 70.5 })
  })

  it('mirrors columns for descending and swaps the bit numbers', () => {
    const l = layoutPacket(
      parsePacket(
        '%%{init: {"packet": {"bitOrder": "descending", "bitsPerRow": 8}}}%%\npacket\n0-3: "a"',
      ),
    )
    const b = l.rows[0]![0]!
    expect(b.x).toBe(4 * 32 + 1)
    expect(b.bits!.map((n) => n.text)).toEqual(['3', '0'])
  })

  it('omits bit numbers and their padding with showBits false', () => {
    const l = layoutPacket(
      parsePacket(
        '%%{init: {"packet": {"showBits": false}}}%%\npacket\n0: "a"',
      ),
    )
    expect(l.rows[0]![0]!.bits).toBeUndefined()
    expect(l.rows[0]![0]!.y).toBe(5)
  })

  it('draws one group per row with Mermaid class names and escapes text', () => {
    const svg = renderMermaidSVG('packet\ntitle A & B\n0-7: "<x>"\n8-39: "y"')
    expect(svg.match(/<g>/g)).toHaveLength(2)
    expect(svg).toContain('class="packetBlock"')
    expect(svg).toContain('class="packetByte start"')
    expect(svg).toContain('class="packetByte end"')
    expect(svg).toContain('&lt;x&gt;')
    expect(svg).toContain('A &amp; B</text>')
    expect(svg).toContain(`font-size: ${PACKET.labelFontSize}px`)
  })

  it('names the diagram from accTitle and keeps theme variables', () => {
    const svg = renderMermaidSVG('packet\naccTitle: Header\n0: "a"')
    expect(svg).toContain('<title')
    expect(svg).toContain('Header')
    expect(svg).toContain('var(--_node-fill)')
  })

  it('shows a front matter title as the packet title', () => {
    expect(
      renderMermaidSVG('---\ntitle: Front\n---\npacket\n0: "a"'),
    ).toContain('Front</text>')
  })
})
