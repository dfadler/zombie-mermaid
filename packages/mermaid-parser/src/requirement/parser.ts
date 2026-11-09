import {
  MermaidParseError,
  tryApplyClassAssignment,
  tryApplyClassDef,
  tryApplyStyleStatement,
} from '@zombie-mermaid/core'
import type {
  RequirementDiagram,
  RequirementKind,
  RequirementNode,
  RequirementRelationType,
} from './types.ts'

// ============================================================================
// Requirement diagram parser
//
// A port of Mermaid's requirementDiagram.jison and requirementDb.ts, checked
// against mermaid@12.3.0:
//
//   requirementDiagram
//   direction TB | BT | LR | RL
//   <kind> <name>[:::class] {          kind: requirement, functionalRequirement,
//     id: <value>                       interfaceRequirement, performanceRequirement,
//     text: <value>                     physicalRequirement, designConstraint
//     risk: low | medium | high
//     verifymethod: analysis | demonstration | inspection | test
//   }
//   element <name> {
//     type: <value>
//     docref: <value>
//   }
//   <a> - <relationship> -> <b>        contains copies derives satisfies
//   <b> <- <relationship> - <a>        verifies refines traces
//   classDef / class / style / <name>:::class
//
// Rules taken from Mermaid:
//   - Keywords are case-insensitive. A `{` ends its line and every property
//     sits on its own line, so `requirement r { id: 1 }` is an error.
//   - An unquoted name or value starts with an ASCII word character and stops
//     at `: , { < > - =`, so `text: a-b` and `text: a, b` are errors and
//     quoting (`text: "a-b"`) is how to write them. Quoted text is anything
//     but a `"`. Unquoted text keeps a trailing `;`.
//   - A name written twice keeps its first definition.
//   - A relationship naming something never declared is an error (Mermaid
//     fails inside ELK).
//   - The relationship `a - r -> b` runs from a to b; `b <- r - a` also runs
//     from a to b, so the arrow always points at the second operand's end.
//
// Parsed from the raw text, not `Statement[]`: a value may hold a `;` or `'`.
// accTitle / accDescr are stripped by `extractAccessibility` before the
// renderers call this; called directly they are accepted and ignored.
// ============================================================================

const KINDS: Record<string, [RequirementKind, string]> = {
  requirement: ['requirement', 'Requirement'],
  functionalrequirement: ['functionalRequirement', 'Functional Requirement'],
  interfacerequirement: ['interfaceRequirement', 'Interface Requirement'],
  performancerequirement: ['performanceRequirement', 'Performance Requirement'],
  physicalrequirement: ['physicalRequirement', 'Physical Requirement'],
  designconstraint: ['designConstraint', 'Design Constraint'],
}

const RISKS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}
const VERIFY: Record<string, string> = {
  analysis: 'Analysis',
  demonstration: 'Demonstration',
  inspection: 'Inspection',
  test: 'Test',
}
const RELATIONS = new Set<RequirementRelationType>([
  'contains',
  'copies',
  'derives',
  'satisfies',
  'verifies',
  'refines',
  'traces',
])

/** An unquoted name or value: `\w[^:,{<>\-=]*`. */
const UNQ = String.raw`\w[^:,{<>\-=]*`
const NAME = String.raw`(?:"([^"]*)"|(${UNQ}?))`
const KIND_ALT = Object.keys(KINDS).join('|')
const RELATION_ALT = [...RELATIONS].join('|')

const BLOCK_RE = new RegExp(
  String.raw`^(${KIND_ALT}|element)\s+${NAME}\s*(?::::\s*([\w-]+(?:\s*,\s*[\w-]+)*))?\s*\{\s*$`,
  'i',
)
const FORWARD_RE = new RegExp(
  String.raw`^${NAME}\s*-\s*(${RELATION_ALT})\s*->\s*${NAME}$`,
  'i',
)
const BACKWARD_RE = new RegExp(
  String.raw`^${NAME}\s*<-\s*(${RELATION_ALT})\s*-\s*${NAME}$`,
  'i',
)
const SHORTHAND_RE = /^(?:"([^"]*)"|(\w[^:,{<>\-=]*?))\s*:::\s*([\w-]+)\s*$/
const PROP_RE = /^(id|text|risk|verifymethod|type|docref)\s*:\s*(.*)$/i
const VALUE_RE = new RegExp(String.raw`^(?:"([^"]*)"|(${UNQ}))$`)

const DIRECTIVE = /%%\{[\s\S]*?\}%%/g

function fail(line: number, message: string): never {
  throw new MermaidParseError(`Line ${line}: ${message}`, {
    diagramType: 'requirement',
  })
}

/**
 * Words the lexer turns into keyword tokens before it tries an unquoted
 * name: an unquoted name or value that starts with one (`text: test suite`,
 * `requirement element`) is a parse error, whatever follows. `title ` and the
 * accessibility statements are keywords too; a `direction TB` anywhere in the
 * rest of the line is a whole-line token.
 */
const KEYWORD_START = new RegExp(
  String.raw`^(?:(?:${[
    'id',
    'text',
    'risk',
    'verifyMethod',
    ...Object.keys(KINDS),
    'low',
    'medium',
    'high',
    'analysis',
    'demonstration',
    'inspection',
    'test',
    'element',
    ...RELATIONS,
    'type',
    'docref',
    'style',
    'classDef',
    'class',
    'requirementDiagram',
  ].join('|')})\b|(?:title|accDescr)\s|acc(?:Title|Descr)\s*[:{])`,
  'i',
)
const DIRECTION_IN_LINE = /direction\s+(?:TB|BT|RL|LR)/i

/** The text of a quoted-or-unquoted match pair; an unquoted one may not start with a keyword. */
function pick(quoted?: string, bare?: string, line = 0): string {
  if (quoted !== undefined) return quoted
  const text = (bare ?? '').trim()
  if (KEYWORD_START.test(text) || DIRECTION_IN_LINE.test(text))
    fail(line, `"${text}" is a keyword; quote it to use it as a name or value`)
  return text
}

/** Parse Mermaid `requirementDiagram` source into a typed {@link RequirementDiagram}. */
export function parseRequirementDiagram(text: string): RequirementDiagram {
  const source = text
    .replace(/\r\n?/g, '\n')
    // Directives are removed before lexing; keep their newlines so line
    // numbers still match the caller's source.
    .replace(DIRECTIVE, (d) => d.replace(/[^\n]/g, ''))
  const lines = source.split('\n')

  const diagram: RequirementDiagram = {
    nodes: [],
    relationships: [],
    classDefs: new Map(),
    classAssignments: new Map(),
    nodeStyles: new Map(),
  }
  const requirements = new Map<string, RequirementNode>()
  const elements = new Map<string, RequirementNode>()
  const relationships: [number, string, string, RequirementRelationType][] = []

  let sawHeader = false
  let current: RequirementNode | null = null
  let closed = true
  let multilineAcc = false

  for (const [i, raw] of lines.entries()) {
    const no = i + 1
    const line = raw.trim()
    if (multilineAcc) {
      if (line.includes('}')) multilineAcc = false
      continue
    }
    if (line === '' || line.startsWith('%') || line.startsWith('#')) continue

    if (!sawHeader) {
      if (/^requirementDiagram\b/i.test(line)) {
        sawHeader = true
        continue
      }
      fail(no, `Expected the "requirementDiagram" header, found "${line}"`)
    }

    // --- Inside a requirement / element body ---
    if (current) {
      if (line === '}') {
        current = null
        closed = true
        continue
      }
      const prop = PROP_RE.exec(line)
      if (!prop) fail(no, `Unexpected "${line}" in the body of "${current.id}"`)
      const key = prop[1]!.toLowerCase()
      const isElement = current.kind === 'element'
      if (isElement !== (key === 'type' || key === 'docref'))
        fail(
          no,
          `"${key}" is not a property of ${isElement ? 'an element' : 'a requirement'}`,
        )
      const rawValue = prop[2]!.trim()
      if (key === 'risk' || key === 'verifymethod') {
        // A keyword here, never quoted text.
        const word = (key === 'risk' ? RISKS : VERIFY)[rawValue.toLowerCase()]
        if (word === undefined) fail(no, `Invalid ${key} "${rawValue}"`)
        if (key === 'risk') current.risk = word
        else current.verifyMethod = word
      } else {
        const value = VALUE_RE.exec(rawValue)
        if (!value) fail(no, `Invalid value "${rawValue}" for "${key}"`)
        const v = pick(value[1], value[2], no)
        if (key === 'id') current.requirementId = v
        else if (key === 'text') current.text = v
        else if (key === 'type') current.elementType = v
        else current.docRef = v
      }
      continue
    }

    if (/^accTitle\s*:/i.test(line) || /^accDescr\s*:/i.test(line)) continue
    if (/^accDescr\s*\{/i.test(line)) {
      if (!line.includes('}')) multilineAcc = true
      continue
    }

    const dir = /^direction\s+(TB|BT|RL|LR)\b/i.exec(line)
    if (dir) {
      diagram.direction = dir[1]!.toUpperCase() as 'TB' | 'BT' | 'RL' | 'LR'
      continue
    }
    if (tryApplyClassDef(line, diagram)) continue
    if (tryApplyStyleStatement(line, diagram)) continue
    if (tryApplyClassAssignment(line, diagram)) continue

    const block = BLOCK_RE.exec(line)
    if (block) {
      const word = block[1]!.toLowerCase()
      const id = pick(block[2], block[3], no)
      const isElement = word === 'element'
      const [, typeLabel] = isElement ? [0, 'Element'] : KINDS[word]!
      const node: RequirementNode = {
        id,
        kind: isElement ? 'element' : 'requirement',
        typeLabel,
        requirementId: '',
        text: '',
        risk: '',
        verifyMethod: '',
        elementType: '',
        docRef: '',
      }
      const map = isElement ? elements : requirements
      // A repeated name keeps its first definition, but still consumes the body.
      const duplicate = map.has(id)
      if (!duplicate) map.set(id, node)
      if (block[4]) {
        const names = block[4].split(',').map((s) => s.trim())
        diagram.classAssignments.set(id, names[names.length - 1]!)
      }
      current = duplicate ? { ...node } : node
      closed = false
      continue
    }

    const fwd = FORWARD_RE.exec(line)
    if (fwd) {
      relationships.push([
        no,
        pick(fwd[1], fwd[2], no),
        pick(fwd[4], fwd[5], no),
        fwd[3]!.toLowerCase() as RequirementRelationType,
      ])
      continue
    }
    const back = BACKWARD_RE.exec(line)
    if (back) {
      relationships.push([
        no,
        pick(back[4], back[5], no),
        pick(back[1], back[2], no),
        back[3]!.toLowerCase() as RequirementRelationType,
      ])
      continue
    }

    const short = SHORTHAND_RE.exec(line)
    if (short) {
      diagram.classAssignments.set(pick(short[1], short[2], no), short[3]!)
      continue
    }

    fail(no, `Unexpected "${line}"`)
  }

  if (!sawHeader)
    throw new MermaidParseError('Expected the "requirementDiagram" header', {
      diagramType: 'requirement',
    })
  if (!closed)
    throw new MermaidParseError(
      `Unclosed block: expected "}" at the end of "${current!.id}"`,
      { diagramType: 'requirement' },
    )

  diagram.nodes = [...requirements.values(), ...elements.values()]
  const known = new Set(diagram.nodes.map((n) => n.id))
  for (const [no, src, dst, type] of relationships) {
    for (const id of [src, dst])
      if (!known.has(id)) fail(no, `Relationship refers to unknown "${id}"`)
    diagram.relationships.push({ type, src, dst })
  }
  return diagram
}

/**
 * The rows under a box's divider, as Mermaid prints them: a requirement shows
 * `ID`, `Text`, `Risk` and `Verification`, an element `Type` and `Doc Ref`,
 * each only when set.
 */
export function requirementBodyRows(node: RequirementNode): string[] {
  const rows =
    node.kind === 'requirement'
      ? [
          node.requirementId && `ID: ${node.requirementId}`,
          node.text && `Text: ${node.text}`,
          node.risk && `Risk: ${node.risk}`,
          node.verifyMethod && `Verification: ${node.verifyMethod}`,
        ]
      : [
          node.elementType && `Type: ${node.elementType}`,
          node.docRef && `Doc Ref: ${node.docRef}`,
        ]
  return rows.filter((r): r is string => Boolean(r))
}
