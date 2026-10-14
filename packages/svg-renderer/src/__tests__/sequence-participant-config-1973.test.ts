/**
 * #1973: `participant X@{ "type": ... }` is accepted and drawn as a plain
 * participant (the type's icon is not drawn yet), in both renderers.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII, renderMermaidSVG } from '../../../../src/index.ts'

const configured = `sequenceDiagram
  participant U@{ "type": "boundary" } as User
  participant DB@{ "type": "database" }
  actor Q@{ type: queue }
  U->>DB: query
  DB-->>Q: notify`
const plain = `sequenceDiagram
  participant U as User
  participant DB
  actor Q
  U->>DB: query
  DB-->>Q: notify`

describe('participant @{ type } rendering', () => {
  it('SVG is identical to the plain participants', () => {
    const svg = renderMermaidSVG(configured)
    expect(svg).toContain('User')
    expect(svg).toBe(renderMermaidSVG(plain))
  })

  it('ASCII is identical to the plain participants', () => {
    expect(renderMermaidASCII(configured)).toBe(renderMermaidASCII(plain))
  })
})
