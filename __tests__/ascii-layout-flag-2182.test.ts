import { describe, expect, it } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidASCIIWithLayout } from '../src/ascii-layout.ts'
import { parseArgs } from '../src/cli/parse-args.ts'
import type { RenderArgs } from '../src/cli/parse-args.ts'
import { runRender } from '../src/cli/render.ts'

const FLAT = 'graph TD\n  A[Start] --> B{Ok?}\n  B -->|yes| C[Done]\n'
const SUBGRAPH = 'graph TD\n  subgraph S\n    A --> B\n  end\n'
const SHAPE = 'graph LR\n  A[x] --> B[/y/]\n'
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
})
