// ============================================================================
// Packet types
//
// The parsed model of a Mermaid `packet` / `packet-beta` diagram. Both
// renderers draw from `Packet.words`: the fields cut into rows of
// `bitsPerRow` bits exactly as Mermaid's packet db does, so a field that
// crosses a row boundary appears once per row it touches.
// ============================================================================

import type { PacketInitConfig } from '@zombie-mermaid/core'

/** One field, `start`..`end` inclusive (`end === start` for a single bit). */
export interface PacketBlock {
  start: number
  end: number
  label: string
}

/** The `packet` config, every key resolved (mermaid@12.3.0 defaults). */
export interface PacketConfig {
  rowHeight: number
  bitWidth: number
  bitsPerRow: number
  showBits: boolean
  bitOrder: 'ascending' | 'descending'
  paddingX: number
  /** Includes the 10px Mermaid adds when `showBits` is on. */
  paddingY: number
}

/** A parsed Mermaid packet diagram. */
export interface Packet {
  /** `title …`; the last one wins, an empty one clears it. */
  title?: string
  /** The fields as written, validated contiguous from bit 0. */
  blocks: PacketBlock[]
  /** The fields cut into rows (see the file header); empty rows are never emitted. */
  words: PacketBlock[][]
  /** `%%{init: {"packet": {...}}}%%` keys mermaid reads. */
  config?: PacketInitConfig
}

/** mermaid@12.3.0 `config.packet` defaults. */
export const PACKET_DEFAULTS = {
  rowHeight: 32,
  bitWidth: 32,
  bitsPerRow: 32,
  showBits: true,
  bitOrder: 'ascending',
  paddingX: 5,
  paddingY: 5,
} as const

/** Merge `config` over the defaults the way Mermaid's `PacketDB.getConfig` does. */
export function resolvePacketConfig(config?: PacketInitConfig): PacketConfig {
  const c = { ...PACKET_DEFAULTS, ...config }
  return { ...c, paddingY: c.showBits ? c.paddingY + 10 : c.paddingY }
}
