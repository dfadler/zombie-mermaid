// Advance widths, in 1/2048 em, of Trebuchet MS (the first family in Mermaid's
// default font stack) for the printable ASCII range, regular and bold, read
// with canvas measureText in Chromium on macOS. Mermaid's timeline renderer
// wraps text in the browser at 150px; summing these advances finds the same
// line breaks without one.
const UNITS_PER_EM = 2048

const REGULAR = [
  617, 752, 665, 1074, 1074, 1229, 1446, 327, 752, 752, 752, 1074, 752, 752,
  752, 1074, 1074, 1074, 1074, 1074, 1074, 1074, 1074, 1074, 1074, 1074, 752,
  752, 1074, 1074, 1074, 752, 1578, 1208, 1159, 1225, 1256, 1097, 1075, 1385,
  1340, 570, 976, 1179, 1037, 1453, 1307, 1380, 1142, 1384, 1192, 985, 1189,
  1328, 1203, 1745, 1140, 1168, 1127, 752, 728, 752, 1074, 1074, 1074, 1076,
  1141, 1014, 1141, 1117, 757, 1028, 1119, 584, 751, 1033, 604, 1700, 1119,
  1099, 1141, 1141, 796, 829, 812, 1119, 1003, 1524, 1026, 1010, 972, 752,
  1074, 752, 1074,
]

const BOLD = [
  617, 752, 751, 1200, 1200, 1401, 1446, 470, 752, 752, 885, 1200, 752, 752,
  752, 799, 1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200, 752,
  752, 1200, 1200, 1200, 897, 1578, 1297, 1219, 1253, 1316, 1165, 1195, 1375,
  1400, 570, 1091, 1264, 1132, 1526, 1367, 1440, 1202, 1452, 1251, 1047,
  1253, 1388, 1273, 1810, 1230, 1256, 1147, 823, 728, 823, 1200, 1200, 1200,
  1091, 1191, 1048, 1189, 1177, 757, 1028, 1214, 611, 751, 1122, 604, 1760,
  1209, 1159, 1193, 1196, 875, 882, 812, 1210, 1080, 1605, 1131, 1093, 1082,
  888, 1200, 888, 1200,
]

/** Advance of `ch` in em, or undefined outside printable ASCII. */
export function trebuchetAdvance(
  ch: string,
  bold: boolean,
): number | undefined {
  const i = ch.charCodeAt(0) - 32
  if (ch.length !== 1 || i < 0 || i >= REGULAR.length) return undefined
  return (bold ? BOLD : REGULAR)[i]! / UNITS_PER_EM
}
