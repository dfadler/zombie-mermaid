// Covers cli.ts's `case 'check':` dispatch branch (#1876) — mocks `runCheck`.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const runCheckMock = vi.fn()

vi.mock('../cli/check.ts', () => ({
  runCheck: runCheckMock,
}))

describe('cli.ts – check command dispatch', () => {
  let originalArgv: string[]
  let exitSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    originalArgv = process.argv
    runCheckMock.mockReset()
    // Non-throwing: cli.ts runs main() un-awaited at import time.
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never)
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    process.argv = originalArgv
    exitSpy.mockRestore()
    errorSpy.mockRestore()
    vi.resetModules()
  })

  it('calls runCheck with the parsed files on success', async () => {
    runCheckMock.mockResolvedValue(undefined)
    process.argv = ['node', 'zombie-mermaid', '--check', 'a.md', 'b.md']
    await import('../cli.ts')
    await vi.waitFor(() => expect(runCheckMock).toHaveBeenCalled())
    expect(runCheckMock).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'check', files: ['a.md', 'b.md'] }),
    )
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('reports the error and exits 1 when runCheck rejects', async () => {
    runCheckMock.mockRejectedValue(new Error('1 of 2 Mermaid block(s) invalid'))
    process.argv = ['node', 'zombie-mermaid', '--check', 'a.md']
    await import('../cli.ts')
    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalled())
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('invalid'))
    expect(exitSpy).toHaveBeenCalledWith(1)
  })
})
