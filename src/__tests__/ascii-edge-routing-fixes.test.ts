/**
 * Regression tests for GitHub issue #64 — ASCII edge-routing engine bugs:
 * dense fan-in crashes, order-dependent root misdetection, ungrouped
 * fan-in roots, sibling edges not sharing a trunk, and box-start connector
 * drift. Repro diagrams are taken directly from the issue.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidAscii } from '../ascii/index.ts'

describe('issue #64: edge-routing crashes and layout bugs', () => {
  describe('bug 1: dense fan-in pathfinding blowup', () => {
    it('renders the dense fan-in repro without hanging or crashing', () => {
      const start = Date.now()
      const out = renderMermaidAscii(`graph TD
    A["AAA<br>(keita)"] --> C["CCC"]
    B["BBB<br>(yuriko)"] --> C
    C --> D["DDDD"]
    D --> E["EEEE"]
    A1["1 / 2"] --> A
    A2["3 / 4"] --> A
    A3["5 / 6"] --> A
    A4["XXX<br>(YYY ZZZ)"] --> A
    B1["77 77<br>(7 / 7 / 7)"] --> B
    B2["88-88<br>(99 99)"] --> B
    B3["111s 222s"] --> B
    D --> F{"F?"}
    F -->|Yes| G["High level<br>Tr"]
    F -->|No| H["Dumb Tr<br>S"]`)
      // A generous ceiling — this used to not return within 60s on the
      // reporter's environment. A correct, bounded render should be
      // effectively instant; this just guards against a real regression
      // back to unbounded behavior without being a flaky wall-clock test.
      expect(Date.now() - start).toBeLessThan(5000)
      for (const label of ['AAA', 'BBB', 'CCC', 'DDDD', 'EEEE', 'F?']) {
        expect(out).toContain(label)
      }
    }, 10000)

    it('renders a much larger dense fan-in graph without hanging or crashing', () => {
      // Amplified stress case (2x60 root nodes feeding two hubs) — confirms
      // the render-wide path budget bounds total pathfinding work even
      // when the per-search cap alone would not (each of ~120 fan-in edges
      // independently getting its own 50k-iteration allowance is what
      // caused real OOM crashes during investigation of this issue).
      let src = 'graph TD\n  A --> C\n  B --> C\n  C --> D\n  D --> E\n'
      for (let i = 0; i < 60; i++) src += `  A${i}["Root A${i}"] --> A\n`
      for (let i = 0; i < 60; i++) src += `  B${i}["Root B${i}"] --> B\n`

      const start = Date.now()
      const out = renderMermaidAscii(src)
      expect(Date.now() - start).toBeLessThan(10000)
      expect(out).toContain('Root A0')
      expect(out).toContain('Root B59')
    }, 20000)
  })

  describe('bug 2: order-dependent root misdetection', () => {
    it('does not misclassify a node as a root when its child edge is declared first', () => {
      // A --> C is declared *before* A1 --> A, so a single-pass,
      // insertion-order root scan would wrongly treat A as a root (it
      // "looks" untargeted at the point the scan reaches it).
      const out = renderMermaidAscii(`graph TD
    A["Parent A"] --> C["Child C"]
    B["Parent B"] --> C
    C --> D["Grandchild D"]
    A1["Root 1"] --> A
    A2["Root 2"] --> A
    A3["Root 3"] --> A
    B1["Root 4"] --> B
    B2["Root 5"] --> B`)

      const lines = out.split('\n')
      const rootRow = lines.findIndex((l) => l.includes('Root 1'))
      const parentRow = lines.findIndex((l) => l.includes('Parent A'))
      const childRow = lines.findIndex((l) => l.includes('Child C'))
      const grandchildRow = lines.findIndex((l) => l.includes('Grandchild D'))

      // Correct levels: roots above parents above child above grandchild.
      expect(rootRow).toBeLessThan(parentRow)
      expect(parentRow).toBeLessThan(childRow)
      expect(childRow).toBeLessThan(grandchildRow)
    })

    it('does not crash on a graph that is a pure cycle (no node is ever a real root)', () => {
      // Every node here has a real incoming edge — order-independent
      // detection correctly finds zero "never targeted" roots, so the
      // layout needs its own fallback seed to avoid leaving every node
      // unplaced (which used to crash with "Map maximum size exceeded" /
      // a null gridCoord dereference).
      expect(() =>
        renderMermaidAscii('graph LR\nA --> B --> C --> A'),
      ).not.toThrow()
      const out = renderMermaidAscii('graph LR\nA --> B --> C --> A')
      expect(out).toContain('A')
      expect(out).toContain('B')
      expect(out).toContain('C')
    })
  })

  describe('bug 3: fan-in roots grouped by shared target', () => {
    it('groups roots feeding the same target contiguously, even when interleaved in source order', () => {
      // A1 and B1 are declared before A2 and B2, interleaving the two
      // fan-in clusters in source order — the roots feeding A must still
      // end up placed together, separately from the roots feeding B.
      const out = renderMermaidAscii(`graph TD
    A1 --> A
    B1 --> B
    A2 --> A
    B2 --> B
    A --> C
    B --> C`)

      const topRow = out.split('\n').find((l) => l.includes('A1'))!
      const a1 = topRow.indexOf('A1')
      const a2 = topRow.indexOf('A2')
      const b1 = topRow.indexOf('B1')
      const b2 = topRow.indexOf('B2')

      expect(a1).toBeGreaterThanOrEqual(0)
      expect(a2).toBeGreaterThanOrEqual(0)
      expect(b1).toBeGreaterThanOrEqual(0)
      expect(b2).toBeGreaterThanOrEqual(0)
      // Grouped order: both A-feeders before both B-feeders.
      expect(a1).toBeLessThan(b1)
      expect(a2).toBeLessThan(b1)
      expect(b1).toBeLessThan(b2)
    })
  })

  describe('bug 4: sibling edges from the same source share a trunk', () => {
    it('routes a labeled 3-way fan-out along a shared straight trunk instead of a detour', () => {
      const out = renderMermaidAscii(`flowchart TB
    Src["Source"]
    Left["Left Target"]
    Center["Center Target"]
    Right["Right Target"]
    Src -->|left*| Left
    Src -->|center*| Center
    Src -->|right*| Right`)

      // The three branch points (├, ┬, ┐) for a clean shared trunk all
      // land on the same row, immediately below Source's box.
      const trunkRow = out
        .split('\n')
        .find((l) => l.includes('├') && l.includes('┬') && l.includes('┐'))
      expect(trunkRow).toBeDefined()
    })
  })

  describe('bug 5: box-start connector stays on the source border', () => {
    it('keeps the ├ connector attached to the box border when a sibling label widens a shared column', () => {
      const out = renderMermaidAscii(`flowchart LR
  Src["Source"]
  Top["Top Target"]
  Mid["Middle Target"]
  Bot["Bottom Target"]
  Src -->|top*| Top
  Src -->|mid*| Mid
  Src -->|bot*| Bot`)

      const topRow = out.split('\n').find((l) => l.includes('top*'))!
      // The connector must be immediately adjacent to Source's box — no
      // run of blank space between the border and the line/label.
      expect(topRow).toMatch(/Source ├top\*/)
    })
  })
})
