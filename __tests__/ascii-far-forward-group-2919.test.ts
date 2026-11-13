/**
 * #2919: a same-pair group running forward over more than a layer takes ELK's
 * faces too (back groups did since #2902). Faces are measured against ELK's
 * hints; the dense-duplicate sample's `a --> c` pair leaves a's right face.
 */
import { describe, expect, it } from 'vitest'
import { registerAsciiLayout } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidASCII } from '../packages/ascii-renderer/src/index.ts'
import { samples } from '../samples/samples-data.ts'
import { asciiLayoutProvider } from '../src/ascii-layout-provider.ts'
import {
  measureSample,
  redirectDirection,
} from '../scripts/lib/ascii-topology.ts'

const chain = (dir: string, labels: boolean): string =>
  `graph ${dir}\nA --> B\nB --> C\nC --> D\nA -->${labels ? '|one|' : ''} D\nA -->${labels ? '|two|' : ''} D`

describe('forward far same-pair group on ELK faces (#2919)', () => {
  it.each(['TD', 'BT', 'LR', 'RL'] as const)(
    'puts every end on ELK’s face in %s',
    (dir) => {
      registerAsciiLayout(asciiLayoutProvider)
      const { faceOk, faceEnds } = measureSample(chain(dir, false))
      expect(faceOk).toBe(faceEnds)
    },
  )

  it('keeps both labels whole in LR', () => {
    registerAsciiLayout(asciiLayoutProvider)
    const text = renderMermaidASCII(chain('LR', true), {
      colorMode: 'none',
      layoutHints: true,
    })
    expect(text).toContain('one')
    expect(text).toContain('two')
  })

  it('leaves a’s right face for the `a --> c` pair of the dense-duplicate sample', () => {
    registerAsciiLayout(asciiLayoutProvider)
    const s = samples.find((x) => /Dense Duplicate Edges \(LR\)/.test(x.title))!
    const { faceOk, faceEnds } = measureSample(redirectDirection(s.source))
    // 16 of 20 before the `a --> c` pair, 18 with it, all 20 once the `b --> c`
    // neighbour pair takes ELK's faces too (the overflow rule).
    expect(faceEnds).toBe(20)
    expect(faceOk).toBe(20)
  })

  it('draws the same group without hints as before', () => {
    registerAsciiLayout(undefined)
    const text = renderMermaidASCII(chain('LR', true), { colorMode: 'none' })
    expect(text).toContain('one')
  })
})
