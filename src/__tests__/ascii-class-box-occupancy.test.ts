// ============================================================================
// ASCII class diagram box-occupancy invariants
//
// packages/ascii-renderer/src/er-diagram.ts has an occupancy guard —
// `setCGuarded`/`boxCells`/`regionClear` — fixing issue #350.
// packages/ascii-renderer/src/class-diagram.ts now generalizes that same
// guard (see its own `boxCells`/`setCGuarded`, plus an obstruction-aware
// same-level detour row) to close issue #953's class-diagram cases. This
// suite sweeps the same "does a relationship line/label ever land on top of
// an unrelated class's box" question issue #350 asked for ER diagrams,
// generalized to class diagrams. Two cases below (the same-level detour
// crossing a taller, in-between class's box) used to be confirmed-broken and
// marked `it.fails`; they're now plain `it()` cases, verifying the fix.
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

describe('ASCII class diagrams — class boxes never overlap', () => {
  it('2 classes, inheritance, target below (baseline)', () => {
    const src = `classDiagram
  class A
  class B
  A <|-- B`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, ['A', 'B'])
  })

  it('2 classes, association, long label', () => {
    const src = `classDiagram
  class A
  class B
  A --> B : a very long descriptive association label`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, ['A', 'B'])
  })

  it('root + 3 same-level siblings, one inheritance edge', () => {
    const src = `classDiagram
  class Root
  class Sib1
  class Sib2
  class Sib3
  Root <|-- Sib1
  Root <|-- Sib2
  Root <|-- Sib3`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, ['Root', 'Sib1', 'Sib2', 'Sib3'])
  })

  // ---------------------------------------------------------------------
  // "Same level" routing (src/ascii/class-diagram.ts's final `else` branch,
  // the class-diagram analog of issue #350's ER bug) turns out to be hard
  // to reach on purpose: empirically (verified by rendering and inspecting
  // raw output, not just reading the code), a direct relationship edge
  // between two classes pushes the target to a deeper level than the
  // source even when both share a parent — so two siblings connected by
  // their own edge route through the "below" branch, not "same level".
  // The same-level branch only fires when the layout can't linearly level
  // the graph at all, i.e. a relationship cycle forces its `levelCap`
  // fallback. A 3-node cycle (A->B->C->A) reliably triggers it.
  // ---------------------------------------------------------------------

  it('3-node cycle (same-level fallback), no obstruction (baseline)', () => {
    const src = `classDiagram
  class Alpha
  class Mid
  class Charlie
  Alpha --> Mid
  Mid --> Charlie
  Charlie --> Alpha`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, ['Alpha', 'Mid', 'Charlie'])
  })

  // The same-level branch's detour row used to be computed only from the
  // relationship's own two endpoints (Alpha, Charlie), never checking
  // whether Mid — sitting between them in the same row — was taller and
  // extended below that row. class-diagram.ts now searches for such a
  // same-row obstruction and routes the detour below its bottom edge too
  // (generalizing er-diagram.ts's obstructionBottom guard, issue #350),
  // so the detour's horizontal segment no longer cuts through Mid's box.
  it('3-node cycle, Mid (middle) has 6 attributes: detour line corrupts an attribute row', () => {
    const src = `classDiagram
  class Alpha
  class Mid {
${manyAttrs('b', 6)}
  }
  class Charlie
  Alpha --> Mid
  Mid --> Charlie
  Charlie --> Alpha`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectAllPresentOnce(ascii, [
      '+ b0: String',
      '+ b1: String',
      '+ b2: String',
      '+ b3: String',
      '+ b4: String',
      '+ b5: String',
    ])
  })

  // The same-row obstruction search (see the test above) must skip a class
  // on a *different* level/row, even when that class's box geometrically
  // overlaps the detour's horizontal span — not just when it happens to sit
  // off to the side where the search would ignore it anyway regardless of
  // the `other.y !== fromP.y` filter. `Root`/`Kid` are a real root/child
  // pair via the level-BFS (Root has no parent, Kid is its level-1 child),
  // placed on a different row from the Alpha/Mid/Charlie cycle.
  //
  // Two orderings of the same Root/Kid pair are compared: declaring Root
  // first places Kid's column off to the side, outside the Alpha-to-Charlie
  // detour span; declaring Root between Alpha and Mid places Kid's column
  // so it overlaps Alpha's own range instead (confirmed below via
  // `findBoxRect`). If the different-row filter worked, both orderings
  // render the cycle identically — Root/Kid's actual row is irrelevant to
  // it either way. A test that only used the non-overlapping ordering would
  // pass even with the filter deleted (verified: an earlier version of this
  // test did exactly that, and CodeRabbit correctly flagged it as not
  // actually exercising the filter — see the PR discussion). Sabotage-
  // verified: deleting the filter leaves both orderings' `+ bN: String`
  // lines intact but makes the overlapping ordering one row taller than the
  // non-overlapping one (19 vs. 18), which the equality assertion below
  // catches.
  it('3-node cycle, unrelated Root->Kid pair on a different level: obstruction search ignores it regardless of whether it overlaps the detour span', () => {
    function withRootKid(rootDeclaredBetweenAlphaAndMid: boolean): string {
      const rootAndKid = `  class Root
  class Kid
`
      return `classDiagram
${rootDeclaredBetweenAlphaAndMid ? '' : rootAndKid}  class Alpha
${rootDeclaredBetweenAlphaAndMid ? rootAndKid : ''}  class Mid {
${manyAttrs('b', 6)}
  }
  class Charlie
  Alpha --> Mid
  Mid --> Charlie
  Charlie --> Alpha
  Root --> Kid`
    }

    const nonOverlapping = renderMermaidASCII(withRootKid(false), {
      useAscii: true,
    })
    const overlapping = renderMermaidASCII(withRootKid(true), {
      useAscii: true,
    })

    // Confirms the geometry this test relies on: in the "overlapping"
    // ordering, Kid really does sit on a different row from the cycle, and
    // really does overlap Alpha's own column range (i.e. the obstruction
    // search has something to incorrectly notice if the different-row
    // filter is missing); in the "non-overlapping" ordering, it doesn't.
    const overlappingAlphaRect = findBoxRect(overlapping, 'Alpha')
    const overlappingKidRect = findBoxRect(overlapping, 'Kid')
    expect(overlappingKidRect.y0).toBeGreaterThan(overlappingAlphaRect.y1)
    expect(overlappingKidRect.x0).toBeLessThan(overlappingAlphaRect.x1)
    const nonOverlappingAlphaRect = findBoxRect(nonOverlapping, 'Alpha')
    const nonOverlappingKidRect = findBoxRect(nonOverlapping, 'Kid')
    expect(nonOverlappingKidRect.x1).toBeLessThanOrEqual(
      nonOverlappingAlphaRect.x0,
    )

    for (const ascii of [nonOverlapping, overlapping]) {
      expectAllPresentOnce(ascii, [
        '+ b0: String',
        '+ b1: String',
        '+ b2: String',
        '+ b3: String',
        '+ b4: String',
        '+ b5: String',
      ])
      expectNoBoxOverlap(ascii, ['Alpha', 'Mid', 'Charlie', 'Root', 'Kid'])
    }

    // The real check: Kid overlapping the detour span must not change the
    // cycle's own rendered height compared to Kid sitting clear of it.
    expect(overlapping.split('\n').length).toBe(
      nonOverlapping.split('\n').length,
    )
  })

  // `computeLabelAnchor`'s same-level branch used to recompute the label's
  // row from scratch (`Math.max(fromBY, toBY) + 2`) instead of reusing the
  // connector's own obstruction-aware `detourY` (`sameLevelDetourY` above)
  // — so a *labeled* same-level relationship still landed its label inside
  // Mid's box even after the unlabeled connector-line fix above, the same
  // corruption in a sibling code path (caught in review on PR #957).
  it('3-node cycle, Mid (middle) has 6 attributes, labeled wrap-around relationship: label no longer corrupts an attribute row', () => {
    const src = `classDiagram
  class Alpha
  class Mid {
${manyAttrs('b', 6)}
  }
  class Charlie
  Alpha --> Mid
  Mid --> Charlie
  Charlie --> Alpha : a rather long descriptive label`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectAllPresentOnce(ascii, [
      '+ b0: String',
      '+ b1: String',
      '+ b2: String',
      '+ b3: String',
      '+ b4: String',
      '+ b5: String',
    ])
    expect(ascii).toContain('a rather long descriptive label')
  })

  it('3-node cycle, long relationship label, no tall obstruction', () => {
    const src = `classDiagram
  class Alpha
  class Mid
  class Charlie
  Alpha --> Mid : a rather long descriptive label
  Mid --> Charlie
  Charlie --> Alpha`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, ['Alpha', 'Mid', 'Charlie'])
  })

  it('3-node cycle, long class names, no tall obstruction', () => {
    const src = `classDiagram
  class AlphaService
  class MidRepository
  class CharlieController
  AlphaService --> MidRepository
  MidRepository --> CharlieController
  CharlieController --> AlphaService`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, [
      'AlphaService',
      'MidRepository',
      'CharlieController',
    ])
  })

  it('2 levels (A,B / C,D), C tall, A->D association (cross-level jog)', () => {
    const src = `classDiagram
  class A
  class B
  class C {
${manyAttrs('c', 6)}
  }
  class D
  A <|-- C
  B <|-- D
  A --> D`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, ['A', 'B', 'C', 'D'])
  })

  // A 4-node cycle (A->B->C->D->A) plus a skip edge (A->C) also fell into
  // the same unguarded same-level detour as the 3-node case above — a
  // second, independently-verified topology hitting the same code gap,
  // this time skipping over B's box. Fixed by the same obstruction-aware
  // detour routing (see the 3-node cycle test above).
  it('4-node cycle with a skip edge, tall middle class: detour corrupts an attribute row', () => {
    const src = `classDiagram
  class A
  class B {
${manyAttrs('b', 6)}
  }
  class C
  class D
  A --> B
  B --> C
  C --> D
  D --> A
  A --> C`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectAllPresentOnce(ascii, [
      '+ b0: String',
      '+ b1: String',
      '+ b2: String',
      '+ b3: String',
      '+ b4: String',
      '+ b5: String',
    ])
  })

  it('3 siblings + 2 children, crossing inheritance edges', () => {
    const src = `classDiagram
  class Sib1
  class Sib2
  class Sib3
  class Child1
  class Child2
  Sib1 <|-- Child1
  Sib3 <|-- Child2
  Sib2 <|-- Child1
  Sib2 <|-- Child2`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, ['Sib1', 'Sib2', 'Sib3', 'Child1', 'Child2'])
  })

  it('strict 3-level vertical chain (negative control, no detour logic)', () => {
    const src = `classDiagram
  class A
  class B
  class C
  A <|-- B
  B <|-- C`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, ['A', 'B', 'C'])
  })

  it('4 siblings under a root, plus a cross-relationship A->D', () => {
    const src = `classDiagram
  class Root
  class A
  class B
  class C
  class D
  Root <|-- A
  Root <|-- B
  Root <|-- C
  Root <|-- D
  A --> D`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, ['Root', 'A', 'B', 'C', 'D'])
  })

  it('2 classes, realization, target above source', () => {
    const src = `classDiagram
  class Impl
  class Iface
  Impl ..|> Iface`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, ['Impl', 'Iface'])
  })

  it('3 siblings under a root, chained by two dependency edges (A->B, B->C)', () => {
    const src = `classDiagram
  class Root
  class A
  class B
  class C
  Root <|-- A
  Root <|-- B
  Root <|-- C
  A ..> B
  B ..> C`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, ['Root', 'A', 'B', 'C'])
  })

  it('2 classes, association, one has interface annotation + long attrs/methods', () => {
    const src = `classDiagram
  class Serializable {
    <<interface>>
    +serialize() String
    +deserialize(data) void
  }
  class Document
  Document ..|> Serializable`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, ['Serializable', 'Document'])
  })

  it('3 siblings under a root plus a relationship, unrelated D one level below', () => {
    const src = `classDiagram
  class Alpha
  class Bravo
  class Charlie
  class Delta
  Alpha <|-- Bravo
  Alpha <|-- Charlie
  Bravo *-- Charlie
  Bravo <|-- Delta`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, ['Alpha', 'Bravo', 'Charlie', 'Delta'])
  })

  it('cyclic dependency edges (cycle-breaking still non-overlapping)', () => {
    const src = `classDiagram
  class View
  class Model
  View --> Model
  Model ..> View`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, ['View', 'Model'])
  })

  it('2 classes, near-duplicate names (substring-collision guard)', () => {
    const src = `classDiagram
  class ServiceA
  class ServiceA2
  ServiceA <|-- ServiceA2`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, ['ServiceA', 'ServiceA2'])
  })
})
