import {
  MermaidParseError,
  parseStyleProps,
  stripFrontMatter,
} from '@zombie-mermaid/core'
import type {
  UsecaseClassDef,
  UsecaseActor,
  UsecaseBoundary,
  UsecaseCase,
  UsecaseDiagram,
  UsecaseDirection,
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
// / `style`, `--o` / `--x` / `o--` / `x--` markers, `id@` edge ids with an
// `id@{ animate: true }` line, and markdown strings (backticks dropped).
//
// Not supported yet (an error saying so): `@{ … }` metadata on a node and
// `json` nodes (#3131).
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

const UNSUPPORTED: Array<[RegExp, string]> = [
  [/@\{/, '`@{ … }` metadata'],
  [/^json\s/, '`json` nodes'],
]

interface Entity {
  id: string
  label: string
  explicit: boolean
  shape: 'ellipse' | 'rect'
  stereotype?: string
  classes?: string[]
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
  const relationships: UsecaseRelationship[] = []
  const relationLines: number[] = []
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
    const st = /^<<\s*([^<>]*?)\s*>>/.exec(r.rest)
    if (st) {
      r.ent.stereotype = st[1]!
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
    const meta = (el: Element): void => {
      if (e.stereotype !== undefined) el.stereotype = e.stereotype
      for (const c of e.classes ?? [])
        if (!el.classes.includes(c)) el.classes.push(c)
    }
    if (!prev) {
      const { classes: _c, ...own } = e
      const el: Element = {
        kind,
        ...own,
        classes: [],
        styles: [],
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
      if (e.classes && !elements.has(e.id))
        fail(`'${e.id}' uses ::: without being declared`)
    const source = declare('weak', from)
    const target = declare('weak', to.ent)
    const { rest: _rest, ...link } = a
    relationships.push({
      source: source.id,
      target: target.id,
      ...link,
      ...(idm && { id: idm[1]! }),
    })
    relationLines.push(n)
  }

  const styleList = (s: string): string[] =>
    Object.entries(parseStyleProps(s)).map(([k, v]) => `${k}:${v}`)
  const classDefs: UsecaseClassDef[] = []
  const edgeMeta: Array<{ id: string; line: number; body: string }> = []

  for (const [i, raw] of lines.entries()) {
    n = i + 1
    const line = raw.trim()
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
    const em = /^(\w+)@\{([^}]*)\}$/.exec(line)
    if (em) {
      edgeMeta.push({ id: em[1]!, line: n, body: em[2]! })
      continue
    }
    for (const [re, what] of UNSUPPORTED)
      if (re.test(line)) fail(`${what} are not supported yet`)

    const cd = /^classDef\s+([\w-]+)\s+(\S.*)$/.exec(line)
    if (cd) {
      classDefs.push({ id: cd[1]!, styles: styleList(cd[2]!) })
      continue
    }
    const cls = /^class\s+([\w,\s]+?)\s+([\w-]+)$/.exec(line)
    const sty = /^style\s+(\w+)\s+(\S.*)$/.exec(line)
    if (cls || sty) {
      for (const id of (cls?.[1] ?? sty![1]!).split(/\s*,\s*/)) {
        const el = elements.get(id)
        if (!el) fail(`'${id}' is not declared`)
        else if (cls) {
          if (!el.classes.includes(cls[2]!)) el.classes.push(cls[2]!)
        } else el.styles.push(...styleList(sty![2]!))
      }
      continue
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
      boundary = { id: ent.id, label: ent.label, members: [] }
      boundaries.set(ent.id, boundary)
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
  for (const [i, r] of relationships.entries()) {
    n = relationLines[i]!
    const from = elements.get(r.source)!.kind
    const to = elements.get(r.target)!.kind
    if (
      (r.type === 'include' || r.type === 'extend') &&
      (from !== 'usecase' || to !== 'usecase')
    )
      fail(`${r.type} relationship requires use-case endpoints`)
    if (r.type === 'generalization' && from !== to)
      fail(
        'Generalization requires actor-to-actor or use-case-to-use-case endpoints',
      )
  }
  for (const m of edgeMeta) {
    n = m.line
    const r = relationships.find((x) => x.id === m.id)
    if (!r) fail('`@{ … }` metadata on a node is not supported yet')
    else
      for (const kv of m.body.split(',')) {
        const [k, v = ''] = kv.split(':').map((x) => x.trim())
        if (k === 'animate') r.animate = v === 'true'
        else if (k === 'animation') r.animation = v
      }
  }
  for (const note of notes) {
    n = note.line
    if (!elements.has(note.target))
      fail(`Note target '${note.target}' is unresolved`)
  }

  const actors: UsecaseActor[] = []
  const useCases: UsecaseCase[] = []
  for (const el of elements.values()) {
    const extra = {
      ...(el.parentId === undefined ? {} : { parentId: el.parentId }),
      ...(el.stereotype === undefined ? {} : { stereotype: el.stereotype }),
      ...(el.classes.length > 0 && { classes: el.classes }),
      ...(el.styles.length > 0 && { styles: el.styles }),
    }
    if (el.kind === 'actor')
      actors.push({ id: el.id, label: el.label, ...extra })
    else
      useCases.push({ id: el.id, label: el.label, shape: el.shape, ...extra })
  }
  return {
    classDefs,
    direction,
    actors,
    useCases,
    boundaries: [...boundaries.values()],
    relationships,
    notes: notes.map(({ target, label }) => ({ target, label })),
  }
}
