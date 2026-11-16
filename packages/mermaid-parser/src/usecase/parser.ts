import {
  MermaidParseError,
  parseStyleProps,
  stripFrontMatter,
} from '@zombie-mermaid/core'
import { jsonObjectEnd, jsonRows } from './json.ts'
import type {
  UsecaseClassDef,
  UsecaseActor,
  UsecaseBoundary,
  UsecaseCase,
  UsecaseDiagram,
  UsecaseDirection,
  UsecaseJson,
  UsecaseNote,
  UsecaseRelationship,
} from './types.ts'

// ============================================================================
// Use case diagram parser
//
// A line-oriented port of Mermaid's Chevrotain grammar and database (mermaid
// `diagrams/usecase/`, checked against 12.3.0, header `usecase-beta`):
//
//   usecase-beta
//   direction LR
//   actor A, B(Label), "Quoted name"
//   systemBoundary S(Title)  …  end        (actors and use cases, one per line)
//   Name   Name(Label)   Name[Label]   "Quoted"      (a use case)
//   A --> B   A <-- B   A -- B   A -- label --> B   A --"label"--> B
//   A ..> : include B   A ..> : extend B   A --|> B
//   note for A "text"
//
// Rules taken from Mermaid:
//   - A statement is one line: a second arrow, `;` or a trailing `%%` comment
//     is an error. Only whole-line `%%` comments exist.
//   - An element is a use case unless an `actor` statement declares it, even
//     after a relationship named it; a line of its own declaring a use case
//     first makes `actor` an error, as is a second label for it.
//   - A quoted name is the element's label; its id is the text with every
//     non-word character replaced by `_`.
//   - `include` / `extend` join two use cases, `--|>` two actors or two use
//     cases; any other pair is an error.
//   - `Name[Label]` is a rectangle, everything else an ellipse.
//   - `TD` is `TB`.
//
// Also read: `<<stereotype>>` and `:::class` after a name, `classDef` / `class`
// / `style`, `--o` / `--x` / `o--` / `x--` markers, `id@` edge ids, markdown
// strings (backticks dropped), `@{ key: value }` metadata after a name (or as
// a `Name@{ … }` line for a name declared elsewhere; it may span lines) and
// `json Name @ { … }` nodes, which only association lines may join.
// ============================================================================

const RESERVED = new Set([
  'actor',
  'systemBoundary',
  'end',
  'direction',
  'TD',
  'TB',
  'BT',
  'LR',
  'RL',
  'note',
  'for',
  'json',
  'classDef',
  'class',
  'style',
  'true',
  'false',
])
const isReserved = (id: string): boolean =>
  RESERVED.has(id) || /^(?:include|extend)$/i.test(id)

interface Prop {
  key: string
  value: string | boolean
  line: number
}

/**
 * Index of the first `@{` at or after `from` that is outside a quoted label, or
 * -1. A quote opens a string only after a non-word character, so the apostrophe
 * of an unquoted label such as `Clerk's desk` is not one.
 */
function metaStart(s: string, from = 0): number {
  let quoted = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!
    if (quoted) {
      if (c === quoted) quoted = ''
    } else if ((c === '"' || c === "'") && !/\w/.test(s[i - 1] ?? ' '))
      quoted = c
    else if (c === '@' && s[i + 1] === '{' && i >= from) return i
  }
  return -1
}

/** Index of the `}` closing a `@{` body that starts at `from` (strings may hold it), or -1. */
function metaEnd(s: string, from: number): number {
  let quoted = ''
  for (let i = from; i < s.length; i++) {
    const c = s[i]!
    if (quoted) {
      if (c === quoted) quoted = ''
    } else if (c === '"' || c === "'") quoted = c
    else if (c === '}') return i
  }
  return -1
}

/** `key: value` pairs of a metadata body, separated by commas or line breaks; `null` when one is malformed. */
function metaProps(body: string, line: number): Prop[] | null {
  const parts: string[] = []
  let quoted = ''
  let from = 0
  for (let i = 0; i <= body.length; i++) {
    const c = body[i]
    if (quoted) {
      if (c === quoted) quoted = ''
    } else if (c === '"' || c === "'") quoted = c
    else if (c === ',' || c === '\n' || i === body.length) {
      parts.push(body.slice(from, i).trim())
      from = i + 1
    }
  }
  const props: Prop[] = []
  for (const part of parts) {
    if (part === '') continue
    const m = /^(\w+|"[^"]*"|'[^']*')\s*:\s*(\w+|"[^"]*"|'[^']*')$/.exec(part)
    if (!m) return null
    const bare = (x: string): string => (/^["']/.test(x) ? x.slice(1, -1) : x)
    props.push({
      key: bare(m[1]!),
      value: m[2] === 'true' ? true : m[2] === 'false' ? false : bare(m[2]!),
      line,
    })
  }
  return props
}

interface Entity {
  id: string
  label: string
  explicit: boolean
  shape: 'ellipse' | 'rect'
  stereotype?: string
  classes?: string[]
  meta?: Prop[]
}

interface Element {
  kind: 'actor' | 'usecase'
  id: string
  label: string
  explicit: boolean
  shape: 'ellipse' | 'rect'
  stereotype?: string
  classes: string[]
  styles: string[]
  line: number
  /** `@{ … }` of the declarations, in source order; applied once every element's kind is final. */
  decl: Prop[]
  parentId?: string
  /** Only named in a relationship so far: an `actor` statement can still claim it. */
  weak: boolean
}

export function parseUsecase(source: string): UsecaseDiagram {
  const lines = stripFrontMatter(source).split(/\r\n?|\n/)
  let n = 0
  const fail = (message: string): never => {
    throw new MermaidParseError(`Line ${n}: ${message}`, {
      line: n,
      diagramType: 'usecase',
    })
  }

  const elements = new Map<string, Element>()
  const boundaries = new Map<string, UsecaseBoundary>()
  const jsons = new Map<string, UsecaseJson>()
  const boundaryPackage = new Set<string>()
  const assignments: Array<{ id: string; line: number; props: Prop[] }> = []
  const relationships: UsecaseRelationship[] = []
  const relationLines: number[] = []
  // `json` names are known up front: a line may join one before its statement.
  const jsonIds = new Set<string>()
  let inAcc = false // An `accDescr { … }` block holds free text.
  for (const raw of lines) {
    if (inAcc) {
      inAcc = !raw.includes('}')
      continue
    }
    if (/^\s*accDescr\s*\{/.test(raw)) {
      inAcc = !raw.includes('}')
      continue
    }
    const j = /^\s*json[\t ]+(\w+)[\t ]*@/.exec(raw)
    if (j) jsonIds.add(j[1]!)
  }
  const notes: Array<UsecaseNote & { line: number }> = []
  let direction: UsecaseDirection = 'LR'
  let boundary: UsecaseBoundary | undefined
  let sawHeader = false
  let accBlock = false

  // A quoted string's body; a markdown string (`"`**x**`"`) loses its backticks.
  const stringBody = (s: string): string | undefined => {
    if (!/^(?:"[^"\r\n]*"|'[^'\r\n]*')$/.test(s)) return undefined
    const body = s.slice(1, -1)
    return /^`[^`]*`$/.test(body) ? body.slice(1, -1) : body
  }
  const idOf = (text: string): string => text.replace(/\W/g, '_')

  /** The entity at the start of `s` (with its `<<stereotype>>` and `:::class`) and the text after it. */
  const entity = (
    s: string,
    allowBracket: boolean,
  ): { ent: Entity; rest: string } => {
    const r = bareEntity(s, allowBracket)
    if (r.rest.startsWith('@{')) {
      // A body left open was joined with the lines after it, so `}` is there.
      const end = metaEnd(r.rest, 2)
      const props = metaProps(r.rest.slice(2, end), n)
      if (!props) return fail("Invalid '@{ … }' metadata")
      r.ent.meta = props
      r.rest = r.rest.slice(end + 1).trim()
    }
    const st = /^<<([^<>]*)>>/.exec(r.rest)
    if (st) {
      r.ent.stereotype = st[1]!.trim()
      r.rest = r.rest.slice(st[0].length).trim()
    }
    const cl = /^:::([\w-]+)/.exec(r.rest)
    if (cl) {
      r.ent.classes = [cl[1]!]
      r.rest = r.rest.slice(cl[0].length).trim()
    }
    return r
  }

  const bareEntity = (
    s: string,
    allowBracket: boolean,
  ): { ent: Entity; rest: string } => {
    const quoted = /^(?:"[^"\r\n]*"|'[^'\r\n]*')/.exec(s)
    if (quoted) {
      const label = quoted[0].slice(1, -1)
      return {
        ent: { id: idOf(label), label, explicit: true, shape: 'ellipse' },
        rest: s.slice(quoted[0].length).trim(),
      }
    }
    const m = /^(\w+)/.exec(s)
    if (!m || isReserved(m[1]!))
      return fail(
        m ? `'${m[1]}' is a keyword, not a name` : `Expected a name at '${s}'`,
      )
    const id = m[1]!
    let rest = s.slice(id.length)
    const group = /^\s*(\(|\[)/.exec(rest)
    if (!group)
      return {
        ent: { id, label: id, explicit: false, shape: 'ellipse' },
        rest: rest.trim(),
      }
    const open = group[1]!
    if (open === '[' && !allowBracket)
      return fail(`Unexpected '[' after an actor`)
    const close = open === '(' ? ')' : ']'
    const from = group[0].length
    const end = rest.indexOf(close, from)
    const inner = end < 0 ? '' : rest.slice(from, end).trim()
    if (end < 0 || inner === '' || /[()[\]{}]/.test(stringBody(inner) ?? inner))
      return fail(`Invalid label after '${id}'`)
    rest = rest.slice(end + 1)
    return {
      ent: {
        id,
        label: stringBody(inner) ?? inner,
        explicit: true,
        shape: open === '[' ? 'rect' : 'ellipse',
      },
      rest: rest.trim(),
    }
  }

  const declare = (
    wanted: Element['kind'] | 'ref' | 'weak',
    e: Entity,
  ): Element => {
    const prev = elements.get(e.id)
    // A name used without `actor` refers to an existing element, else is a use case.
    const kind =
      wanted === 'ref' || wanted === 'weak' ? (prev?.kind ?? 'usecase') : wanted
    if (boundaries.has(e.id)) fail(`ID '${e.id}' is already a system boundary`)
    if (jsonIds.has(e.id)) fail(`ID '${e.id}' is already a json node`)
    const meta = (el: Element): void => {
      el.decl.push(...(e.meta ?? []))
      if (e.stereotype !== undefined) el.stereotype = e.stereotype
      for (const c of e.classes ?? [])
        if (!el.classes.includes(c)) el.classes.push(c)
    }
    if (!prev) {
      const { classes: _c, meta: _m, ...own } = e
      const el: Element = {
        kind,
        ...own,
        classes: [],
        styles: [],
        line: n,
        decl: [],
        weak: wanted === 'weak',
      }
      meta(el)
      if (boundary) el.parentId = boundary.id
      elements.set(e.id, el)
      if (boundary) boundary.members.push(e.id)
      return el
    }
    meta(prev)
    if (prev.weak && wanted === 'actor') {
      prev.kind = 'actor'
      prev.weak = false
    } else if (wanted !== 'weak') prev.weak = false
    if (prev.kind !== kind)
      fail(`ID '${e.id}' is declared as both ${prev.kind} and ${kind}`)
    if (
      prev.explicit &&
      e.explicit &&
      (prev.label !== e.label || prev.shape !== e.shape)
    )
      fail(`ID '${e.id}' has conflicting labels`)
    if (e.explicit && !prev.explicit) {
      prev.label = e.label
      prev.shape = e.shape
      prev.explicit = true
    }
    if (boundary) {
      if (prev.parentId !== undefined && prev.parentId !== boundary.id)
        fail(`Element '${e.id}' belongs to more than one system boundary`)
      if (prev.parentId === undefined) {
        prev.parentId = boundary.id
        boundary.members.push(e.id)
      }
    }
    return prev
  }

  /** `-->`-style operator at the start of `s`, with its label, and the text after it. */
  const arrow = (
    s: string,
  ): Pick<UsecaseRelationship, 'type' | 'arrow' | 'label'> & {
    rest: string
  } => {
    let m = /^\.\.>\s*:\s*(include|extend)(?![\w-])/i.exec(s)
    if (m)
      return {
        type: m[1]!.toLowerCase() as 'include' | 'extend',
        arrow: 'forward',
        rest: s.slice(m[0].length).trim(),
      }
    if (s.startsWith('--|>'))
      return {
        type: 'generalization',
        arrow: 'forward',
        rest: s.slice(4).trim(),
      }
    const marker = /^(?:(--+)([ox])|([ox])--+)(?=\s|$)/.exec(s)
    if (marker) {
      const end = marker[2] !== undefined
      const kind = (marker[2] ?? marker[3]) === 'o' ? 'circle' : 'cross'
      return {
        type: 'association',
        arrow:
          `${kind}${end ? 'End' : 'Start'}` as UsecaseRelationship['arrow'],
        rest: s.slice(marker[0].length).trim(),
      }
    }
    const text = String.raw`(?:"[^"\r\n]*"|'[^'\r\n]*'|.+?)`
    const labelOf = (raw: string): string =>
      stringBody(raw.trim()) ?? raw.trim()
    if ((m = /^<--+/.exec(s))) {
      const after = s.slice(m[0].length)
      const l = new RegExp(`^\\s*(${text})\\s*--+(?!>)(?=\\s|$|["'\\w])`).exec(
        after,
      )
      if (l)
        return {
          type: 'association',
          arrow: 'backward',
          label: labelOf(l[1]!),
          rest: after.slice(l[0].length).trim(),
        }
      return { type: 'association', arrow: 'backward', rest: after.trim() }
    }
    if ((m = /^--+>/.exec(s)))
      return {
        type: 'association',
        arrow: 'forward',
        rest: s.slice(m[0].length).trim(),
      }
    if ((m = /^--+/.exec(s))) {
      const after = s.slice(m[0].length)
      const l = new RegExp(
        `^\\s*(${text})\\s*(--+>|--+[ox](?=\\s|$)|--+)(?=\\s|$|["'\\w])`,
      ).exec(after)
      if (l && !/^\s*$/.test(l[1]!)) {
        const tail = l[2]!.slice(-1)
        return {
          type: 'association',
          arrow:
            tail === '>'
              ? 'forward'
              : tail === 'o'
                ? 'circleEnd'
                : tail === 'x'
                  ? 'crossEnd'
                  : 'none',
          label: labelOf(l[1]!),
          rest: after.slice(l[0].length).trim(),
        }
      }
      return { type: 'association', arrow: 'none', rest: after.trim() }
    }
    return fail(`Unexpected '${s}'`)
  }

  const relate = (from: Entity, text: string): void => {
    const idm = /^(\w+)@(?=-|\.|<)/.exec(text)
    const a = arrow(idm ? text.slice(idm[0].length) : text)
    const to = entity(a.rest, true)
    if (to.rest !== '') fail(`Unexpected '${to.rest}'`)
    // Mermaid: `:::` on a relationship endpoint only applies to a declared node.
    for (const e of [from, to.ent])
      if (e.classes && !elements.has(e.id) && !jsonIds.has(e.id))
        fail(`'${e.id}' uses ::: without being declared`)
    const end = (e: Entity): string =>
      jsonIds.has(e.id) ? e.id : declare('weak', e).id
    const source = end(from)
    const target = end(to.ent)
    const { rest: _rest, ...link } = a
    relationships.push({
      source,
      target,
      ...link,
      ...(idm && { id: idm[1]! }),
    })
    relationLines.push(n)
  }

  const styleList = (s: string): string[] =>
    Object.entries(parseStyleProps(s)).map(([k, v]) => `${k}:${v}`)
  const classDefs: UsecaseClassDef[] = []
  const boundaryMeta = (id: string, p: Prop): void => {
    n = p.line
    if (p.key !== 'type' || (p.value !== 'rect' && p.value !== 'package'))
      fail(`Metadata property '${p.key}' is invalid for boundary '${id}'`)
    if (p.value === 'package') boundaryPackage.add(id)
    else boundaryPackage.delete(id)
  }

  for (let i = 0; i < lines.length; i++) {
    n = i + 1
    let line = lines[i]!.trim()
    if (accBlock) {
      if (line.includes('}')) accBlock = false
      continue
    }
    if (line === '' || line.startsWith('%%')) continue
    if (!sawHeader) {
      if (!/^usecase-beta$/.test(line)) fail("Expected 'usecase-beta'")
      sawHeader = true
      continue
    }
    if (/^accTitle\s*:/.test(line) || /^accDescr\s*:/.test(line)) continue
    if (/^accDescr\s*\{/.test(line)) {
      accBlock = !line.includes('}')
      continue
    }
    // A `@{ … }` body or a json object may run over several lines.
    const open = (t: string): boolean => {
      const j = /^json[\t ]+\w+[\t ]*@[\t ]*(?=\{)/.exec(t)
      if (j) return jsonObjectEnd(t, j[0].length) < 0
      // Every `@{` body on the line must close (an actor list can hold several).
      for (let from = 0; ;) {
        const at = metaStart(t, from)
        if (at < 0) return false
        const end = metaEnd(t, at + 2)
        if (end < 0) return true
        from = end + 1
      }
    }
    while (open(line)) {
      if (i + 1 >= lines.length) return fail("Unclosed '{'")
      line += '\n' + lines[++i]!.trim()
    }

    const js = /^json[\t ]+(\w+)[\t ]*@[\t ]*(?=\{)/.exec(line)
    if (js) {
      const id = js[1]!
      if (boundary) fail("A json node cannot be inside a 'systemBoundary'")
      const end = jsonObjectEnd(line, js[0].length)
      const rows = jsonRows(line.slice(js[0].length, end))
      if (typeof rows === 'string') fail(rows)
      const rest = line.slice(end).trim()
      const cl = /^:::([\w-]+(?:\s*,\s*[\w-]+)*)$/.exec(rest)
      if (rest !== '' && !cl) fail(`Unexpected '${rest}'`)
      if (jsons.has(id)) fail(`ID '${id}' is declared more than once`)
      jsons.set(id, {
        id,
        rows: rows as UsecaseJson['rows'],
        ...(cl && { classes: cl[1]!.split(',').map((x) => x.trim()) }),
      })
      continue
    }
    // `Name@{ … }` on a line of its own sets metadata on a name declared elsewhere.
    const asg = boundary ? null : /^(\w+|"[^"\r\n]*"|'[^'\r\n]*')@\{/.exec(line)
    if (asg) {
      const end = metaEnd(line, asg[0].length)
      const props = metaProps(line.slice(asg[0].length, end), n)
      if (!props) fail("Invalid '@{ … }' metadata")
      if (line.slice(end + 1).trim() !== '')
        fail(`Unexpected '${line.slice(end + 1).trim()}'`)
      assignments.push({
        id: /^["']/.test(asg[1]!) ? idOf(asg[1]!.slice(1, -1)) : asg[1]!,
        line: n,
        props: props!,
      })
      continue
    }

    // Split by hand: a regex over `\s+` runs is polynomial on hostile input.
    const kw = /^(classDef|class|style)\s/.exec(line)
    if (kw) {
      const rest = line.slice(kw[0].length).trim()
      const cut = rest.search(/\s/)
      const head = cut < 0 ? rest : rest.slice(0, cut)
      const tail = cut < 0 ? '' : rest.slice(cut).trim()
      if (kw[1] === 'classDef' && /^[\w-]+$/.test(head) && tail !== '') {
        classDefs.push({ id: head, styles: styleList(tail) })
        continue
      }
      const words = rest.split(/\s+/)
      const ids =
        kw[1] === 'class'
          ? words
              .slice(0, -1)
              .join(' ')
              .split(',')
              .map((x) => x.trim())
          : [head]
      const name = words.at(-1)!
      if (
        kw[1] !== 'classDef' &&
        ids.length > 0 &&
        ids.every((x) => /^\w+$/.test(x)) &&
        (kw[1] === 'style'
          ? tail !== ''
          : words.length > 1 && /^[\w-]+$/.test(name))
      ) {
        for (const id of ids) {
          const el = elements.get(id) ?? jsons.get(id)
          if (!el) fail(`'${id}' is not declared`)
          else if (kw[1] === 'class') {
            el.classes ??= []
            if (!el.classes.includes(name)) el.classes.push(name)
          } else (el.styles ??= []).push(...styleList(tail))
        }
        continue
      }
    }

    const dir = /^direction\s+(TD|TB|BT|LR|RL)$/.exec(line)
    if (dir) {
      direction = dir[1] === 'TD' ? 'TB' : (dir[1] as UsecaseDirection)
      continue
    }
    if (line === 'end') {
      if (!boundary) fail("'end' without a systemBoundary")
      boundary = undefined
      continue
    }
    if (/^systemBoundary(?:\s|$)/.test(line)) {
      if (boundary) fail('System boundaries cannot be nested')
      const { ent, rest } = entity(line.slice(14).trim(), true)
      if (rest !== '') fail(`Unexpected '${rest}'`)
      if (boundaries.has(ent.id) || elements.has(ent.id))
        fail(`ID '${ent.id}' is already declared`)
      if (jsonIds.has(ent.id)) fail(`ID '${ent.id}' is already declared`)
      boundary = { id: ent.id, label: ent.label, members: [] }
      boundaries.set(ent.id, boundary)
      for (const p of ent.meta ?? []) boundaryMeta(ent.id, p)
      continue
    }
    const note = /^note\s+for\s+(\w+)\s+(\S.*)$/.exec(line)
    if (note) {
      notes.push({
        line: n,
        target: note[1]!,
        label: stringBody(note[2]!.trim()) ?? note[2]!.trim(),
      })
      continue
    }
    if (/^actor(?:\s|$)/.test(line)) {
      let rest = line.slice(5).trim()
      const items: Entity[] = []
      for (;;) {
        const r = entity(rest, false)
        items.push(r.ent)
        rest = r.rest
        if (!rest.startsWith(',')) break
        rest = rest.slice(1).trim()
      }
      for (const e of items) declare('actor', e)
      if (rest !== '') {
        if (boundary || items.length > 1) fail(`Unexpected '${rest}'`)
        relate(items[0]!, rest)
      }
      continue
    }
    const first = entity(line, true)
    if (boundary) {
      if (first.rest !== '') fail(`Unexpected '${first.rest}'`)
      declare('ref', first.ent)
    } else if (first.rest === '') declare('ref', first.ent)
    else relate(first.ent, first.rest)
  }
  n = lines.length
  if (!sawHeader) fail("Expected 'usecase-beta'")
  if (boundary)
    fail(`System boundary '${boundary.id}' is not closed with 'end'`)

  // An actor statement may come after the relationship, so the kinds are only final now.
  const kindOf = (id: string): 'actor' | 'usecase' | 'json' =>
    jsonIds.has(id) ? 'json' : elements.get(id)!.kind
  for (const [i, r] of relationships.entries()) {
    n = relationLines[i]!
    const from = kindOf(r.source)
    const to = kindOf(r.target)
    if (
      (r.type === 'include' || r.type === 'extend') &&
      (from !== 'usecase' || to !== 'usecase')
    )
      fail(`${r.type} relationship requires use-case endpoints`)
    if (r.type === 'generalization' && (from !== to || from === 'json'))
      fail(
        'Generalization requires actor-to-actor or use-case-to-use-case endpoints',
      )
    if (
      r.type === 'association' &&
      (from === 'json' || to === 'json') &&
      !['forward', 'backward', 'none'].includes(r.arrow)
    )
      fail(
        `JSON relationship '${r.source}' to '${r.target}' permits only point, reversed-point, or markerless solid association`,
      )
  }

  // `@{ … }`: declarations first (a clash between two is an error), then the
  // `Name@{ … }` lines, which replace.
  interface Meta {
    type?: string
    icon?: string
    business?: boolean
  }
  const metaOf = new Map<string, Meta>()
  const applyProp = (
    el: Element,
    st: Meta,
    p: Prop,
    replace: boolean,
  ): void => {
    n = p.line
    const set = <K extends keyof Meta>(k: K, v: Meta[K]): void => {
      if (!replace && st[k] !== undefined && st[k] !== v)
        fail(
          `${el.kind === 'actor' ? 'Actor' : 'Use case'} '${el.id}' has conflicting ${k} metadata`,
        )
      st[k] = v
    }
    if (p.key === 'business' && typeof p.value === 'boolean')
      set('business', p.value)
    else if (
      el.kind === 'actor' &&
      p.key === 'type' &&
      (p.value === 'normal' || p.value === 'hollow' || p.value === 'awesome')
    )
      set('type', p.value)
    else if (
      el.kind === 'actor' &&
      p.key === 'icon' &&
      typeof p.value === 'string'
    )
      set('icon', p.value)
    else
      fail(`Metadata property '${p.key}' is invalid for ${el.kind} '${el.id}'`)
  }
  for (const el of elements.values()) {
    const st: Meta = {}
    for (const p of el.decl) applyProp(el, st, p, false)
    metaOf.set(el.id, st)
  }
  for (const a of assignments) {
    const el = elements.get(a.id)
    const r = relationships.find((x) => x.id === a.id)
    for (const p of a.props) {
      n = p.line
      if (el) applyProp(el, metaOf.get(a.id)!, p, true)
      else if (boundaries.has(a.id)) boundaryMeta(a.id, p)
      else if (r) {
        if (p.key === 'animate' && typeof p.value === 'boolean')
          r.animate = p.value
        else if (
          p.key === 'animation' &&
          (p.value === 'fast' || p.value === 'slow')
        )
          r.animation = p.value
        else fail(`Metadata property '${p.key}' is invalid for edge '${a.id}'`)
      } else if (jsonIds.has(a.id))
        fail(`Metadata property '${p.key}' is invalid for json '${a.id}'`)
      else {
        const hint = a.props.some((q) => q.key === 'icon' || q.key === 'type')
          ? ' (metadata implies actor)'
          : ''
        fail(`Metadata target '${a.id}' is unresolved${hint}`)
      }
    }
  }
  for (const r of relationships) if (r.animation !== undefined) r.animate = true
  for (const el of elements.values()) {
    n = el.line
    const st = metaOf.get(el.id)!
    if (el.kind === 'actor') {
      if (
        st.icon !== undefined &&
        st.type !== undefined &&
        st.type !== 'normal'
      )
        fail(`Actor '${el.id}' cannot combine icon with type '${st.type}'`)
      if (st.business && (st.icon !== undefined || st.type === 'awesome'))
        fail(`Business actor '${el.id}' must use normal or hollow geometry`)
    } else if (el.shape === 'rect' && st.business)
      fail(`Rectangular use case '${el.id}' cannot be a business use case`)
  }
  for (const note of notes) {
    n = note.line
    if (!elements.has(note.target))
      fail(`Note target '${note.target}' is unresolved`)
  }

  const actors: UsecaseActor[] = []
  const useCases: UsecaseCase[] = []
  for (const el of elements.values()) {
    const st = metaOf.get(el.id)!
    const extra = {
      ...(st.business && { business: true as const }),
      ...(el.parentId === undefined ? {} : { parentId: el.parentId }),
      ...(el.stereotype === undefined ? {} : { stereotype: el.stereotype }),
      ...(el.classes.length > 0 && { classes: el.classes }),
      ...(el.styles.length > 0 && { styles: el.styles }),
    }
    if (el.kind === 'actor') {
      const type = st.icon === undefined ? st.type : 'icon'
      actors.push({
        id: el.id,
        label: el.label,
        ...(type === 'hollow' || type === 'awesome' || type === 'icon'
          ? { type }
          : {}),
        ...(st.icon === undefined ? {} : { icon: st.icon }),
        ...extra,
      })
    } else
      useCases.push({ id: el.id, label: el.label, shape: el.shape, ...extra })
  }
  return {
    classDefs,
    direction,
    actors,
    useCases,
    boundaries: [...boundaries.values()].map((b) =>
      boundaryPackage.has(b.id) ? { ...b, type: 'package' as const } : b,
    ),
    jsonNodes: [...jsons.values()],
    relationships,
    notes: notes.map(({ target, label }) => ({ target, label })),
  }
}
