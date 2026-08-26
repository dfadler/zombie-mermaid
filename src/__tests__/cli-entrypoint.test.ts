import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from 'vitest'
import { THEMES } from '../theme.ts'

// ============================================================================
// Mocks
//
// runRender is exercised in depth by cli-render.test.ts already; here it's
// mocked so this file can focus on cli.ts's own dispatch/exit-code logic
// without re-rendering real diagrams.
// ============================================================================

vi.mock('../cli/render.ts', () => ({
  runRender: vi.fn(),
}))

const ORIGINAL_ARGV = process.argv

// ============================================================================
// main()
//
// cli.ts calls `main()` unconditionally at module load, so the very first
// import (below, with a harmless --help argv) exercises that top-level call
// for free. Every test after that calls the exported `main` directly with
// process.argv set for the scenario under test.
// ============================================================================

describe('cli entrypoint – main()', () => {
  let main: () => Promise<void>
  let runRender: ReturnType<typeof vi.fn>
  let logSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>
  let exitSpy: ReturnType<typeof vi.spyOn>

  beforeAll(async () => {
    process.argv = ['node', 'cli.js', '--help']
    const cli = await import('../cli.ts')
    main = cli.main
    const renderModule = await import('../cli/render.ts')
    runRender = renderModule.runRender as unknown as ReturnType<typeof vi.fn>
  })

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((code?: string | number | null): never => {
        throw new Error(`process.exit(${code})`)
      })
    runRender.mockReset()
  })

  afterEach(() => {
    logSpy.mockRestore()
    errorSpy.mockRestore()
    exitSpy.mockRestore()
    process.argv = ORIGINAL_ARGV
  })

  it('prints usage text for --help', async () => {
    process.argv = ['node', 'cli.js', '--help']
    await main()

    const printed = logSpy.mock.calls
      .map((call: unknown[]) => call[0])
      .join('\n')
    expect(printed).toContain('zombie-mermaid')
    expect(printed).toContain('Usage:')
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('prints usage text for empty args', async () => {
    process.argv = ['node', 'cli.js']
    await main()

    expect(logSpy).toHaveBeenCalled()
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('prints the package version for --version', async () => {
    process.argv = ['node', 'cli.js', '--version']
    await main()

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^zombie-mermaid \d+\.\d+\.\d+/),
    )
  })

  it('lists every theme name for the themes command', async () => {
    process.argv = ['node', 'cli.js', 'themes']
    await main()

    const printed = logSpy.mock.calls
      .map((call: unknown[]) => call[0])
      .join('\n')
    for (const name of Object.keys(THEMES)) {
      expect(printed).toContain(name)
    }
  })

  it('exits with code 1 and reports the error when argv fails to parse', async () => {
    process.argv = ['node', 'cli.js', 'bogus-command']

    await expect(main()).rejects.toThrow('process.exit(1)')

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown command: bogus-command'),
    )
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(runRender).not.toHaveBeenCalled()
  })

  it('delegates to runRender for the render command and exits cleanly on success', async () => {
    runRender.mockResolvedValueOnce(undefined)
    process.argv = ['node', 'cli.js', 'render', 'diagram.mmd', '--ascii']

    await main()

    expect(runRender).toHaveBeenCalledTimes(1)
    expect(runRender.mock.calls[0]?.[0]).toMatchObject({
      command: 'render',
      input: 'diagram.mmd',
      ascii: true,
    })
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('exits with code 1 and reports the error when runRender rejects', async () => {
    runRender.mockRejectedValueOnce(new Error('boom'))
    process.argv = ['node', 'cli.js', 'render', 'diagram.mmd', '--ascii']

    await expect(main()).rejects.toThrow('process.exit(1)')

    expect(errorSpy).toHaveBeenCalledWith('Error: boom')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })
})
