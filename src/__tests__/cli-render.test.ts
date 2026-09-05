import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runRender } from '../cli/render.ts'
import { displayWidth } from '../ascii/display-width.ts'
import { createMockStdout, renderArgs } from './cli-test-helpers.ts'

// ============================================================================
// Constants
// ============================================================================

const SIMPLE_FLOWCHART = `graph LR
  A --> B --> C`

// ============================================================================
// Temp directory lifecycle
// ============================================================================

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'cli-render-test-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

// ============================================================================
// ASCII output
// ============================================================================

describe('runRender – ASCII from file', () => {
  it('renders ASCII to stdout from a file and output contains node labels', async () => {
    const inputPath = join(tmpDir, 'diagram.mmd')
    await writeFile(inputPath, SIMPLE_FLOWCHART)

    const mockStdout = createMockStdout()
    await runRender(renderArgs({ input: inputPath, ascii: true }), mockStdout)

    const output = mockStdout.output()
    expect(output).toContain('A')
    expect(output).toContain('B')
    expect(output).toContain('C')
  })
})

describe('runRender – ASCII from stdin', () => {
  it('reads from stdinContent and renders ASCII output', async () => {
    const mockStdout = createMockStdout()
    await runRender(renderArgs({ ascii: true }), mockStdout, SIMPLE_FLOWCHART)

    const output = mockStdout.output()
    expect(output).toContain('A')
    expect(output).toContain('B')
    expect(output).toContain('C')
  })
})

// ============================================================================
// SVG output
// ============================================================================

describe('runRender – SVG to file', () => {
  it('renders SVG and writes to the output file', async () => {
    const inputPath = join(tmpDir, 'diagram.mmd')
    const outputPath = join(tmpDir, 'out.svg')
    await writeFile(inputPath, SIMPLE_FLOWCHART)

    await runRender(
      renderArgs({ input: inputPath, svg: true, output: outputPath }),
    )

    const svg = await readFile(outputPath, 'utf-8')
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })
})

// ============================================================================
// Output ergonomics (#456)
// ============================================================================

describe('runRender – output ergonomics', () => {
  it('writes the SVG to stdout for -o -, byte-identical to the file output', async () => {
    const inputPath = join(tmpDir, 'diagram.mmd')
    const filePath = join(tmpDir, 'out.svg')
    await writeFile(inputPath, SIMPLE_FLOWCHART)

    const mockStdout = createMockStdout()
    await runRender(
      renderArgs({ input: inputPath, svg: true, output: '-' }),
      mockStdout,
    )
    await runRender(
      renderArgs({ input: inputPath, svg: true, output: filePath }),
    )

    expect(mockStdout.output()).toMatch(/^<svg[\s\S]*<\/svg>$/)
    expect(mockStdout.output()).toBe(await readFile(filePath, 'utf-8'))
  })

  it('refuses to overwrite an existing output file, naming the file and --force', async () => {
    const inputPath = join(tmpDir, 'diagram.mmd')
    const outputPath = join(tmpDir, 'out.svg')
    await writeFile(inputPath, SIMPLE_FLOWCHART)
    await writeFile(outputPath, 'ORIGINAL')

    const mockStdout = createMockStdout()
    await expect(
      runRender(
        renderArgs({
          input: inputPath,
          ascii: true,
          svg: true,
          output: outputPath,
        }),
        mockStdout,
      ),
    ).rejects.toThrow(
      `Refusing to overwrite existing file "${outputPath}" — pass --force to replace it`,
    )
    expect(await readFile(outputPath, 'utf-8')).toBe('ORIGINAL')
    // Refused before any work: nothing was printed ahead of the error.
    expect(mockStdout.output()).toBe('')
  })

  it('overwrites an existing output file with force', async () => {
    const inputPath = join(tmpDir, 'diagram.mmd')
    const outputPath = join(tmpDir, 'out.svg')
    await writeFile(inputPath, SIMPLE_FLOWCHART)
    await writeFile(outputPath, 'ORIGINAL')

    await runRender(
      renderArgs({
        input: inputPath,
        svg: true,
        output: outputPath,
        force: true,
      }),
    )

    expect(await readFile(outputPath, 'utf-8')).toContain('<svg')
  })

  it('writes ASCII to a file when it is the only format and -o names one', async () => {
    const inputPath = join(tmpDir, 'diagram.mmd')
    const outputPath = join(tmpDir, 'out.txt')
    await writeFile(inputPath, SIMPLE_FLOWCHART)

    const mockStdout = createMockStdout()
    await runRender(
      renderArgs({ input: inputPath, ascii: true, output: outputPath }),
      mockStdout,
    )

    const text = await readFile(outputPath, 'utf-8')
    expect(text).toContain('A')
    expect(text).toContain('C')
    expect(text.endsWith('\n')).toBe(true)
    expect(mockStdout.output()).toBe('')
  })

  it('writes ASCII to a file without ANSI escapes even when a theme is set', async () => {
    const inputPath = join(tmpDir, 'diagram.mmd')
    const outputPath = join(tmpDir, 'out.txt')
    await writeFile(inputPath, SIMPLE_FLOWCHART)

    await runRender(
      renderArgs({
        input: inputPath,
        ascii: true,
        output: outputPath,
        theme: 'tokyo-night',
      }),
    )

    expect(await readFile(outputPath, 'utf-8')).not.toMatch(/\x1b\[/)
  })

  it('refuses to overwrite an existing ASCII output file too', async () => {
    const inputPath = join(tmpDir, 'diagram.mmd')
    const outputPath = join(tmpDir, 'out.txt')
    await writeFile(inputPath, SIMPLE_FLOWCHART)
    await writeFile(outputPath, 'ORIGINAL')

    await expect(
      runRender(
        renderArgs({ input: inputPath, ascii: true, output: outputPath }),
      ),
    ).rejects.toThrow('Refusing to overwrite existing file')
    expect(await readFile(outputPath, 'utf-8')).toBe('ORIGINAL')
  })

  it('still prints ASCII to stdout when both formats are requested with a file -o', async () => {
    const inputPath = join(tmpDir, 'diagram.mmd')
    const outputPath = join(tmpDir, 'out.svg')
    await writeFile(inputPath, SIMPLE_FLOWCHART)

    const mockStdout = createMockStdout()
    await runRender(
      renderArgs({
        input: inputPath,
        ascii: true,
        svg: true,
        output: outputPath,
      }),
      mockStdout,
    )

    expect(mockStdout.output()).toContain('A')
    expect(mockStdout.output()).not.toContain('<svg')
    expect(await readFile(outputPath, 'utf-8')).toContain('<svg')
  })
})

// ============================================================================
// Both ASCII + SVG
// ============================================================================

describe('runRender – both ASCII and SVG', () => {
  it('renders both ASCII to stdout and SVG to file', async () => {
    const inputPath = join(tmpDir, 'diagram.mmd')
    const outputPath = join(tmpDir, 'out.svg')
    await writeFile(inputPath, SIMPLE_FLOWCHART)

    const mockStdout = createMockStdout()
    await runRender(
      renderArgs({
        input: inputPath,
        ascii: true,
        svg: true,
        output: outputPath,
      }),
      mockStdout,
    )

    // ASCII went to stdout
    const asciiOutput = mockStdout.output()
    expect(asciiOutput).toContain('A')
    expect(asciiOutput).toContain('B')

    // SVG went to file
    const svg = await readFile(outputPath, 'utf-8')
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })
})

// ============================================================================
// Theme application
// ============================================================================

describe('runRender – theme application', () => {
  it('applies tokyo-night theme and SVG contains --bg:#1a1b26', async () => {
    const inputPath = join(tmpDir, 'diagram.mmd')
    const outputPath = join(tmpDir, 'themed.svg')
    await writeFile(inputPath, SIMPLE_FLOWCHART)

    await runRender(
      renderArgs({
        input: inputPath,
        svg: true,
        output: outputPath,
        theme: 'tokyo-night',
      }),
    )

    const svg = await readFile(outputPath, 'utf-8')
    expect(svg).toContain('--bg:#1a1b26')
  })
})

// ============================================================================
// Padding/spacing flags
// ============================================================================

describe('runRender – padding flags', () => {
  it('widens ASCII output when paddingX is increased', async () => {
    const narrowStdout = createMockStdout()
    await runRender(
      renderArgs({ ascii: true, paddingX: 1 }),
      narrowStdout,
      SIMPLE_FLOWCHART,
    )

    const wideStdout = createMockStdout()
    await runRender(
      renderArgs({ ascii: true, paddingX: 30 }),
      wideStdout,
      SIMPLE_FLOWCHART,
    )

    const narrowWidth = Math.max(
      ...narrowStdout
        .output()
        .split('\n')
        .map((line) => line.length),
    )
    const wideWidth = Math.max(
      ...wideStdout
        .output()
        .split('\n')
        .map((line) => line.length),
    )
    expect(wideWidth).toBeGreaterThan(narrowWidth)
  })

  it('passes borderPadding through to the ASCII renderer', async () => {
    const tightStdout = createMockStdout()
    await runRender(
      renderArgs({ ascii: true, borderPadding: 0 }),
      tightStdout,
      SIMPLE_FLOWCHART,
    )

    const paddedStdout = createMockStdout()
    await runRender(
      renderArgs({ ascii: true, borderPadding: 5 }),
      paddedStdout,
      SIMPLE_FLOWCHART,
    )

    expect(paddedStdout.output().length).toBeGreaterThan(
      tightStdout.output().length,
    )
  })
})

// ============================================================================
// --coords debug overlay
// ============================================================================

describe('runRender – coords overlay', () => {
  it('adds coordinate ruler lines when coords is true', async () => {
    const plainStdout = createMockStdout()
    await runRender(renderArgs({ ascii: true }), plainStdout, SIMPLE_FLOWCHART)

    const coordsStdout = createMockStdout()
    await runRender(
      renderArgs({ ascii: true, coords: true }),
      coordsStdout,
      SIMPLE_FLOWCHART,
    )

    expect(coordsStdout.output().split('\n').length).toBeGreaterThan(
      plainStdout.output().split('\n').length,
    )
    expect(coordsStdout.output()).toContain('0123456789')
  })
})

// ============================================================================
// --max-width
// ============================================================================

describe('runRender – max-width warning', () => {
  it('warns on stderr when ASCII output exceeds an explicit --max-width', async () => {
    const mockStdout = createMockStdout()
    const mockStderr = createMockStdout()
    await runRender(
      renderArgs({ ascii: true, maxWidth: 10 }),
      mockStdout,
      SIMPLE_FLOWCHART,
      mockStderr,
    )

    expect(mockStderr.output()).toContain('Warning:')
    expect(mockStderr.output()).toContain('exceeding --max-width of 10')
    // stdout still gets the full, unmodified diagram — no truncation.
    expect(mockStdout.output()).toContain('A')
    expect(mockStdout.output()).toContain('C')
  })

  it('does not warn when ASCII output fits within --max-width', async () => {
    const mockStdout = createMockStdout()
    const mockStderr = createMockStdout()
    await runRender(
      renderArgs({ ascii: true, maxWidth: 1000 }),
      mockStdout,
      SIMPLE_FLOWCHART,
      mockStderr,
    )

    expect(mockStderr.output()).toBe('')
  })

  it('does not warn when --max-width is not given', async () => {
    const mockStdout = createMockStdout()
    const mockStderr = createMockStdout()
    await runRender(
      renderArgs({ ascii: true }),
      mockStdout,
      SIMPLE_FLOWCHART,
      mockStderr,
    )

    expect(mockStderr.output()).toBe('')
  })

  it('automatically applies compact spacing to fit a diagram that only overflows at default spacing', async () => {
    // A longer chain than SIMPLE_FLOWCHART so default spacing (45 cols)
    // overflows a mid-size target while compact spacing (19 cols) fits it.
    const chain = `graph LR
  A --> B --> C --> D --> E`

    const mockStdout = createMockStdout()
    const mockStderr = createMockStdout()
    await runRender(
      renderArgs({ ascii: true, maxWidth: 30 }),
      mockStdout,
      chain,
      mockStderr,
    )

    // No overflow warning — compaction alone was enough to fit.
    expect(mockStderr.output()).not.toContain('Warning:')
    expect(mockStderr.output()).toContain('applied compact spacing')
    expect(mockStderr.output()).toContain('to fit')

    const lines = mockStdout.output().split('\n')
    const width = Math.max(...lines.map((line) => line.length))
    expect(width).toBeLessThanOrEqual(30)
    // Content survives compaction unmodified — no truncation.
    expect(mockStdout.output()).toContain('A')
    expect(mockStdout.output()).toContain('E')
  })

  it('still warns when the diagram exceeds --max-width even after compact spacing', async () => {
    const chain = `graph LR
  A --> B --> C --> D --> E`

    const mockStdout = createMockStdout()
    const mockStderr = createMockStdout()
    await runRender(
      renderArgs({ ascii: true, maxWidth: 10 }),
      mockStdout,
      chain,
      mockStderr,
    )

    expect(mockStderr.output()).toContain('Warning:')
    expect(mockStderr.output()).toContain('already applied automatically')
    expect(mockStderr.output()).toContain(
      'https://github.com/dfadler/zombie-mermaid/issues/335',
    )
    // Still no truncation — full diagram content still present.
    expect(mockStdout.output()).toContain('A')
    expect(mockStdout.output()).toContain('E')
  })

  it('does not attempt compaction when explicit padding is already at or below compact levels', async () => {
    const chain = `graph LR
  A --> B --> C --> D --> E`

    const mockStdout = createMockStdout()
    const mockStderr = createMockStdout()
    await runRender(
      renderArgs({
        ascii: true,
        maxWidth: 10,
        paddingX: 1,
        paddingY: 1,
        borderPadding: 0,
      }),
      mockStdout,
      chain,
      mockStderr,
    )

    expect(mockStderr.output()).toContain('Warning:')
    // No compaction note — nothing left to tighten.
    expect(mockStderr.output()).not.toContain('already applied automatically')
  })

  it('resolves --max-width auto against the detected terminal width', async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      process.stdout,
      'columns',
    )
    // Narrow enough that the sample flowchart is guaranteed to overflow it.
    Object.defineProperty(process.stdout, 'columns', {
      value: 5,
      configurable: true,
    })

    try {
      const mockStdout = createMockStdout()
      const mockStderr = createMockStdout()
      await runRender(
        renderArgs({ ascii: true, maxWidth: 'auto' }),
        mockStdout,
        SIMPLE_FLOWCHART,
        mockStderr,
      )

      expect(mockStderr.output()).toContain('detected terminal width of 5')
    } finally {
      if (originalDescriptor === undefined) {
        delete (process.stdout as { columns?: number }).columns
      } else {
        Object.defineProperty(process.stdout, 'columns', originalDescriptor)
      }
    }
  })

  it('measures width in terminal display columns, not UTF-16 code units', async () => {
    // Every row of the ASCII canvas is padded to the same fixed grid width,
    // and a wide (CJK) glyph's second column is an empty placeholder cell
    // that contributes zero characters to the emitted string (see
    // `WIDE_CHAR_PLACEHOLDER` in ascii/display-width.ts) — so a row's own
    // `.length` is always exactly `canvasWidth - <wide chars in that row>`,
    // while its true rendered display width is always exactly
    // `canvasWidth`. Consequently `Math.max(...lines.map(l => l.length))`
    // over the *whole* rendered diagram ties the true display width for any
    // diagram that has at least one plain-ASCII row (a border, a blank
    // separator row — virtually guaranteed), so deriving a maxWidth from
    // that code-unit measurement can never manufacture a case where display
    // width exceeds it. Assert the regression this test actually guards
    // against directly instead: force overflow with a maxWidth well below
    // the true width, and check the warning reports the CJK-correct
    // display-column count (not the smaller UTF-16 code-unit count a
    // `.length`-based regression would report).
    const wideSequence = `sequenceDiagram
  participant A
  participant B
  A->>B: 中文很长的消息内容说明文字超长`

    const mockStdout = createMockStdout()
    await runRender(
      renderArgs({ ascii: true, maxWidth: 1000 }),
      mockStdout,
      wideSequence,
      createMockStdout(),
    )
    const rendered = mockStdout.output()
    const codeUnitWidth = Math.max(
      ...rendered.split('\n').map((line) => line.length),
    )
    const trueDisplayWidth = Math.max(
      ...rendered.split('\n').map((line) => displayWidth(line)),
    )
    // The CJK label makes this diagnostic (not the fix itself) worth
    // keeping: on a `.length`-based renderer these differed; the correct,
    // canvas-uniform-width renderer ties them, which is why maxWidth below
    // must be an independent constant rather than derived from either.
    expect(trueDisplayWidth).toBe(codeUnitWidth)

    // At maxWidth 10, the automatic compact-spacing fallback (see issue
    // #335) kicks in and narrows the diagram below its uncapped width
    // above — so the warning's reported width must be re-derived from
    // *this* render's actual (possibly compacted) output, not the uncapped
    // one, while still exercising the same CJK display-width correctness.
    const mockStdoutCapped = createMockStdout()
    const mockStderr = createMockStdout()
    await runRender(
      renderArgs({ ascii: true, maxWidth: 10 }),
      mockStdoutCapped,
      wideSequence,
      mockStderr,
    )
    const renderedCapped = mockStdoutCapped.output()
    const trueDisplayWidthCapped = Math.max(
      ...renderedCapped.split('\n').map((line) => displayWidth(line)),
    )

    // The reported column count must reflect true display width (double
    // for each CJK character) — a `.length`-based regression would report
    // a smaller UTF-16 code-unit count instead.
    expect(mockStderr.output()).toContain('Warning:')
    expect(mockStderr.output()).toContain(
      `is ${trueDisplayWidthCapped} columns`,
    )
  })
})

// ============================================================================
// Error cases
// ============================================================================

describe('runRender – errors', () => {
  it('throws on empty input', async () => {
    const mockStdout = createMockStdout()
    await expect(
      runRender(renderArgs({ ascii: true }), mockStdout, '   '),
    ).rejects.toThrow('Empty input')
  })

  it('throws on unknown theme with name, "Available themes", and known theme listed', async () => {
    const inputPath = join(tmpDir, 'diagram.mmd')
    await writeFile(inputPath, SIMPLE_FLOWCHART)

    await expect(
      runRender(
        renderArgs({
          input: inputPath,
          svg: true,
          output: join(tmpDir, 'out.svg'),
          theme: 'nope',
        }),
      ),
    ).rejects.toThrow(/Unknown theme.*"nope".*Available themes:.*tokyo-night/)
  })

  it('throws on invalid mermaid syntax', async () => {
    const mockStdout = createMockStdout()
    await expect(
      runRender(
        renderArgs({ ascii: true }),
        mockStdout,
        'this is not valid mermaid',
      ),
    ).rejects.toThrow()
  })
})

// ============================================================================
// HTML viewer output (#456)
// ============================================================================

describe('runRender – HTML viewer output', () => {
  it('renders a self-contained HTML file embedding the SVG', async () => {
    const inputPath = join(tmpDir, 'diagram.mmd')
    const outputPath = join(tmpDir, 'out.html')
    await writeFile(inputPath, SIMPLE_FLOWCHART)

    await runRender(
      renderArgs({ input: inputPath, html: true, output: outputPath }),
    )

    const html = await readFile(outputPath, 'utf-8')
    expect(html).toMatch(/^<!doctype html>/)
    expect(html).toContain('<svg')
    expect(html).toContain('</svg>')
    expect(html).toContain('id="stage"')
    expect(html).toContain('id="diagram"')
    expect(html).toContain('<script>')
    // No externally-loaded assets — a single file that opens from disk
    // with no network, per the issue's requirement. (The SVG's own
    // `xmlns="http://www.w3.org/2000/svg"` is a namespace URI, not a
    // fetched resource, so it's deliberately not what this checks.)
    expect(html).not.toMatch(/<script[^>]+src=/)
    expect(html).not.toMatch(/<link[^>]+href=/)
    expect(html).not.toMatch(/\bfetch\(/)
  })

  it('writes HTML to stdout for -o -, byte-identical to the file output', async () => {
    const inputPath = join(tmpDir, 'diagram.mmd')
    const filePath = join(tmpDir, 'out.html')
    await writeFile(inputPath, SIMPLE_FLOWCHART)

    const mockStdout = createMockStdout()
    await runRender(
      renderArgs({ input: inputPath, html: true, output: '-' }),
      mockStdout,
    )
    await runRender(
      renderArgs({ input: inputPath, html: true, output: filePath }),
    )

    const fileContent = await readFile(filePath, 'utf-8')
    expect(mockStdout.output()).toBe(fileContent)
  })

  it('titles the page from the input file stem', async () => {
    const inputPath = join(tmpDir, 'my-cool-diagram.mmd')
    const outputPath = join(tmpDir, 'out.html')
    await writeFile(inputPath, SIMPLE_FLOWCHART)

    await runRender(
      renderArgs({ input: inputPath, html: true, output: outputPath }),
    )

    const html = await readFile(outputPath, 'utf-8')
    expect(html).toContain('<title>my-cool-diagram</title>')
  })

  it('refuses to overwrite an existing .html file without --force', async () => {
    const inputPath = join(tmpDir, 'diagram.mmd')
    const outputPath = join(tmpDir, 'out.html')
    await writeFile(inputPath, SIMPLE_FLOWCHART)
    await writeFile(outputPath, 'existing content')

    await expect(
      runRender(
        renderArgs({ input: inputPath, html: true, output: outputPath }),
      ),
    ).rejects.toThrow(/Refusing to overwrite existing file/)

    expect(await readFile(outputPath, 'utf-8')).toBe('existing content')
  })
})
