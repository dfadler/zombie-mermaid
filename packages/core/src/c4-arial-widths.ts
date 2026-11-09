// Advance widths, in 1/2048 em, of Arial (the metrics Liberation Sans and
// Helvetica share) for the printable ASCII range, regular and bold. Mermaid's
// C4 renderer measures its text in the browser, and the 32 diagrams recorded
// in `__tests__/fixtures/c4-mermaid-reference.json` are laid out to within a
// fraction of a pixel by summing these advances, which a scaled copy of this
// package's own Inter-based estimate could not do (see `c4TextWidth`).
const UNITS_PER_EM = 2048

const REGULAR =
  // Indexed from U+0020: ` !"#$%&'()*+,-./`
  [
    569, 569, 727, 1139, 1139, 1821, 1366, 391, 682, 682, 797, 1196, 569, 682,
    569, 569,
    // 0-9
    1139, 1139, 1139, 1139, 1139, 1139, 1139, 1139, 1139, 1139,
    // :;<=>?@
    569, 569, 1196, 1196, 1196, 1139, 2079,
    // A-Z
    1366, 1366, 1479, 1479, 1366, 1251, 1593, 1479, 569, 1024, 1366, 1139, 1706,
    1479, 1593, 1366, 1593, 1479, 1366, 1251, 1479, 1366, 1933, 1366, 1366,
    1251,
    // [\]^_`
    569, 569, 569, 961, 1139, 682,
    // a-z
    1139, 1139, 1024, 1139, 1139, 569, 1139, 1139, 455, 455, 1024, 455, 1706,
    1139, 1139, 1139, 1139, 682, 1024, 569, 1139, 1024, 1479, 1024, 1024, 1024,
    // {|}~
    684, 532, 684, 1196,
  ]

const BOLD = [
  // ` !"#$%&'()*+,-./`
  569, 682, 971, 1139, 1139, 1821, 1479, 487, 682, 682, 797, 1196, 569, 682,
  569, 569,
  // 0-9
  1139, 1139, 1139, 1139, 1139, 1139, 1139, 1139, 1139, 1139,
  // :;<=>?@
  682, 682, 1196, 1196, 1196, 1251, 1992,
  // A-Z
  1479, 1479, 1479, 1479, 1366, 1251, 1593, 1479, 569, 1139, 1479, 1251, 1706,
  1479, 1593, 1366, 1593, 1479, 1366, 1251, 1479, 1366, 1933, 1366, 1366, 1251,
  // [\]^_`
  682, 569, 682, 1196, 1139, 682,
  // a-z
  1139, 1251, 1139, 1251, 1139, 682, 1251, 1251, 569, 569, 1139, 569, 1821,
  1251, 1251, 1251, 1251, 797, 1139, 682, 1251, 1139, 1593, 1139, 1139, 1024,
  // {|}~
  801, 573, 801, 1196,
]

/**
 * Width in em of `ch`, or `undefined` outside printable ASCII (the caller
 * falls back to its own estimate).
 */
export function arialAdvance(ch: string, bold: boolean): number | undefined {
  const code = ch.codePointAt(0)!
  if (code < 0x20 || code > 0x7e) return undefined
  return (bold ? BOLD : REGULAR)[code - 0x20]! / UNITS_PER_EM
}
