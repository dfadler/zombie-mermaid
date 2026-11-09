import { extractInitConfig, MermaidParseError } from '@zombie-mermaid/core'
import type {
  GitCommit,
  GitCommitType,
  GitGraph,
  GitGraphConfig,
  GitGraphDirection,
} from './types.ts'
import { GIT_GRAPH_DEFAULTS } from './types.ts'

// ============================================================================
// GitGraph parser
//
// A port of Mermaid's gitGraph grammar (packages/parser/src/language/gitGraph/
// gitGraph.langium) and database (packages/mermaid/src/diagrams/git/
// gitGraphAst.ts), checked against mermaid@12.3.0 by parsing each form below
// with `mermaid.parse`:
//
//   gitGraph [LR: | TB: | BT:]        `gitGraph LR` without the colon is an error
//   commit [id: "x"] [msg: "x" | "x"] [tag: "x"]... [type: NORMAL|REVERSE|HIGHLIGHT]
//   branch <name | "name"> [order: <int>]
//   checkout <name> | switch <name>
//   merge <name> [id: "x"] [tag: "x"]... [type: NORMAL|REVERSE|HIGHLIGHT]
//   cherry-pick id: "x" [tag: "x"]... [parent: "x"]
//   title <text>
//
// Rules taken from Mermaid:
//   - A statement ends at the end of its line, or at the end of the input;
//     `;` is a lexer error (unlike flowcharts). Keywords are case-sensitive.
//   - `id:`, `msg:`, `tag:`, `type:`, `parent:`, `order:` are single tokens:
//     `id :` is an error, `id:"a"tag:"b"` is not. Options may repeat; the
//     last `id`, `msg`, `type` wins and every `tag` is kept.
//   - A name is a word of letters, digits, `_`, `-`, `.` and `/` that does
//     not start with `-`/`.` or consist only of digits, or a quoted string.
//   - `order:` takes a non-negative integer; branches sort by it, ties in
//     creation order (the langium parser always passes 0 for a missing one).
//   - The database errors (`branch` that exists, `checkout` of an unknown
//     branch, a `merge` of a branch into itself, with no commits, with the
//     same head, or reusing an id, a `cherry-pick` of a commit on the current
//     branch or of a merge without `parent:`) throw with Mermaid's messages.
//   - Commit ids that are not given are `<seq>-<7 hex>`. Mermaid draws the
//     hex at random; here it is a hash of the commit, so output is stable.
//
// Parsed from the raw text (Mermaid's lexer has no statement separator).
// accTitle/accDescr are stripped by `extractAccessibility` before the
// renderers call this; called directly they are accepted and ignored.
// ============================================================================

type Tok =
  | { k: 'str'; v: string }
  | { k: 'opt'; v: string }
  | { k: 'word'; v: string }
  | { k: 'int'; v: number }

const TOKEN =
  /[\t ]+|%%.*|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(id|msg|tag|type|parent|order):|(\d+)(?![\w./-])|(\w(?:[-./\w]*[-\w])?)|(.)/gy

const DIRECTIVE = /%%\{[\s\S]*?\}%%/g

const ESCAPES: Record<string, string> = {
  n: '\n',
  r: '\r',
  t: '\t',
  b: '\b',
  f: '\f',
  v: '\v',
  '0': '\0',
}

/** Langium's string value converter: drop the quotes, resolve `\x` escapes. */
function unquote(raw: string): string {
  return raw
    .slice(1, -1)
    .replace(/\\([\s\S])/g, (_m, c: string) => ESCAPES[c] ?? c)
}

function tokenize(line: string, lineNo: number): Tok[] {
  const out: Tok[] = []
  TOKEN.lastIndex = 0
  for (let m = TOKEN.exec(line); m; m = TOKEN.exec(line)) {
    if (m[1] !== undefined) out.push({ k: 'str', v: unquote(m[1]) })
    else if (m[2] !== undefined) out.push({ k: 'opt', v: m[2] })
    else if (m[3] !== undefined) out.push({ k: 'int', v: Number(m[3]) })
    else if (m[4] !== undefined) out.push({ k: 'word', v: m[4] })
    else if (m[5] !== undefined)
      throw new MermaidParseError(
        `Line ${lineNo}: Unexpected character "${m[5]}"`,
        { diagramType: 'gitgraph' },
      )
  }
  return out
}

const COMMIT_TYPES: ReadonlySet<string> = new Set([
  'NORMAL',
  'REVERSE',
  'HIGHLIGHT',
])

/** Seven hex digits derived from the commit, standing in for Mermaid's random ones. */
function hashId(seed: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0').slice(0, 7)
}

interface Opts {
  id?: string
  msg?: string
  tags: string[]
  type?: GitCommitType
  parent?: string
  order?: number
}

/** The `key: value` options after a statement keyword (and its name). */
function readOptions(
  toks: Tok[],
  from: number,
  allowed: readonly string[],
  fail: (msg: string) => never,
  bareMessage: boolean,
): Opts {
  const o: Opts = { tags: [] }
  let i = from
  while (i < toks.length) {
    const t = toks[i]!
    if (t.k === 'str' && bareMessage) {
      o.msg = t.v
      i++
      continue
    }
    if (t.k !== 'opt' || !allowed.includes(t.v))
      fail(
        `Unexpected ${t.k === 'str' ? `"${t.v}"` : `"${String(t.v)}"`}; expected ${allowed.map((a) => `${a}:`).join(', ')} or the end of the line`,
      )
    const v = toks[i + 1]
    if (t.v === 'order') {
      if (v?.k !== 'int') fail('"order:" takes a whole number')
      o.order = v.v
    } else if (t.v === 'type') {
      if (v?.k !== 'word' || !COMMIT_TYPES.has(v.v))
        fail('"type:" takes NORMAL, REVERSE or HIGHLIGHT')
      o.type = v.v as GitCommitType
    } else {
      if (v?.k !== 'str') fail(`"${t.v}:" takes a quoted string`)
      if (t.v === 'id') o.id = v.v
      else if (t.v === 'msg') o.msg = v.v
      else if (t.v === 'parent') o.parent = v.v
      else o.tags.push(v.v)
    }
    i += 2
  }
  return o
}

/** A branch name token: a word that is not a plain number, or a string. */
function nameOf(
  t: Tok | undefined,
  fail: (msg: string) => never,
  what: string,
): string {
  if (t?.k === 'str') return t.v
  if (t?.k === 'word') return t.v
  return fail(`Expected ${what}`)
}

/** Parse Mermaid `gitGraph` source into a typed {@link GitGraph}. */
export function parseGitGraph(text: string): GitGraph {
  const source = text
    .replace(/\r\n?/g, '\n')
    .replace(DIRECTIVE, (d) => d.replace(/[^\n]/g, ''))
  const init = extractInitConfig(text.split(/\r\n?|\n/)).gitGraph
  const config: GitGraphConfig = { ...GIT_GRAPH_DEFAULTS, ...init }

  const mainName = config.mainBranchName
  const commits = new Map<string, GitCommit>()
  const heads = new Map<string, string | null>([[mainName, null]])
  const order = new Map<string, number>([[mainName, config.mainBranchOrder]])
  let current = mainName
  let head: GitCommit | null = null
  let seq = 0
  let direction: GitGraphDirection = 'LR'
  let title: string | undefined
  let sawHeader = false
  let inAccBlock = false

  const lines = source.split('\n')
  for (let n = 0; n < lines.length; n++) {
    const lineNo = n + 1
    let line = lines[n]!
    const fail = (msg: string): never => {
      throw new MermaidParseError(`Line ${lineNo}: ${msg}`, {
        diagramType: 'gitgraph',
      })
    }
    if (/^[\t ]*(?:%%.*)?$/.test(line)) continue
    if (inAccBlock) {
      inAccBlock = line.indexOf('}') === -1
      continue
    }
    const acc = /^[\t ]*acc(?:Title[\t ]*:|Descr[\t ]*(?::|(\{)))/.exec(line)
    if (acc) {
      inAccBlock = acc[1] !== undefined && line.indexOf('}', acc[0].length) === -1
      continue
    }

    if (!sawHeader) {
      const h = /^[\t ]*gitGraph(?:[\t ]+(LR|TB|BT)[\t ]*:|[\t ]*:)?/.exec(line)
      if (!h)
        return fail(
          `Expected the "gitGraph" header, found "${line.trim()}" ("gitGraph LR" needs a colon: "gitGraph LR:")`,
        )
      sawHeader = true
      if (h[1]) direction = h[1] as GitGraphDirection
      line = line.slice(h[0].length)
      if (/^[\t ]*(?:%%.*)?$/.test(line)) continue
    }

    const t = /^[\t ]*title(?:[\t ]+([^\n]*?))?[\t ]*(?:%%.*)?$/.exec(line)
    if (t) {
      title = t[1]?.replace(/[\t ]*%%.*$/, '').trim() || undefined
      continue
    }

    const toks = tokenize(line, lineNo)
    const kw = toks[0]
    if (kw?.k !== 'word') return fail(`Unexpected "${line.trim()}"`)

    switch (kw.v) {
      case 'commit': {
        const o = readOptions(
          toks,
          1,
          ['id', 'msg', 'tag', 'type'],
          fail,
          true,
        )
        const message = o.msg ?? ''
        const id =
          o.id ||
          `${seq}-${hashId(`${seq}|${current}|${message}|${head?.id ?? ''}`)}`
        const c: GitCommit = {
          id,
          message,
          seq: seq++,
          type: o.type ?? 'NORMAL',
          tags: o.tags,
          parents: head ? [head.id] : [],
          branch: current,
        }
        head = c
        commits.set(c.id, c)
        heads.set(current, c.id)
        break
      }
      case 'branch': {
        const name = nameOf(toks[1], fail, 'a branch name')
        const o = readOptions(toks, 2, ['order'], fail, false)
        if (heads.has(name))
          throw new MermaidParseError(
            `Trying to create an existing branch. (Help: Either use a new name if you want create a new branch or try using "checkout ${name}")`,
            { diagramType: 'gitgraph', line: lineNo },
          )
        heads.set(name, head?.id ?? null)
        order.set(name, o.order ?? 0)
        current = name
        break
      }
      case 'checkout':
      case 'switch': {
        const name = nameOf(toks[1], fail, 'a branch name')
        if (toks.length > 2) fail('Unexpected text after the branch name')
        if (!heads.has(name))
          throw new MermaidParseError(
            `Trying to checkout branch which is not yet created. (Help try using "branch ${name}")`,
            { diagramType: 'gitgraph', line: lineNo },
          )
        current = name
        const id = heads.get(name)
        head = id ? (commits.get(id) ?? null) : null
        break
      }
      case 'merge': {
        const other = nameOf(toks[1], fail, 'a branch name')
        const o = readOptions(toks, 2, ['id', 'tag', 'type'], fail, false)
        const err = (m: string): never => {
          throw new MermaidParseError(m, {
            diagramType: 'gitgraph',
            line: lineNo,
          })
        }
        const curId = heads.get(current)
        const otherId = heads.get(other)
        const curCommit = curId ? commits.get(curId) : undefined
        const otherCommit = otherId ? commits.get(otherId) : undefined
        if (curCommit && otherCommit && curCommit.branch === other)
          err(`Cannot merge branch '${other}' into itself.`)
        if (current === other)
          err('Incorrect usage of "merge". Cannot merge a branch to itself')
        if (!curCommit)
          err(
            `Incorrect usage of "merge". Current branch (${current})has no commits`,
          )
        if (!heads.has(other))
          err(
            `Incorrect usage of "merge". Branch to be merged (${other}) does not exist`,
          )
        if (!otherCommit)
          err(
            `Incorrect usage of "merge". Branch to be merged (${other}) has no commits`,
          )
        if (curCommit === otherCommit)
          err('Incorrect usage of "merge". Both branches have same head')
        if (o.id && commits.has(o.id))
          err(
            `Incorrect usage of "merge". Commit with id:${o.id} already exists, use different custom id`,
          )
        const m: GitCommit = {
          id: o.id || `${seq}-${hashId(`${seq}|${current}|${other}|${head?.id}`)}`,
          message: `merged branch ${other} into ${current}`,
          seq: seq++,
          parents: head ? [head.id, otherId!] : [],
          branch: current,
          type: 'MERGE',
          tags: o.tags,
        }
        if (o.type) m.customType = o.type
        if (o.id) m.customId = true
        head = m
        commits.set(m.id, m)
        heads.set(current, m.id)
        break
      }
      case 'cherry-pick': {
        const o = readOptions(toks, 1, ['id', 'tag', 'parent'], fail, false)
        const err = (m: string): never => {
          throw new MermaidParseError(m, {
            diagramType: 'gitgraph',
            line: lineNo,
          })
        }
        const source = o.id ? commits.get(o.id) : undefined
        if (!source)
          err(
            'Incorrect usage of "cherryPick". Source commit id should exist and provided',
          )
        const sc = source!
        if (o.parent && !sc.parents.includes(o.parent))
          err(
            'Invalid operation: The specified parent commit is not an immediate parent of the cherry-picked commit.',
          )
        if (sc.type === 'MERGE' && !o.parent)
          err(
            'Incorrect usage of cherry-pick: If the source commit is a merge commit, an immediate parent commit must be specified.',
          )
        if (sc.branch === current)
          err(
            'Incorrect usage of "cherryPick". Source commit is already on current branch',
          )
        if (!heads.get(current))
          err(
            `Incorrect usage of "cherry-pick". Current branch (${current})has no commits`,
          )
        const c: GitCommit = {
          id: `${seq}-${hashId(`${seq}|${current}|${sc.id}`)}`,
          message: `cherry-picked ${sc.message} into ${current}`,
          seq: seq++,
          parents: head ? [head.id, sc.id] : [],
          branch: current,
          type: 'CHERRY_PICK',
          tags: o.tags.length
            ? o.tags.filter(Boolean)
            : [
                `cherry-pick:${sc.id}${sc.type === 'MERGE' ? `|parent:${o.parent}` : ''}`,
              ],
        }
        head = c
        commits.set(c.id, c)
        heads.set(current, c.id)
        break
      }
      default:
        fail(`Unexpected "${kw.v}"`)
    }
  }

  if (!sawHeader)
    throw new MermaidParseError('Expected the "gitGraph" header', {
      diagramType: 'gitgraph',
    })

  const branches = [...order.entries()]
    .map(([name, o], i) => ({ name, o, i }))
    .sort((a, b) => a.o - b.o || a.i - b.i)
    .map((b) => b.name)

  const g: GitGraph = {
    direction,
    branches,
    commits: [...commits.values()].sort((a, b) => a.seq - b.seq),
    config,
  }
  if (title) g.title = title
  return g
}
