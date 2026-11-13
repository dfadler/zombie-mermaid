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
// reproduces mermaid's measured widths once the kerning pairs below are added;
// Linux, with no Trebuchet MS, falls back
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

/** Kerning (1/10000 em) for adjacent ASCII pairs, regular weight: `AT-972` is -0.0972em between A and T. */
const KERN_REGULAR =
  'AT-972 AV-879 AW-879 AY-1064 Av-552 Aw-459 Ay-410 F,-1802 F.-1802 ' +
  'FA-1060 Ke-312 Ki-312 Kn-312 Ko-312 Ku-312 Kw-312 LT-1021 LV-1387 ' +
  'LW-1250 LY-1294 Ly-830 P,-1953 P.-1953 PA-1113 Pa-469 Pe-469 Ph-469 ' +
  'Pi-469 Po-469 Pr-469 RT-410 RV-459 RW-640 RY-640 Re-405 Ro-405 Ru-288 ' +
  'T,-1660 T--967 T.-1660 T:-1108 T;-1108 TA-972 TO-552 Ta-1245 Tc-1245 ' +
  'Te-1245 Ti-415 To-1245 Tr-1099 Ts-1201 Tu-1294 Tw-1382 Ty-1152 V,-1465 ' +
  'V--737 V.-1465 V:-601 V;-601 VA-1021 Va-786 Ve-645 Vi-181 Vo-645 ' +
  'Vr-601 Vu-649 Vy-371 W,-923 W--688 W.-923 W:-181 W;-181 WA-879 Wa-557 ' +
  'We-459 Wi-137 Wo-459 Wr-503 Wu-410 Wy-181 Y,-1611 Y--1221 Y.-1611 ' +
  'Y:-874 Y;-874 YA-1064 Ya-928 Ye-1050 Yi-557 Yo-1147 Yp-928 Yq-1196 ' +
  'Yu-737 Yv-596 r,-1426 r.-1333 v,-1343 v.-1343 w,-1060 w.-1060 y,-1221 ' +
  'y.-1221'

/** Kerning for adjacent ASCII pairs, bold weight. */
const KERN_BOLD =
  'AT-947 AV-742 AW-542 AY-894 Av-181 Aw-181 Ay-181 F,-1108 F.-1108 ' +
  'FA-552 Fa-469 Fe-469 Fo-469 Fu-469 LT-742 LV-742 LW-742 LY-742 Ly-371 ' +
  'P,-1289 P.-1289 PA-742 Pa-469 Pe-469 Po-469 RT-405 RV-361 RW-435 ' +
  'RY-630 T,-1108 T--776 T.-1108 T:-1108 T;-1108 TA-947 TO-596 Ta-1108 ' +
  'Tc-1108 Te-1108 Ti-371 To-1289 Tr-1025 Ts-1108 Tu-903 Tw-796 Ty-752 ' +
  'V,-1118 V--552 V.-918 V:-371 V;-371 VA-742 Va-742 Ve-552 Vi-181 Vo-674 ' +
  'Vr-493 Vu-532 Vy-371 W,-874 W--181 W.-835 W:-181 W;-181 WA-542 Wa-371 ' +
  'We-181 Wo-181 Wr-181 Wu-181 Wy-88 Y,-1289 Y--918 Y.-1289 Y:-552 Y;-649 ' +
  'YA-894 Ya-742 Ye-918 Yi-371 Yo-918 Yp-742 Yq-918 Yu-552 Yv-552 ka-312 ' +
  'r,-1128 r.-1182 ra-312 v,-1318 v.-1318 vi313 w,-972 w.-972 y,-1108 ' +
  'y.-1108'

/** Kerning for `sans-serif`, same encoding. */
const KERN_SANS =
  '11-738 AT-737 AV-737 AW-366 AY-737 Av-176 Aw-176 Ay-176 F,-1108 F.-1108 FA-547 LT-737 LV-738 LW-737 LY-738 Ly-367 P,-1289 P.-1289 PA-737 RT-176 RV-176 RW-176 RY-176 T,-1108 T--546 T.-1108 T:-1108 T;-1108 TA-737 TO-175 Ta-1108 Tc-1108 Te-1108 Ti-366 To-1108 Tr-366 Ts-1108 Tu-366 Tw-547 Ty-546 V,-918 V--547 V.-918 V:-366 V;-366 VA-737 Va-738 Ve-547 Vi-176 Vo-547 Vr-366 Vu-367 Vy-366 W,-546 W--175 W.-546 W:-175 W;-175 WA-366 Wa-366 We-176 Wo-176 Wr-175 Wu-176 Wy-87 Y,-1289 Y--918 Y.-1289 Y:-547 Y;-649 YA-737 Ya-738 Ye-919 Yi-367 Yo-919 Yp-738 Yq-919 Yu-547 Yv-547 ff-175 r,-546 r.-546 v,-737 v.-737 w,-547 w.-547 y,-737 y.-737'

const kernMaps = new Map<string, Map<string, number>>()
function kerning(face: 'regular' | 'bold' | 'sans'): Map<string, number> {
  let map = kernMaps.get(face)
  if (!map) {
    // A pair is the first two characters; the rest is a signed integer.
    map = new Map(
      (face === 'bold' ? KERN_BOLD : face === 'sans' ? KERN_SANS : KERN_REGULAR)
        .split(' ')
        .map((t) => [t.slice(0, 2), Number(t.slice(2)) / 10000] as const),
    )
    kernMaps.set(face, map)
  }
  return map
}

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
  const kern = kerning(bold ? 'bold' : 'regular')
  for (let i = 1; i < text.length; i++) {
    em += kern.get(text.slice(i - 1, i + 1)) ?? 0
  }
  for (const ch of text) {
    const cp = ch.codePointAt(0) as number
    if (cp >= 0x20 && cp <= 0x7e) em += table[cp - 0x20] as number
    else if (cp === 0xab || cp === 0xbb) em += guillemet
    else em += fallbackAdvance(cp)
  }
  return em * 16
}

/** Advances (em) for U+0020-U+007E in `sans-serif` (Helvetica/Arial metrics), regular weight. */
const SANS = [
  0.2778, 0.2778, 0.355, 0.5562, 0.5562, 0.8892, 0.667, 0.1909, 0.333, 0.333,
  0.3892, 0.584, 0.2778, 0.333, 0.2778, 0.2778, 0.5562, 0.5562, 0.5562, 0.5562,
  0.5562, 0.5562, 0.5562, 0.5562, 0.5562, 0.5562, 0.2778, 0.2778, 0.584, 0.584,
  0.584, 0.5562, 1.0151, 0.667, 0.667, 0.7222, 0.7222, 0.667, 0.6108, 0.7778,
  0.7222, 0.2778, 0.5, 0.667, 0.5562, 0.833, 0.7222, 0.7778, 0.667, 0.7778,
  0.7222, 0.667, 0.6108, 0.7222, 0.667, 0.9438, 0.667, 0.667, 0.6108, 0.2778,
  0.2778, 0.2778, 0.4692, 0.5562, 0.333, 0.5562, 0.5562, 0.5, 0.5562, 0.5562,
  0.2778, 0.5562, 0.5562, 0.2222, 0.2222, 0.5, 0.2222, 0.833, 0.5562, 0.5562,
  0.5562, 0.5562, 0.333, 0.5, 0.2778, 0.5562, 0.5, 0.7222, 0.5, 0.5, 0.5, 0.334,
  0.2598, 0.334, 0.584,
]

/**
 * Width in px of `text` at 16px `sans-serif`, rounded as mermaid's
 * `calculateTextWidth` does. Mermaid compares this (not the Trebuchet width it
 * draws with) against `er.minEntityWidth` to decide a bare entity's minimum.
 */
export function mermaidSansTextWidth(text: string): number {
  let em = 0
  const kern = kerning('sans')
  for (let i = 1; i < text.length; i++) {
    em += kern.get(text.slice(i - 1, i + 1)) ?? 0
  }
  for (const ch of text) {
    const cp = ch.codePointAt(0) as number
    em +=
      cp >= 0x20 && cp <= 0x7e
        ? (SANS[cp - 0x20] as number)
        : fallbackAdvance(cp)
  }
  return Math.round(em * 16)
}
