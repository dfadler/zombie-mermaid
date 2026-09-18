/**
 * Regression test for issue #531: at a small enough `paddingY`, a
 * relationship label could vanish from ASCII class-diagram output with no
 * error, no ellipsis, and no trace.
 *
 * Root cause: `renderClassAscii` resolves each relationship label's row in
 * two independent places. `computeLabelAnchor` gives a label a "raw" ideal
 * row (`baseMidY`). If that row lands inside a box, a runtime fallback (the
 * "box-gap scan") searches the from/to gap for the nearest row that is at
 * least clear of boxes, and the draw pass uses whatever row the fallback
 * picked. Separately, a horizontal-territory precompute (added for issue
 * #447, to stop two same-row labels from overwriting each other) decides
 * which labels need X-territory splitting by comparing each pair's row
 * bands — but it computed those bands from the *raw* `baseMidY`, before the
 * box-gap-scan fallback could move a label to a completely different row.
 * Two relationships whose *ideal* rows never overlapped could still both
 * resolve, via the fallback, to the *same actual* row — invisibly to the
 * territory precompute, which never split their columns because it never
 * saw them as colliding. The later relationship's unconditional `setC`
 * write then silently overwrote the earlier one's already-drawn label.
 *
 * A second, related gap: even once territory rowStart/rowEnd values reflect
 * the real (post-fallback) row, the split algorithm only ever compared a
 * label against its immediate neighbor by `idealMidX` order. When a third
 * label — on a different, non-colliding row — happened to sit between two
 * same-row colliding labels in `idealMidX` order, the pair that actually
 * needed splitting was never adjacent in that order and so was never
 * compared at all.
 *
 * The fix (`resolveLabelFinalY` in class-diagram.ts) resolves each label's
 * final row once, up front, and both the territory precompute and the draw
 * pass reuse that single resolved value — so they can never disagree.
 * Territory splitting also now scans outward for the nearest row-*actually*-
 * overlapping neighbor instead of stopping at the immediate one. Neither
 * fix is specific to detour routing (issue #487/#489's "route around an
 * intermediate box" mechanism): the second test below reproduces the same
 * silent-drop failure with a diagram where no relationship detours at all,
 * confirming the bug (and the fix) live in the general label-placement
 * mechanism, not the detour-trunk logic.
 */

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

/** paddingY values below the default (5) that the issue found all reproduce
 * the same corruption — the vertical gap floors at 1 row, so nothing about
 * it changes at more extreme negative values. */
const tightPaddingYValues = [4, 3, 2, 1, 0, -1, -5, -10]

describe('ASCII class diagram — relationship label row collision (issue #531)', () => {
  describe("detour-involving repro (the issue's own minimal repro)", () => {
    const src = `classDiagram
  class Model
  class View
  class Controller
  Controller --> Model : updates
  Controller --> View : refreshes
  View --> Model : reads
  Model ..> View : notifies`

    it('renders every label in full at the default paddingY', () => {
      const out = renderMermaidASCII(src, { colorMode: 'none' })
      expect(out).toContain('updates')
      expect(out).toContain('refreshes')
      expect(out).toContain('reads')
      expect(out).toContain('notifies')
    })

    it.each(tightPaddingYValues)(
      'never silently drops a label at paddingY=%d',
      (paddingY) => {
        const out = renderMermaidASCII(src, { colorMode: 'none', paddingY })

        // Three of the four labels have room to render in full regardless.
        expect(out).toContain('updates')
        expect(out).toContain('reads')
        expect(out).toContain('notifies')

        // `refreshes` shares a row with `updates` at this tight spacing and
        // must yield some of its width via territory-splitting/truncation
        // (issue #447's established, accepted behavior for genuinely
        // insufficient space) — but it must never disappear *entirely* the
        // way it (or `updates`, depending on exact geometry) did before the
        // fix. Assert the real invariant rather than pinning the exact
        // truncated glyphs: the row that carries `updates` must carry some
        // non-blank content besides it, where the old bug left nothing.
        const line = out.split('\n').find((l) => l.includes('updates'))
        expect(line).toBeDefined()
        const withoutUpdates = line!.replace('updates', '').trim()
        expect(withoutUpdates.length).toBeGreaterThan(0)
      },
    )
  })

  describe('non-detour repro (general mechanism, no detour routing involved)', () => {
    // A -> B, B -> C (adjacent, direct) plus A -> C (a "skip" relationship
    // whose direct straight-line midpoint lands inside B's box, triggering
    // the same box-gap-scan fallback purely from vertical box geometry —
    // no relationship here ever detours horizontally). Confirms the bug (and
    // the fix) are independent of the #487/#489 detour-trunk logic, per the
    // issue's own "Scope note".
    const src = `classDiagram
  class A
  class B
  class C
  A --> B : sib1
  B --> C : sib2
  A --> C : longlabelhere`

    it('renders every label in full at the default paddingY', () => {
      const out = renderMermaidASCII(src, { colorMode: 'none' })
      expect(out).toContain('sib1')
      expect(out).toContain('sib2')
      expect(out).toContain('longlabelhere')
    })

    it.each(tightPaddingYValues)(
      'never silently drops a label at paddingY=%d',
      (paddingY) => {
        const out = renderMermaidASCII(src, { colorMode: 'none', paddingY })

        expect(out).toContain('sib1')
        expect(out).toContain('sib2')

        // `longlabelhere` shares a row with `sib1` at this tight spacing and
        // gets truncated rather than disappearing outright — see the note
        // in the sibling describe block above.
        const line = out.split('\n').find((l) => l.includes('sib1'))
        expect(line).toBeDefined()
        const withoutSib1 = line!.replace('sib1', '').trim()
        expect(withoutSib1.length).toBeGreaterThan(0)
      },
    )
  })
})
