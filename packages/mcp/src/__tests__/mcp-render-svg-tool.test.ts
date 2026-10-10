// ============================================================================
// Unit coverage for the render_mermaid_svg tool's bg/fg overrides and
// outputPath file writing (path-safety model documented on writeSvgFile).
// Uses a real temp dir as process.cwd() — no mocks of fs.
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  symlinkSync,
  realpathSync,
  rmSync,
  existsSync,
} from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import {
  renderSvgHandler,
  renderSvgInputShape,
  writeAll,
} from '../tools/render-svg.ts'

const DIAGRAM = 'graph LR\n  A --> B'

function text(result: ReturnType<typeof renderSvgHandler>): string {
  const first = result.content[0]
  if (first?.type !== 'text') throw new Error('Expected text content')
  return first.text
}

let dir: string
let outside: string

beforeEach(() => {
  // `dir` lives in a private container so `../` escapes land in a directory
  // only this test owns, not the shared tmpdir.
  const container = realpathSync(mkdtempSync(join(tmpdir(), 'zm-mcp-')))
  dir = join(container, 'work')
  mkdirSync(dir)
  outside = join(container, 'outside')
  mkdirSync(outside)
  vi.spyOn(process, 'cwd').mockReturnValue(dir)
})

afterEach(() => {
  vi.restoreAllMocks()
  rmSync(dirname(dir), { recursive: true, force: true })
})

describe('bg / fg overrides', () => {
  it('applies bg and fg on top of the theme', () => {
    const svg = text(
      renderSvgHandler({
        diagram: DIAGRAM,
        theme: 'tokyo-night',
        bg: '#123456',
        fg: '#abcdef',
      }),
    )
    expect(svg).toContain('--bg:#123456')
    expect(svg).toContain('--fg:#abcdef')
  })

  it('leaves the theme colors alone when no override is given', () => {
    const svg = text(renderSvgHandler({ diagram: DIAGRAM, theme: 'nord' }))
    expect(svg).not.toContain('--bg:#123456')
    expect(svg).toContain('--bg:')
  })

  it('validates hex format in the input schema', () => {
    const schema = z.object(renderSvgInputShape)
    expect(schema.safeParse({ diagram: 'x', bg: '#fff' }).success).toBe(true)
    expect(schema.safeParse({ diagram: 'x', fg: '#A1B2C3' }).success).toBe(true)
    for (const bad of ['red', '#ggg', '123456', '#12345', 'url(x)']) {
      expect(schema.safeParse({ diagram: 'x', bg: bad }).success).toBe(false)
      expect(schema.safeParse({ diagram: 'x', fg: bad }).success).toBe(false)
    }
  })
})

describe('outputPath', () => {
  it('writes the SVG and returns { saved, size } instead of the SVG', () => {
    const result = renderSvgHandler({ diagram: DIAGRAM, outputPath: 'out.svg' })
    expect(result.isError).toBeFalsy()
    const report = JSON.parse(text(result)) as { saved: string; size: number }
    expect(report.saved).toBe(join(dir, 'out.svg'))
    const written = readFileSync(report.saved, 'utf8')
    expect(written).toContain('<svg')
    expect(report.size).toBe(Buffer.byteLength(written))
    expect(text(result)).not.toContain('<svg')
  })

  it('overwrites an existing regular .svg file, truncating old content', () => {
    writeFileSync(join(dir, 'a.svg'), 'x'.repeat(100000))
    const result = renderSvgHandler({ diagram: DIAGRAM, outputPath: 'a.svg' })
    expect(result.isError).toBeFalsy()
    const written = readFileSync(join(dir, 'a.svg'), 'utf8')
    expect(written.startsWith('<svg')).toBe(true)
    expect(written).not.toContain('xxxx')
  })

  it('accepts an absolute path inside the working directory', () => {
    const result = renderSvgHandler({
      diagram: DIAGRAM,
      outputPath: join(dir, 'abs.svg'),
    })
    expect(result.isError).toBeFalsy()
    expect(existsSync(join(dir, 'abs.svg'))).toBe(true)
  })

  it.each([
    ['a non-.svg extension', 'out.png'],
    ['no extension', 'out'],
    ['.. traversal', '../escape.svg'],
    ['a missing parent directory', 'nope/out.svg'],
  ])('refuses %s', (_label, outputPath) => {
    const result = renderSvgHandler({ diagram: DIAGRAM, outputPath })
    expect(result.isError).toBe(true)
    expect(existsSync(join(dir, '..', 'escape.svg'))).toBe(false)
    expect(existsSync(join(dir, 'out.png'))).toBe(false)
    expect(existsSync(join(dir, 'out'))).toBe(false)
  })

  it('refuses an absolute path elsewhere', () => {
    const result = renderSvgHandler({
      diagram: DIAGRAM,
      outputPath: join(outside, 'x.svg'),
    })
    expect(result.isError).toBe(true)
    expect(existsSync(join(outside, 'x.svg'))).toBe(false)
  })

  it('refuses a sibling directory sharing the base as a string prefix', () => {
    const sibling = `${dir}-evil`
    mkdirSync(sibling)
    try {
      const result = renderSvgHandler({
        diagram: DIAGRAM,
        outputPath: join(sibling, 'x.svg'),
      })
      expect(result.isError).toBe(true)
      expect(existsSync(join(sibling, 'x.svg'))).toBe(false)
    } finally {
      rmSync(sibling, { recursive: true, force: true })
    }
  })

  it('refuses to write through a symlinked directory', () => {
    symlinkSync(outside, join(dir, 'link'))
    const result = renderSvgHandler({
      diagram: DIAGRAM,
      outputPath: 'link/x.svg',
    })
    expect(result.isError).toBe(true)
    expect(existsSync(join(outside, 'x.svg'))).toBe(false)
  })

  it('refuses to write through a symlinked file', () => {
    const victim = join(outside, 'victim.svg')
    writeFileSync(victim, 'original')
    symlinkSync(victim, join(dir, 'l.svg'))
    const result = renderSvgHandler({ diagram: DIAGRAM, outputPath: 'l.svg' })
    expect(result.isError).toBe(true)
    expect(readFileSync(victim, 'utf8')).toBe('original')
  })

  it('refuses an existing directory named like an svg', () => {
    mkdirSync(join(dir, 'd.svg'))
    const result = renderSvgHandler({ diagram: DIAGRAM, outputPath: 'd.svg' })
    expect(result.isError).toBe(true)
    // Raw fs errors would embed the absolute path; only the code may surface.
    expect(text(result)).toContain('outputPath could not be written')
    expect(text(result)).not.toContain(dir)
  })

  it.skipIf(process.platform === 'win32')(
    'refuses a FIFO without blocking on the open',
    () => {
      execFileSync('mkfifo', [join(dir, 'f.svg')])
      const result = renderSvgHandler({ diagram: DIAGRAM, outputPath: 'f.svg' })
      expect(result.isError).toBe(true)
    },
  )

  it('does not write anything when the diagram itself is invalid', () => {
    const result = renderSvgHandler({ diagram: '', outputPath: 'bad.svg' })
    expect(existsSync(join(dir, 'bad.svg'))).toBe(false)
    expect(result.isError).toBe(true)
  })
})

describe('writeAll', () => {
  it('continues after a short write until every byte is written', () => {
    const calls: Array<[number, number]> = []
    const write = ((_fd: number, _b: Buffer, off: number, len: number) => {
      calls.push([off, len])
      return Math.min(3, len)
    }) as unknown as typeof import('node:fs').writeSync
    writeAll(1, Buffer.from('0123456789'), write)
    expect(calls).toEqual([
      [0, 10],
      [3, 7],
      [6, 4],
      [9, 1],
    ])
  })

  it('throws when a write makes no progress', () => {
    const write = (() => 0) as unknown as typeof import('node:fs').writeSync
    expect(() => writeAll(1, Buffer.from('abc'), write)).toThrow('no progress')
  })
})
