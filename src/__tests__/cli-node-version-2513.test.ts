import { afterEach, describe, expect, it, vi } from 'vitest'
import { nodeVersionError } from '../cli/node-version.ts'

describe('nodeVersionError', () => {
  it('rejects Node below 24 naming both versions', () => {
    const msg = nodeVersionError('22.22.1')
    expect(msg).toContain('Node 24 or newer')
    expect(msg).toContain('22.22.1')
  })
  it.each(['24.0.0', '25.1.0'])('accepts %s', (v) => {
    expect(nodeVersionError(v)).toBeNull()
  })
})

describe('node-guard', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })
  const run = async (version: string) => {
    const orig = process.versions.node
    Object.defineProperty(process.versions, 'node', {
      value: version,
      configurable: true,
    })
    const exit = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never)
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await import('../cli/node-guard.ts')
    } finally {
      Object.defineProperty(process.versions, 'node', {
        value: orig,
        configurable: true,
      })
    }
    return { exit, err }
  }
  it('exits 1 with a message on old Node', async () => {
    const { exit, err } = await run('20.0.0')
    expect(exit).toHaveBeenCalledWith(1)
    expect(err).toHaveBeenCalledWith(
      expect.stringContaining('Node 24 or newer'),
    )
  })
  it('does nothing on Node 24', async () => {
    const { exit } = await run('24.1.0')
    expect(exit).not.toHaveBeenCalled()
  })
})
