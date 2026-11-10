import { describe, expect, it, vi } from 'vitest'
import { parsePolicy } from '../scripts/lib/parse-policy.ts'

const exit = (code: number): never => {
  throw new Error(`exit ${code}`)
}

describe('parsePolicy (#2207)', () => {
  it('defaults to grow-only (the rasterizer default)', () => {
    expect(parsePolicy(['--show'], exit)).toBe('grow-only')
  })

  it('accepts merge-then-grow', () => {
    expect(parsePolicy(['--policy=merge-then-grow'], exit)).toBe(
      'merge-then-grow',
    )
  })

  it.each(['--policy=grow-onli', '--policy='])('rejects %s', (arg) => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => parsePolicy([arg], exit)).toThrow('exit 1')
    expect(err.mock.calls[0]?.[0]).toContain('merge-then-grow, grow-only')
    err.mockRestore()
  })
})
