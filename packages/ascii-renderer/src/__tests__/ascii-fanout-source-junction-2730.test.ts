/**
 * A fan-out stem tees into its source box like a lone edge does (#2730).
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../index.ts'

const FAN = 'graph TD\n  P[Processor] --> O[Output]\n  P --> L[Log]'

describe('fan-out stem junction on the source border (#2730)', () => {
  it('draws ┬ on the bottom border where the stem leaves', () => {
    const out = renderMermaidASCII(FAN)
    expect(out).toContain('└─────┬─────┘')
  })

  it('draws + in ASCII mode', () => {
    const out = renderMermaidASCII(FAN, { useAscii: true })
    expect(out).toContain('+-----+-----+')
  })

  it('leaves a diamond source, whose bottom is no straight border, alone', () => {
    const out = renderMermaidASCII('graph TD\n  A{Choose} --> B\n  A --> C')
    expect(out).toContain('╲╱')
    expect(out).not.toContain('┬')
  })
})
