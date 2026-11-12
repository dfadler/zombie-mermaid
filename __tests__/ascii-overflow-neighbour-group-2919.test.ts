/**
 * #2919 cause B: a neighbour same-pair group whose ELK face holds more ends than
 * a face's three cells takes ELK's faces (the dense-duplicate sample's `a --> b`
 * and `b --> c` pairs). Measured against ELK's hints and mermaid@12.3.0's faces
 * (B/T in TD, R/L in LR, mirrored in BT and RL).
 */
import { describe, expect, it } from 'vitest'
import { registerAsciiLayout } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidASCII } from '../packages/ascii-renderer/src/index.ts'
import { samples } from '../samples/samples-data.ts'
import { asciiLayoutProvider } from '../src/ascii-layout-provider.ts'
import { measureSample } from '../scripts/lib/ascii-topology.ts'

const dense = (title: 'TD' | 'LR'): string =>
  samples.find(
    (x) => x.title === `Flowchart: Dense Duplicate Edges (${title})`,
  )!.source

describe('overflowing neighbour group on ELK faces (#2919)', () => {
  it.each(['TD', 'BT', 'LR', 'RL'] as const)(
    'puts all 20 dense-duplicate ends on ELK’s faces in %s',
    (dir) => {
      registerAsciiLayout(asciiLayoutProvider)
      const { faceOk, faceEnds } = measureSample(
        dense('TD').replace('flowchart TD', `flowchart ${dir}`),
      )
      expect(faceEnds).toBe(20)
      expect(faceOk).toBe(20)
    },
  )

  it('draws one stroke and one arrowhead per edge in TD', () => {
    registerAsciiLayout(asciiLayoutProvider)
    const text = renderMermaidASCII(dense('TD'), {
      colorMode: 'none',
      layoutHints: true,
    })
    // Ten edges, two of them loops of nothing: eight forward ends plus two returns.
    expect((text.match(/▼/g) ?? []).length).toBe(8)
    expect((text.match(/▲/g) ?? []).length).toBe(2)
  })

  it('keeps a labelled group on lanes: its labels stay whole', () => {
    registerAsciiLayout(asciiLayoutProvider)
    const src =
      'graph TD\nA -->|one| B\nA -->|two| B\nA -->|three| B\nA -->|four| B\nB --> C\nB --> C'
    const text = renderMermaidASCII(src, {
      colorMode: 'none',
      layoutHints: true,
    })
    for (const l of ['one', 'two', 'three', 'four']) expect(text).toContain(l)
  })

  it.each(['TD', 'LR'] as const)(
    'renders Labeled Fan-In (LR) in %s without losing a label',
    (dir) => {
      registerAsciiLayout(asciiLayoutProvider)
      const s = samples.find((x) => x.title === 'Labeled Fan-In (LR)')!
      const text = renderMermaidASCII(
        s.source.replace(/^(\s*(?:graph|flowchart))\s+\w+/m, `$1 ${dir}`),
        { colorMode: 'none', layoutHints: true },
      )
      for (const l of s.source.match(/\|([^|]+)\|/g) ?? [])
        expect(text).toContain(l.slice(1, -1))
    },
  )

  it('leaves a group within a face’s three cells on its lanes', () => {
    registerAsciiLayout(asciiLayoutProvider)
    const src = 'graph TD\nA --> B\nA --> B\nB --> C'
    const withHints = renderMermaidASCII(src, {
      colorMode: 'none',
      layoutHints: true,
    })
    registerAsciiLayout(undefined)
    expect(withHints).toBe(renderMermaidASCII(src, { colorMode: 'none' }))
  })

  it('draws the dense sample without hints as before', () => {
    registerAsciiLayout(undefined)
    const text = renderMermaidASCII(dense('TD'), { colorMode: 'none' })
    expect(text).toContain('┐')
    expect((text.match(/▼/g) ?? []).length).toBeGreaterThanOrEqual(8)
  })

  it('keeps a lane for a sibling whose hinted route is rejected', () => {
    registerAsciiLayout(asciiLayoutProvider)
    // Decisions and loops crowd the faces so a sibling's ELK route is refused
    // (found by fuzzing): it stays on its lane instead of sharing a centre path,
    // which draws one more arrowhead.
    const src = [
      'flowchart TD',
      'a{d} --> a',
      'b{d} --> a',
      ...Array(2).fill('b --> a'),
      ...Array(4).fill('a --> b'),
      'b{d} --> b',
      'b{d} --> b',
      ...Array(2).fill('b --> b'),
      ...Array(2).fill('b{d} --> a'),
      ...Array(2).fill('b --> a'),
      'b --> a',
    ].join('\n')
    const text = renderMermaidASCII(src, {
      colorMode: 'none',
      layoutHints: true,
    })
    expect((text.match(/[▼▲◄►]/g) ?? []).length).toBe(7)
  })
})
