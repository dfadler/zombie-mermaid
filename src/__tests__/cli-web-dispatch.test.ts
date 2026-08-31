// ============================================================================
// Covers cli.ts's `case 'web':` dispatch branch (added alongside the `web`
// subcommand) — mocks `runWeb` so no real server starts.
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const runWebMock = vi.fn()

vi.mock('../cli/web.ts', () => ({
  runWeb: runWebMock,
}))

describe('cli.ts – web command dispatch', () => {
  let originalArgv: string[]
  let exitSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    originalArgv = process.argv
    runWebMock.mockReset()
    // Non-throwing: cli.ts calls main() as a top-level, un-awaited side
    // effect of importing the module (see the bottom of cli.ts), so a
    // throwing mock here would surface as an unhandled rejection rather
    // than a test failure we control.
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never)
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    process.argv = originalArgv
    exitSpy.mockRestore()
    errorSpy.mockRestore()
    // cli.ts runs main() at import time; re-importing a cached module
    // wouldn't re-run it, so force a fresh evaluation per test.
    vi.resetModules()
  })

  it('calls runWeb with the parsed args on success', async () => {
    runWebMock.mockResolvedValue(undefined)
    process.argv = ['node', 'zombie-mermaid', 'web', '--port', '4321']
    await import('../cli.ts')
    await vi.waitFor(() => expect(runWebMock).toHaveBeenCalled())
    expect(runWebMock).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'web', port: 4321 }),
    )
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('reports the error and exits non-zero when runWeb rejects', async () => {
    runWebMock.mockRejectedValue(new Error('port in use'))
    process.argv = ['node', 'zombie-mermaid', 'web']
    await import('../cli.ts')
    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalled())
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('port in use'),
    )
    expect(exitSpy).toHaveBeenCalledWith(1)
  })
})
