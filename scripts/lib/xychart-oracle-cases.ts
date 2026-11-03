/**
 * Numeric x-axis cases for scripts/xychart-oracle.ts (#1592). The gallery's
 * only numeric-range sample has 21 points over 0..100, which coincide with
 * mermaid's ticks and hide a layout that treated the range as categories, so
 * these use point counts that are not tick-aligned.
 */
export const XYCHART_RANGE_CASES: { title: string; source: string }[] = [
  {
    title: 'Range: line, 4 points over 0..9',
    source: 'xychart-beta\n x-axis 0 --> 9\n line [1,5,3,8]',
  },
  {
    title: 'Range: horizontal line, 4 points over 0..9',
    source: 'xychart-beta horizontal\n x-axis 0 --> 9\n line [1,5,3,8]',
  },
  {
    title: 'Range: 5 bars over 0..100',
    source: 'xychart-beta\n x-axis 0 --> 100\n bar [10,20,30,40,50]',
  },
  {
    title: 'Range: horizontal 5 bars over 0..100',
    source: 'xychart-beta horizontal\n x-axis 0 --> 100\n bar [10,20,30,40,50]',
  },
  {
    title: 'Range: bar and line over 2020..2024',
    source: 'xychart-beta\n x-axis 2020 --> 2024\n bar [3,5,2]\n line [4,1,6]',
  },
  {
    title: 'Range: horizontal bar and line over 2020..2024',
    source:
      'xychart-beta horizontal\n x-axis 2020 --> 2024\n bar [3,5,2]\n line [4,1,6]',
  },
  {
    title: 'Range: ticks stop short of the end (0..95)',
    source: 'xychart-beta\n x-axis 0 --> 95\n bar [4,8,6,9,2,7,5]',
  },
  {
    title: 'Range: negative start (-5..5)',
    source: 'xychart-beta\n x-axis -5 --> 5\n line [2,4,1,6,3,5]',
  },
  {
    title: 'Range: single point',
    source: 'xychart-beta\n x-axis 0 --> 10\n y-axis 0 --> 10\n bar [5]',
  },
  {
    title: 'Range: two series of different length',
    source: 'xychart-beta\n x-axis 0 --> 20\n line [1,2,3,4,5]\n line [5,1,4]',
  },
]
