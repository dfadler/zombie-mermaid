// ============================================================================
// Covers cli.ts's `case 'mcp':` dispatch branch (added alongside the `mcp`
// subcommand) — mocks `runMcp` so no real stdio server starts.
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const runMcpMock = vi.fn()

vi.mock('../cli/mcp.ts', () => ({
  runMcp: runMcpMock,
}))

describe('cli.ts – mcp command dispatch', () => {
  let originalArgv: string[]
  let exitSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    originalArgv = process.argv
    runMcpMock.mockReset()
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

  it('calls runMcp on success', async () => {
    runMcpMock.mockResolvedValue(undefined)
    process.argv = ['node', 'zombie-mermaid', 'mcp']
    await import('../cli.ts')
    await vi.waitFor(() => expect(runMcpMock).toHaveBeenCalled())
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('reports the error and exits non-zero when runMcp rejects', async () => {
    runMcpMock.mockRejectedValue(new Error('stdio already in use'))
    process.argv = ['node', 'zombie-mermaid', 'mcp']
    await import('../cli.ts')
    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalled())
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('stdio already in use'),
    )
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('stringifies a non-Error rejection instead of reading a nonexistent .message', async () => {
    runMcpMock.mockRejectedValue('raw string failure')
    process.argv = ['node', 'zombie-mermaid', 'mcp']
    await import('../cli.ts')
    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalled())
    expect(errorSpy).toHaveBeenCalledWith('Error: raw string failure')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })
})
