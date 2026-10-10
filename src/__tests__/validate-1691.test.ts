// #1691: `validate` CLI command, CLI line diagnostics on failed render, and
// the validate_mermaid MCP tool share one parse-only path.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { parseArgs } from '../cli/parse-args.ts'
import { runValidate } from '../cli/validate.ts'
import { runRender } from '../cli/render.ts'
import { validateHandler } from '../../packages/mcp/src/tools/validate.ts'

const BAD =
  'sequenceDiagram\n  participant A\n  A->>B: hi\n  loop forever\n  B-->>A: ok'
const GOOD = 'graph LR\n  A --> B'

afterEach(() => vi.restoreAllMocks())

describe('parseArgs validate', () => {
  it('accepts an optional file and rejects flags/extra args', () => {
    expect(parseArgs(['validate', 'a.mmd'])).toEqual({
      command: 'validate',
      input: 'a.mmd',
    })
    expect(parseArgs(['validate'])).toEqual({
      command: 'validate',
      input: undefined,
    })
    expect(() => parseArgs(['validate', '--svg'])).toThrow(
      /Unexpected argument: --svg/,
    )
    expect(() => parseArgs(['validate', 'a', 'b'])).toThrow(
      /Unexpected argument: b/,
    )
  })
})

describe('runValidate', () => {
  it('prints valid for good source', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await runValidate({ command: 'validate', input: undefined }, GOOD)
    expect(log).toHaveBeenCalledWith('valid')
  })

  it('throws the line message plus the source line for bad source', async () => {
    await expect(
      runValidate({ command: 'validate', input: undefined }, BAD),
    ).rejects.toThrow(/Line 4:[\s\S]*\n {2}4 \| {3}loop forever/)
  })

  it('rejects empty input', async () => {
    await expect(
      runValidate({ command: 'validate', input: undefined }, '  \n'),
    ).rejects.toThrow(/Empty input/)
  })
})

describe('runRender failure diagnostics', () => {
  it('appends the offending source line', async () => {
    const args = parseArgs(['render', '--ascii'])
    if (args.command !== 'render') throw new Error('x')
    await expect(
      runRender(args, { write: () => true }, BAD, { write: () => true }),
    ).rejects.toThrow(/Line 4:[\s\S]*\n {2}4 \| {3}loop forever/)
  })
})

describe('validate_mermaid', () => {
  const parse = (d: string) => {
    const c = validateHandler({ diagram: d }).content[0]
    if (c?.type !== 'text') throw new Error('x')
    return JSON.parse(c.text) as {
      valid: boolean
      diagnostics: Array<{
        line?: number
        sourceLine?: string
        message: string
      }>
    }
  }

  it('valid source', () => {
    expect(parse(GOOD)).toEqual({ valid: true, diagnostics: [] })
  })

  it('bad source reports line, sourceLine, no absolute paths', () => {
    const r = parse(BAD)
    expect(r.valid).toBe(false)
    expect(r.diagnostics[0]).toMatchObject({
      line: 4,
      sourceLine: '  loop forever',
    })
    expect(JSON.stringify(r)).not.toMatch(/\/Users\/|node_modules/)
  })

  it('falls back to message-only when no line is named', () => {
    const r = parse('   \n  ')
    expect(r.valid).toBe(false)
    expect(r.diagnostics[0]?.line).toBeUndefined()
    expect(r.diagnostics[0]?.message).toBeTruthy()
  })
})
