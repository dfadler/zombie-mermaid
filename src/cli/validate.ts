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
  let raw: string
  if (args.input !== undefined) {
    raw = await readFile(args.input, 'utf-8')
  } else if (stdinContent !== undefined) {
    raw = stdinContent
  } else {
    if (process.stdin.isTTY) {
      throw new Error(
        'No input file specified and stdin is a terminal. Pipe a diagram or pass a file path.',
      )
    }
    raw = await readStdin()
  }
  // Validate the untrimmed source so parser "Line N" numbers match the file.
  const text = raw
  if (text.trim().length === 0) {
    throw new Error('Empty input — provide a Mermaid diagram via file or stdin')
  }
  try {
    validateMermaid(text)
  } catch (e) {
    throw withSourceLine(e, text)
  }
  console.log('valid')
}
