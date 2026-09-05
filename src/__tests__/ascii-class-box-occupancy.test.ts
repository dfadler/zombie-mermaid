// ============================================================================
// ASCII class diagram box-occupancy invariants
//
// Unlike src/ascii/er-diagram.ts (which gained an occupancy guard —
// `setCGuarded`/`boxCells`/`regionClear` — fixing issue #350),
// src/ascii/class-diagram.ts has no equivalent mechanism: its relationship
// line/marker/label writes all go through the plain `setC`, which only
// bounds-checks, never occupancy-checks. This suite sweeps the same "does a
// relationship line/label ever land on top of an unrelated class's box"
// question issue #350 asked for ER diagrams, generalized to class diagrams —
// where it has never been asked before. Most cases pass today (no unguarded
// code path is exercised); two are confirmed-broken and marked `it.fails`
// with the exact code path they hit.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'
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

  it.fails(
    // Confirmed by rendering (not just reading the code): the same-level
    // branch's detour row — `Math.max(fromBY, toP.y + toP.height - 1) + 2`
    // — is computed only from the *relationship's own* two endpoints
    // (Alpha, Charlie). It never checks whether Mid, sitting between them
    // in the same row, is taller and extends below that row. The detour's
    // horizontal segment is drawn through plain `setC` with no occupancy
    // check, so it cuts straight through Mid's box — see the middle
    // attribute line missing from the assertion below.
    '3-node cycle, Mid (middle) has 6 attributes: detour line corrupts an attribute row',
    () => {
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
    },
  )

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

  it.fails(
    // Confirmed by rendering: a 4-node cycle (A->B->C->D->A) plus a skip
    // edge (A->C) also falls into the same unguarded same-level detour as
    // the 3-node case above — a second, independently-verified topology
    // hitting the same code gap, this time skipping over B's box.
    '4-node cycle with a skip edge, tall middle class: detour corrupts an attribute row',
    () => {
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
    },
  )

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
