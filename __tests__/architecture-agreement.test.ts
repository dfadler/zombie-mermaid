import { describe, expect, it } from 'vitest'
import {
  ARCH_FLOOR,
  architectureAgreement,
  architectureBreaches,
  measureOurArchitecture,
  parseOfficialArchitecture,
  summarizeArchitecture,
  worstArch,
} from '../scripts/lib/architecture-agreement.ts'
import {
  scorecardMarkdown,
  summarize,
  type SampleResult,
} from '../scripts/lib/layout-agreement.ts'

// Trimmed from mermaid 12.2.0's render of the source below (render id `r`).
const OFFICIAL = `<svg><g class="architecture-services">
<g id="r-service-a" class="architecture-service" transform="translate(0,0)"></g>
<g id="r-service-b" class="architecture-service" transform="translate(200.5,0)"></g>
</g><g class="architecture-junction" transform="translate(100,200)"><g><rect id="r-node-j" fill-opacity="0" width="80" height="80"></rect></g></g>
<g class="architecture-groups"><rect id="r-group-g" x="-10" y="-10" width="320" height="100" class="node-bkg"></rect></g></svg>`

const SRC = `architecture-beta
  group g(cloud)[G]
  service a(server)[A] in g
  service b(server)[B] in g
  junction j
  a:R -- L:b
  b:B -- T:j`

describe('architecture agreement (#2451)', () => {
  it('reads services, junctions and groups from official mermaid', () => {
    const o = parseOfficialArchitecture(OFFICIAL, 'r')
    expect(o.nodes).toEqual({
      a: { x: 0, y: 0, w: 80, h: 80 },
      b: { x: 200.5, y: 0, w: 80, h: 80 },
      j: { x: 100, y: 200, w: 80, h: 80 },
    })
    expect(o.groups).toEqual({ g: { x: -10, y: -10, w: 320, h: 100 } })
    expect(parseOfficialArchitecture(OFFICIAL, 'other').nodes).toEqual({})
  })

  it('measures our own services, junctions and groups by id', () => {
    const ours = measureOurArchitecture(SRC)
    expect(Object.keys(ours.nodes).sort()).toEqual(['a', 'b', 'j'])
    expect(Object.keys(ours.groups)).toEqual(['g'])
    expect(ours.nodes.a!.w).toBeGreaterThan(0)
  })

  it('agrees with itself and sees a service moved to the other side', () => {
    const o = parseOfficialArchitecture(OFFICIAL, 'r')
    expect(architectureAgreement(o, o)).toMatchObject({
      vertical: 1,
      horizontal: 1,
      containment: 1,
      nodes: 3,
    })
    const swapped = {
      ...o,
      nodes: { ...o.nodes, a: o.nodes.b!, b: o.nodes.a! },
    }
    expect(architectureAgreement(o, swapped).horizontal).toBeLessThan(1)
  })

  it('counts a service pulled out of its group as a containment disagreement', () => {
    const o = parseOfficialArchitecture(OFFICIAL, 'r')
    const out = {
      ...o,
      nodes: { ...o.nodes, a: { x: 900, y: 900, w: 80, h: 80 } },
    }
    expect(architectureAgreement(o, out).containment).toBeLessThan(1)
  })

  it('treats two centres within half an icon as level', () => {
    const o = parseOfficialArchitecture(OFFICIAL, 'r')
    const nudged = {
      ...o,
      nodes: { ...o.nodes, b: { ...o.nodes.b!, y: 30 } },
    }
    expect(architectureAgreement(o, nudged).vertical).toBe(1)
    const moved = { ...o, nodes: { ...o.nodes, b: { ...o.nodes.b!, y: 60 } } }
    expect(architectureAgreement(o, moved).vertical).toBeLessThan(1)
  })

  it('has no figure with nothing to compare', () => {
    const empty = { nodes: {}, groups: {} }
    const a = architectureAgreement(empty, empty)
    expect(a).toMatchObject({ vertical: null, horizontal: null })
    expect(worstArch(a)).toBeNull()
  })

  it('gates samples on the floor and on errors', () => {
    const ok = { vertical: 1, horizontal: 1, containment: null, nodes: 2 }
    const bad = { ...ok, vertical: ARCH_FLOOR - 0.1 }
    expect(architectureBreaches({ ok })).toEqual([])
    expect(architectureBreaches({ ok, bad }, ['boom'])).toEqual([
      'boom (error)',
      `bad (${Math.round((ARCH_FLOOR - 0.1) * 100)}% < ${ARCH_FLOOR * 100}%)`,
    ])
  })

  it('shows the architecture section in the scorecard only with entries', () => {
    const a = { vertical: 0.5, horizontal: 1, containment: null, nodes: 2 }
    const entry = summarizeArchitecture(
      { a },
      { date: '2026-10-30', commit: 'abcdef0123', mermaid: '12.2.0' },
    )
    expect(entry).toMatchObject({
      kind: 'architecture',
      samples: 1,
      vertical: 0.5,
      containment: null,
    })
    const results: Record<string, SampleResult> = {}
    const run = {
      results,
      entry: summarize(results, {
        date: 'd',
        commit: 'c',
        tolerance: 20,
        type: 'flowchart',
        mermaid: '12.2.0',
      }),
    }
    const md = scorecardMarkdown(
      [run],
      [run.entry],
      undefined,
      [],
      [],
      [],
      [],
      [entry],
    )
    expect(md).toContain('## Architecture diagrams (placement)')
    expect(md).toContain(
      '| 2026-10-30 | abcdef0 | 12.2.0 | 1 | 50% | 100% | - |',
    )
    expect(scorecardMarkdown([run], [run.entry])).not.toContain(
      'Architecture diagrams',
    )
  })
})
