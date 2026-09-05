import { describe, it, expect } from 'vitest'
import { parseArgs } from '../cli/parse-args.ts'
import type { RenderArgs, SimpleCommand, WebArgs } from '../cli/parse-args.ts'

// ============================================================================
// render command — happy paths
// ============================================================================

describe('parseArgs – render happy paths', () => {
  it('parses render <file> --ascii', () => {
    const result = parseArgs(['render', 'diagram.mmd', '--ascii'])
    expect(result).toEqual({
      command: 'render',
      input: 'diagram.mmd',
      ascii: true,
      svg: false,
      html: false,
      output: undefined,
      force: false,
      theme: undefined,
      paddingX: undefined,
      paddingY: undefined,
      borderPadding: undefined,
      coords: false,
      maxWidth: undefined,
    } satisfies RenderArgs)
  })

  it('parses render <file> --svg -o <path>', () => {
    const result = parseArgs([
      'render',
      'diagram.mmd',
      '--svg',
      '-o',
      'out.svg',
    ])
    expect(result).toEqual({
      command: 'render',
      input: 'diagram.mmd',
      ascii: false,
      svg: true,
      html: false,
      output: 'out.svg',
      force: false,
      theme: undefined,
      paddingX: undefined,
      paddingY: undefined,
      borderPadding: undefined,
      coords: false,
      maxWidth: undefined,
    } satisfies RenderArgs)
  })

  it('parses render <file> --ascii --svg -o <path>', () => {
    const result = parseArgs([
      'render',
      'diagram.mmd',
      '--ascii',
      '--svg',
      '-o',
      'out.svg',
    ])
    expect(result).toEqual({
      command: 'render',
      input: 'diagram.mmd',
      ascii: true,
      svg: true,
      html: false,
      output: 'out.svg',
      force: false,
      theme: undefined,
      paddingX: undefined,
      paddingY: undefined,
      borderPadding: undefined,
      coords: false,
      maxWidth: undefined,
    } satisfies RenderArgs)
  })

  it('parses render <file> --svg -o out.svg --theme tokyo-night', () => {
    const result = parseArgs([
      'render',
      'diagram.mmd',
      '--svg',
      '-o',
      'out.svg',
      '--theme',
      'tokyo-night',
    ])
    expect(result).toEqual({
      command: 'render',
      input: 'diagram.mmd',
      ascii: false,
      svg: true,
      html: false,
      output: 'out.svg',
      force: false,
      theme: 'tokyo-night',
      paddingX: undefined,
      paddingY: undefined,
      borderPadding: undefined,
      coords: false,
      maxWidth: undefined,
    } satisfies RenderArgs)
  })

  it('parses render --ascii with no file (stdin)', () => {
    const result = parseArgs(['render', '--ascii'])
    expect(result).toEqual({
      command: 'render',
      input: undefined,
      ascii: true,
      svg: false,
      html: false,
      output: undefined,
      force: false,
      theme: undefined,
      paddingX: undefined,
      paddingY: undefined,
      borderPadding: undefined,
      coords: false,
      maxWidth: undefined,
    } satisfies RenderArgs)
  })

  it('parses render --svg -o out.svg with no file (stdin)', () => {
    const result = parseArgs(['render', '--svg', '-o', 'out.svg'])
    expect(result).toEqual({
      command: 'render',
      input: undefined,
      ascii: false,
      svg: true,
      html: false,
      output: 'out.svg',
      force: false,
      theme: undefined,
      paddingX: undefined,
      paddingY: undefined,
      borderPadding: undefined,
      coords: false,
      maxWidth: undefined,
    } satisfies RenderArgs)
  })

  it('parses --output the same as -o', () => {
    const result = parseArgs([
      'render',
      'diagram.mmd',
      '--svg',
      '--output',
      'out.svg',
    ])
    expect(result).toEqual({
      command: 'render',
      input: 'diagram.mmd',
      ascii: false,
      svg: true,
      html: false,
      output: 'out.svg',
      force: false,
      theme: undefined,
      paddingX: undefined,
      paddingY: undefined,
      borderPadding: undefined,
      coords: false,
      maxWidth: undefined,
    } satisfies RenderArgs)
  })

  it('parses -x/-y/-p padding flags (short form)', () => {
    const result = parseArgs([
      'render',
      'diagram.mmd',
      '--ascii',
      '-x',
      '10',
      '-y',
      '3',
      '-p',
      '2',
    ])
    expect(result).toEqual({
      command: 'render',
      input: 'diagram.mmd',
      ascii: true,
      svg: false,
      html: false,
      output: undefined,
      force: false,
      theme: undefined,
      paddingX: 10,
      paddingY: 3,
      borderPadding: 2,
      coords: false,
      maxWidth: undefined,
    } satisfies RenderArgs)
  })

  it('parses --paddingX/--paddingY/--borderPadding (long form)', () => {
    const result = parseArgs([
      'render',
      'diagram.mmd',
      '--ascii',
      '--paddingX',
      '7',
      '--paddingY',
      '9',
      '--borderPadding',
      '0',
    ])
    expect(result).toEqual({
      command: 'render',
      input: 'diagram.mmd',
      ascii: true,
      svg: false,
      html: false,
      output: undefined,
      force: false,
      theme: undefined,
      paddingX: 7,
      paddingY: 9,
      borderPadding: 0,
      coords: false,
      maxWidth: undefined,
    } satisfies RenderArgs)
  })

  it('parses --coords', () => {
    const result = parseArgs(['render', 'diagram.mmd', '--ascii', '--coords'])
    expect(result).toEqual({
      command: 'render',
      input: 'diagram.mmd',
      ascii: true,
      svg: false,
      html: false,
      output: undefined,
      force: false,
      theme: undefined,
      paddingX: undefined,
      paddingY: undefined,
      borderPadding: undefined,
      coords: true,
      maxWidth: undefined,
    } satisfies RenderArgs)
  })

  it('parses -w <n>', () => {
    const result = parseArgs(['render', 'diagram.mmd', '--ascii', '-w', '40'])
    expect(result).toEqual({
      command: 'render',
      input: 'diagram.mmd',
      ascii: true,
      svg: false,
      html: false,
      output: undefined,
      force: false,
      theme: undefined,
      paddingX: undefined,
      paddingY: undefined,
      borderPadding: undefined,
      coords: false,
      maxWidth: 40,
    } satisfies RenderArgs)
  })

  it('parses --max-width auto', () => {
    const result = parseArgs([
      'render',
      'diagram.mmd',
      '--ascii',
      '--max-width',
      'auto',
    ])
    expect(result).toEqual({
      command: 'render',
      input: 'diagram.mmd',
      ascii: true,
      svg: false,
      html: false,
      output: undefined,
      force: false,
      theme: undefined,
      paddingX: undefined,
      paddingY: undefined,
      borderPadding: undefined,
      coords: false,
      maxWidth: 'auto',
    } satisfies RenderArgs)
  })
})

// ============================================================================
// simple commands
// ============================================================================

// ============================================================================
// Output ergonomics (#456): -o -, extension inference, default names, --force
// ============================================================================

describe('parseArgs – output ergonomics', () => {
  const render = (argv: string[]) => {
    const args = parseArgs(['render', ...argv])
    if (args.command !== 'render') throw new Error('expected render')
    return args
  }

  it('accepts -o - as "write the SVG to stdout"', () => {
    const args = render(['diagram.mmd', '--svg', '-o', '-'])
    expect(args.svg).toBe(true)
    expect(args.output).toBe('-')
  })

  it('accepts -o - with --ascii alone (a no-op: ASCII already goes to stdout)', () => {
    const args = render(['diagram.mmd', '--ascii', '-o', '-'])
    expect(args.ascii).toBe(true)
    expect(args.svg).toBe(false)
    expect(args.output).toBe('-')
  })

  it('rejects -o - when both ASCII and SVG would land on stdout', () => {
    expect(() =>
      render(['diagram.mmd', '--ascii', '--svg', '-o', '-']),
    ).toThrow('-o - would send both ASCII and SVG to stdout')
  })

  it('infers --svg from a .svg extension when no format flag is given', () => {
    const args = render(['diagram.mmd', '-o', 'out.svg'])
    expect(args.svg).toBe(true)
    expect(args.ascii).toBe(false)
    expect(args.output).toBe('out.svg')
  })

  it('infers --svg case-insensitively (.SVG)', () => {
    expect(render(['diagram.mmd', '-o', 'OUT.SVG']).svg).toBe(true)
  })

  it('infers --ascii from a .txt extension, writing ASCII to that file', () => {
    const args = render(['diagram.mmd', '-o', 'out.txt'])
    expect(args.ascii).toBe(true)
    expect(args.svg).toBe(false)
    expect(args.output).toBe('out.txt')
  })

  it('adds --svg when --ascii is given with a .svg -o (ASCII to terminal, SVG to file)', () => {
    const args = render(['diagram.mmd', '--ascii', '-o', 'out.svg'])
    expect(args.ascii).toBe(true)
    expect(args.svg).toBe(true)
    expect(args.output).toBe('out.svg')
  })

  it('rejects --svg with a .txt -o (extension contradicts the format written there)', () => {
    expect(() => render(['diagram.mmd', '--svg', '-o', 'out.txt'])).toThrow(
      '-o out.txt has a .txt extension, but --svg output would be written to it',
    )
  })

  it('lets an explicit flag win over an unrecognised extension', () => {
    const args = render(['diagram.mmd', '--svg', '-o', 'diagram.xml'])
    expect(args.svg).toBe(true)
    expect(args.output).toBe('diagram.xml')
  })

  it('rejects -o with an unrecognised extension and no format flag', () => {
    expect(() => render(['diagram.mmd', '-o', 'out.xml'])).toThrow(
      'Cannot infer an output format from "out.xml"',
    )
  })

  it('defaults the SVG output name to the input stem when --svg has no -o', () => {
    expect(render(['diagram.mmd', '--svg']).output).toBe('diagram.svg')
    expect(render(['docs/flow.mermaid', '--svg']).output).toBe('docs/flow.svg')
    expect(render(['flow', '--svg']).output).toBe('flow.svg')
    expect(render(['a.b/diagram.mmd', '--svg']).output).toBe('a.b/diagram.svg')
  })

  it('keeps --ascii without -o as stdout only (no file, no default name)', () => {
    expect(render(['diagram.mmd', '--ascii']).output).toBeUndefined()
  })

  it('parses -f and --force', () => {
    expect(render(['diagram.mmd', '--svg', '-f']).force).toBe(true)
    expect(render(['diagram.mmd', '--svg', '--force']).force).toBe(true)
    expect(render(['diagram.mmd', '--svg']).force).toBe(false)
  })

  it('rejects a bare - as the input file (stdin is the no-file default)', () => {
    expect(() => render(['-', '--ascii'])).toThrow(
      'Unexpected argument: - (use -o - to write output to stdout',
    )
  })

  it('reports -o missing its value with the stdout hint', () => {
    expect(() => render(['diagram.mmd', '--svg', '-o'])).toThrow(
      '-o requires a file path (or - for stdout)',
    )
  })
})

describe('parseArgs – simple commands', () => {
  it('parses "themes"', () => {
    const result = parseArgs(['themes'])
    expect(result).toEqual({ command: 'themes' } satisfies SimpleCommand)
  })

  it('returns help for --help', () => {
    const result = parseArgs(['--help'])
    expect(result).toEqual({ command: 'help' } satisfies SimpleCommand)
  })

  it('returns help for -h', () => {
    const result = parseArgs(['-h'])
    expect(result).toEqual({ command: 'help' } satisfies SimpleCommand)
  })

  it('returns help for empty args', () => {
    const result = parseArgs([])
    expect(result).toEqual({ command: 'help' } satisfies SimpleCommand)
  })

  it('returns version for --version', () => {
    const result = parseArgs(['--version'])
    expect(result).toEqual({ command: 'version' } satisfies SimpleCommand)
  })

  it('returns version for -v', () => {
    const result = parseArgs(['-v'])
    expect(result).toEqual({ command: 'version' } satisfies SimpleCommand)
  })

  it('parses "mcp"', () => {
    const result = parseArgs(['mcp'])
    expect(result).toEqual({ command: 'mcp' } satisfies SimpleCommand)
  })
})

// ============================================================================
// web command
// ============================================================================

describe('parseArgs – web command', () => {
  it('parses "web" with the default port', () => {
    const result = parseArgs(['web'])
    expect(result).toEqual({ command: 'web', port: 3000 } satisfies WebArgs)
  })

  it('parses "web --port <n>"', () => {
    const result = parseArgs(['web', '--port', '8080'])
    expect(result).toEqual({ command: 'web', port: 8080 } satisfies WebArgs)
  })

  it('throws when --port is not a non-negative integer', () => {
    expect(() => parseArgs(['web', '--port', 'nope'])).toThrow(
      '--port requires a non-negative integer, got: "nope"',
    )
  })

  it('throws on unknown flag in web sub-parser', () => {
    expect(() => parseArgs(['web', '--bogus'])).toThrow('Unknown flag: --bogus')
  })
})

// ============================================================================
// validation errors
// ============================================================================

describe('parseArgs – validation errors', () => {
  it('throws when render has --svg but no -o and no input file to name the output after', () => {
    expect(() => parseArgs(['render', '--svg'])).toThrow(
      '--svg needs -o <path> (or -o - for stdout) when reading from stdin',
    )
  })

  it('throws when render has no output flags', () => {
    expect(() => parseArgs(['render', 'diagram.mmd'])).toThrow(
      'Specify --ascii, --svg, and/or --html',
    )
  })

  it('throws on unknown command', () => {
    expect(() => parseArgs(['foobar'])).toThrow('Unknown command: foobar')
  })

  it('throws when -o is last argument with no value', () => {
    expect(() => parseArgs(['render', 'diagram.mmd', '--svg', '-o'])).toThrow(
      '-o requires a file path',
    )
  })

  it('throws when --theme is last argument with no value', () => {
    expect(() =>
      parseArgs(['render', 'diagram.mmd', '--ascii', '--theme']),
    ).toThrow('--theme requires a theme name')
  })

  it('throws on unknown flag in render sub-parser', () => {
    expect(() =>
      parseArgs(['render', 'diagram.mmd', '--ascii', '--bogus']),
    ).toThrow('Unknown flag: --bogus')
  })

  it('throws on duplicate positional argument', () => {
    expect(() =>
      parseArgs(['render', 'diagram1.mmd', '--ascii', 'diagram2.mmd']),
    ).toThrow(
      'Unexpected argument: diagram2.mmd (input file already set to "diagram1.mmd")',
    )
  })

  it('throws when -x is last argument with no value', () => {
    expect(() => parseArgs(['render', 'diagram.mmd', '--ascii', '-x'])).toThrow(
      '-x requires a numeric value',
    )
  })

  it('throws when --paddingX is not a non-negative integer', () => {
    expect(() =>
      parseArgs(['render', 'diagram.mmd', '--ascii', '--paddingX', '-5']),
    ).toThrow('--paddingX requires a non-negative integer, got: "-5"')
  })

  it('throws when -y is not numeric', () => {
    expect(() =>
      parseArgs(['render', 'diagram.mmd', '--ascii', '-y', 'abc']),
    ).toThrow('-y requires a non-negative integer, got: "abc"')
  })

  it('throws when --borderPadding is a decimal', () => {
    expect(() =>
      parseArgs(['render', 'diagram.mmd', '--ascii', '--borderPadding', '1.5']),
    ).toThrow('--borderPadding requires a non-negative integer, got: "1.5"')
  })

  it('throws when -w is last argument with no value', () => {
    expect(() => parseArgs(['render', 'diagram.mmd', '--ascii', '-w'])).toThrow(
      '-w requires a value ("auto" or a positive integer)',
    )
  })

  it('throws when --max-width is zero', () => {
    expect(() =>
      parseArgs(['render', 'diagram.mmd', '--ascii', '--max-width', '0']),
    ).toThrow('--max-width requires "auto" or a positive integer, got: "0"')
  })

  it('throws when --max-width is not numeric or "auto"', () => {
    expect(() =>
      parseArgs(['render', 'diagram.mmd', '--ascii', '--max-width', 'wide']),
    ).toThrow('--max-width requires "auto" or a positive integer, got: "wide"')
  })

  it('throws when --max-width exceeds Number.MAX_SAFE_INTEGER', () => {
    expect(() =>
      parseArgs([
        'render',
        'diagram.mmd',
        '--ascii',
        '--max-width',
        '9'.repeat(400),
      ]),
    ).toThrow(/--max-width requires "auto" or a positive integer, got:/)
  })

  it('throws when --max-width is given without --ascii', () => {
    expect(() =>
      parseArgs([
        'render',
        'diagram.mmd',
        '--svg',
        '-o',
        'out.svg',
        '--max-width',
        '40',
      ]),
    ).toThrow('-w/--max-width requires --ascii')
  })
})

// ============================================================================
// --html
// ============================================================================

describe('parseArgs – --html', () => {
  it('parses --html with an explicit -o path', () => {
    const result = parseArgs([
      'render',
      'diagram.mmd',
      '--html',
      '-o',
      'out.html',
    ]) as RenderArgs
    expect(result.html).toBe(true)
    expect(result.svg).toBe(false)
    expect(result.output).toBe('out.html')
  })

  it('derives <input stem>.html when --html is given with no -o', () => {
    const result = parseArgs(['render', 'diagram.mmd', '--html']) as RenderArgs
    expect(result.html).toBe(true)
    expect(result.output).toBe('diagram.html')
  })

  it('infers --html from a .html extension with no flag', () => {
    const result = parseArgs([
      'render',
      'diagram.mmd',
      '-o',
      'out.html',
    ]) as RenderArgs
    expect(result.html).toBe(true)
    expect(result.svg).toBe(false)
  })

  it('infers --html from a .htm extension with no flag', () => {
    const result = parseArgs([
      'render',
      'diagram.mmd',
      '-o',
      'out.htm',
    ]) as RenderArgs
    expect(result.html).toBe(true)
  })

  it('allows --html -o - to write to stdout', () => {
    const result = parseArgs([
      'render',
      'diagram.mmd',
      '--html',
      '-o',
      '-',
    ]) as RenderArgs
    expect(result.html).toBe(true)
    expect(result.output).toBe('-')
  })

  it('allows --ascii with --html (ascii to stdout, html to file)', () => {
    const result = parseArgs([
      'render',
      'diagram.mmd',
      '--ascii',
      '--html',
      '-o',
      'out.html',
    ]) as RenderArgs
    expect(result.ascii).toBe(true)
    expect(result.html).toBe(true)
  })

  it('throws when --svg and --html are both set', () => {
    expect(() =>
      parseArgs(['render', 'diagram.mmd', '--svg', '--html']),
    ).toThrow('--svg and --html cannot both be set')
  })

  it('throws when -o has a .svg extension but --html was requested', () => {
    expect(() =>
      parseArgs(['render', 'diagram.mmd', '--html', '-o', 'out.svg']),
    ).toThrow('but --html output would be written to it')
  })

  it('throws when -o has an .html extension but --svg was requested', () => {
    expect(() =>
      parseArgs(['render', 'diagram.mmd', '--svg', '-o', 'out.html']),
    ).toThrow('but --svg output would be written to it')
  })

  it('throws when -o has a .txt extension but --html was requested', () => {
    expect(() =>
      parseArgs(['render', 'diagram.mmd', '--html', '-o', 'out.txt']),
    ).toThrow('but --html output would be written to it')
  })

  it('throws when -o - would send both ASCII and HTML to stdout', () => {
    expect(() =>
      parseArgs(['render', 'diagram.mmd', '--ascii', '--html', '-o', '-']),
    ).toThrow('-o - would send both ASCII and HTML to stdout')
  })

  it('throws when --html is given for stdin input with no -o', () => {
    expect(() => parseArgs(['render', '--html'])).toThrow(
      '--html needs -o <path> (or -o - for stdout) when reading from stdin',
    )
  })
})
