// `zombie-mermaid --check <file.md>...` (#1876): validate every ```mermaid
// fenced block in Markdown files. Parse only; reuses the line-level
// diagnostics from #1174/#1691. Reports `file:line: message` where `line` is
// the physical line in the Markdown file; exits 1 (via throw) if any block is
// invalid.
import { readFile } from 'node:fs/promises'
import { validateMermaid } from '@zombie-mermaid/svg-renderer'
import { extractParseDiagnostic } from '../../packages/mcp/src/tools/parse-diagnostics.ts'
import type { CheckArgs } from './parse-args.ts'

export interface MermaidBlock {
  /** 1-based file line of the first line inside the fence. */
  startLine: number
  source: string
}

const OPEN = /^ {0,3}(`{3,}|~{3,})\s*mermaid\b[^`]*$/i

/** Extract ```mermaid / ~~~mermaid fenced blocks (CommonMark fence rules, no nesting). */
export function extractMermaidBlocks(markdown: string): MermaidBlock[] {
  const lines = markdown.split(/\r?\n/)
  const blocks: MermaidBlock[] = []
  for (let i = 0; i < lines.length; i++) {
    const m = OPEN.exec(lines[i]!)
    if (!m) continue
    const fence = m[1]!
    const close = new RegExp(`^ {0,3}${fence[0]}{${fence.length},}\\s*$`)
    const body: string[] = []
    let j = i + 1
    while (j < lines.length && !close.test(lines[j]!)) body.push(lines[j++]!)
    blocks.push({ startLine: i + 2, source: body.join('\n') })
    i = j
  }
  return blocks
}

export async function runCheck(args: CheckArgs): Promise<void> {
  let failures = 0
  let total = 0
  for (const file of args.files) {
    const md = await readFile(file, 'utf-8')
    for (const block of extractMermaidBlocks(md)) {
      total++
      try {
        validateMermaid(block.source)
      } catch (e) {
        failures++
        const d = extractParseDiagnostic(e, block.source)
        const line = block.startLine + (d ? d.line - 1 : 0)
        const message = d ? d.message : e instanceof Error ? e.message : String(e)
        console.error(`${file}:${line}: ${message}`)
        if (d) console.error(`  ${line} | ${d.sourceLine}`)
      }
    }
  }
  if (failures > 0) {
    throw new Error(`${failures} of ${total} Mermaid block(s) invalid`)
  }
  console.log(`${total} Mermaid block(s) valid`)
}
