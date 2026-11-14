import { MermaidParseError } from '@zombie-mermaid/core'
import type {
  EventModeling,
  EventModelingDataBlock,
  EventModelingEntityType,
  EventModelingFrame,
} from './types.ts'

// ============================================================================
// Event modeling parser
//
// A port of Mermaid's langium grammar (mermaid-js/mermaid packages/parser/src/
// language/eventmodeling/eventmodeling.langium) and the diagram database
// (packages/mermaid/src/diagrams/eventmodeling/db.ts), read from
// @mermaid-js/parser 2.0.1 and mermaid 12.3.0:
//
//   eventmodeling
//   tf|timeframe|rf|resetframe <1-3 digits> <type> <Identifier>
//       [->> <digits>]* [[[ <DataName> ]]] [`json`]{ inline } | "inline" | 'inline'
//   data <Name> [`json`]{
//     block
//   }
//   entity <Identifier>            parsed, drawn nowhere
//   note <digits> { block }        parsed, drawn nowhere
//   gwt <digits> given <type> <Name>... [when ...] then ...   parsed, drawn nowhere
//
// Rules taken from Mermaid:
//   - Whitespace (newlines too) is not significant between tokens; `%%` and
//     `//` line comments, `/* */` comments, `%%{ }%%` directives and front
//     matter are skipped. Keywords are case-sensitive, and there is no
//     `title`, `accTitle` or `accDescr`: they are syntax errors there.
//   - A frame number is 1-3 digits and its text is its identity: a repeated
//     number is "Duplicate event modeling frame ID".
//   - Mermaid reports no error for `->>` to an unknown frame (the arrow is
//     left out), for a source of the wrong kind, or for `[[Name]]` with no
//     such `data` block (nothing is drawn). Neither does this parser.
//   - An identifier with exactly one `.` splits into a namespace and a name.
// ============================================================================

const ENTITY_TYPES: Record<string, EventModelingEntityType> = {
  ui: 'ui',
  pcr: 'processor',
  processor: 'processor',
  cmd: 'command',
  command: 'command',
  rmo: 'readmodel',
  readmodel: 'readmodel',
  evt: 'event',
  event: 'event',
}
const DATA_TYPES = new Set([
  'json',
  'jsobj',
  'figma',
  'salt',
  'uri',
  'md',
  'html',
  'text',
])

const SKIP = /(?:\s+|%%[^\n\r]*|\/\/[^\n\r]*|\/\*[\s\S]*?\*\/)+/y
const FRONT_MATTER = /^\s*---[\t ]*\r?\n(?:[\s\S]*?\r?\n)?---[\t ]*(?:\r?\n|$)/
const DIRECTIVE = /%%\{[\s\S]*?\}%%/g
const FRAME_KEYWORD = /(tf|timeframe|rf|resetframe)(?!\w)/y
const FRAME_ID = /\d{1,3}(?!\d)/y
const ENTITY_TYPE =
  /(ui|pcr|processor|cmd|command|rmo|readmodel|evt|event)(?!\w)/y
const IDENTIFIER = /[_a-zA-Z]\w*(?:\.[_a-zA-Z]\w*)*/y
const NAME = /[_a-zA-Z]\w*/y
const DATA_TYPE = /`(\w+)`/y
const DATA_INLINE = /\{.*\}|".*"|'.*'/y
const DATA_BLOCK = /\{[\t ]*\r?\n(?:[\s\S]*?\r?\n)?\}(?:\r?\n|(?!\S))/y

/** Parse Mermaid `eventmodeling` source into a typed {@link EventModeling}. */
export function parseEventModeling(text: string): EventModeling {
  const src = text
    .replace(/\r\n?/g, '\n')
    .replace(FRONT_MATTER, (m) => m.replace(/[^\n]/g, ''))
    // Directives go before lexing; their newlines stay so line numbers match.
    .replace(DIRECTIVE, (d) => d.replace(/[^\n]/g, ''))

  let pos = 0
  const lineAt = (at: number): number => {
    let n = 1
    for (let i = 0; i < at && i < src.length; i++)
      if (src.charCodeAt(i) === 10) n++
    return n
  }
  const fail = (msg: string, at = pos): never => {
    throw new MermaidParseError(`Line ${lineAt(at)}: ${msg}`, {
      diagramType: 'eventmodeling',
    })
  }
  const skip = (): void => {
    SKIP.lastIndex = pos
    const m = SKIP.exec(src)
    if (m) pos += m[0].length
  }
  /** Match `re` (sticky) at the next token; returns the matched text. */
  const take = (re: RegExp): string | undefined => {
    skip()
    re.lastIndex = pos
    const m = re.exec(src)
    if (!m) return undefined
    pos += m[0].length
    return m[0]
  }
  const need = (re: RegExp, what: string): string =>
    take(re) ?? fail(`Expected ${what}, found "${near()}"`)
  const near = (): string => src.slice(pos, pos + 20).split('\n')[0] ?? ''
  const punct = (p: string): boolean => {
    skip()
    if (!src.startsWith(p, pos)) return false
    pos += p.length
    return true
  }

  if (take(/eventmodeling(?!\w)/y) === undefined)
    fail(`Expected the "eventmodeling" header, found "${near()}"`)

  const frames: EventModelingFrame[] = []
  const rawSources: string[][] = []
  const dataBlocks: EventModelingDataBlock[] = []
  const seen = new Set<string>()

  const optionalDataType = (): void => {
    const t = take(DATA_TYPE)
    if (t !== undefined && !DATA_TYPES.has(t.slice(1, -1)))
      fail(`Unknown data type ${t}`)
  }

  for (;;) {
    skip()
    if (pos >= src.length) break
    const at = pos
    const kw = take(FRAME_KEYWORD)
    if (kw !== undefined) {
      const id = need(FRAME_ID, 'a frame number (1-3 digits)')
      const typeWord = need(ENTITY_TYPE, 'ui, pcr, cmd, rmo or evt')
      const identifier = need(IDENTIFIER, 'an identifier')
      const refs: string[] = []
      while (punct('->>')) refs.push(need(FRAME_ID, 'a frame number'))
      let dataRef: string | undefined
      if (punct('[[')) {
        dataRef = need(NAME, 'a data block name')
        if (!punct(']]')) fail(`Expected "]]", found "${near()}"`)
      }
      const save = pos
      optionalDataType()
      const dataInline = take(DATA_INLINE)
      if (dataInline === undefined) pos = save
      if (seen.has(id)) fail(`Duplicate event modeling frame ID "${id}"`, at)
      seen.add(id)
      const parts = identifier.split('.')
      const frame: EventModelingFrame = {
        id,
        reset: kw === 'rf' || kw === 'resetframe',
        entityType: ENTITY_TYPES[typeWord]!,
        identifier,
        name: parts.length === 2 ? parts[1]! : identifier,
        sources: [],
      }
      if (parts.length === 2) frame.namespace = parts[0]!
      if (dataRef !== undefined) frame.dataRef = dataRef
      if (dataInline !== undefined) frame.dataInline = dataInline
      frames.push(frame)
      rawSources.push(refs)
      continue
    }
    if (take(/data(?!\w)/y) !== undefined) {
      const name = need(NAME, 'a data block name')
      optionalDataType()
      dataBlocks.push({
        name,
        value: need(DATA_BLOCK, 'a data block ("{" then a line break)'),
      })
      continue
    }
    if (take(/entity(?!\w)/y) !== undefined) {
      need(IDENTIFIER, 'an entity identifier')
      continue
    }
    if (take(/note(?!\w)/y) !== undefined) {
      need(FRAME_ID, 'a frame number')
      optionalDataType()
      need(DATA_BLOCK, 'a data block ("{" then a line break)')
      continue
    }
    if (take(/gwt(?!\w)/y) !== undefined) {
      need(FRAME_ID, 'a frame number')
      const statements = (word: string): void => {
        need(new RegExp(`${word}(?!\\w)`, 'y'), `"${word}"`)
        do {
          need(ENTITY_TYPE, 'ui, pcr, cmd, rmo or evt')
          need(NAME, 'a name')
          skip()
        } while (ENTITY_TYPE_AHEAD.test(src.slice(pos, pos + 12)))
      }
      statements('given')
      skip()
      if (/^when(?!\w)/.test(src.slice(pos, pos + 5))) statements('when')
      statements('then')
      continue
    }
    fail(`Unexpected "${near()}"`)
  }

  const ids = new Set(frames.map((f) => f.id))
  frames.forEach((f, i) => {
    f.sources = [...new Set(rawSources[i]!)].filter((id) => ids.has(id))
  })
  return { frames, dataBlocks }
}

/** A `gwt` statement list continues while an entity keyword follows. */
const ENTITY_TYPE_AHEAD =
  /^(?:ui|pcr|processor|cmd|command|rmo|readmodel|evt|event)(?!\w)/
