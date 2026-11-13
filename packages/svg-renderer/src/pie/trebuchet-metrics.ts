// ============================================================================
// Trebuchet MS advance widths, for sizing a pie chart as mermaid 12.3.0 does
//
// Mermaid sizes a pie from the rendered width of its title and legend text,
// drawn in its default stack ("trebuchet ms", verdana, arial, sans-serif). The
// pie renderer draws in that stack too when the caller passes no `font`, so it
// measures with these advances instead of the Inter-based estimate used
// elsewhere. Measured per 1000 em (canvas measureText at 1000px, headless
// Chromium, real Trebuchet MS, regular weight) for U+0020..U+007E; Trebuchet MS
// has no kerning pairs that matter at these sizes. Mermaid takes getBBox
// widths, so no padding is added.
// ============================================================================

const FIRST = 0x20

/** Advance of U+0020, U+0021, ... U+007E in thousandths of an em. */
const ADVANCES = [
  301, 367, 325, 524, 524, 600, 706, 160, 367, 367, 367, 524, 367, 367, 367,
  524, 524, 524, 524, 524, 524, 524, 524, 524, 524, 524, 367, 367, 524, 524,
  524, 367, 771, 590, 566, 598, 613, 536, 525, 676, 654, 278, 477, 576, 506,
  709, 638, 674, 558, 676, 582, 481, 581, 648, 587, 852, 557, 570, 550, 367,
  355, 367, 524, 524, 524, 525, 557, 495, 557, 545, 370, 502, 546, 285, 367,
  504, 295, 830, 546, 537, 557, 557, 389, 405, 396, 546, 490, 744, 501, 493,
  475, 367, 524, 367, 524,
] as const

/** Width in px of `char`, or undefined outside printable ASCII. */
export function trebuchetAdvance(
  char: string,
  fontSize: number,
): number | undefined {
  const advance = ADVANCES[char.codePointAt(0)! - FIRST]
  return advance === undefined ? undefined : (advance * fontSize) / 1000
}
