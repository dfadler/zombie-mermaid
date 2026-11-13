import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../index.ts'

const src = `architecture-beta
  service a(server)[A]
  service b(server)[B]
  service c(server)[C]
  a:R -- L:b
  b:B -- T:c`

describe('architecture direction override (#2912)', () => {
  it.each(['TD', 'BT', 'LR', 'RL'] as const)(
    'ignores direction %s: ports place the services',
    (direction) => {
      expect(renderMermaidSVG(src, { direction })).toBe(renderMermaidSVG(src))
    },
  )
})
