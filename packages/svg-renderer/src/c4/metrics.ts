import type { C4Element } from '@zombie-mermaid/mermaid-parser'
import type { FontSizes } from '../styles.ts'

// ============================================================================
// C4 SVG geometry shared by layout (which sizes boxes) and the renderer
// (which draws text and glyphs inside them), so the two can't drift.
// ============================================================================

export const C4 = {
  padX: 16,
  padY: 14,
  minWidth: 150,
  /** Text wraps beyond this width (px). */
  maxTextWidth: 210,
  /** Vertical room the person glyph takes at the top of a person box. */
  personGlyphHeight: 54,
  /** Gap between the type line and the description. */
  descGap: 6,
  /** Cylinder cap height (`Db` elements). */
  dbCap: 10,
  /** Queue end-cap half-width (`Queue` elements). */
  queueCap: 12,
  nodeSpacing: 60,
  layerSpacing: 80,
  padding: 40,
  boundaryPadX: 24,
  boundaryPadBottom: 24,
  boundaryPadTop: 52,
  boundaryMinWidth: 160,
  titleHeight: 32,
} as const

export interface C4TextSizes {
  name: number
  type: number
  desc: number
  nameLine: number
  typeLine: number
  descLine: number
}

export function c4TextSizes(fontSizes: FontSizes): C4TextSizes {
  const name = fontSizes.nodeLabel
  const type = Math.max(9, fontSizes.edgeLabel)
  const desc = Math.max(9, fontSizes.edgeLabel)
  return {
    name,
    type,
    desc,
    nameLine: name * 1.35,
    typeLine: type * 1.45,
    descLine: desc * 1.4,
  }
}

/** Extra height an element's shape adds above its text block. */
export function c4TextTopInset(el: Pick<C4Element, 'kind' | 'shape'>): number {
  let inset = C4.padY
  if (el.kind === 'person') inset += C4.personGlyphHeight
  if (el.shape === 'db') inset += C4.dbCap
  return inset
}

/** Standard C4 palette (c4model.com) by kind and externality. */
export interface C4Palette {
  fill: string
  stroke: string
  text: string
}

export function c4Palette(el: Pick<C4Element, 'kind' | 'external'>): C4Palette {
  const light = '#ffffff'
  const dark = '#0d0d0d'
  if (el.external) {
    switch (el.kind) {
      case 'person':
        return { fill: '#686868', stroke: '#4d4d4d', text: light }
      case 'system':
        return { fill: '#999999', stroke: '#6b6b6b', text: light }
      case 'container':
        return { fill: '#b3b3b3', stroke: '#8a8a8a', text: dark }
      case 'component':
        return { fill: '#cccccc', stroke: '#a3a3a3', text: dark }
    }
  }
  switch (el.kind) {
    case 'person':
      return { fill: '#08427b', stroke: '#052e56', text: light }
    case 'system':
      return { fill: '#1168bd', stroke: '#0b4884', text: light }
    case 'container':
      return { fill: '#438dd5', stroke: '#2e6295', text: light }
    case 'component':
      return { fill: '#85bbf0', stroke: '#5d82a8', text: dark }
  }
}
