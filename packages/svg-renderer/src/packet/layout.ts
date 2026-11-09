// ============================================================================
// Packet layout
//
// Turns a parsed Packet into absolute SVG geometry, following Mermaid's own
// packet renderer (packages/mermaid/src/diagrams/packet/renderer.ts), checked
// against mermaid@12.3.0. It needs no text measurement, so the numbers are
// exact:
//
//   - a row is `rowHeight + paddingY` tall (paddingY includes the 10px Mermaid
//     adds when bit numbers show); row `n` has its boxes at
//     `y = n * (rowHeight + paddingY) + paddingY`
//   - a box is `bits * bitWidth - paddingX` wide at `x = column * bitWidth + 1`
//     (`column` counts from the right with `bitOrder: descending`)
//   - the label is centred in the box; the start bit number sits 2px above it,
//     left-aligned (centred over a one-bit box), the end bit number right-aligned
//     at the box's right edge
//   - the title is centred under the last row
//   - the viewBox is `bitWidth * bitsPerRow + 2` wide and
//     `(rowHeight + paddingY) * (rows + 1)` tall, less one row height without a title
// ============================================================================

import { resolvePacketConfig } from '@zombie-mermaid/mermaid-parser'
import type { Packet } from '@zombie-mermaid/mermaid-parser'

/** Mermaid's font sizes for the packet diagram, in px. */
export const PACKET = {
  labelFontSize: 12,
  byteFontSize: 10,
  titleFontSize: 14,
} as const

/** A bit number above a box. */
export interface PositionedPacketBit {
  text: string
  x: number
  y: number
  anchor: 'start' | 'middle' | 'end'
}

/** One field (or one row's slice of a longer field). */
export interface PositionedPacketBlock {
  x: number
  y: number
  width: number
  height: number
  label: string
  labelX: number
  labelY: number
  /** Absent with `showBits: false`. */
  bits?: PositionedPacketBit[]
}

export interface PositionedPacket {
  width: number
  height: number
  rows: PositionedPacketBlock[][]
  title?: { text: string; x: number; y: number }
}

/** Lay out a parsed packet diagram. */
export function layoutPacket(packet: Packet): PositionedPacket {
  const cfg = resolvePacketConfig(packet.config)
  const { rowHeight, paddingX, paddingY, bitWidth, bitsPerRow, showBits } = cfg
  const descending = cfg.bitOrder === 'descending'
  const totalRowHeight = rowHeight + paddingY
  const rowCount = packet.words.length
  const height =
    totalRowHeight * (rowCount + 1) - (packet.title ? 0 : rowHeight)
  const width = bitWidth * bitsPerRow + 2

  const rows = packet.words.map((word, rowNumber) => {
    const y = rowNumber * totalRowHeight + paddingY
    return word.map((b): PositionedPacketBlock => {
      const bits = b.end - b.start + 1
      const firstColumn = b.start % bitsPerRow
      const column = descending ? bitsPerRow - firstColumn - bits : firstColumn
      const x = column * bitWidth + 1
      const w = bits * bitWidth - paddingX
      const out: PositionedPacketBlock = {
        x,
        y,
        width: w,
        height: rowHeight,
        label: b.label,
        labelX: x + w / 2,
        labelY: y + rowHeight / 2,
      }
      if (showBits) {
        const [lead, trail] = descending ? [b.end, b.start] : [b.start, b.end]
        const single = bits === 1
        out.bits = [
          {
            text: String(lead),
            x: x + (single ? w / 2 : 0),
            y: y - 2,
            anchor: single ? 'middle' : 'start',
          },
        ]
        if (!single)
          out.bits.push({
            text: String(trail),
            x: x + w,
            y: y - 2,
            anchor: 'end',
          })
      }
      return out
    })
  })

  return {
    width,
    height,
    rows,
    ...(packet.title && {
      title: {
        text: packet.title,
        x: width / 2,
        y: height - totalRowHeight / 2,
      },
    }),
  }
}
