// ============================================================================
// Mermaid class-box text widths
// ============================================================================
//
// Mermaid sizes a class box from the DOM width of its text at 16px in
// `"trebuchet ms", verdana, arial, sans-serif`, then lays out and draws that
// text in the box. We draw class text in our own fonts, so to size boxes the
// way mermaid does (#2128) we need mermaid's text widths, not ours. These are
// the advances of that stack's first face (Trebuchet MS, macOS/Windows: what
// mermaid.live and GitHub use there), measured with canvas `measureText` at
// 16px in headless Chromium and divided by 16. U+0020-U+007E, then `\u00ab`
// and `\u00bb` (mermaid draws an annotation as «name»). Summing them
// reproduces mermaid 12.1.0's measured width of 136 gallery strings to within
// 2.1px (kerning is the difference); Linux, with no Trebuchet MS, falls back
// to another face and mermaid's own widths shift.
// ============================================================================

/** Advances (em) for U+0020-U+007E, regular weight. */
const REGULAR = [
  0.3013, 0.3672, 0.3247, 0.5244, 0.5244, 0.6001, 0.7061, 0.1597, 0.3672,
  0.3672, 0.3672, 0.5244, 0.3672, 0.3672, 0.3672, 0.5244, 0.5244, 0.5244,
  0.5244, 0.5244, 0.5244, 0.5244, 0.5244, 0.5244, 0.5244, 0.5244, 0.3672,
  0.3672, 0.5244, 0.5244, 0.5244, 0.3672, 0.7705, 0.5898, 0.5659, 0.5981,
  0.6133, 0.5356, 0.5249, 0.6763, 0.6543, 0.2783, 0.4766, 0.5757, 0.5063,
  0.7095, 0.6382, 0.6738, 0.5576, 0.6758, 0.582, 0.481, 0.5806, 0.6484, 0.5874,
  0.8521, 0.5566, 0.5703, 0.5503, 0.3672, 0.3555, 0.3672, 0.5244, 0.5244,
  0.5244, 0.5254, 0.5571, 0.4951, 0.5571, 0.5454, 0.3696, 0.502, 0.5464, 0.2852,
  0.3667, 0.5044, 0.2949, 0.8301, 0.5464, 0.5366, 0.5571, 0.5571, 0.3887,
  0.4048, 0.3965, 0.5464, 0.4897, 0.7441, 0.501, 0.4932, 0.4746, 0.3672, 0.5244,
  0.3672, 0.5244,
]

/** Advances (em) for U+0020-U+007E, bold weight (the class name). */
const BOLD = [
  0.3013, 0.3672, 0.3667, 0.5859, 0.5859, 0.6841, 0.7061, 0.2295, 0.3672,
  0.3672, 0.4321, 0.5859, 0.3672, 0.3672, 0.3672, 0.3901, 0.5859, 0.5859,
  0.5859, 0.5859, 0.5859, 0.5859, 0.5859, 0.5859, 0.5859, 0.5859, 0.3672,
  0.3672, 0.5859, 0.5859, 0.5859, 0.438, 0.7705, 0.6333, 0.5952, 0.6118, 0.6426,
  0.5688, 0.5835, 0.6714, 0.6836, 0.2783, 0.5327, 0.6172, 0.5527, 0.7451,
  0.6675, 0.7031, 0.5869, 0.709, 0.6108, 0.5112, 0.6118, 0.6777, 0.6216, 0.8838,
  0.6006, 0.6133, 0.5601, 0.4019, 0.3555, 0.4019, 0.5859, 0.5859, 0.5859,
  0.5327, 0.5815, 0.5117, 0.5806, 0.5747, 0.3696, 0.502, 0.5928, 0.2983, 0.3667,
  0.5479, 0.2949, 0.8594, 0.5903, 0.5659, 0.5825, 0.584, 0.4272, 0.4307, 0.3965,
  0.5908, 0.5273, 0.7837, 0.5522, 0.5337, 0.5283, 0.4336, 0.5859, 0.4336,
  0.5859,
]

/** Advance of a glyph outside the table: average Latin, or a full em for CJK and emoji. */
function fallbackAdvance(cp: number): number {
  return cp >= 0x1100 ? 1 : 0.6
}

/**
 * Width in px of `text` as mermaid measures it: 16px Trebuchet MS, bold or
 * regular, one line. Used only to size class boxes, never to place text.
 */
export function mermaidTextWidth(text: string, bold: boolean): number {
  const table = bold ? BOLD : REGULAR
  const guillemet = bold ? 0.5859 : 0.5244
  let em = 0
  for (const ch of text) {
    const cp = ch.codePointAt(0) as number
    if (cp >= 0x20 && cp <= 0x7e) em += table[cp - 0x20] as number
    else if (cp === 0xab || cp === 0xbb) em += guillemet
    else em += fallbackAdvance(cp)
  }
  return em * 16
}
