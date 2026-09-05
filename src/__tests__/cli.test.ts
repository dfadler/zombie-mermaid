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
      resolveColors: false,
      output: undefined,
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
      resolveColors: false,
      output: 'out.svg',
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
      resolveColors: false,
      output: 'out.svg',
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
      resolveColors: false,
      output: 'out.svg',
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
      resolveColors: false,
      output: undefined,
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
      resolveColors: false,
      output: 'out.svg',
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
      resolveColors: false,
      output: 'out.svg',
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
      resolveColors: false,
      output: undefined,
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
      resolveColors: false,
      output: undefined,
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
      resolveColors: false,
      output: undefined,
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
      resolveColors: false,
      output: undefined,
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
      resolveColors: false,
      output: undefined,
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

describe('parseArgs – --resolve-colors', () => {
  it('parses render <file> --svg -o out.svg --resolve-colors', () => {
    const args = parseArgs([
      'render',
      'diagram.mmd',
      '--svg',
      '-o',
      'out.svg',
      '--resolve-colors',
    ])
    expect(args.command).toBe('render')
    if (args.command !== 'render') throw new Error('expected render')
    expect(args.resolveColors).toBe(true)
    expect(args.svg).toBe(true)
    expect(args.output).toBe('out.svg')
  })

  it('defaults resolveColors to false', () => {
    const args = parseArgs(['render', 'diagram.mmd', '--svg', '-o', 'out.svg'])
    if (args.command !== 'render') throw new Error('expected render')
    expect(args.resolveColors).toBe(false)
  })

  it('throws when --resolve-colors is given without --svg', () => {
    expect(() =>
      parseArgs(['render', 'diagram.mmd', '--ascii', '--resolve-colors']),
    ).toThrow('--resolve-colors requires --svg')
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
  it('throws when render has --svg but no -o', () => {
    expect(() => parseArgs(['render', 'diagram.mmd', '--svg'])).toThrow(
      '--svg requires -o <path>',
    )
  })

  it('throws when render has no output flags', () => {
    expect(() => parseArgs(['render', 'diagram.mmd'])).toThrow(
      'Specify --ascii and/or --svg -o <path>',
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
