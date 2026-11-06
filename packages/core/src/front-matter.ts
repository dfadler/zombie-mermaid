// Mermaid's leading YAML front matter (`---` ... `---`), removed once at the
// shared entry (`splitStatementsByLine`, `extractAccessibility`) so no diagram
// type sees it. Mermaid accepts it on every diagram type, as does GitHub.
//
// `config:` becomes the `%%{init}%%` directive we already parse, so it honours
// exactly what init does. `title:` is read by `readFrontMatterTitle` and drawn
// like mermaid does (`extractAccessibility` routes it); other keys are ignored.
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
 * Index of the closing fence of a leading block, or undefined when there is
 * none. Mermaid's regex is anchored at character 0: a blank line, BOM or
 * comment before the opening `---` is not front matter there either (12.3.0).
 * An unterminated block throws, pointing at the opening `---`.
 */
function blockEnd(lines: string[]): number | undefined {
  if (!FENCE.test(lines[0]!.trimEnd())) return undefined
  const close = lines.findIndex((l, i) => i > 1 && FENCE.test(l.trimEnd()))
  if (close === -1 && FENCE.test((lines[1] ?? '').trimEnd())) return undefined
  if (close === -1) {
    throw new MermaidParseError(
      'Line 1: Unterminated front matter: missing closing "---".',
      { line: 1 },
    )
  }
  return close
}

/** The top-level `title:` of a leading front matter block; empty means none. */
export function readFrontMatterTitle(text: string): string | undefined {
  const lines = text.split('\n')
  const close = blockEnd(lines)
  if (close === undefined) return undefined
  for (const line of lines.slice(1, close)) {
    const m = /^title[ \t]*:(.*)$/.exec(line)
    if (m) {
      const v = String(scalar(m[1]!)).trim()
      return v === '' ? undefined : v
    }
  }
  return undefined
}

/**
 * Blank a leading front matter block (line numbers preserved), turning its
 * `config:` into an init directive on the block's first line. Text without
 * front matter is returned as is. An unterminated block throws, pointing at
 * the opening `---`.
 */
export function stripFrontMatter(text: string): string {
  const lines = text.split('\n')
  const open = 0
  const close = blockEnd(lines)
  if (close === undefined) return text
  const config = configOf(lines.slice(open + 1, close))
  const blanked = lines.map((l, i) => (i >= open && i <= close ? '' : l))
  if (config) blanked[open] = `%%{init: ${JSON.stringify(config)}}%%`
  return blanked.join('\n')
}
