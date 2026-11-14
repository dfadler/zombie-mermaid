import { sanitizeTitle } from '../sanitize-title.ts'
import { MermaidParseError, stripFrontMatter } from '@zombie-mermaid/core'
import type {
  WardleyAnnotation,
  WardleyArrow,
  WardleyFlow,
  WardleyLink,
  WardleyMap,
  WardleyNode,
  WardleyNote,
  WardleyPipeline,
  WardleyStrategy,
  WardleyTrend,
} from './types.ts'

// ============================================================================
// Wardley map parser
//
// A port of Mermaid's Langium grammar and database (@mermaid-js/parser
// `wardley.langium`, mermaid `diagrams/wardley/wardleyParser.ts`, checked
// against 12.3.0). One statement per line:
//
//   wardley-beta
//   title <text>
//   size [<w>, <h>]
//   evolution A@0.2 -> B@0.5 -> C / D@1.0
//   anchor <name> [<visibility>, <evolution>]
//   component <name> [<v>, <e>] label [<dx>, <dy>] (build|buy|outsource|market) inertia
//   <from> [+>|+<|+<>] [-->|->|-.->|>|+'text'>] <to> [+>|+<|+<>] ; <label>
//   evolve <name> <evolution>
//   pipeline <name> {  component <name> [<e>] label [<dx>, <dy>]  ... }
//   note "<text>" [<v>, <e>]
//   annotations [<x>, <y>]  /  annotation <n>,[<x>, <y>] "<text>"
//   accelerator <name> [<x>, <y>]  /  deaccelerator <name> [<x>, <y>]
//
// Rules taken from Mermaid:
//   - Coordinates are decimals (`0.5`, not `.5` or `50`); a value up to 1 is a
//     fraction of the chart and a larger one a percentage, so `1.0` is the
//     right/top edge and `2.5` is 2.5%. Outside 0-100 is an error.
//     `size` takes integers; `annotations`/`annotation` coordinates also take them.
//   - A name is `"quoted"`, or words of letters, digits, `_`, `(`, `)`, `&` and
//     `-` (not before `>`) separated by spaces; a name that starts with a digit is an error.
//   - The database fills in a fixed order whatever the source order: size,
//     evolution, anchors, components, notes, pipelines, links, evolves,
//     annotations, accelerators, deaccelerators. A pipeline's parent must be an
//     anchor or component; a link to a name that is not a node is dropped when
//     drawn; an `evolve` of an unknown name is ignored.
//   - A link label is the text after `;`, trimmed; `+'text'>` on the arrow
//     gives the label and flow instead (a `;` label loses to it).
//
// Parsed from the raw text, not `Statement[]`: `;` starts a link label.
// accTitle/accDescr are stripped by `extractAccessibility` before the
// renderers call this; called directly, they are accepted and ignored.
// ============================================================================

const DEC = String.raw`\d+\.\d+`
const INT = String.raw`\d+`
const WORD = String.raw`[A-Za-z](?:[A-Za-z0-9_()&]|-(?!>))*`
const WORD_AFTER_SPACE = String.raw`[A-Za-z(](?:[A-Za-z0-9_()&]|-(?!>))*`
/** A quoted string, words separated by spaces, or an id that starts with `_` (one starting with a digit is lexed as a number and fails, as in Mermaid). */
const NAME = String.raw`(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|${WORD}(?:[ \t]+${WORD_AFTER_SPACE})*|_(?:[-\w]*\w)?)`
const STRING = String.raw`(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')`
const PORT = String.raw`(?:\+<>|\+>|\+<)`
const ARROW = String.raw`(?:-->|-\.->|->|>|\+'[^']*'(?:<>|<|>))`
const OFFSET = String.raw`\[\s*(-)?\s*(${INT})\s*,\s*(-)?\s*(${INT})\s*\]`
const LABEL = String.raw`(?:\s*label\s*${OFFSET})?`

const SIZE_RE = new RegExp(
  String.raw`^size\s*\[\s*(${INT})\s*,\s*(${INT})\s*\]$`,
)
const EVOLUTION_RE = /^evolution\s+(.+)$/
const STAGE_RE = new RegExp(
  String.raw`^(${NAME})(?:\s*@\s*(${DEC}))?(?:\s*/\s*(${NAME}))?$`,
)
const ANCHOR_RE = new RegExp(
  String.raw`^anchor\s+(${NAME})\s*\[\s*(${DEC})\s*,\s*(${DEC})\s*\]$`,
)
const COMPONENT_RE = new RegExp(
  String.raw`^component\s+(${NAME})\s*\[\s*(${DEC})\s*,\s*(${DEC})\s*\]${LABEL}(?:\s*\(\s*(build|buy|outsource|market)\s*\))?(?:\s*(inertia)|\s*\(\s*(inertia)\s*\))?$`,
)
const EVOLVE_RE = new RegExp(String.raw`^evolve\s+(${NAME})\s+(${DEC})$`)
const PIPELINE_RE = new RegExp(String.raw`^pipeline\s+(${NAME})\s*\{$`)
const PIPELINE_COMPONENT_RE = new RegExp(
  String.raw`^component\s+(${NAME})\s*\[\s*(${DEC})\s*\]${LABEL}$`,
)
const NOTE_RE = new RegExp(
  String.raw`^note\s+(${STRING})\s*\[\s*(${DEC})\s*,\s*(${DEC})\s*\]$`,
)
const COORD = `(?:${DEC}|${INT})`
const ANNOTATIONS_RE = new RegExp(
  String.raw`^annotations\s*\[\s*(${COORD})\s*,\s*(${COORD})\s*\]$`,
)
const ANNOTATION_RE = new RegExp(
  String.raw`^annotation\s+(${INT})\s*,\s*\[\s*(${COORD})\s*,\s*(${COORD})\s*\]\s*(${STRING})$`,
)
const ACCELERATOR_RE = new RegExp(
  String.raw`^(accelerator|deaccelerator)\s+(${NAME})\s*\[\s*(${DEC})\s*,\s*(${DEC})\s*\]$`,
)
const LINK_RE = new RegExp(
  String.raw`^(${NAME})\s*(${PORT})?\s*(${ARROW})?\s*(${NAME})\s*(${PORT})?\s*(?:;(.+))?$`,
)

const ESCAPES: Record<string, string> = {
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
  v: '\v',
  '0': '\0',
}

/** A quoted name or string without its quotes; anything else as written. */
function unquote(raw: string): string {
  if (!/^["']/.test(raw)) return raw
  return raw.slice(1, -1).replace(/\\(.)/gs, (_, c: string) => ESCAPES[c] ?? c)
}

/** The lexer reads these as keywords, so a bare one is no name (a longer name starting with one is fine). */
const KEYWORDS = new Set([
  'wardley-beta',
  'size',
  'evolution',
  'anchor',
  'component',
  'label',
  'inertia',
  'evolve',
  'pipeline',
  'note',
  'annotations',
  'annotation',
  'accelerator',
  'deaccelerator',
  'build',
  'buy',
  'outsource',
  'market',
])

/** A name token without its quotes; a bare keyword is an error. */
function nameOf(raw: string, line: number): string {
  if (KEYWORDS.has(raw))
    fail(line, `Unexpected keyword "${raw}" where a name was expected`)
  return unquote(raw)
}

function fail(line: number, detail: string): never {
  throw new MermaidParseError(`Line ${line}: ${detail}`, {
    diagramType: 'wardley',
  })
}

/** Mermaid's `toPercent`: up to 1 is a fraction of the chart, above that a percentage. */
function toPercent(value: string, context: string): number {
  const v = Number(value)
  const percent = v <= 1 ? v * 100 : v
  if (percent < 0 || percent > 100)
    throw new MermaidParseError(
      `${context} must be between 0-1 (decimal) or 0-100 (percentage). Received: ${v}`,
      { diagramType: 'wardley' },
    )
  return percent
}

function flowFromPort(port: string | undefined): WardleyFlow | undefined {
  if (port === '+<>') return 'bidirectional'
  if (port === '+<') return 'backward'
  if (port === '+>') return 'forward'
  return undefined
}

/** `+'text'>` style arrows carry a flow and a label; plain arrows carry neither. */
function flowFromArrow(arrow: string | undefined): {
  flow?: WardleyFlow
  label?: string
} {
  if (!arrow?.startsWith('+')) return {}
  const label = /^\+'([^']*)'/.exec(arrow)?.[1]
  const flow = arrow.includes('<>')
    ? 'bidirectional'
    : arrow.includes('<')
      ? 'backward'
      : 'forward'
  return { flow, label }
}

/** Mermaid's converter for a `title` token: the text after the keyword, blanks collapsed. */
function titleText(raw: string): string {
  return raw
    .replace(/^\s*title\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

interface Offset {
  x?: number
  y?: number
}

function offset(m: RegExpExecArray, at: number): Offset {
  if (m[at + 1] === undefined) return {}
  return {
    x: (m[at] ? -1 : 1) * Number(m[at + 1]),
    y: (m[at + 2] ? -1 : 1) * Number(m[at + 3]),
  }
}

/** Parse Mermaid `wardley-beta` source into a typed {@link WardleyMap}. */
export function parseWardley(text: string): WardleyMap {
  const source = stripFrontMatter(text.replace(/\r\n?/g, '\n')).replace(
    /[\t ]*%%\{[\S\s]*?\}%%/g,
    '',
  )
  const raw = source.split('\n')
  // [source line, text] for each statement line, comments and blanks gone.
  const lines: Array<[number, string]> = []
  raw.forEach((l, i) => {
    const t = l.replace(/%%.*$/, '').trim()
    if (t !== '') lines.push([i + 1, t])
  })

  const head = /^wardley-beta(?:\s+(.*))?$/.exec(lines[0]?.[1] ?? '')
  if (!head) fail(lines[0]?.[0] ?? 1, 'Expected the "wardley-beta" header')
  // Statements may follow the header on its own line (`wardley-beta title X`).
  if (head?.[1]) lines[0] = [(lines[0] as [number, string])[0], head[1]]
  else lines.shift()

  const map: WardleyMap = {
    nodes: [],
    links: [],
    trends: [],
    pipelines: [],
    annotations: [],
    notes: [],
    accelerators: [],
    deaccelerators: [],
  }
  let title: string | undefined
  const anchors: Array<{ line: number; node: WardleyNode }> = []
  const components: Array<{ line: number; node: WardleyNode }> = []
  const notes: WardleyNote[] = []
  const pipelines: Array<{
    line: number
    parent: string
    components: Array<{ name: string; x: number; offset: Offset }>
  }> = []
  const rawLinks: Array<{ from: string; to: string; link: WardleyLink }> = []
  const evolves: Array<{ name: string; target: number }> = []
  const accelerators: WardleyArrow[] = []
  const deaccelerators: WardleyArrow[] = []

  for (let i = 0; i < lines.length; i++) {
    const [n, line] = lines[i] as [number, string]
    let m: RegExpExecArray | null
    if (/^title(?:\s|$)/.test(line)) {
      title = sanitizeTitle(titleText(line)) || undefined
    } else if (/^accTitle\s*:/.test(line)) {
      continue
    } else if (/^accDescr\b/.test(line)) {
      // `accDescr { … }` over several lines.
      if (/^accDescr\s*\{/.test(line) && !line.includes('}'))
        while (
          i + 1 < lines.length &&
          !(lines[i] as [number, string])[1].includes('}')
        )
          i++
    } else if ((m = SIZE_RE.exec(line))) {
      map.size = { width: Number(m[1]), height: Number(m[2]) }
    } else if ((m = EVOLUTION_RE.exec(line))) {
      const parts = (m[1] as string).split(/\s*->\s*/)
      if (parts.length < 2) fail(n, 'An evolution needs at least two stages')
      const stages: string[] = []
      const bounds: Array<number | undefined> = []
      for (const part of parts) {
        const s = STAGE_RE.exec(part.trim())
        if (!s) fail(n, `Unexpected "${part.trim()}" in the evolution stages`)
        const [, name, boundary, second] = s as RegExpExecArray
        stages.push(
          second === undefined
            ? nameOf(name as string, n).trim()
            : `${nameOf(name as string, n).trim()} / ${nameOf(second, n).trim()}`,
        )
        bounds.push(boundary === undefined ? undefined : Number(boundary))
      }
      map.stages = stages
      const given = bounds.filter((b): b is number => b !== undefined)
      if (given.length > 0) map.stageBoundaries = given
      else delete map.stageBoundaries
    } else if ((m = ANCHOR_RE.exec(line))) {
      const name = nameOf(m[1] as string, n)
      anchors.push({
        line: n,
        node: {
          id: name,
          label: name,
          x: toPercent(m[3] as string, `Anchor "${name}" evolution`),
          y: toPercent(m[2] as string, `Anchor "${name}" visibility`),
          kind: 'anchor',
        },
      })
    } else if ((m = COMPONENT_RE.exec(line))) {
      const name = nameOf(m[1] as string, n)
      const o = offset(m, 4)
      const node: WardleyNode = {
        id: name,
        label: name,
        x: toPercent(m[3] as string, `Component "${name}" evolution`),
        y: toPercent(m[2] as string, `Component "${name}" visibility`),
        kind: 'component',
      }
      if (o.x !== undefined) {
        node.labelOffsetX = o.x
        node.labelOffsetY = o.y as number
      }
      if (m[8]) node.strategy = m[8] as WardleyStrategy
      if (m[9] || m[10]) node.inertia = true
      components.push({ line: n, node })
    } else if ((m = EVOLVE_RE.exec(line))) {
      evolves.push({
        name: nameOf(m[1] as string, n),
        target: toPercent(
          m[2] as string,
          `Evolve target for "${nameOf(m[1] as string, n)}"`,
        ),
      })
    } else if ((m = PIPELINE_RE.exec(line))) {
      const pipeline: (typeof pipelines)[number] = {
        line: n,
        parent: nameOf(m[1] as string, n),
        components: [],
      }
      for (i++; i < lines.length; i++) {
        const [cn, cl] = lines[i] as [number, string]
        if (cl === '}') break
        const c = PIPELINE_COMPONENT_RE.exec(cl)
        if (!c) fail(cn, `Unexpected "${cl}" in a pipeline`)
        const cname = nameOf((c as RegExpExecArray)[1] as string, cn)
        pipeline.components.push({
          name: cname,
          x: toPercent(
            (c as RegExpExecArray)[2] as string,
            `Pipeline component "${cname}" evolution`,
          ),
          offset: offset(c as RegExpExecArray, 3),
        })
      }
      if (lines[i]?.[1] !== '}') fail(n, 'A pipeline needs a closing "}"')
      if (pipeline.components.length === 0)
        fail(n, 'A pipeline needs at least one component')
      pipelines.push(pipeline)
    } else if ((m = NOTE_RE.exec(line))) {
      const text = unquote(m[1] as string)
      notes.push({
        text,
        x: toPercent(m[3] as string, `Note "${text}" evolution`),
        y: toPercent(m[2] as string, `Note "${text}" visibility`),
      })
    } else if ((m = ANNOTATIONS_RE.exec(line))) {
      // Mermaid reads `[x, y]` here as (visibility, evolution), like notes.
      map.annotationsBox = {
        x: toPercent(m[2] as string, 'Annotations box evolution'),
        y: toPercent(m[1] as string, 'Annotations box visibility'),
      }
    } else if ((m = ANNOTATION_RE.exec(line))) {
      const number = Number(m[1])
      const a: WardleyAnnotation = {
        number,
        x: toPercent(m[3] as string, `Annotation ${number} evolution`),
        y: toPercent(m[2] as string, `Annotation ${number} visibility`),
        text: unquote(m[4] as string),
      }
      map.annotations.push(a)
    } else if ((m = ACCELERATOR_RE.exec(line))) {
      const name = nameOf(m[2] as string, n)
      const a: WardleyArrow = {
        name,
        x: toPercent(m[4] as string, `Accelerator "${name}" evolution`),
        y: toPercent(m[3] as string, `Accelerator "${name}" visibility`),
      }
      ;(m[1] === 'accelerator' ? accelerators : deaccelerators).push(a)
    } else if (
      (m = LINK_RE.exec(line)) &&
      // Without an arrow or a port the words are one name, not two.
      (m[2] !== undefined || m[3] !== undefined || m[5] !== undefined)
    ) {
      const from = nameOf(m[1] as string, n)
      const to = nameOf(m[4] as string, n)
      const arrow = flowFromArrow(m[3])
      const label = arrow.label ?? (m[6]?.trim() || undefined)
      const link: WardleyLink = {
        source: from,
        target: to,
        dashed: m[3] !== undefined && /-\.->/.test(m[3]),
      }
      const flow = flowFromPort(m[2]) ?? flowFromPort(m[5]) ?? arrow.flow
      if (flow) link.flow = flow
      if (label) link.label = label
      rawLinks.push({ from, to, link })
    } else {
      fail(n, `Unexpected "${line}"`)
    }
  }

  // Fill in Mermaid's database order (see the header).
  const byId = new Map<string, WardleyNode>()
  const add = (node: WardleyNode): void => {
    const prev = byId.get(node.id)
    // Mermaid's `{ ...existing, ...node }`: a repeat replaces every field but the label offsets.
    byId.set(node.id, {
      ...node,
      labelOffsetX: node.labelOffsetX ?? prev?.labelOffsetX,
      labelOffsetY: node.labelOffsetY ?? prev?.labelOffsetY,
    })
  }
  for (const { node } of anchors) add(node)
  for (const { node } of components) add(node)

  const wardleyPipelines: WardleyPipeline[] = []
  for (const p of pipelines) {
    const parent = byId.get(p.parent)
    if (!parent)
      fail(
        p.line,
        `Pipeline "${p.parent}" must reference an existing component with coordinates.`,
      )
    parent.isPipelineParent = true
    const pipeline: WardleyPipeline = { nodeId: p.parent, componentIds: [] }
    for (const c of p.components) {
      const id = `${p.parent}_${c.name}`
      const node: WardleyNode = {
        id,
        label: c.name,
        x: c.x,
        y: (parent as WardleyNode).y,
        kind: 'pipeline-component',
      }
      if (c.offset.x !== undefined) {
        node.labelOffsetX = c.offset.x
        node.labelOffsetY = c.offset.y as number
      }
      add(node)
      pipeline.componentIds.push(id)
    }
    wardleyPipelines.push(pipeline)
  }

  const resolve = (name: string): string => {
    if (byId.has(name)) return name
    for (const [id, node] of byId) if (node.label === name) return id
    return name
  }
  const links = rawLinks.map(({ from, to, link }) => ({
    ...link,
    source: resolve(from),
    target: resolve(to),
  }))
  // One trend per node: a repeated `evolve` replaces the target, keeping the first one's place.
  const trendById = new Map<string, WardleyTrend>()
  for (const e of evolves) {
    const node = byId.get(e.name)
    if (node)
      trendById.set(e.name, {
        nodeId: e.name,
        targetX: e.target,
        targetY: node.y,
      })
  }
  const trends = [...trendById.values()]

  map.nodes = [...byId.values()].map((node) => {
    // Drop the undefined optional fields so the model compares cleanly.
    const clean = { ...node }
    for (const key of ['labelOffsetX', 'labelOffsetY'] as const)
      if (clean[key] === undefined) delete clean[key]
    return clean
  })
  map.links = links
  map.trends = trends
  map.pipelines = wardleyPipelines
  map.notes = notes
  map.accelerators = accelerators
  map.deaccelerators = deaccelerators
  if (title !== undefined) map.title = title
  return map
}
