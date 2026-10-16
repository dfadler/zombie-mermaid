import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { layoutFlowchart, UnsupportedFlowchartError } from '../src/index.ts'

// No Chromium here: expected JSON is committed. Its agreement with real mermaid is checked by
// `pnpm run elk-layout:oracle`. Regenerate after an intentional change with
// `UPDATE_ELK_LAYOUT=1 pnpm exec vitest run -c config/vitest.config.ts packages/elk-layout`
// and re-run the oracle before committing.
const FIXTURES = new URL('./fixtures/', import.meta.url)
const round = (v: number) => Math.round(v * 1000) / 1000
const normalise = (l: Awaited<ReturnType<typeof layoutFlowchart>>) => ({
  dir: l.dir,
  nodes: l.nodes.map((n) => ({
    ...n,
    x: round(n.x),
    y: round(n.y),
    w: round(n.w),
    h: round(n.h),
  })),
  edges: l.edges.map((e) => ({
    ...e,
    pts: e.pts.map(([x, y]) => [round(x), round(y)]),
  })),
})

describe('elk-layout', () => {
  it('resolves its own exact elkjs 0.9.3 (the root also carries a newer elkjs)', () => {
    const v = createRequire(import.meta.url)('elkjs-0.9.3/package.json') as {
      version: string
    }
    expect(v.version).toBe('0.9.3')
  })

  const sources = readdirSync(FIXTURES).filter((f) => f.endsWith('.mmd'))
  it('has fixtures', () => expect(sources.length).toBeGreaterThanOrEqual(9))
  it.each(sources)('%s matches the committed layout', async (file) => {
    const actual = normalise(
      await layoutFlowchart(readFileSync(new URL(file, FIXTURES), 'utf8')),
    )
    const expectedUrl = new URL(
      file.replace(/\.mmd$/, '.expected.json'),
      FIXTURES,
    )
    if (process.env.UPDATE_ELK_LAYOUT)
      writeFileSync(expectedUrl, JSON.stringify(actual, null, 1) + '\n')
    expect(actual).toEqual(JSON.parse(readFileSync(expectedUrl, 'utf8')))
  })

  it('lays out the shape of a self-loop and a reciprocal pair', async () => {
    const l = await layoutFlowchart(
      'flowchart TD\n  A --> A\n  A --> B\n  B --> A',
    )
    const byId = Object.fromEntries(l.edges.map((e) => [e.id, e]))
    expect(Object.keys(byId)).toEqual(['L_A_A_0', 'L_A_B_0', 'L_B_A_0'])
    for (const e of l.edges) expect(e.pts.length).toBeGreaterThanOrEqual(2)
  })

  it.each([
    ['subgraphs', 'flowchart TD\n  subgraph S\n    A --> B\n  end'],
    ['shape "trapezoid"', 'flowchart TD\n  A[/Trap\\]'],
    ['shape "asymmetric"', 'flowchart TD\n  A>Flag]'],
  ])(
    'signals %s as unsupported so callers can fall back',
    async (reason, src) => {
      const err = await layoutFlowchart(src).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(UnsupportedFlowchartError)
      expect((err as UnsupportedFlowchartError).reasons.join(' ')).toContain(
        reason,
      )
    },
  )
})
