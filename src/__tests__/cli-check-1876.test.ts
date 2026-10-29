import { describe, it, expect, vi, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { extractMermaidBlocks, runCheck } from '../cli/check.ts'
import { parseArgs } from '../cli/parse-args.ts'

const md = (...l: string[]) => l.join('\n')

describe('extractMermaidBlocks', () => {
  it('finds backtick and tilde fences with 1-based start lines, skips other langs', () => {
    const blocks = extractMermaidBlocks(
      md(
        '# t',
        '```mermaid',
        'graph TD',
        'A-->B',
        '```',
        '```js',
        'x',
        '```',
        '~~~~mermaid',
        'graph LR',
        '~~~~',
      ),
    )
    expect(blocks).toEqual([
      { startLine: 3, source: 'graph TD\nA-->B' },
      { startLine: 10, source: 'graph LR' },
    ])
  })
})

describe('parseArgs --check', () => {
  it('collects files and rejects empty / flags', () => {
    expect(parseArgs(['--check', 'a.md', 'b.md'])).toEqual({
      command: 'check',
      files: ['a.md', 'b.md'],
    })
    expect(() => parseArgs(['--check'])).toThrow(/at least one/)
    expect(() => parseArgs(['--check', '-x'])).toThrow(/Unknown flag/)
  })
})

describe('runCheck', () => {
  afterEach(() => vi.restoreAllMocks())
  const write = (text: string) => {
    const f = join(mkdtempSync(join(tmpdir(), 'chk-')), 'a.md')
    writeFileSync(f, text)
    return f
  }

  it('passes valid blocks', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await runCheck({
      command: 'check',
      files: [write(md('```mermaid', 'graph TD', 'A-->B', '```'))],
    })
    expect(log).toHaveBeenCalledWith('1 Mermaid block(s) valid')
  })

  it('reports the markdown-file line of the bad diagram line and throws', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const f = write(
      md(
        'intro',
        '',
        '```mermaid',
        'sequenceDiagram',
        '  participant A',
        '  A->>B: hi',
        '  loop forever',
        '  B-->>A: ok',
        '```',
      ),
    )
    await expect(runCheck({ command: 'check', files: [f] })).rejects.toThrow(
      '1 of 1',
    )
    const out = err.mock.calls.map((c) => String(c[0])).join('\n')
    expect(out).toContain(`${f}:7: `)
  })
})
