// Diamond and circle silhouettes (#2164): edges leave and re-enter beside the
// outline instead of cutting it, in every direction and both charsets.

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { findOrphanedJunctions } from './validate.ts'

const count = (s: string, ch: string) => [...s].filter((c) => c === ch).length

/** Glyphs one node contributes, per charset. */
const GLYPHS = {
  diamond: {
    unicode: { '╱': 4, '╲': 4, '<': 1, '>': 1 },
    // ASCII arrowheads are `<` `>` too, so the points cannot be counted.
    ascii: { '/': 4, '\\': 4 },
  },
  circle: {
    unicode: { '╭': 1, '╮': 1, '╰': 1, '╯': 1, '(': 1, ')': 1 },
    ascii: { '.': 2, "'": 2, '(': 1, ')': 1 },
  },
} as const

const SHAPE = { diamond: 'a{x}', circle: 'a((x))' } as const

describe('diamond and circle outlines survive busy edges (#2164)', () => {
  for (const shape of ['diamond', 'circle'] as const) {
    for (const dir of ['TD', 'LR', 'BT', 'RL']) {
      for (const ascii of [false, true]) {
        it(`${shape} ${dir} ${ascii ? 'ascii' : 'unicode'}: self-loop, duplicates and a back edge keep every outline glyph`, () => {
          const out = renderMermaidASCII(
            `flowchart ${dir}
  ${SHAPE[shape]} --> a
  a --> b
  a --> b
  b --> a
  c --> a`,
            { colorMode: 'none', useAscii: ascii },
          )
          const want = GLYPHS[shape][ascii ? 'ascii' : 'unicode']
          for (const [ch, n] of Object.entries(want)) {
            // `b` and `c` are rectangles, so these glyphs come from `a` alone,
            // except ASCII `.`/`'`/`/`/`\` which no edge draws either.
            expect(count(out, ch), `${ch} in\n${out}`).toBe(n)
          }
          expect(findOrphanedJunctions(out)).toEqual([])
        })
      }
    }
  }
})
