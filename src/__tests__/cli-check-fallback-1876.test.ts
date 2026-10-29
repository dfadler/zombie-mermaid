// runCheck's no-diagnostic fallbacks (#1876): the message comes from the Error
// itself, or String(e) for a non-Error throw, and the line is the block start.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const validateMock = vi.fn()

vi.mock('@zombie-mermaid/svg-renderer', () => ({
  validateMermaid: validateMock,
}))
vi.mock('../../packages/mcp/src/tools/parse-diagnostics.ts', () => ({
  extractParseDiagnostic: () => null,
}))

const { runCheck } = await import('../cli/check.ts')

describe('runCheck without a parse diagnostic', () => {
  afterEach(() => vi.restoreAllMocks())

  it.each([
    [new Error('boom'), 'boom'],
    ['plain string', 'plain string'],
  ])('reports %s at the block start line', async (thrown, message) => {
    validateMock.mockImplementation(() => {
      throw thrown
    })
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const f = join(mkdtempSync(join(tmpdir(), 'chk-')), 'a.md')
    writeFileSync(f, '# t\n```mermaid\nwhatever\n```\n')
    await expect(runCheck({ command: 'check', files: [f] })).rejects.toThrow(
      '1 of 1',
    )
    expect(err).toHaveBeenCalledTimes(1)
    expect(err).toHaveBeenCalledWith(`${f}:3: ${message}`)
  })
})
