// `zombie-mermaid validate [file]`: parse only, render nothing. Prints
// "valid" and exits 0 when the diagram parses; otherwise throws the parser
// error plus the offending source line, and main() exits 1.
import { readFile } from 'node:fs/promises'
import { validateMermaid } from '@zombie-mermaid/svg-renderer'
import { withSourceLine } from './diagnostics.ts'
import { readStdin } from './render.ts'
import type { ValidateArgs } from './parse-args.ts'

export async function runValidate(
  args: ValidateArgs,
  stdinContent?: string,
): Promise<void> {
  const raw =
    args.input !== undefined
      ? await readFile(args.input, 'utf-8')
      : (stdinContent ?? (await readStdin()))
  const text = raw.trim()
  if (text.length === 0) {
    throw new Error('Empty input — provide a Mermaid diagram via file or stdin')
  }
  try {
    validateMermaid(text)
  } catch (e) {
    throw withSourceLine(e, text)
  }
  console.log('valid')
}
