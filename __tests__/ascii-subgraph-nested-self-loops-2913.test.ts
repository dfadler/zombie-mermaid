/**
 * #2913 bullet 1 / #2028, inside a subgraph: duplicate self-loops nest there too.
 *
 * mermaid@12.3.0 (`scripts/lib/real-mermaid.ts`) draws one hook per loop on a
 * node inside a frame, each smaller hook inside the last, in the left gutter in
 * TD and BT and over the top in LR and RL, with the frame round them. The grid
 * kept member loops out of the margin column and the frame ignored the hooks'
 * legs, so a lone member drew one hook that crossed the frame's wall.
 * Not checked on GitHub / mermaid.live.
 */
import { describe, expect, it } from 'vitest'
import { registerAsciiLayout } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidASCII } from '../packages/ascii-renderer/src/index.ts'
import { renderMermaidSVG } from '../packages/svg-renderer/src/index.ts'
import { asciiLayoutProvider } from '../src/ascii-layout-provider.ts'
import {
  measureSample,
  subgraphLoopCases,
} from '../scripts/lib/ascii-topology.ts'

const draw = (source: string, hints: boolean): string => {
  registerAsciiLayout(hints ? asciiLayoutProvider : undefined)
  try {
    return renderMermaidASCII(source, { colorMode: 'none' })
  } finally {
    registerAsciiLayout(undefined)
  }
}

const trim = (out: string): string =>
  out
    .split('\n')
    .map((r) => r.trimEnd())
    .join('\n')
    .replace(/^\n+|\n+$/g, '')

const lone = (dir: string, body = 'a["a"]\n    a --> a\n    a --> a'): string =>
  `flowchart ${dir}\n  subgraph S\n    ${body}\n  end`

const CASES = subgraphLoopCases().map((c) => [c.title, c.source] as const)

describe('duplicate self-loops inside a subgraph nest (#2913)', () => {
  it.each(CASES)('%s: one hook per loop, scored exact', (_t, src) => {
    const c = measureSample(src)
    expect(c.loopHooks).toBe(c.loops)
    expect(c.faceOk).toBe(c.faceEnds)
    const rows = draw(src, true).split('\n')
    expect(new Set(rows.map((r) => r.length)).size).toBe(1)
  })

  it('TD: the hooks sit in the frame, inner inside outer, walls clear of the legs', () => {
    expect(trim(draw(lone('TD'), true))).toBe(
      [
        '┌───────────┐',
        '│     S     │',
        '│           │',
        '│           │',
        '│     ┌───┐ │',
        '│ ┌───┤   │ │',
        '│ │   │   │ │',
        '│ │ ┌─┤   │ │',
        '│ │ │ │ a │ │',
        '│ │ └►│   │ │',
        '│ │   │   │ │',
        '│ └──►│   │ │',
        '│     └───┘ │',
        '│           │',
        '└───────────┘',
      ].join('\n'),
    )
  })

  it('BT: the same hooks, flipped', () => {
    expect(trim(draw(lone('BT'), true))).toBe(
      [
        '┌───────────┐',
        '│     S     │',
        '│           │',
        '│           │',
        '│     ┌───┐ │',
        '│ ┌──►│   │ │',
        '│ │   │   │ │',
        '│ │ ┌►│   │ │',
        '│ │ │ │ a │ │',
        '│ │ └─┤   │ │',
        '│ │   │   │ │',
        '│ └───┤   │ │',
        '│     └───┘ │',
        '│           │',
        '└───────────┘',
      ].join('\n'),
    )
  })

  it('LR: the hooks stand over the node inside the frame', () => {
    expect(trim(draw(lone('LR'), true))).toBe(
      [
        '┌───────────┐',
        '│     S     │',
        '│           │',
        '│           │',
        '│  ┌─────┐  │',
        '│  │     │  │',
        '│  │ ┌─┐ │  │',
        '│  │ │ ▼ ▼  │',
        '│ ┌┴─┴────┐ │',
        '│ │       │ │',
        '│ │   a   │ │',
        '│ │       │ │',
        '│ └───────┘ │',
        '│           │',
        '└───────────┘',
      ].join('\n'),
    )
  })

  it('RL: the same hooks, mirrored', () => {
    expect(trim(draw(lone('RL'), true))).toBe(
      [
        '┌───────────┐',
        '│     S     │',
        '│           │',
        '│           │',
        '│  ┌─────┐  │',
        '│  │     │  │',
        '│  │ ┌─┐ │  │',
        '│  ▼ ▼ │ │  │',
        '│ ┌────┴─┴┐ │',
        '│ │       │ │',
        '│ │   a   │ │',
        '│ │       │ │',
        '│ └───────┘ │',
        '│           │',
        '└───────────┘',
      ].join('\n'),
    )
  })

  it('TD: a label sits on its own leg and never on the inner frame’s wall', () => {
    const out = draw(
      'flowchart TD\n  subgraph O\n    subgraph I\n      a["a"]\n      a -->|x| a\n      a -->|y| a\n    end\n    b --> a\n  end\n  c --> b',
      true,
    )
    const row = out.split('\n').find((r) => r.includes('y   x'))!
    // `│ │ y   x  │ a │`: the outer frame's wall, the inner frame's wall, a blank, then the leg's label.
    expect(row).toMatch(/^│ │ y {3}x {2}│ a │/)
  })

  it('a member loop no longer widens the gap beside another frame without end', () => {
    // A frame an edge merely passes made the loop's own frame chase its wall: 551 columns.
    const src =
      'flowchart TD\n subgraph A\n  x\n end\n subgraph B\n  p --> q\n  q --> q\n  q --> q\n end\n x --> p'
    const widest = Math.max(
      ...draw(src, true)
        .split('\n')
        .map((r) => r.length),
    )
    expect(widest).toBeLessThan(40)
    const single = src.replace('  q --> q\n  q --> q', '  q --> q')
    expect(
      Math.max(
        ...draw(single, true)
          .split('\n')
          .map((r) => r.length),
      ),
    ).toBeLessThan(40)
  })

  it('draws the same without ELK hints as before: no nesting to take from the layout', () => {
    const src = lone('TD')
    expect(draw(src, false)).toBe(
      draw(lone('TD', 'a["a"]\n    a --> a'), false),
    )
  })

  it.each(CASES)(
    '%s: snapshots SVG and ASCII (grid and ELK hints)',
    (_t, src) => {
      expect(renderMermaidSVG(src)).toMatchSnapshot('svg')
      expect(draw(src, false)).toMatchSnapshot('ascii-grid')
      expect(draw(src, true)).toMatchSnapshot('ascii-hints')
    },
  )
})
