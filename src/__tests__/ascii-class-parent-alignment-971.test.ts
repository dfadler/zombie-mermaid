/**
 * Regression tests for issue #971 — "ASCII class-diagram layout: single-
 * parent x-alignment," the first implementation stage of #964's fix
 * (docs/decisions/ascii-class-diagram-x-coordinate-assignment-970.md).
 *
 * Before this fix, `class-diagram.ts` packed each level's classes strictly
 * left-to-right in declaration order, with no reference to any parent's
 * column — a level with exactly one occupant always landed at column 0,
 * even when its real parent sat far to the right. This fix aligns a
 * "singleton block" (no sibling at its level shares its exact parent-id
 * set) with exactly one qualifying (strictly-shallower) parent under that
 * parent's own box center instead. Every other shape (no parents, an
 * all-same-level/rootless-cycle parent set, or more than one class sharing
 * a parent set) is out of scope here — it keeps its pre-fix left-to-right
 * position, tracked separately by issue #972.
 */

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { findBoxRect } from './helpers/ascii-form.ts'

describe('ASCII class diagram — single-parent x-alignment (issue #971)', () => {
  it("#964's exact repro: a lone child aligns under its real parent's center, not the leftmost column", () => {
    const src = `classDiagram
  class Left
  class TallMid {
    +String b0
    +String b1
    +String b2
    +String b3
    +String b4
    +String b5
  }
  class RightSrc
  class Kid
  RightSrc --> Kid`
    const ascii = renderMermaidASCII(src, { useAscii: true })

    const rightSrc = findBoxRect(ascii, 'RightSrc')
    const kid = findBoxRect(ascii, 'Kid')
    const rightSrcCenter =
      rightSrc.x0 + Math.floor((rightSrc.x1 - rightSrc.x0) / 2)
    const kidCenter = kid.x0 + Math.floor((kid.x1 - kid.x0) / 2)

    // Kid's box center lands on (or within 1 cell of, for odd-width
    // rounding) RightSrc's box center -- not at column 0, where every
    // sole-occupant level used to land regardless of its real parent.
    expect(Math.abs(kidCenter - rightSrcCenter)).toBeLessThanOrEqual(1)
    expect(kid.x0).toBeGreaterThan(0)

    // Left is the leftmost root and must stay exactly where declaration
    // order has always put it -- this fix only ever moves a class that has
    // a real single parent to align to.
    const left = findBoxRect(ascii, 'Left')
    expect(left.x0).toBe(0)
  })

  it('a root class with no parent at all is unaffected', () => {
    const src = `classDiagram
  class Lonely`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    const lonely = findBoxRect(ascii, 'Lonely')
    expect(lonely.x0).toBe(0)
  })

  it('a class whose only parent edges are same-level (a rootless relationship cycle) is unaffected', () => {
    // A -> B -> C -> A has no external root: the level-BFS puts every
    // member at level 0 together, but the `parents` map still records
    // each one's in-cycle predecessor. That predecessor is same-level, not
    // strictly shallower, so it doesn't qualify -- every member keeps its
    // plain declaration-order position, same as before this fix.
    const src = `classDiagram
  class A
  class B
  class C
  A --> B
  B --> C
  C --> A`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    const a = findBoxRect(ascii, 'A')
    const b = findBoxRect(ascii, 'B')
    const c = findBoxRect(ascii, 'C')
    expect(a.x0).toBe(0)
    expect(a.x0).toBeLessThan(b.x0)
    expect(b.x0).toBeLessThan(c.x0)
  })

  // Two children sharing the exact same single parent are a *multi-member*
  // block -- explicitly out of #971's scope (see #972) -- so this sample
  // must render byte-for-byte the way it always has. Chosen because
  // docs/decisions/ascii-class-diagram-x-coordinate-assignment-970.md
  // names this exact samples-data.ts sample ("Class: Inheritance (<|--)")
  // as one it verified stays unchanged.
  it('an existing catalog sample with a multi-child parent (Class: Inheritance) keeps its exact current positions', () => {
    const src = `classDiagram
  class Animal {
    +String name
    +eat() void
  }
  class Dog {
    +String breed
    +bark() void
  }
  class Cat {
    +bool isIndoor
    +meow() void
  }
  Animal <|-- Dog
  Animal <|-- Cat`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    const animal = findBoxRect(ascii, 'Animal')
    const dog = findBoxRect(ascii, 'Dog')
    const cat = findBoxRect(ascii, 'Cat')
    expect(animal).toEqual({ x0: 0, x1: 17, y0: 0, y1: 6 })
    expect(dog).toEqual({ x0: 0, x1: 18, y0: 10, y1: 16 })
    expect(cat).toEqual({ x0: 23, x1: 42, y0: 10, y1: 16 })
  })

  it('two independent single-parent children at the same level both align, and compaction keeps them from overlapping', () => {
    // ParentA and ParentB are both roots; KidA is ParentA's only child,
    // KidB is ParentB's only child. Each is its own singleton block with
    // exactly one qualifying parent, so both get a real desired center --
    // this exercises the compaction pass itself (#971 must implement it
    // for every block shape, not just multi-parent ones): two different
    // singleton blocks can still want colliding desired positions.
    const src = `classDiagram
  class ParentA
  class ParentB
  class KidA
  class KidB
  ParentA --> KidA
  ParentB --> KidB`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    const kidA = findBoxRect(ascii, 'KidA')
    const kidB = findBoxRect(ascii, 'KidB')
    // Declaration order is preserved -- KidA never lands right of KidB.
    expect(kidA.x1).toBeLessThan(kidB.x0)
  })
})
