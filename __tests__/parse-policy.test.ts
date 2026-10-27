import { describe, expect, it, vi } from 'vitest'
import { parsePolicy } from '../scripts/lib/parse-policy.ts'

const exit = (code: number): never => {
  throw new Error(`exit ${code}`)
}

describe('parsePolicy (#2207)', () => {
  it('defaults to merge-then-grow', () => {
    expect(parsePolicy(['--show'], exit)).toBe('merge-then-grow')
  })

  it('accepts grow-only', () => {
    expect(parsePolicy(['--policy=grow-only'], exit)).toBe('grow-only')
  })

  it.each(['--policy=grow-onli', '--policy='])('rejects %s', (arg) => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => parsePolicy([arg], exit)).toThrow('exit 1')
    expect(err.mock.calls[0]?.[0]).toContain('merge-then-grow, grow-only')
    err.mockRestore()
  })
})
