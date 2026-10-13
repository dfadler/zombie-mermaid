// Size limits are checked before layout (#1854): an oversized input throws a
// typed LimitExceededError instead of hanging in ELK or running out of memory.
import { describe, it, expect } from 'vitest'
import ELK from 'elkjs/lib/elk.bundled.js'
import {
  registerElk,
  renderMermaidSVG,
  renderMermaidASCII,
  LimitExceededError,
  DEFAULT_RENDER_LIMITS,
} from '../index.ts'
import { renderAsciiHandler } from '../../packages/mcp/src/tools/render-ascii.ts'
import { renderSvgHandler } from '../../packages/mcp/src/tools/render-svg.ts'

registerElk(ELK)

/** Chain of `n` nodes plus `extra` additional edges: n-1+extra edges. */
function chain(n: number, extra = 0): string {
  const lines = ['graph TD']
  for (let i = 1; i < n; i++) lines.push(`  N${i - 1} --> N${i}`)
  for (let i = 0; i < extra; i++) lines.push(`  N0 --> N${(i % (n - 1)) + 1}`)
  return lines.join('\n')
}

function catchErr(fn: () => unknown): unknown {
  try {
    fn()
  } catch (e) {
    return e
  }
  return undefined
}

const small = 'graph LR\n  A --> B'
const renderers = {
  svg: renderMermaidSVG,
  ascii: renderMermaidASCII,
} as const

describe.each(Object.entries(renderers))('%s limits', (_name, render) => {
  it('throws LimitExceededError with a stable code for too many nodes', () => {
    const err = catchErr(() => render(chain(5), { limits: { maxNodes: 4 } }))
    expect(err).toBeInstanceOf(LimitExceededError)
    expect(err).toMatchObject({
      code: 'LIMIT_EXCEEDED',
      limit: 'maxNodes',
      value: 5,
      max: 4,
    })
  })

  it('throws for too many edges', () => {
    const err = catchErr(() => render(chain(3, 3), { limits: { maxEdges: 4 } }))
    expect(err).toMatchObject({ limit: 'maxEdges', value: 5, max: 4 })
  })

  it('throws for too long input before parsing', () => {
    const err = catchErr(() =>
      render('not a diagram '.repeat(10), { limits: { maxInputLength: 20 } }),
    )
    expect(err).toMatchObject({ limit: 'maxInputLength' })
  })

  it('allows exactly the limit and lets Infinity disable one', () => {
    expect(() => render(chain(4), { limits: { maxNodes: 4 } })).not.toThrow()
    expect(() =>
      render(chain(5), { limits: { maxNodes: Infinity } }),
    ).not.toThrow()
  })

  it('applies default limits', () => {
    const err = catchErr(() =>
      render(chain(DEFAULT_RENDER_LIMITS.maxNodes + 1)),
    )
    expect(err).toMatchObject({ code: 'LIMIT_EXCEEDED', limit: 'maxNodes' })
  })

  it('does not reject a small diagram under default limits', () => {
    expect(() => render(small)).not.toThrow()
  })
})

describe('ascii canvas cap', () => {
  it('throws once the laid-out grid exceeds maxCanvasCells', () => {
    const err = catchErr(() =>
      renderMermaidASCII(chain(6), { limits: { maxCanvasCells: 50 } }),
    )
    expect(err).toMatchObject({
      code: 'LIMIT_EXCEEDED',
      limit: 'maxCanvasCells',
    })
    expect(() =>
      renderMermaidASCII(chain(6), { limits: { maxCanvasCells: 1e6 } }),
    ).not.toThrow()
  })
})

describe('MCP tools use tighter limits and report the error', () => {
  const big = chain(151)
  it.each([
    ['svg', () => renderSvgHandler({ diagram: big })],
    ['ascii', () => renderAsciiHandler({ diagram: big })],
  ] as const)('%s', (_n, run) => {
    const res = run()
    expect(res.isError).toBe(true)
    expect(JSON.stringify(res.content)).toContain(
      'maxNodes exceeded: 151 > 150',
    )
  })
})
