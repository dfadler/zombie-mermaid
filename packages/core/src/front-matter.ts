// Mermaid's leading YAML front matter (`---` ... `---`), removed once at the
// shared entry (`splitStatementsByLine`, `extractAccessibility`) so no diagram
// type sees it. Mermaid accepts it on every diagram type, as does GitHub.
//
// `config:` becomes the `%%{init}%%` directive we already parse, so it honours
// exactly what init does. `title:` and any other key are ignored: front matter
// has no title slot in the flowchart/sequence/class/ER renderers.
import { MermaidParseError } from './parse-error.ts'

const FENCE = /^---[ \t]*$/

/** Scalar → JSON value: quoted strings, numbers, booleans, else bare string. */
function scalar(raw: string): unknown {
  const v = raw.replace(/\s+#.*$/, '').trim()
  if (/^(["']).*\1$/.test(v)) return v.slice(1, -1)
  if (v === 'true' || v === 'false') return v === 'true'
  if (v !== '' && !Number.isNaN(Number(v))) return Number(v)
  return v
}

/** Indentation-nested `key: value` maps under `config:`; anything else is skipped. */
function configOf(body: string[]): Record<string, unknown> | undefined {
  const root: Record<string, unknown> = {}
  const stack: { indent: number; map: Record<string, unknown> }[] = []
  let inConfig = false
  for (const line of body) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const indent = line.length - line.trimStart().length
    const m = /^([\w-]+)[ \t]*:[ \t]*(.*)$/.exec(t)
    if (indent === 0) {
      inConfig = m?.[1] === 'config'
      stack.length = 0
      if (inConfig) stack.push({ indent: -1, map: root })
      continue
    }
    if (!inConfig || !m) continue
    while (stack.at(-1)!.indent >= indent) stack.pop()
    const [, key, rest] = m
    const parent = stack.at(-1)!.map
    if (rest === '') {
      const child: Record<string, unknown> = {}
      parent[key!] = child
      stack.push({ indent, map: child })
    } else parent[key!] = scalar(rest!)
  }
  return Object.keys(root).length ? root : undefined
}

/**
 * Blank a leading front matter block (line numbers preserved), turning its
 * `config:` into an init directive on the block's first line. Text without
 * front matter is returned as is. An unterminated block throws, pointing at
 * the opening `---`.
 */
export function stripFrontMatter(text: string): string {
  const lines = text.split('\n')
  const open = lines.findIndex((l) => l.trim() !== '')
  if (open === -1 || !FENCE.test(lines[open]!.trimEnd())) return text
  const close = lines.findIndex((l, i) => i > open && FENCE.test(l.trimEnd()))
  if (close === -1) {
    throw new MermaidParseError(
      `Line ${open + 1}: Unterminated front matter: missing closing "---".`,
      { line: open + 1 },
    )
  }
  const config = configOf(lines.slice(open + 1, close))
  const blanked = lines.map((l, i) => (i >= open && i <= close ? '' : l))
  if (config) blanked[open] = `%%{init: ${JSON.stringify(config)}}%%`
  return blanked.join('\n')
}
