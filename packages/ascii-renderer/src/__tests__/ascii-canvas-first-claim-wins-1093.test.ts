/**
 * Direct unit tests for `firstClaimWins` (packages/ascii-renderer/src/canvas.ts),
 * added in response to a CodeRabbit finding on PR #1093 (the #1067 fix):
 * https://github.com/dfadler/zombie-mermaid/pull/1093#discussion_r… (canvas.ts:446).
 *
 * `firstClaimWins` runs before `mergeCanvases` on the line-canvas layer to
 * fix #1067's "one edge's style bleeds into another's" bug — but its
 * original implementation suppressed a later canvas's character at any
 * already-claimed cell purely by coordinate, with no regard for what the
 * two characters actually were. That silently broke a genuine perpendicular
 * crossing between two plain box-drawing edges (one edge's own `─`, another
 * unrelated edge's own `│`): `mergeCanvases`'s existing junction-merge logic
 * (`isJunctionChar` + `mergeJunctions`) would normally combine them into
 * `┼`, but firstClaimWins now deleted the second character before
 * mergeCanvases ever saw it, so the crossing silently became whichever edge
 * drew first instead. The fix: only suppress a later cell when the two
 * characters *wouldn't* form a meaningful junction merge (i.e. when at
 * least one of them isn't a junction char at all — the actual #1067
 * scenario, dashed vs. heavy characters, neither of which is in
 * `JUNCTION_CHARS`).
 */
import { describe, it, expect } from 'vitest'
import { mkCanvas, firstClaimWins, mergeCanvases } from '../canvas.ts'
import type { Canvas } from '../types.ts'

function canvasWithChar(
  width: number,
  height: number,
  x: number,
  y: number,
  c: string,
): Canvas {
  const canvas = mkCanvas(width, height)
  canvas[x]![y] = c
  return canvas
}

describe('firstClaimWins', () => {
  it('preserves a genuine perpendicular crossing between two plain junction characters', () => {
    // Edge A's own line draws '─' at (2,2); edge B's own (unrelated) line
    // independently draws '│' at the very same cell — a real crossing, not
    // a style conflict.
    const horizontal = canvasWithChar(4, 4, 2, 2, '─')
    const vertical = canvasWithChar(4, 4, 2, 2, '│')

    const resolved = firstClaimWins([horizontal, vertical])
    // Both canvases must still carry their own character at the shared
    // cell — dropping either one would make it impossible for
    // mergeCanvases's junction-merge logic below to ever see both.
    expect(resolved[0]![2]![2]).toBe('─')
    expect(resolved[1]![2]![2]).toBe('│')

    const merged = mergeCanvases(
      mkCanvas(4, 4),
      { x: 0, y: 0 },
      false,
      ...resolved,
    )
    expect(merged[2]![2]).toBe('┼')
  })

  it('still suppresses a later same-orientation duplicate (collinear overlap)', () => {
    const first = canvasWithChar(4, 4, 1, 1, '─')
    const second = canvasWithChar(4, 4, 1, 1, '─')
    const resolved = firstClaimWins([first, second])
    expect(resolved[0]![1]![1]).toBe('─')
    expect(resolved[1]![1]![1]).toBe(' ')
  })

  it('still suppresses a later non-junction character at an already-claimed cell (#1067)', () => {
    // The original #1067 scenario: a dashed edge's own leg ('┄', not a
    // junction char) sharing a cell with a heavy edge's own leg ('━', also
    // not a junction char) — neither can form a meaningful merge, so first
    // claim must still win.
    const dashed = canvasWithChar(4, 4, 1, 1, '┄')
    const heavy = canvasWithChar(4, 4, 1, 1, '━')
    const resolved = firstClaimWins([dashed, heavy])
    expect(resolved[0]![1]![1]).toBe('┄')
    expect(resolved[1]![1]![1]).toBe(' ')
  })

  it('suppresses a later cell when only one side is a junction character', () => {
    const junction = canvasWithChar(4, 4, 1, 1, '│')
    const heavy = canvasWithChar(4, 4, 1, 1, '━')
    const resolved = firstClaimWins([junction, heavy])
    expect(resolved[0]![1]![1]).toBe('│')
    expect(resolved[1]![1]![1]).toBe(' ')
  })
})
