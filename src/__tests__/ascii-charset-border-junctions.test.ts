/**
 * Regression test: ASCII-charset rendering (`{ useAscii: true }`) never drew
 * a junction character where an edge exits a node's border — the border
 * stayed a plain run of dashes even at the column where a connector
 * dropped/branched from it, while Unicode mode correctly drew a T-junction
 * ('┬'/'┴'/'├'/'┤') there. Root cause: `drawBoxStart` (draw-arrows.ts) and
 * the fan-in box-start connector (draw-bundles.ts) early-returned/guarded
 * on `useAscii`, skipping junction placement entirely instead of writing
 * the ASCII equivalent ('+').
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

describe('ASCII vs Unicode charset: box-start border junctions', () => {
  it('draws a "+" junction on a plain top-down edge, matching the Unicode T-junction', () => {
    const src = `flowchart TD
  A[Hello World] --> B[Done]`

    const unicode = renderMermaidASCII(src, { useAscii: false })
    const ascii = renderMermaidASCII(src, { useAscii: true })

    expect(unicode).toContain('└──────┬──────┘')
    // Before the fix this rendered as a plain, uninterrupted
    // '+-------------+' with no junction at all.
    expect(ascii).toContain('+------+------+')
  })

  it('draws a "+" junction on a left-right (LR) edge exit, matching Unicode', () => {
    const src = `flowchart LR
  A[Hello] --> B[World]`

    const unicode = renderMermaidASCII(src, { useAscii: false })
    const ascii = renderMermaidASCII(src, { useAscii: true })

    expect(unicode).toContain('├')

    // The row with the arrow must have a '+' where Unicode has '├', not a
    // plain '|' vertical border with no junction.
    const unicodeRow = unicode.split('\n').find((l) => l.includes('├'))!
    const asciiRow = ascii.split('\n').find((l) => l.includes('+---->'))
    expect(asciiRow).toBeDefined()
    const junctionCol = unicodeRow.indexOf('├')
    expect(asciiRow![junctionCol]).toBe('+')
  })

  it('draws "+" junctions on a fan-in bundle box-start connector in ASCII mode', () => {
    const src = `flowchart TD
  A[One] --> C[Target]
  B[Two] --> C`

    const unicode = renderMermaidASCII(src, { useAscii: false })
    const ascii = renderMermaidASCII(src, { useAscii: true })

    // Unicode shows T-junctions where each source box's bottom border
    // meets the fan-in connector line.
    expect(unicode).toMatch(/[┬┴├┤]/)

    // Each source box's bottom border must show an interior '+' junction
    // where the fan-in connector drops from it, not a plain dash run.
    expect(ascii).toContain('+----+---+')
    expect(ascii).toContain('+--+--+')
  })
})
