/**
 * ER ASCII legibility (#2112): edge crossings carry a junction glyph, a
 * relationship label belongs to one edge, and no edge runs along a box border.
 * The whole-canvas rules live in helpers/ascii-invariants.ts and run over every
 * gallery sample in ascii-invariants-1858.test.ts; this file pins the old
 * output of the two samples that broke them (so the rules provably fail on it)
 * and the routing behaviour that fixed it.
 */
import { describe, expect, it } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { samples } from '../packages/site/samples-data.ts'
import { checkAll } from './helpers/ascii-invariants.ts'

const rules = (out: string) =>
  new Set(
    checkAll(out, { unicode: true, er: true, skip: ['arms'] }).map(
      (x) => x.rule,
    ),
  )

/** `renderMermaidASCII` output of the two gallery samples on main 0c13e226. */
const OLD_MIXED = `
┌───────┐      ┌─────────┐
│ ORDER │      │ PRODUCT │
└───────┘      └─────────┘
 ┼     ┼        ┼      ┌┼
 │     └╌╌╌╌╌╌╌╌│╌╌╌╌╌╌┊╌┐
 │ contains┌────┘      ┊ ┊ ships-via
 │         │ includes  └ receives ╌╌╌╌╌╌╌╌┐
 │         ○             ○                ○
 ╧         ╧             ╧                ╧
┌───────────┐      ┌──────────┐      ┌────────┐
│ LINE_ITEM │      │ SHIPMENT │      │ REVIEW │
└───────────┘      └──────────┘      └────────┘`.slice(1)

const OLD_BLOG = `
┌────────────────────┐
│ USER               │
└────────────────────┘
 ┼────────────────────┐
          ┌─────────┘ │
          │ writes    │
          ○           │
          ╧           │
┌──────────────────┐  │
│ POST             │  │
└──────────────────┘  │
 ┼                ╤   │ authors
 │                │   │
 │ has            └──────────────┐ tagged-with
 │              ┌─────┘          │
 ○              ○                ○`.slice(1)

const source = (title: string) => samples.find((x) => x.title === title)!.source
const MIXED = source('ER: Mixed Identifying & Non-Identifying')
const BLOG = source('ER: Blog Platform Schema')

describe('ER ASCII legibility rules fail on the old output (#2112)', () => {
  it('flags a crossing with no junction, an ambiguous label and a border-hugging edge', () => {
    expect(rules(OLD_MIXED)).toContain('crossing')
    expect(rules(OLD_MIXED)).toContain('label')
    expect(rules(OLD_BLOG)).toContain('border-hug')
  })
})

describe('ER ASCII routing (#2112)', () => {
  it('draws a junction where two edges cross, in both charsets', () => {
    for (const [useAscii, glyph] of [
      [false, '┼'],
      [true, '+'],
    ] as const) {
      const out = renderMermaidASCII(MIXED, { colorMode: 'none', useAscii })
      // A stem crossing a jog: the glyph sits between two line strokes
      expect(out).toMatch(
        useAscii ? /[.-]\+[.-]/ : new RegExp(`[╌─]${glyph}[╌─]`),
      )
    }
  })

  it('keeps a bypass off the box border and labels edges on their own line', () => {
    const out = renderMermaidASCII(BLOG, { colorMode: 'none' })
    const rows = out.split('\n')
    const bottom = rows.findIndex((r) => r.startsWith('└'))
    // The row under USER holds only marker ticks, never a horizontal run
    expect(rows[bottom + 1]).not.toMatch(/[─╌]/)
    expect(checkAll(out, { unicode: true, er: true, skip: ['arms'] })).toEqual(
      [],
    )
  })

  it('puts a label that fits on its own jog, between two blanks', () => {
    const out = renderMermaidASCII(MIXED, { colorMode: 'none' })
    expect(out).toMatch(/╌ ships-via ╌/)
    expect(out).toMatch(/┌ includes ┘/)
  })

  it('does not erase another edge when a label is placed', () => {
    const out = renderMermaidASCII(BLOG, { colorMode: 'none' })
    // Every relationship keeps both of its markers
    expect(out.match(/○/g)).toHaveLength(4)
    expect(out.match(/[╧╤]/g)).toHaveLength(5)
  })
})
