// ============================================================================
// Arial text widths for the gitGraph redux and neo themes
// ============================================================================
//
// Mermaid's `redux` and `neo` themes set the font to `arial` (after
// `"Recursive Variable"`, which a machine without it skips), so a gitGraph
// drawn with them is sized from Arial's advances, not Trebuchet's. Measured with
// canvas `measureText` at 1000px in headless Chromium (macOS Arial), divided
// by 1000: U+0020-U+007E, regular and bold (the redux themes draw branch and
// commit labels at weight 600, which picks Arial Bold), then the kerning of
// every adjacent ASCII pair that has any (`AT-737`: -0.0737 em).
// ============================================================================

const REGULAR = [
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

const BOLD = [
  0.2778, 0.333, 0.4741, 0.5562, 0.5562, 0.8892, 0.7222, 0.2378, 0.333, 0.333,
  0.3892, 0.584, 0.2778, 0.333, 0.2778, 0.2778, 0.5562, 0.5562, 0.5562, 0.5562,
  0.5562, 0.5562, 0.5562, 0.5562, 0.5562, 0.5562, 0.333, 0.333, 0.584, 0.584,
  0.584, 0.6108, 0.9751, 0.7222, 0.7222, 0.7222, 0.7222, 0.667, 0.6108, 0.7778,
  0.7222, 0.2778, 0.5562, 0.7222, 0.6108, 0.833, 0.7222, 0.7778, 0.667, 0.7778,
  0.7222, 0.667, 0.6108, 0.7222, 0.667, 0.9438, 0.667, 0.667, 0.6108, 0.333,
  0.2778, 0.333, 0.584, 0.5562, 0.333, 0.5562, 0.6108, 0.5562, 0.6108, 0.5562,
  0.333, 0.6108, 0.6108, 0.2778, 0.2778, 0.5562, 0.2778, 0.8892, 0.6108, 0.6108,
  0.6108, 0.6108, 0.3892, 0.5562, 0.333, 0.6108, 0.5562, 0.7778, 0.5562, 0.5562,
  0.5, 0.3892, 0.2798, 0.3892, 0.584,
]

const KERN_REGULAR =
  '11-742 AT-742 AV-742 AW-371 AY-742 Av-181 Aw-181 Ay-181 F,-1108 F.-1108 ' +
  'FA-552 LT-742 LV-742 LW-742 LY-742 Ly-371 P,-1289 P.-1289 PA-742 RT-181 ' +
  'RV-181 RW-181 RY-181 T,-1108 T--552 T.-1108 T:-1108 T;-1108 TA-742 ' +
  'TO-181 Ta-1108 Tc-1108 Te-1108 Ti-371 To-1108 Tr-371 Ts-1108 Tu-371 ' +
  'Tw-552 Ty-552 V,-918 V--552 V.-918 V:-371 V;-371 VA-742 Va-742 Ve-552 ' +
  'Vi-181 Vo-552 Vr-371 Vu-371 Vy-371 W,-552 W--181 W.-552 W:-181 W;-181 ' +
  'WA-371 Wa-371 We-181 Wo-181 Wr-181 Wu-181 Wy-88 Y,-1289 Y--918 Y.-1289 ' +
  'Y:-552 Y;-649 YA-742 Ya-742 Ye-918 Yi-371 Yo-918 Yp-742 Yq-918 Yu-552 ' +
  'Yv-552 ff-181 r,-552 r.-552 v,-742 v.-742 w,-552 w.-552 y,-742 y.-742'

const KERN_BOLD =
  '11-552 AT-742 AV-742 AW-552 AY-918 Av-371 Aw-181 Ay-371 F,-1108 F.-1108 ' +
  'FA-552 LT-742 LV-742 LW-552 LY-918 Ly-371 P,-1289 P.-1289 PA-742 RV-181 ' +
  'RW-181 RY-371 T,-1108 T--552 T.-1108 T:-1108 T;-1108 TA-742 TO-181 ' +
  'Ta-742 Tc-742 Te-742 Ti-181 To-742 Tr-552 Ts-742 Tu-742 Tw-742 Ty-742 ' +
  'V,-918 V--552 V.-918 V:-552 V;-552 VA-742 Va-552 Ve-552 Vi-181 Vo-742 ' +
  'Vr-552 Vu-371 Vy-371 W,-552 W--200 W.-552 W:-181 W;-181 WA-552 Wa-371 ' +
  'We-181 Wi-88 Wo-181 Wr-181 Wu-181 Wy-181 Y,-1108 Y--552 Y.-1108 Y:-742 ' +
  'Y;-742 YA-918 Ya-552 Ye-552 Yi-371 Yo-742 Yp-552 Yq-742 Yu-552 Yv-552 ' +
  'r,-552 r.-552 v,-742 v.-742 w,-371 w.-371 y,-742 y.-742'

const kernMaps = new Map<boolean, Map<string, number>>()
function kerning(bold: boolean): Map<string, number> {
  let map = kernMaps.get(bold)
  if (!map) {
    // A pair is the first two characters; the rest is a signed integer in 1/10000 em.
    map = new Map(
      (bold ? KERN_BOLD : KERN_REGULAR)
        .split(' ')
        .map((t) => [t.slice(0, 2), Number(t.slice(2)) / 10000] as const),
    )
    kernMaps.set(bold, map)
  }
  return map
}

/** Width of `text` in Arial at `size` px; outside printable ASCII a glyph is a guess (a full em for CJK and emoji). */
export function arialWidth(text: string, size = 16, bold = false): number {
  const table = bold ? BOLD : REGULAR
  const kern = kerning(bold)
  let em = 0
  for (let i = 1; i < text.length; i++)
    em += kern.get(text.slice(i - 1, i + 1)) ?? 0
  for (const ch of text) {
    const cp = ch.codePointAt(0) as number
    em +=
      cp >= 0x20 && cp <= 0x7e
        ? (table[cp - 0x20] as number)
        : cp >= 0x1100
          ? 1
          : 0.6
  }
  return em * size
}
