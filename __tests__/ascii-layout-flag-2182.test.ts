import { describe, expect, it, vi } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidASCIIWithLayout } from '../src/ascii-layout.ts'
import { parseArgs } from '../src/cli/parse-args.ts'
import type { RenderArgs } from '../src/cli/parse-args.ts'
import { runRender } from '../src/cli/render.ts'

const FLAT = 'graph TD\n  A[Start] --> B{Ok?}\n  B -->|yes| C[Done]\n'
const SUBGRAPH = 'graph TD\n  subgraph S\n    A --> B\n  end\n'
const SHAPE = 'graph LR\n  A[x] --> B[/y/]\n'
// Boxes alone are wider than 120 columns, so the cap cannot be met.
const WIDE =
  'graph LR\n  A[Alpha service gateway node] --> B[Bravo processing pipeline stage] --> C[Charlie storage backend cluster] --> D[Delta notification dispatcher worker] --> E[Echo audit trail sink]\n'
const SEQUENCE = 'sequenceDiagram\n  A->>B: hi\n'

const sink = () => {
  const chunks: string[] = []
  return {
    write: (s: string | Uint8Array) => void chunks.push(String(s)),
    chunks,
  }
}

async function cli(src: string, ...flags: string[]) {
  const args = parseArgs(['render', '--ascii', ...flags]) as RenderArgs
  const out = sink()
  const err = sink()
  await runRender(args, out, src, err)
  return { out: out.chunks.join(''), err: err.chunks.join('') }
}

describe('layout-faithful ASCII opt-in (#2182)', () => {
  it('default output is byte-identical to the standard renderer', async () => {
    const r = await renderMermaidASCIIWithLayout(FLAT)
    expect(r).toEqual({
      text: renderMermaidASCII(FLAT),
      path: 'standard',
    })
    const { out, err } = await cli(FLAT)
    expect(out).toBe(renderMermaidASCII(FLAT, { colorMode: 'none' }) + '\n')
    expect(err).toBe('')
  })

  it('draws a flat flowchart from the ELK layout when asked', async () => {
    const r = await renderMermaidASCIIWithLayout(FLAT, { layout: 'mermaid' })
    expect(r.path).toBe('layout-faithful')
    expect(r.fallbackReason).toBeUndefined()
    expect(r.text).not.toBe(renderMermaidASCII(FLAT))
    expect(r.text).toContain('Start')
  })

  it.each([
    ['subgraph', SUBGRAPH, /unsupported \(.*subgraph/i],
    ['unsupported shape', SHAPE, /unsupported \(/],
    ['non-flowchart', SEQUENCE, /not applicable to sequence diagrams/],
  ])('falls back with a reason: %s', async (_n, src, reason) => {
    const r = await renderMermaidASCIIWithLayout(src, { layout: 'mermaid' })
    expect(r.path).toBe('standard')
    expect(r.fallbackReason).toMatch(reason)
    expect(r.text).toBe(renderMermaidASCII(src))
  })

  it('CLI --layout mermaid reports the path on stderr, never silently', async () => {
    const ok = await cli(FLAT, '--layout', 'mermaid')
    expect(ok.err).toMatch(/^layout-faithful: used mermaid's ELK layout/)
    expect(ok.err).toContain('elkjs 0.9.3')
    expect(ok.out).not.toBe(
      renderMermaidASCII(FLAT, { colorMode: 'none' }) + '\n',
    )

    const sub = await cli(SUBGRAPH, '--layout=mermaid')
    expect(sub.err).toMatch(
      /^layout-faithful: unsupported \(.*\); used standard renderer\n$/,
    )
    expect(sub.out).toBe(
      renderMermaidASCII(SUBGRAPH, { colorMode: 'none' }) + '\n',
    )

    const seq = await cli(SEQUENCE, '--layout', 'mermaid')
    expect(seq.err).toMatch(
      /not applicable to sequence diagrams.*used standard/,
    )
  })

  it('validates the flag', () => {
    expect(() => parseArgs(['render', '--ascii', '--layout', 'dagre'])).toThrow(
      /--layout requires one of: mermaid/,
    )
    expect(() =>
      parseArgs(['render', '--svg', '-o', 'x.svg', '--layout', 'mermaid']),
    ).toThrow(/--layout requires --ascii/)
  })

  it('loads the layout packages lazily', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(
      new URL('../src/ascii-layout.ts', import.meta.url),
      'utf8',
    )
    expect(src).not.toMatch(/^import .*(elk-layout|ascii-layout)/m)
    expect(src).toMatch(/import\('@zombie-mermaid\/elk-layout'\)/)
  })

  it('falls back when the drawing cannot fit the width cap, unless opted out', async () => {
    const r = await renderMermaidASCIIWithLayout(WIDE, { layout: 'mermaid' })
    expect(r.path).toBe('standard')
    expect(r.fallbackReason).toMatch(
      /^layout-faithful output is \d+ columns, over the 120-column cap$/,
    )
    expect(r.text).toBe(renderMermaidASCII(WIDE))

    const wide = await renderMermaidASCIIWithLayout(WIDE, {
      layout: 'mermaid',
      maxCols: Infinity,
    })
    expect(wide.path).toBe('layout-faithful')
    expect(
      Math.max(...wide.text.split('\n').map((l) => l.length)),
    ).toBeGreaterThan(120)

    // an explicit smaller cap that a compressible diagram cannot meet also falls back
    const tight = await renderMermaidASCIIWithLayout(FLAT, {
      layout: 'mermaid',
      maxCols: 5,
    })
    expect(tight.fallbackReason).toMatch(/over the 5-column cap/)
  })

  it('a diagram that fits the cap does not fall back', async () => {
    const r = await renderMermaidASCIIWithLayout(FLAT, { layout: 'mermaid' })
    expect(r.path).toBe('layout-faithful')
  })

  it('CLI: wide diagram falls back with one stderr line; mermaid-wide and -w control the cap', async () => {
    const fb = await cli(WIDE, '--layout', 'mermaid')
    expect(fb.err).toMatch(
      /^layout-faithful: layout-faithful output is \d+ columns, over the 120-column cap; used standard renderer\n$/,
    )
    expect(fb.out).toBe(renderMermaidASCII(WIDE, { colorMode: 'none' }) + '\n')

    const wide = await cli(WIDE, '--layout', 'mermaid-wide')
    expect(wide.err).toMatch(/^layout-faithful: used mermaid's ELK layout/)
    expect(wide.out).not.toBe(fb.out)

    const capped = await cli(WIDE, '--layout', 'mermaid', '-w', '400')
    expect(capped.err).toMatch(/^layout-faithful: used mermaid's ELK layout/)
  })

  it('falls back with a reason when the layout packages cannot be imported', async () => {
    vi.resetModules()
    vi.doMock('@zombie-mermaid/elk-layout', () => {
      throw new Error('Cannot find package elkjs-0.9.3')
    })
    try {
      const { renderMermaidASCIIWithLayout: fresh } =
        await import('../src/ascii-layout.ts')
      const r = await fresh(FLAT, { layout: 'mermaid' })
      expect(r.path).toBe('standard')
      expect(r.fallbackReason).toMatch(/elkjs 0\.9\.3 is not installed/)
      expect(r.text).toBe(renderMermaidASCII(FLAT))
    } finally {
      vi.doUnmock('@zombie-mermaid/elk-layout')
      vi.resetModules()
    }
  })

  it.each([
    ['an Error', new Error('elk blew up'), 'layout failed (elk blew up)'],
    ['a non-Error', 'plain string', 'layout failed (plain string)'],
  ])(
    'falls back with a reason when the layout throws %s',
    async (_n, thrown, reason) => {
      vi.resetModules()
      vi.doMock('@zombie-mermaid/ascii-layout', async (orig) => ({
        ...(await orig<object>()),
        renderFlowchartAscii: () => Promise.reject(thrown),
      }))
      try {
        const { renderMermaidASCIIWithLayout: fresh } =
          await import('../src/ascii-layout.ts')
        const r = await fresh(FLAT, { layout: 'mermaid' })
        expect(r.path).toBe('standard')
        expect(r.fallbackReason).toBe(reason)
        expect(r.text).toBe(renderMermaidASCII(FLAT))
      } finally {
        vi.doUnmock('@zombie-mermaid/ascii-layout')
        vi.resetModules()
      }
    },
  )

  it('--layout without a value is rejected with an empty "got"', () => {
    expect(() => parseArgs(['render', '--ascii', '--layout'])).toThrow(
      /got: ""/,
    )
  })

  it('CLI: -w auto is accepted as the layout cap', async () => {
    const r = await cli(FLAT, '--layout', 'mermaid', '-w', 'auto')
    expect(r.err).toMatch(/^layout-faithful: /)
  })

  it.each([
    [
      'layout-faithful without a note',
      { text: 'X', path: 'layout-faithful' },
      "layout-faithful: used mermaid's ELK layout (mermaid 12.1.0 + elkjs 0.9.3).\n",
    ],
    [
      'standard without a reason',
      { text: 'X', path: 'standard' },
      'layout-faithful: unavailable; used standard renderer\n',
    ],
  ])(
    'CLI stderr line is well-formed when the result has %s',
    async (_n, result, line) => {
      vi.resetModules()
      vi.doMock('../src/ascii-layout.ts', () => ({
        renderMermaidASCIIWithLayout: () => Promise.resolve(result),
      }))
      try {
        const { runRender: fresh } = await import('../src/cli/render.ts')
        const args = parseArgs([
          'render',
          '--ascii',
          '--layout',
          'mermaid',
        ]) as RenderArgs
        const out = sink()
        const err = sink()
        await fresh(args, out, FLAT, err)
        expect(err.chunks.join('')).toBe(line)
        expect(out.chunks.join('')).toBe('X\n')
      } finally {
        vi.doUnmock('../src/ascii-layout.ts')
        vi.resetModules()
      }
    },
  )
})
