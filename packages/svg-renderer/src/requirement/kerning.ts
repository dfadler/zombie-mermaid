// Kerning of Trebuchet MS, in 1/64 px at 16px, for the ASCII pairs Chromium on
// macOS kerns by more than 0.1px, measured as width("ab") - width("a") -
// width("b") with `font-kerning: normal`, regular and bold. Mermaid sizes a
// requirement box from the browser's text width, kerning included, so the sum
// of plain advances (see the timeline layout) runs a few pixels wide on
// strings like "Text: the test text.". Each entry is two characters (a space
// is written as U+2423) then a signed value, and ends in `|`.

const REGULAR_KERNING =
  '␣A-57|␣T-19|␣Y-19|A␣-57|AT-100|AV-90|AW-90|AY-109|Av-57|Aw-47|Ay-42|' +
  'F,-185|F.-185|FA-109|Ke-33|Ki-32|Kn-33|Ko-33|Ku-33|Kw-32|L␣-39|LT-105|' +
  'LV-143|LW-129|LY-133|Ly-85|P␣-19|P,-200|P.-200|PA-114|Pa-48|Pe-48|' +
  'Ph-48|Pi-48|Po-48|Pr-48|RT-42|RV-47|RW-66|RY-65|Re-42|Ro-42|Ru-30|' +
  'T␣-19|T,-170|T--99|T.-170|T:-114|T;-114|TA-100|TO-57|Ta-128|Tc-128|' +
  'Te-128|Ti-43|To-128|Tr-113|Ts-124|Tu-133|Tw-142|Ty-118|V,-150|V--76|' +
  'V.-150|V:-62|V;-62|VA-105|Va-81|Ve-67|Vi-19|Vo-67|Vr-62|Vu-67|Vy-38|' +
  'W,-95|W--71|W.-95|W:-19|W;-19|WA-90|Wa-57|We-48|Wi-14|Wo-48|Wr-52|' +
  'Wu-43|Wy-19|Y␣-19|Y,-165|Y--125|Y.-165|Y:-89|Y;-89|YA-109|Ya-95|' +
  'Ye-108|Yi-57|Yo-118|Yp-95|Yq-123|Yu-76|Yv-61|r,-146|r.-136|v,-138|' +
  'v.-138|w,-108|w.-108|y,-125|y.-125|'

const BOLD_KERNING =
  '␣A-57|␣T-19|␣Y-19|A␣-57|AT-98|AV-77|AW-56|AY-92|Av-19|Aw-19|Ay-19|' +
  'F,-114|F.-114|FA-57|Fa-49|Fe-49|Fo-49|Fu-48|L␣-38|LT-76|LV-76|LW-76|' +
  'LY-76|Ly-38|P␣-19|P,-132|P.-132|PA-76|Pa-48|Pe-48|Po-48|RT-42|RV-38|' +
  'RW-45|RY-65|T␣-19|T,-114|T--80|T.-114|T:-114|T;-114|TA-98|TO-61|' +
  'Ta-114|Tc-114|Te-114|Ti-39|To-133|Tr-106|Ts-114|Tu-93|Tw-82|Ty-78|' +
  'V,-115|V--57|V.-94|V:-38|V;-38|VA-77|Va-77|Ve-57|Vi-19|Vo-70|Vr-51|' +
  'Vu-55|Vy-39|W,-89|W--18|W.-85|W:-18|W;-18|WA-56|Wa-38|We-19|Wo-19|' +
  'Wr-19|Wu-18|Wy-9|Y␣-19|Y,-132|Y--94|Y.-132|Y:-56|Y;-66|YA-92|Ya-76|' +
  'Ye-94|Yi-38|Yo-94|Yp-76|Yq-94|Yu-56|Yv-56|ka-32|r,-116|r.-121|ra-33|' +
  'v,-135|v.-135|vi32|w,-100|w.-100|y,-114|y.-114|'

function parse(table: string): Map<string, number> {
  const map = new Map<string, number>()
  for (const entry of table.split('|').filter(Boolean)) {
    // Two characters, then the value; the pair itself may contain `-`.
    map.set(
      entry.slice(0, 2).replace('\u2423', ' '),
      Number(entry.slice(2)) / 64,
    )
  }
  return map
}

const REGULAR = parse(REGULAR_KERNING)
const BOLD = parse(BOLD_KERNING)

/** Total kerning of `text` at 16px, in px (negative: the text is narrower). */
export function trebuchetKerning(text: string, bold = false): number {
  const table = bold ? BOLD : REGULAR
  let sum = 0
  for (let i = 0; i + 1 < text.length; i++)
    sum += table.get(text.slice(i, i + 2)) ?? 0
  return sum
}
