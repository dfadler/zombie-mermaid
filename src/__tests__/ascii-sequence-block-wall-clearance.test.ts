// ============================================================================
// ASCII sequence diagram — block-wall lifeline clearance (issue #353)
//
// `loop`/`alt`/`opt`/etc. share a single wall-extent calculation
// (src/ascii/sequence.ts's "DRAW: blocks" pass): a fixed BLOCK_WALL_MARGIN
// padding around the leftmost/rightmost lifeline the block's own messages
// touch. That calculation only ever looks at lifelines the block's messages
// reach — so the fixed margin can coincidentally land a wall exactly on a
// *different*, untouched lifeline's column, subsuming it (wall glyph and
// lifeline glyph share the same cell) for the block's whole vertical span.
//
// This bit `alt` in the issue's repro (a diagram combining `loop`, `alt`,
// and `opt`, where only `alt` doesn't reach the diagram's rightmost
// lifeline) while `loop`/`opt` happened to clear it, because their own
// messages already reached that lifeline and so were naturally padded past
// it by the same margin. It is not a per-block-type bug: all three share
// identical wall-calculation code.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

/** Column indices (0-based) of every lifeline, read off the actor header's
 * bottom border row (the one carrying `┬` junctions). */
function lifelineColumns(lines: string[]): number[] {
  const row = lines[2]!
  const cols: number[] = []
  for (let i = 0; i < row.length; i++) if (row[i] === '┬') cols.push(i)
  return cols
}

/** Right-wall column of a block, read from the row containing `marker`
 * (its own top-border/header row, e.g. "┌alt [...]" or a divider row like
 * "├[else label]"). The block's own right corner/junction is the last
 * box-drawing glyph on that row. */
function blockWallRightColumn(lines: string[], marker: string): number {
  const row = lines.find((l) => l.includes(marker))
  expect(row, `expected a line containing "${marker}"`).toBeDefined()
  const candidates = ['┐', '┤', '┘']
  let col = -1
  for (const ch of candidates) {
    const idx = row!.lastIndexOf(ch)
    if (idx > col) col = idx
  }
  expect(col, `expected a right-wall glyph on line: ${row}`).toBeGreaterThan(-1)
  return col
}

describe('ASCII sequence diagrams – block wall lifeline clearance (issue #353)', () => {
  it('clears the rightmost lifeline consistently across loop/alt/opt in the same diagram', () => {
    const src = `
sequenceDiagram
    participant U as User
    participant C as Client
    participant A as Auth Service
    participant D as Database

    U->>C: click sign in
    C->>A: POST /authorize

    loop token refresh
        A->>A: validate signature<br/>and check expiry
        A->>D: lookup session
        D-->>A: session row
    end

    alt credentials valid
        A->>A: mint access token<br/>mint refresh token
        A-->>C: 200 + tokens
        C-->>U: redirect to app
    else credentials rejected
        A->>A: increment<br/>failure counter
        A-->>C: 401 unauthorized
        C-->>U: show error
    end

    opt remember me
        C->>A: POST /persist
        A->>D: store long-lived token
    end
`
    const result = renderMermaidASCII(src, { useAscii: false })
    const lines = result.split('\n')

    const llCols = lifelineColumns(lines)
    const rightmostLL = Math.max(...llCols)

    const loopRight = blockWallRightColumn(lines, 'loop [token refresh]')
    const altRight = blockWallRightColumn(lines, 'alt [credentials valid]')
    const optRight = blockWallRightColumn(lines, 'opt [remember me]')

    // None of the three walls may land on any lifeline column — the bug
    // manifested as alt's right wall landing exactly on the Database
    // lifeline's column.
    for (const wallCol of [loopRight, altRight, optRight]) {
      expect(llCols).not.toContain(wallCol)
    }

    // All three clear the rightmost lifeline, and by the same margin —
    // loop/opt already did; alt must now match rather than sit flush on it.
    expect(loopRight).toBeGreaterThan(rightmostLL)
    expect(altRight).toBeGreaterThan(rightmostLL)
    expect(optRight).toBeGreaterThan(rightmostLL)
    expect(altRight).toBe(loopRight)
    expect(altRight).toBe(optRight)

    // The Database lifeline must still be drawn as a lifeline (not
    // subsumed into the alt block's wall) for a row inside the alt block's
    // span, e.g. its "mint access token" self-arrow row.
    const selfArrowRow = lines.find((l) => l.includes('mint access token'))
    expect(selfArrowRow).toBeDefined()
    expect(selfArrowRow![rightmostLL]).toBe('│')
    // ...and that lifeline column is strictly to the left of the alt
    // block's own right wall on that row — two distinct glyphs, not one.
    expect(rightmostLL).toBeLessThan(altRight)
  })

  it('keeps a consistent right wall across every else-branch of a multi-branch alt', () => {
    // Branch labels/content of increasing width so a wall computed only
    // from the *first* branch (rather than reused consistently across all
    // of them) would drift from branch to branch.
    const src = `
sequenceDiagram
    participant A
    participant B
    participant C

    alt first branch
        A->>B: short
    else second branch is quite a bit longer than the first
        B->>C: also a fairly long message label here
    else third
        A->>A: a long self-arrow label in the third branch
    end
`
    const result = renderMermaidASCII(src, { useAscii: false })
    const lines = result.split('\n')
    const llCols = lifelineColumns(lines)

    const headerRight = blockWallRightColumn(lines, 'alt [first branch]')
    const else1Right = blockWallRightColumn(
      lines,
      '[second branch is quite a bit longer than the first]',
    )
    const else2Right = blockWallRightColumn(lines, '[third]')

    // The wall stays at the same column for the header and every divider —
    // it must be computed once from the whole block's extent, not
    // per-branch (which would produce a jagged/misaligned right edge).
    expect(else1Right).toBe(headerRight)
    expect(else2Right).toBe(headerRight)

    // And, as above, it must not coincide with any lifeline column.
    for (const wallCol of [headerRight, else1Right, else2Right]) {
      expect(llCols).not.toContain(wallCol)
    }
  })
})
