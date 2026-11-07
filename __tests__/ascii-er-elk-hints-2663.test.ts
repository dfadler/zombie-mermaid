/**
 * ER ASCII layout from ELK hints (#2663, #2645 PR 2): layers, order and
 * alignment follow the registered provider; without one the grid keeps its own
 * placement. Sample and expectations: mermaid@12.3.0, fork-fixes entry
 * `er-ascii-crossings-labels`.
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  registerAsciiLayout,
  renderMermaidASCII,
} from '@zombie-mermaid/ascii-renderer'
import type { AsciiLayoutHints } from '@zombie-mermaid/ascii-renderer'
import { registerAsciiLayoutFromElk } from '../src/ascii-layout-provider.ts'

afterEach(() => registerAsciiLayout(undefined))

const SAMPLE = `erDiagram
  ORDER ||--|{ LINE_ITEM : contains
  ORDER ||..o{ SHIPMENT : ships-via
  PRODUCT ||--o{ LINE_ITEM : includes
  PRODUCT ||..o{ REVIEW : receives`

const render = (src: string, ascii = false) =>
  renderMermaidASCII(src, { colorMode: 'none', useAscii: ascii })
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .trimEnd()

describe('ER ASCII with ELK layout hints', () => {
  it('orders and centres the layers like mermaid, with no crossing and no label on a foreign stem', () => {
    registerAsciiLayoutFromElk()
    const out = render(SAMPLE)
    expect(out).toBe(
      [
        '┌─────────┐           ┌───────┐',
        '│ PRODUCT │           │ ORDER │',
        '└─────────┘           └───────┘',
        ' ┼       ┼             ┼     ┼',
        ' ┊       │             │     ┊',
        ' └╌╌╌┐   └─ includes ─┐│     └╌╌╌╌╌ ships-via ╌╌╌╌╌┐',
        '     ┊                │└────────┐                  ┊',
        '  receives            │         │                  ┊',
        '     ┊                │      contains              ┊',
        '     ┊                │         │                  ┊',
        '     ○                ○         │                  ○',
        '     ╧                ╧         ╧                  ╧',
        '┌────────┐           ┌───────────┐           ┌──────────┐',
        '│ REVIEW │           │ LINE_ITEM │           │ SHIPMENT │',
        '└────────┘           └───────────┘           └──────────┘',
      ].join('\n'),
    )
    // Only the four "one" markers are `┼`: no edge crosses another.
    expect(out.match(/┼/g)).toHaveLength(4)
  })

  it('keeps the grid placement without a provider', () => {
    expect(render(SAMPLE)).toBe(
      [
        '┌───────┐            ┌─────────┐',
        '│ ORDER │            │ PRODUCT │',
        '└───────┘            └─────────┘',
        ' ┼     ┼              ┼       ┼',
        ' │     ┊              │       ┊',
        ' │     └╌ ships-via ╌╌┼╌╌╌╌╌╌╌┊',
        ' contains             │       └╌╌╌╌╌╌ receives ╌╌╌╌╌╌┐',
        ' │                    │       ┊                      ┊',
        ' │         ┌ includes ┘       ┊                      ┊',
        ' │         ○                  ○                      ○',
        ' ╧         ╧                  ╧                      ╧',
        '┌───────────┐           ┌──────────┐            ┌────────┐',
        '│ LINE_ITEM │           │ SHIPMENT │            │ REVIEW │',
        '└───────────┘           └──────────┘            └────────┘',
      ].join('\n'),
    )
  })

  it('keeps every label, on its own stem or run, when parallel edges crowd the gap', () => {
    registerAsciiLayoutFromElk()
    const out = render(`erDiagram
  C ||..o{ E : label0
  C ||..o{ E : label1
  A ||--o{ E : label2`)
    expect(out).toBe(
      [
        '┌───┐         ┌───┐',
        '│ C │         │ A │',
        '└───┘         └───┘',
        ' ┼ ┼            ┼',
        ' ┊ ┊            │',
        ' ┊ ┊ label1     │',
        ' ┊ label0───────┘',
        ' ┊ │ label2',
        ' ┊┌│',
        ' ○○○',
        ' ╧╧╧',
        '┌───┐',
        '│ E │',
        '└───┘',
      ].join('\n'),
    )
    for (const l of ['label0', 'label1', 'label2']) expect(out).toContain(l)
  })

  it('places a self relationship and an ASCII-only charset from hints', () => {
    registerAsciiLayoutFromElk()
    expect(
      render(
        `erDiagram
  A ||--o{ B : has
  B ||--o{ B : parent
  A ||--o{ C : owns`,
        true,
      ),
    ).toBe(
      [
        '+---+',
        '| A |',
        '+---+',
        ' + +',
        ' | |',
        ' | +------- owns --------+',
        ' +--- has ----+          |',
        '              |          |',
        '              o          o',
        '              ^          ^',
        '            +---+      +---+',
        ' parent +-| | B |      | C |',
        '        +-o<|   |      +---+',
        '            +---+',
      ].join('\n'),
    )
  })

  it('ignores hints for a direction the grid packs side by side', () => {
    registerAsciiLayoutFromElk()
    const lr = `erDiagram
  direction LR
  A ||--o{ B : has
  A ||--o{ C : owns`
    const hinted = render(lr)
    registerAsciiLayout(undefined)
    expect(render(lr)).toBe(hinted)
  })

  it('falls back to the grid when the hints miss an entity', () => {
    const partial: AsciiLayoutHints = {
      nodes: new Map([['A', { layer: 0, order: 0, cross: 0 }]]),
      edges: [],
    }
    registerAsciiLayout({ er: () => partial })
    const out = render(SAMPLE)
    registerAsciiLayout(undefined)
    expect(out).toBe(render(SAMPLE))
  })

  it('falls back to the grid when the provider throws or gives a fractional layer', () => {
    const grid = render(SAMPLE)
    registerAsciiLayout({
      er: () => {
        throw new Error('layout failed')
      },
    })
    expect(render(SAMPLE)).toBe(grid)
    const ids = ['ORDER', 'LINE_ITEM', 'SHIPMENT', 'PRODUCT', 'REVIEW']
    registerAsciiLayout({
      er: () => ({
        nodes: new Map(
          ids.map((id, i) => [id, { layer: i / 2, order: 0, cross: 0 }]),
        ),
        edges: [],
      }),
    })
    expect(render(SAMPLE)).toBe(grid)
  })

  it('keeps a label on a same-row edge whatever else is drawn', () => {
    const hints: AsciiLayoutHints = {
      nodes: new Map([
        ['A', { layer: 0, order: 0, cross: 0 }],
        ['B', { layer: 0, order: 1, cross: 1 }],
      ]),
      edges: [],
    }
    registerAsciiLayout({ er: () => hints })
    const out = render(`erDiagram
  B ||--|| A : lost
  A ||--|| B : "aaaa<br>bbbb<br>cccc<br>dddd"`)
    expect(out).toContain('lost')
    registerAsciiLayout({ er: () => hints })
    const reversed = render(`erDiagram
  A ||--|| B : "aaaa<br>bbbb<br>cccc<br>dddd"
  B ||--|| A : lost`)
    expect(reversed).toContain('lost')
    expect(reversed).toContain('dddd')
  })

  it('draws no stray junction when a bypass column is the stem’s own (no provider)', () => {
    const out = render(`erDiagram
  D ||--o{ A : lbl0
  B ||..o{ C : lbl4
  C ||..o{ B : lbl5
  A ||--o{ C : lbl6`)
    expect(out).toBe(
      [
        '┌───┐',
        '│ D │',
        '└───┘',
        '  ┼',
        '  │',
        ' lbl0',
        '  │',
        '  ○',
        '  ╧',
        '┌───┐',
        '│ A │',
        '└───┘',
        '  ┼',
        '  │',
        '  └──┐',
        '     │',
        '     │',
        '    lbl6',
        '┌───┐│',
        '│ B ││',
        '└───┘│',
        ' ┼ ╤ │',
        ' ┊ ○ │',
        ' ┊ ┊ lbl5',
        ' ┊ lbl4',
        ' ┊┌┌─┘',
        ' ○┊○',
        ' ╧┼╧',
        '┌───┐',
        '│ C │',
        '└───┘',
      ].join('\n'),
    )
  })
})
