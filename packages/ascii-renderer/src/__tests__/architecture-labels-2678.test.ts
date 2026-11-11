/**
 * #2678: mermaid 12.3.0 draws a `?` for an icon it has no art for, and every
 * group title. ASCII shows the `?` as the first label line and keeps a group
 * the ports would have folded into its neighbour (general-94, general-96).
 * The SVG renderer already draws both (`architecture-icon-tiles-2518`).
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const lines = (src: string): string[] =>
  renderMermaidASCII(src, { colorMode: 'none' }).split('\n')

describe('architecture ASCII labels (#2678)', () => {
  it('puts ? above the label of an unknown icon only', () => {
    const out = lines(`architecture-beta
  service a(server)[Known]
  service b(not-a-real-icon)[Unknown Icon]
  service c[No Icon]
  a:R -- L:b
  b:R -- L:c`)
    const row = out.findIndex((l) => l.includes('Unknown Icon'))
    expect(out[row - 1]).toMatch(/[│├┤]\s+\?\s+[│├┤]/)
    expect(out.join('\n').match(/\?/g)).toHaveLength(1)
  })

  it('keeps a group whose box the ports would fold into another group', () => {
    const out = lines(`architecture-beta
  group front(cloud)[Frontend]
  group back(server)[Backend]
  group store(database)[Storage]
  service ui(internet)[UI] in front
  service api(server)[API] in back
  service jobs(server)[Jobs] in back
  service db(database)[Postgres] in store
  ui{group}:R --> L:api{group}
  api:B -- T:db{group}
  jobs:R --> L:db`)
    const text = out.join('\n')
    for (const label of ['Frontend', 'Backend', 'Storage', 'Postgres'])
      expect(text).toContain(label)
    // Backend does not enclose Postgres: Storage sits to its right
    const at = (s: string) => out.find((l) => l.includes(s))!.indexOf(s)
    expect(at('Storage')).toBeGreaterThan(at('Backend'))
    expect(at('Backend')).toBeGreaterThan(at('Frontend'))
  })
})
