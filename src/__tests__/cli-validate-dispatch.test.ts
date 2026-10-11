// Covers cli.ts's `case 'validate':` dispatch branch (#1691) — mocks
// `runValidate` so no file/stdin is read.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const runValidateMock = vi.fn()

vi.mock('../cli/validate.ts', () => ({ runValidate: runValidateMock }))

describe('cli.ts – validate command dispatch', () => {
  let originalArgv: string[]
  let exitSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    originalArgv = process.argv
    runValidateMock.mockReset()
    // Non-throwing: main() runs un-awaited at import time (see cli.ts).
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

  it('calls runValidate with the parsed args on success', async () => {
    runValidateMock.mockResolvedValue(undefined)
    process.argv = ['node', 'zombie-mermaid', 'validate', 'a.mmd']
    await import('../cli.ts')
    await vi.waitFor(() => expect(runValidateMock).toHaveBeenCalled())
    expect(runValidateMock).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'validate', input: 'a.mmd' }),
    )
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('reports the error and exits 1 when runValidate rejects', async () => {
    runValidateMock.mockRejectedValue(new Error('Line 4: bad'))
    process.argv = ['node', 'zombie-mermaid', 'validate']
    await import('../cli.ts')
    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledWith(1))
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Line 4: bad'),
    )
  })

  it('stringifies a non-Error rejection', async () => {
    runValidateMock.mockRejectedValue('plain string')
    process.argv = ['node', 'zombie-mermaid', 'validate']
    await import('../cli.ts')
    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledWith(1))
    expect(errorSpy).toHaveBeenCalledWith('Error: plain string')
  })
})
