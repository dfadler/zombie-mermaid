// ============================================================================
// `json Name @ { ... }` bodies of a use case diagram
//
// Mermaid keeps the key order the source gave (a JS object would hoist integer
// keys), and flattens the value to the rows of a key/value table: a nested key
// is a dotted path, an array of scalars one row per item (the path on the
// first), an array of objects `path[0].key`, an empty array `[]`, an empty
// object `{}`.
// ============================================================================

type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { keys: string[]; values: Map<string, Json> }

const MAX_DEPTH = 100
const NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/

/** Index just past the `{ … }` object starting at `from` (strings may hold braces), or -1 when it never closes. */
export function jsonObjectEnd(text: string, from: number): number {
  let depth = 0
  let quoted = false
  for (let i = from; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '\\') i++
      else if (c === '"') quoted = false
    } else if (c === '"') quoted = true
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) return i + 1
  }
  return -1
}

class JsonError extends Error {}

function parseValue(s: string, at: { i: number }, depth: number): Json {
  if (depth > MAX_DEPTH) throw new JsonError('nested too deeply')
  const skip = (): void => {
    while (at.i < s.length && /\s/.test(s[at.i]!)) at.i++
  }
  const expect = (c: string): void => {
    skip()
    if (s[at.i] !== c)
      throw new JsonError(`expected '${c}' at position ${at.i}`)
    at.i++
  }
  const str = (): string => {
    const start = at.i
    at.i++
    while (at.i < s.length && s[at.i] !== '"') at.i += s[at.i] === '\\' ? 2 : 1
    if (at.i >= s.length) throw new JsonError('unterminated string')
    at.i++
    try {
      return JSON.parse(s.slice(start, at.i)) as string
    } catch {
      throw new JsonError(`bad string at position ${start}`)
    }
  }
  skip()
  const c = s[at.i]
  if (c === '{') {
    at.i++
    const keys: string[] = []
    const values = new Map<string, Json>()
    skip()
    if (s[at.i] === '}') at.i++
    else
      for (;;) {
        skip()
        if (s[at.i] !== '"')
          throw new JsonError(`expected a key at position ${at.i}`)
        const key = str()
        expect(':')
        const value = parseValue(s, at, depth + 1)
        // A repeated key keeps the last value, in the last position.
        if (values.has(key)) keys.splice(keys.indexOf(key), 1)
        keys.push(key)
        values.set(key, value)
        skip()
        if (s[at.i] === ',') at.i++
        else {
          expect('}')
          break
        }
      }
    return { keys, values }
  }
  if (c === '[') {
    at.i++
    const items: Json[] = []
    skip()
    if (s[at.i] === ']') at.i++
    else
      for (;;) {
        items.push(parseValue(s, at, depth + 1))
        skip()
        if (s[at.i] === ',') at.i++
        else {
          expect(']')
          break
        }
      }
    return items
  }
  if (c === '"') return str()
  let end = at.i
  while (end < s.length && /[\w.+-]/.test(s[end]!)) end++
  const word = s.slice(at.i, end)
  at.i = end
  if (word === 'true') return true
  if (word === 'false') return false
  if (word === 'null') return null
  if (NUMBER.test(word)) return Number(word)
  throw new JsonError(`unexpected '${word || (s[at.i] ?? 'end')}'`)
}

const scalar = (v: Json): v is string | number | boolean | null =>
  v === null || typeof v !== 'object'
const show = (v: string | number | boolean | null): string =>
  v === null ? 'null' : String(v)

/** The table rows of the `{ … }` text, or the reason it is not a JSON object. */
export function jsonRows(
  text: string,
): Array<{ key: string; value: string }> | string {
  let root: Json
  const at = { i: 0 }
  try {
    root = parseValue(text, at, 0)
    while (at.i < text.length && /\s/.test(text[at.i]!)) at.i++
    if (at.i < text.length) throw new JsonError(`unexpected input at ${at.i}`)
  } catch (e) {
    return `Invalid JSON: ${(e as Error).message}`
  }
  if (scalar(root) || Array.isArray(root))
    return 'JSON value must have an object root'
  const rows: Array<{ key: string; value: string }> = []
  const visit = (v: Json, path: string): void => {
    if (Array.isArray(v)) {
      if (v.length === 0) rows.push({ key: path, value: '[]' })
      else if (v.every(scalar))
        v.forEach((x, i) =>
          rows.push({ key: i === 0 ? path : '', value: show(x as never) }),
        )
      else v.forEach((x, i) => visit(x, `${path}[${i}]`))
    } else if (scalar(v)) rows.push({ key: path, value: show(v) })
    else if (v.keys.length === 0) rows.push({ key: path, value: '{}' })
    else
      for (const k of v.keys) visit(v.values.get(k)!, path ? `${path}.${k}` : k)
  }
  visit(root, '')
  return rows
}
