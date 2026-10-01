import { normalizeBrTags, type Statement } from '@zombie-mermaid/core'
import type {
  ArchitectureDiagram,
  ArchitectureEdge,
  ArchitecturePort,
} from './types.ts'

// ============================================================================
// Architecture diagram parser
//
// Parses Mermaid's `architecture-beta` diagram
// (https://mermaid.ai/open-source/syntax/architecture.html):
//
//   architecture-beta
//     group api(cloud)[API]
//     service db(database)[Database] in api
//     service server(server)[Server] in api
//     junction j1 in api
//     db:L -- R:server
//     server{group}:B --> T:client{group}
//
// Grammar:
//   group    <id>[(icon)][[Title]] [in <parent>]
//   service  <id>[(icon)][[Title]] [in <parent>]
//   junction <id> [in <parent>]
//   <id>[{group}]:<L|R|T|B> <--|-->|<-->|--> <L|R|T|B>:<id>[{group}]
//   align row|column <id> <id> ...     (accepted, no effect: see to-graph)
//
// Unlike Mermaid's own parser, every malformed statement throws with its line
// number rather than being dropped.
// ============================================================================

const ID = String.raw`[\w-]+`
const DECL_RE = new RegExp(
  String.raw`^(group|service)\s+(${ID})\s*(?:\(([^)]*)\))?\s*(?:\[([^\]]*)\])?(?:\s+in\s+(${ID}))?$`,
)
const JUNCTION_RE = new RegExp(
  String.raw`^junction\s+(${ID})(?:\s+in\s+(${ID}))?$`,
)
const EDGE_RE = new RegExp(
  String.raw`^(${ID})(\{group\})?:([LRTB])\s+(<)?--(>)?\s+([LRTB]):(${ID})(\{group\})?$`,
)
const ALIGN_RE = new RegExp(
  String.raw`^align\s+(?:row|column)\s+${ID}(?:\s+${ID})+$`,
)

type Kind = 'group' | 'service' | 'junction'

function fail(stmt: Statement, msg: string): never {
  throw new Error(
    `Architecture diagram, line ${stmt.line}: ${msg} — "${stmt.text}"`,
  )
}

/** Strip the optional quotes around a custom icon name like `"logos:aws"`. */
function cleanIcon(raw: string | undefined): string | undefined {
  const icon = raw?.trim().replace(/^"(.*)"$/, '$1')
  return icon || undefined
}

/**
 * Parse a Mermaid architecture diagram.
 * Expects the first statement to be the `architecture-beta` header.
 */
export function parseArchitecture(lines: Statement[]): ArchitectureDiagram {
  const diagram: ArchitectureDiagram = {
    groups: [],
    services: [],
    junctions: [],
    edges: [],
  }
  const kinds = new Map<string, Kind>()
  // `in` may name a group declared later, so parents and edge endpoints are
  // resolved after the loop.
  const parentRefs: { stmt: Statement; parent: string }[] = []
  const pendingEdges: { stmt: Statement; edge: ArchitectureEdge }[] = []

  const declare = (
    stmt: Statement,
    id: string,
    kind: Kind,
    parent: string | undefined,
  ): void => {
    if (kinds.has(id)) fail(stmt, `duplicate id "${id}"`)
    if (parent === id) fail(stmt, `"${id}" cannot be inside itself`)
    kinds.set(id, kind)
    if (parent) parentRefs.push({ stmt, parent })
  }

  for (let i = 1; i < lines.length; i++) {
    const stmt = lines[i]!
    const text = stmt.text

    const decl = text.match(DECL_RE)
    if (decl) {
      const kind = decl[1] as 'group' | 'service'
      const id = decl[2]!
      const title = decl[4]
      const parent = decl[5]
      declare(stmt, id, kind, parent)
      const entry = {
        id,
        icon: cleanIcon(decl[3]),
        title: title !== undefined ? normalizeBrTags(title.trim()) : id,
        parent,
      }
      if (kind === 'group') diagram.groups.push(entry)
      else diagram.services.push(entry)
      continue
    }

    const junction = text.match(JUNCTION_RE)
    if (junction) {
      const id = junction[1]!
      const parent = junction[2]
      declare(stmt, id, 'junction', parent)
      diagram.junctions.push({ id, parent })
      continue
    }

    const edge = text.match(EDGE_RE)
    if (edge) {
      pendingEdges.push({
        stmt,
        edge: {
          source: edge[1]!,
          sourceGroup: edge[2] !== undefined,
          sourcePort: edge[3] as ArchitecturePort,
          arrowStart: edge[4] !== undefined,
          arrowEnd: edge[5] !== undefined,
          targetPort: edge[6] as ArchitecturePort,
          target: edge[7]!,
          targetGroup: edge[8] !== undefined,
        },
      })
      continue
    }

    // Alignment constraints (Mermaid v11.16+) have no flowchart equivalent.
    if (ALIGN_RE.test(text)) continue

    fail(stmt, 'unrecognized statement')
  }

  for (const { stmt, parent } of parentRefs) {
    if (kinds.get(parent) !== 'group') {
      fail(stmt, `"in ${parent}" must name a declared group`)
    }
  }

  const parentOf = new Map<string, string>()
  for (const g of diagram.groups) if (g.parent) parentOf.set(g.id, g.parent)
  for (const g of diagram.groups) {
    const seen = new Set([g.id])
    for (let p = parentOf.get(g.id); p; p = parentOf.get(p)) {
      if (seen.has(p)) {
        throw new Error(
          `Architecture diagram: group "${g.id}" is nested inside itself`,
        )
      }
      seen.add(p)
    }
  }

  for (const { stmt, edge } of pendingEdges) {
    const ends: [string, boolean][] = [
      [edge.source, edge.sourceGroup],
      [edge.target, edge.targetGroup],
    ]
    for (const [id, viaGroup] of ends) {
      const kind = kinds.get(id)
      if (!kind) fail(stmt, `unknown id "${id}"`)
      if (kind === 'group') {
        fail(stmt, `edges connect services or junctions, not the group "${id}"`)
      }
      const parent = [...diagram.services, ...diagram.junctions].find(
        (n) => n.id === id,
      )?.parent
      if (viaGroup && !parent) {
        fail(stmt, `"{group}" needs "${id}" to be declared inside a group`)
      }
    }
    diagram.edges.push(edge)
  }

  return diagram
}
