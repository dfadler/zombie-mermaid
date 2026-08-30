// ============================================================================
// zombie-mermaid CLI — argument parser
//
// Zero dependencies, hand-rolled — kept consistent with the library's own
// "no external dependencies" philosophy.
// ============================================================================

// ============================================================================
// Types
// ============================================================================

export interface RenderArgs {
  command: 'render'
  input: string | undefined
  ascii: boolean
  svg: boolean
  output: string | undefined
  theme: string | undefined
  paddingX: number | undefined
  paddingY: number | undefined
  borderPadding: number | undefined
}

export interface SimpleCommand {
  command: 'themes' | 'help' | 'version'
}

export type CliArgs = RenderArgs | SimpleCommand

// ============================================================================
// Parser
// ============================================================================

export function parseArgs(argv: string[]): CliArgs {
  const [first, ...rest] = argv

  // Empty args → help
  if (first === undefined) {
    return { command: 'help' }
  }

  // Top-level flags (before any command)
  if (first === '--help' || first === '-h') {
    return { command: 'help' }
  }
  if (first === '--version' || first === '-v') {
    return { command: 'version' }
  }

  // Simple commands
  if (first === 'themes') {
    return { command: 'themes' }
  }

  // Render command
  if (first === 'render') {
    return parseRender(rest)
  }

  throw new Error(`Unknown command: ${first}`)
}

// ============================================================================
// render sub-parser
// ============================================================================

/** Parse a numeric flag's value, throwing a clear error if it's missing or invalid. */
function parseNonNegativeIntFlag(
  args: string[],
  i: number,
  flag: string,
): number {
  const raw = args[i + 1]
  if (i + 1 >= args.length || raw === undefined) {
    throw new Error(`${flag} requires a numeric value`)
  }
  if (!/^\d+$/.test(raw)) {
    throw new Error(`${flag} requires a non-negative integer, got: "${raw}"`)
  }
  return Number(raw)
}

function parseRender(args: string[]): RenderArgs {
  let input: string | undefined
  let ascii = false
  let svg = false
  let output: string | undefined
  let theme: string | undefined
  let paddingX: number | undefined
  let paddingY: number | undefined
  let borderPadding: number | undefined

  let i = 0
  while (i < args.length) {
    const arg = args[i]
    // `i < args.length` (the loop condition) guarantees this is defined —
    // but that's bounds-vs-loop-variable reasoning the type checker can't
    // verify, so guard explicitly rather than asserting past it.
    if (arg === undefined) {
      throw new Error(
        `parseArgs: index ${i} out of range while parsing arguments`,
      )
    }

    if (arg === '--ascii') {
      ascii = true
      i++
    } else if (arg === '--svg') {
      svg = true
      i++
    } else if (arg === '-o' || arg === '--output') {
      if (i + 1 >= args.length) throw new Error('-o requires a file path')
      output = args[i + 1]
      i += 2
    } else if (arg === '--theme') {
      if (i + 1 >= args.length) throw new Error('--theme requires a theme name')
      theme = args[i + 1]
      i += 2
    } else if (arg === '-x' || arg === '--paddingX') {
      paddingX = parseNonNegativeIntFlag(args, i, arg)
      i += 2
    } else if (arg === '-y' || arg === '--paddingY') {
      paddingY = parseNonNegativeIntFlag(args, i, arg)
      i += 2
    } else if (arg === '-p' || arg === '--borderPadding') {
      borderPadding = parseNonNegativeIntFlag(args, i, arg)
      i += 2
    } else if (!arg.startsWith('-')) {
      // Positional argument = input file
      if (input !== undefined) {
        throw new Error(
          `Unexpected argument: ${arg} (input file already set to "${input}")`,
        )
      }
      input = arg
      i++
    } else {
      throw new Error(`Unknown flag: ${arg}`)
    }
  }

  // Validation
  if (!ascii && !svg) {
    throw new Error('Specify --ascii and/or --svg -o <path>')
  }

  if (svg && output === undefined) {
    throw new Error('--svg requires -o <path>')
  }

  return {
    command: 'render',
    input,
    ascii,
    svg,
    output,
    theme,
    paddingX,
    paddingY,
    borderPadding,
  }
}
