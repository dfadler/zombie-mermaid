import { extractInitConfig, MermaidParseError } from '@zombie-mermaid/core'
import { resolvePacketConfig } from './types.ts'
import type { Packet, PacketBlock } from './types.ts'

// ============================================================================
// Packet parser
//
// A port of Mermaid's Langium grammar and packet db (mermaid-js/mermaid
// packages/parser/src/language/packet/packet.langium and
// packages/mermaid/src/diagrams/packet/{parser,db}.ts, mermaid@12.3.0):
//
//   packet | packet-beta
//   title <text>
//   <start>[-<end>]: "<label>"        (also  +<bits>: "<label>")
//
// Rules taken from Mermaid:
//   - The header is case-sensitive; a block may follow it on the same line.
//   - A label is a quoted string, single or double; `\n`, `\t` and the other
//     escapes of Langium's string converter apply (`\q` is `q`).
//   - A block ends its line: two on one line, `;` separators, a bare
//     (unquoted) label and `007`-style numbers are errors.
//   - Blocks must be contiguous from bit 0; `+0` and `end < start` are errors.
//   - `title` may sit between blocks; the last one wins.
//   - Rows hold `bitsPerRow` bits (32); a longer field repeats per row.
//   - At most 10000 rows are kept.
//
// Parsed from the raw text, not `Statement[]`: `;` is not a separator here.
// accTitle/accDescr are stripped by `extractAccessibility` before the
// renderers call this; called directly, they are accepted and ignored.
// ============================================================================

type TokenKind =
  | 'SKIP'
  | 'HEADER'
  | 'TITLE'
  | 'INT'
  | 'STRING'
  | 'NEWLINE'
  | 'DASH'
  | 'PLUS'
  | 'COLON'
  | 'INVALID'

/** Langium's terminal order: keywords, then the grammar's terminals. */
const RULES: ReadonlyArray<readonly [TokenKind, RegExp]> = [
  ['HEADER', /packet(?:-beta)?(?=%%|\s|$)/y],
  [
    'SKIP',
    /[\t ]*accDescr(?:[\t ]*:(?:[^\n\r]*?(?=%%)|[^\n\r]*)|\s*\{[^}]*\})/y,
  ],
  ['SKIP', /[\t ]*accTitle[\t ]*:(?:[^\n\r]*?(?=%%)|[^\n\r]*)/y],
  ['TITLE', /[\t ]*title(?:[\t ][^\n\r]*?(?=%%)|[\t ][^\n\r]*|)/y],
  ['INT', /(?:0|[1-9][0-9]*)(?!\.)/y],
  ['STRING', /"(?:[^"\\]|\\[\s\S])*"|'(?:[^'\\]|\\[\s\S])*'/y],
  ['NEWLINE', /\r?\n/y],
  ['SKIP', /[\t ]+/y],
  ['SKIP', /[\t ]*%%[^\n\r]*/y],
  ['DASH', /-/y],
  ['PLUS', /\+/y],
  ['COLON', /:/y],
  ['INVALID', /[\s\S]/y],
]

const DIRECTIVE = /%%\{[\s\S]*?\}%%/g

/** Mermaid's cap on rows (`maxPacketSize`). */
const MAX_ROWS = 1e4

const ESCAPES: Record<string, string> = {
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
  v: '\v',
  0: '\0',
}

/** Langium's `convertString`: drop the quotes, resolve escapes. */
function unquote(raw: string): string {
  let out = ''
  for (let i = 1; i < raw.length - 1; i++) {
    const c = raw[i]!
    if (c === '\\') {
      const n = raw[++i]!
      out += ESCAPES[n] ?? n
    } else out += c
  }
  return out
}

function lineOf(text: string, pos: number): number {
  let line = 1
  for (let i = 0; i < pos; i++) if (text.charCodeAt(i) === 10) line++
  return line
}

/** Mermaid's `getNextFittingBlock`: the part of `b` in row `row`, and the rest. */
function split(
  b: PacketBlock,
  row: number,
  bitsPerRow: number,
): [PacketBlock, PacketBlock | undefined] {
  if (b.end + 1 <= row * bitsPerRow) return [b, undefined]
  const rowEnd = row * bitsPerRow - 1
  return [
    { start: b.start, end: rowEnd, label: b.label },
    { start: row * bitsPerRow, end: b.end, label: b.label },
  ]
}

/** Parse Mermaid `packet` / `packet-beta` source into a typed {@link Packet}. */
export function parsePacket(text: string): Packet {
  const source = text
    .replace(/\r\n?/g, '\n')
    // Directives are removed by Mermaid before lexing; keep their newlines so
    // error line numbers still match the caller's source.
    .replace(DIRECTIVE, (d) => d.replace(/[^\n]/g, ''))
  const fail = (pos: number, msg: string): never => {
    throw new MermaidParseError(`Line ${lineOf(source, pos)}: ${msg}`, {
      diagramType: 'packet',
    })
  }

  interface Tok {
    kind: TokenKind
    value: string
    at: number
  }
  const toks: Tok[] = []
  for (let pos = 0; pos < source.length;) {
    let kind: TokenKind = 'INVALID'
    let value = ''
    for (const [k, re] of RULES) {
      re.lastIndex = pos
      const m = re.exec(source)
      if (m) {
        kind = k
        value = m[0]
        break
      }
    }
    if (kind !== 'SKIP') toks.push({ kind, value, at: pos })
    pos += value.length
  }

  const packet: Packet = { blocks: [], words: [] }
  let i = 0
  const peek = (): Tok | undefined => toks[i]
  // Newlines before the header, the header itself.
  while (peek()?.kind === 'NEWLINE') i++
  if (peek()?.kind !== 'HEADER') {
    throw new MermaidParseError(
      'Expected the "packet" or "packet-beta" header',
      { diagramType: 'packet' },
    )
  }
  i++

  const describe = (t: Tok | undefined): string =>
    t ? `"${t.value.trim() || t.value}"` : 'the end of the text'
  const expect = (kind: TokenKind, what: string): Tok => {
    const t = peek()
    if (t?.kind !== kind) {
      return fail(
        t?.at ?? source.length,
        `Expected ${what}, found ${describe(t)}`,
      )
    }
    i++
    return t
  }
  const endOfLine = (): void => {
    const t = peek()
    if (t === undefined) return
    if (t.kind !== 'NEWLINE')
      fail(
        t.at,
        `Unexpected ${describe(t)}: a field ends its line (one "<bits>: \\"label\\"" per line, no ";")`,
      )
  }

  while (i < toks.length) {
    const t = toks[i]!
    if (t.kind === 'NEWLINE') {
      i++
      continue
    }
    if (t.kind === 'TITLE') {
      i++
      endOfLine()
      // Everything after `title`, up to a `%%` comment; runs of blanks collapse.
      const body = t.value.replace(/^[\t ]*title/, '').trim()
      const title = body.replace(/[\t ]{2,}/g, ' ')
      if (title) packet.title = title
      else delete packet.title
      continue
    }

    let start: number | undefined
    let end: number | undefined
    let bits: number | undefined
    if (t.kind === 'PLUS') {
      i++
      bits = Number(expect('INT', 'a bit count after "+"').value)
    } else if (t.kind === 'INT') {
      i++
      start = Number(t.value)
      if (peek()?.kind === 'DASH') {
        i++
        end = Number(expect('INT', 'an end bit after "-"').value)
      }
    } else {
      fail(
        t.at,
        `Unexpected ${describe(t)}: a field is "<start>[-<end>]: \\"label\\"" or "+<bits>: \\"label\\""`,
      )
    }
    expect('COLON', '":" after the bit range')
    const label = unquote(
      expect('STRING', 'a quoted label ("..." or \'...\')').value,
    )
    endOfLine()

    // Mermaid's db checks, in its order.
    if (start !== undefined && end !== undefined && end < start) {
      fail(
        t.at,
        `Packet block ${start} - ${end} is invalid. End must be greater than start.`,
      )
    }
    const last = packet.blocks[packet.blocks.length - 1]
    const next = last ? last.end + 1 : 0
    start ??= next
    if (start !== next) {
      fail(
        t.at,
        `Packet block ${start} - ${end ?? start} is not contiguous. It should start from ${next}.`,
      )
    }
    if (bits === 0) {
      fail(
        t.at,
        `Packet block ${start} is invalid. Cannot have a zero bit field.`,
      )
    }
    end ??= start + (bits ?? 1) - 1
    packet.blocks.push({ start, end, label })
  }

  const init = extractInitConfig(text.split(/\r\n?|\n/))
  if (init.packet) packet.config = init.packet

  // Cut into rows, as Mermaid's `populate` does.
  const { bitsPerRow } = resolvePacketConfig(packet.config)
  let word: PacketBlock[] = []
  let row = 1
  for (const b of packet.blocks) {
    let cur: PacketBlock = b
    while (word.length <= bitsPerRow + 1 && packet.words.length < MAX_ROWS) {
      const [part, rest] = split(cur, row, bitsPerRow)
      word.push(part)
      if (part.end + 1 === row * bitsPerRow) {
        packet.words.push(word)
        word = []
        row++
      }
      if (!rest) break
      cur = rest
    }
  }
  if (word.length > 0) packet.words.push(word)
  return packet
}
