// #1691: `validate` CLI command, CLI line diagnostics on failed render, and
// the validate_mermaid MCP tool share one parse-only path.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from '../cli/parse-args.ts'
import { runValidate } from '../cli/validate.ts'
import { withSourceLine } from '../cli/diagnostics.ts'
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

  it('reads the file when an input path is given', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'validate-'))
    const file = join(dir, 'a.mmd')
    writeFileSync(file, GOOD)
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      await runValidate({ command: 'validate', input: file })
      expect(log).toHaveBeenCalledWith('valid')
    } finally {
      rmSync(dir, { recursive: true })
    }
  })

  it('reports parser line numbers against the untrimmed source', async () => {
    await expect(
      runValidate({ command: 'validate', input: undefined }, '\n\n' + BAD),
    ).rejects.toThrow(/Line 6:[\s\S]*\n {2}6 \| {3}loop forever/)
  })

  it('rejects a missing file without leaking an absolute path in a diagnostic', async () => {
    await expect(
      runValidate({ command: 'validate', input: '/nonexistent/zz-1727.mmd' }),
    ).rejects.toThrow(/ENOENT/)
  })

  it('refuses to wait on an interactive terminal', async () => {
    const orig = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY')
    Object.defineProperty(process.stdin, 'isTTY', {
      value: true,
      configurable: true,
    })
    try {
      await expect(
        runValidate({ command: 'validate', input: undefined }),
      ).rejects.toThrow(/stdin is a terminal/)
    } finally {
      if (orig) Object.defineProperty(process.stdin, 'isTTY', orig)
      else delete (process.stdin as { isTTY?: boolean }).isTTY
    }
  })

  it('reads piped stdin when no file or content is given', async () => {
    const orig = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY')
    Object.defineProperty(process.stdin, 'isTTY', {
      value: false,
      configurable: true,
    })
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      const run = runValidate({ command: 'validate', input: undefined })
      process.stdin.emit('data', GOOD)
      process.stdin.emit('end')
      await run
      expect(log).toHaveBeenCalledWith('valid')
    } finally {
      if (orig) Object.defineProperty(process.stdin, 'isTTY', orig)
      else delete (process.stdin as { isTTY?: boolean }).isTTY
    }
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
    await expect(runRender(args, { write: () => true }, BAD)).rejects.toThrow(
      /Line 4:[\s\S]*\n {2}4 \| {3}loop forever/,
    )
  })
})

describe('runRender line numbers', () => {
  it('keeps original line numbers when the source has leading blank lines', async () => {
    const args = parseArgs(['render', '--ascii'])
    if (args.command !== 'render') throw new Error('x')
    await expect(
      runRender(args, { write: () => true }, '\n\n' + BAD),
    ).rejects.toThrow(/Line 6:[\s\S]*\n {2}6 \| {3}loop forever/)
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

  it('returns a normal invalid result for empty source', () => {
    const r = parse('')
    expect(r).toEqual({
      valid: false,
      diagnostics: [
        { message: 'diagram must not be empty', code: 'EMPTY_DIAGRAM' },
      ],
    })
  })

  it('falls back to message-only when no line is named', () => {
    const r = parse('   \n  ')
    expect(r.valid).toBe(false)
    expect(r.diagnostics[0]?.line).toBeUndefined()
    expect(r.diagnostics[0]?.message).toBeTruthy()
  })
})

describe('withSourceLine', () => {
  it('passes a non-Error value through unchanged', () => {
    expect(withSourceLine('nope', GOOD)).toBe('nope')
  })

  it('returns an Error without a "Line N:" prefix unchanged', () => {
    const err = new Error('C4 diagram, line 2: unrecognized statement')
    expect(withSourceLine(err, 'C4Context\n Person(')).toBe(err)
  })
})
