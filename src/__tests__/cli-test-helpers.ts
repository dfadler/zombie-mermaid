import type { RenderArgs } from '../cli/parse-args.ts'

/** Collect all write() calls into a single string. */
export function createMockStdout(): {
  write: (s: string) => void
  output: () => string
} {
  const chunks: string[] = []
  return {
    write: (s: string) => chunks.push(s),
    output: () => chunks.join(''),
  }
}

/** Build a RenderArgs for common test scenarios. */
export function renderArgs(overrides: Partial<RenderArgs> = {}): RenderArgs {
  return {
    command: 'render',
    input: undefined,
    ascii: false,
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
    ...overrides,
  }
}
