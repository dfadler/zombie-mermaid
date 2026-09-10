// ============================================================================
// ASCII class diagram — cross-level connector jog corrupting an intervening
// box's text
//
// Discovered incidentally while writing ascii-class-box-occupancy.test.ts's
// coverage for issue #953/PR #957 (the *same-level* relationship cycle's
// detour line lacking an occupancy guard). This is a distinct bug in a
// different branch of src/ascii/class-diagram.ts's relationship-drawing
// pass — the "target is below source" (and, by the same missing guard,
// "target is above source") branch, used whenever a relationship's two
// classes land on different levels.
//
// That branch's "no collision" routing draws a straight horizontal jog
// connecting the source's lane column to the target's lane column at some
// row between them. The *only* check that decided this was safe to draw
// without a detour (`findClearColumn`) tests whether the source's own lane
// column is itself clear of boxes across the full row range — it says
// nothing about whether the horizontal jog's row is clear all the way over
// to the target's column. When a class ends up positioned far from its
// actual parent's column — e.g. a level's only child is always placed at
// the leftmost slot regardless of which sibling at the level above is its
// parent — and a *different*, taller same-level sibling's box sits between
// those two columns, the jog cuts straight through that sibling's box,
// silently replacing whichever attribute/method row it crosses.
//
// Fixed by giving src/ascii/class-diagram.ts the same kind of box-occupancy
// guard (`boxCells`/`setCGuarded`) src/ascii/er-diagram.ts already has for
// issue #350, scoped to the cross-level branches only — the same-level
// branch's own detour (PR #957's scope) is untouched here.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { findBoxRect, rectsOverlap } from './helpers/ascii-form.ts'

function expectNoBoxOverlap(ascii: string, names: string[]): void {
  const rects = names.map((n) => ({ n, r: findBoxRect(ascii, n) }))
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      expect(
        rectsOverlap(rects[i]!.r, rects[j]!.r),
        `${rects[i]!.n} and ${rects[j]!.n} boxes overlap`,
      ).toBe(false)
    }
  }
}

function manyAttrs(prefix: string, count: number): string {
  return Array.from(
    { length: count },
    (_, i) => `    +String ${prefix}${i}`,
  ).join('\n')
}

/** Assert every one of `needles` appears verbatim, exactly once, in `text`. */
function expectAllPresentOnce(text: string, needles: string[]): void {
  for (const needle of needles) {
    const count = text.split(needle).length - 1
    expect(count, `expected "${needle}" to appear exactly once`).toBe(1)
  }
}

describe('ASCII class diagrams — cross-level connector jog never corrupts a box', () => {
  it('root-level sibling sits between a source and its far-off, sole child (minimal repro)', () => {
    // Left/TallMid/RightSrc are three unrelated level-0 roots (no cycle
    // involved, unlike the original report — isolates this bug from the
    // separately-tracked same-level detour issue). Kid is RightSrc's only
    // child, so it lands at the leftmost slot of level 1 regardless of
    // RightSrc's own (rightmost) column — the "no collision" routing then
    // has to jog the whole width of the canvas, straight through TallMid.
    const src = `classDiagram
  class Left
  class TallMid {
${manyAttrs('b', 6)}
  }
  class RightSrc
  class Kid
  RightSrc --> Kid`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectAllPresentOnce(ascii, [
      '+ b0: String',
      '+ b1: String',
      '+ b2: String',
      '+ b3: String',
      '+ b4: String',
      '+ b5: String',
    ])
    expectNoBoxOverlap(ascii, ['Left', 'TallMid', 'RightSrc', 'Kid'])
  })

  it('originally-reported repro: same-level cycle plus an unrelated root/child pair', () => {
    // The exact topology this bug was first reported against. Alpha/Mid/
    // Charlie form a same-level relationship cycle (falls to level 0 via
    // the level-BFS's "no root" fallback); Root is a genuine level-0 root
    // (declared after the cycle) with its own child Kid at level 1. Only
    // "+ b4: String" is asserted here — the cross-level bug this file
    // covers. "+ b1: String" is a *separate*, already-tracked corruption
    // (the same-level cycle's own detour, issue #953/PR #957) and is
    // deliberately not asserted on so this suite stays independent of
    // that fix landing.
    const src = `classDiagram
  class Alpha
  class Mid {
${manyAttrs('b', 6)}
  }
  class Charlie
  class Root
  class Kid
  Alpha --> Mid
  Mid --> Charlie
  Charlie --> Alpha
  Root --> Kid`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expect(
      ascii,
      '"+ b4: String" was overwritten by Root->Kid\'s jog',
    ).toContain('+ b4: String')
  })

  it('deeper tree: a tall level-0 sibling between a level-1 source and its level-2 grandchild', () => {
    const src = `classDiagram
  class A
  class TallMid {
${manyAttrs('b', 6)}
  }
  class B
  class Kid1
  class GrandKid
  B --> Kid1
  Kid1 --> GrandKid`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectAllPresentOnce(ascii, [
      '+ b0: String',
      '+ b1: String',
      '+ b2: String',
      '+ b3: String',
      '+ b4: String',
      '+ b5: String',
    ])
    expectNoBoxOverlap(ascii, ['A', 'TallMid', 'B', 'Kid1', 'GrandKid'])
  })

  it('more siblings: several unrelated roots plus a separate parent/child pair, inheritance marker', () => {
    const src = `classDiagram
  class Left
  class TallMid {
${manyAttrs('d', 6)}
  }
  class RightSrc
  class Kid
  RightSrc <|-- Kid`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectAllPresentOnce(ascii, [
      '+ d0: String',
      '+ d1: String',
      '+ d2: String',
      '+ d3: String',
      '+ d4: String',
      '+ d5: String',
    ])
    expectNoBoxOverlap(ascii, ['Left', 'TallMid', 'RightSrc', 'Kid'])
  })
})
