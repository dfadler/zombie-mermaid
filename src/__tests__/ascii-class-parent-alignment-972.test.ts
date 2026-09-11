/**
 * Regression tests for issue #972 — "ASCII class-diagram layout:
 * multi-parent / overlap resolution," the second implementation stage of
 * #964's fix (docs/decisions/ascii-class-diagram-x-coordinate-assignment-970.md),
 * building on #971's single-parent alignment + universal compaction pass.
 *
 * #971 only computed a real desired position for a *singleton* block (no
 * sibling at its level shares its exact parent-id set) with exactly one
 * qualifying (strictly-shallower) parent. This fix adds the remaining
 * block shapes #970's decision named: a block of more than one class
 * sharing one qualifying-parent-set spreads evenly around that shared
 * center; a block with more than one qualifying parent centers on the
 * mean of their centers. Both reuse #971's exact compaction pass
 * unchanged, which already handles "an aligned position collides with a
 * sibling" — #972 does not add new nudging logic, only new
 * desired-position computations for `if (qualifying.length === 0)` this
 * pass now escapes into.
 */

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { findBoxRect, rectsOverlap } from './helpers/ascii-form.ts'

function boxCenter(rect: { x0: number; x1: number }): number {
  return rect.x0 + Math.floor((rect.x1 - rect.x0 + 1) / 2)
}

describe('ASCII class diagram — multi-parent / overlap resolution (issue #972)', () => {
  it('two children of the same parent spread evenly around its center, not packed from column 0', () => {
    // WidePadding gives Animal real room on both sides -- proves genuine
    // symmetric spreading, not just an edge-of-canvas clamp coincidence.
    const src = `classDiagram
  class WidePadding {
    +String p0
    +String p1
    +String p2
  }
  class Animal
  class Dog
  class Cat
  Animal <|-- Dog
  Animal <|-- Cat`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    const animal = findBoxRect(ascii, 'Animal')
    const dog = findBoxRect(ascii, 'Dog')
    const cat = findBoxRect(ascii, 'Cat')

    // Declaration order preserved: Dog left of Cat, neither overlapping.
    expect(dog.x1).toBeLessThan(cat.x0)
    // The pair's combined footprint centers on Animal's own center.
    const blockCenter = dog.x0 + Math.floor((cat.x1 - dog.x0 + 1) / 2)
    expect(Math.abs(blockCenter - boxCenter(animal))).toBeLessThanOrEqual(1)
    // Neither child sits at column 0 (the pre-#972 leftover artifact).
    expect(dog.x0).toBeGreaterThan(0)
  })

  it('a child with two parents at different levels centers on the mean of their centers', () => {
    // Controller (level 0) -> Model (level 1) -> View (level 2); View also
    // has a direct edge from Controller. View's qualifying parents are
    // both Controller and Model (both strictly shallower than View), so
    // its desired center is their mean -- not just Controller's alone.
    const src = `classDiagram
  class Controller {
    +handleInput() void
  }
  class Model {
    +getData() void
  }
  class View {
    +render() void
  }
  Controller --> Model
  Controller --> View
  Model ..> View`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    const controller = findBoxRect(ascii, 'Controller')
    const model = findBoxRect(ascii, 'Model')
    const view = findBoxRect(ascii, 'View')

    const expectedCenter = Math.round(
      (boxCenter(controller) + boxCenter(model)) / 2,
    )
    expect(Math.abs(boxCenter(view) - expectedCenter)).toBeLessThanOrEqual(1)
    // Not simply parked back at column 0 the way an unresolved block used to be.
    expect(view.x0).toBeGreaterThan(0)
  })

  it('a multi-child block whose desired position collides with an earlier sibling is pushed right without overlapping it', () => {
    // Two parents both near the canvas's left edge: EarlyParent's own
    // child (EarlySibling) is placed first; WidePair's two children want
    // to center on WidePair, which sits close enough that their desired
    // block would otherwise land on top of EarlySibling. The universal
    // compaction pass (#971, reused unchanged by #972) must push the
    // whole block right of EarlySibling instead of overlapping it.
    const src = `classDiagram
  class EarlyParent
  class WidePair
  class EarlySibling
  class ChildA
  class ChildB
  EarlyParent --> EarlySibling
  WidePair --> ChildA
  WidePair --> ChildB`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    const names = [
      'EarlyParent',
      'WidePair',
      'EarlySibling',
      'ChildA',
      'ChildB',
    ]
    const rects = names.map((n) => ({ n, r: findBoxRect(ascii, n) }))
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        expect(
          rectsOverlap(rects[i]!.r, rects[j]!.r),
          `${rects[i]!.n} and ${rects[j]!.n} boxes overlap`,
        ).toBe(false)
      }
    }
    // Declaration order preserved even after compaction pushes the block right.
    const earlySibling = findBoxRect(ascii, 'EarlySibling')
    const childA = findBoxRect(ascii, 'ChildA')
    expect(earlySibling.x1).toBeLessThan(childA.x0)
  })

  it('a block with no qualifying parents (a rootless cycle with two same-level "parent" edges) keeps its plain baseline position', () => {
    // A and B mutually reference each other with no external root: both
    // land at level 0, and neither's same-level "parent" edge qualifies --
    // #972 must not spread or converge this shape, only #971's untouched
    // no-resolvable-parents fallback applies.
    const src = `classDiagram
  class A
  class B
  A --> B
  B --> A`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    const a = findBoxRect(ascii, 'A')
    const b = findBoxRect(ascii, 'B')
    expect(a.x0).toBe(0)
    expect(a.x1).toBeLessThan(b.x0)
  })
})
