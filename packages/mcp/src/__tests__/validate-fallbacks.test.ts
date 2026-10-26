// #1691: validateHandler fallbacks when the parser throws something that is not
// a "Line N: ..." Error. validateMermaid is replaced with a plain thrower
// (not a vi.fn) so the throw is controlled without mock bookkeeping.
import { describe, it, expect, vi } from 'vitest'

const state = vi.hoisted(() => ({ thrown: undefined as unknown }))
vi.mock('@zombie-mermaid/svg-renderer', () => ({
  validateMermaid: () => {
    throw state.thrown
  },
}))

const { validateHandler } = await import('../tools/validate.ts')

function run() {
  const res = validateHandler({ diagram: 'graph LR\n A-->B' })
  return JSON.parse((res.content[0] as { text: string }).text)
}

describe('validateHandler fallbacks', () => {
  it('uses the plain message when the error has no Line prefix', () => {
    state.thrown = new Error('boom')
    expect(run()).toEqual({
      valid: false,
      diagnostics: [{ message: 'boom', code: 'PARSE_ERROR' }],
    })
  })

  it('passes through an error code, e.g. LIMIT_EXCEEDED', () => {
    state.thrown = Object.assign(new Error('maxNodes exceeded: 401 > 400'), {
      code: 'LIMIT_EXCEEDED',
    })
    expect(run().diagnostics[0].code).toBe('LIMIT_EXCEEDED')
  })

  it('stringifies a non-Error throw', () => {
    state.thrown = 'oops'
    expect(run()).toEqual({
      valid: false,
      diagnostics: [{ message: 'oops', code: 'PARSE_ERROR' }],
    })
  })
})
