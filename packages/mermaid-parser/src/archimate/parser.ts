import { normalizeBrTags, type Statement } from '@zombie-mermaid/core'
import {
  ARCHIMATE_ELEMENT_TYPES,
  ARCHIMATE_LAYERS,
  ARCHIMATE_RELATIONSHIP_TYPES,
} from './types.ts'
import type {
  ArchiMateDiagram,
  ArchiMateElement,
  ArchiMateElementType,
  ArchiMateLayer,
  ArchiMateRelationshipType,
} from './types.ts'

// ============================================================================
// ArchiMate diagram parser
//
// Parses the `archimate-layered` DSL. Mermaid itself has no ArchiMate diagram
// (mermaid-js/mermaid discussion #4007 is an open request), so this syntax is
// the one proposed in lukilabs/beautiful-mermaid#34 and kept by #71; it is
// accepted unchanged so their fixtures and any sources written against them
// keep working.
//
//   archimate-layered
//     business:
//       actor Customer
//       service "Online Banking" as OB
//     application:
//       component "Web App" as WA
//     Customer -->|serving| OB
//     OB -->|realization| WA
//
// Layer blocks: strategy:, motivation:, business:, application:, technology:,
//               physical:, implementation:
//
// Element declarations (inside a layer block):
//   type alias                  id = alias,           label = alias
//   type "Label" as alias       id = alias,           label = Label
//   type "Label"                id = Label (spaces -> _), label = Label
//
// Relationships (anywhere after the header):
//   source -->|type| target     one of the 11 ArchiMate relationship types
//   source --> target           association
//
// Unlike the upstream parser, which silently dropped lines it did not
// understand, every malformed statement throws with its line number, as the
// C4 parser does.
// ============================================================================

const LAYER_SET: ReadonlySet<string> = new Set(ARCHIMATE_LAYERS)
const RELATIONSHIP_SET: ReadonlySet<string> = new Set(
  ARCHIMATE_RELATIONSHIP_TYPES,
)
/**
 * Every element type, regardless of layer. Upstream accepts a known type in
 * any layer block ("the layer just provides context"), so `service` works in
 * `technology:` and `node` in `business:`; kept as-is.
 */
const ELEMENT_SET: ReadonlySet<string> = new Set(
  Object.values(ARCHIMATE_ELEMENT_TYPES).flat(),
)

function fail(stmt: Statement, msg: string): never {
  throw new Error(
    `ArchiMate diagram, line ${stmt.line}: ${msg} — "${stmt.text}"`,
  )
}

/** Parse a `type "Label" as alias` / `type "Label"` / `type alias` line. */
function parseElementLine(
  text: string,
): { type: string; id: string; label: string } | null {
  const quotedAlias = text.match(/^(\w+)\s+"([^"]+)"\s+as\s+(\w+)$/)
  if (quotedAlias) {
    return {
      type: quotedAlias[1]!,
      id: quotedAlias[3]!,
      label: normalizeBrTags(quotedAlias[2]!),
    }
  }
  const quoted = text.match(/^(\w+)\s+"([^"]+)"$/)
  if (quoted) {
    return {
      type: quoted[1]!,
      id: quoted[2]!.replace(/\s+/g, '_'),
      label: normalizeBrTags(quoted[2]!),
    }
  }
  const simple = text.match(/^(\w+)\s+(\w+)$/)
  if (simple) return { type: simple[1]!, id: simple[2]!, label: simple[2]! }
  return null
}

/**
 * Parse an ArchiMate diagram. Expects the first statement to be the
 * `archimate-layered` header.
 */
export function parseArchimate(lines: Statement[]): ArchiMateDiagram {
  const header = lines[0]?.text.trim().toLowerCase()
  if (header !== 'archimate-layered') {
    throw new Error(
      `ArchiMate diagram: expected a header of "archimate-layered", got "${lines[0]?.text ?? ''}"`,
    )
  }

  const diagram: ArchiMateDiagram = {
    layers: new Map(),
    elements: new Map(),
    relationships: [],
  }
  const relationshipLines: Statement[] = []
  let currentLayer: ArchiMateLayer | null = null

  for (let i = 1; i < lines.length; i++) {
    const stmt = lines[i]!
    const text = stmt.text

    const layerMatch = text.match(/^(\w+):$/)
    if (layerMatch) {
      const name = layerMatch[1]!
      if (!LAYER_SET.has(name)) {
        fail(
          stmt,
          `unknown layer "${name}" (expected ${ARCHIMATE_LAYERS.join(', ')})`,
        )
      }
      currentLayer = name as ArchiMateLayer
      if (!diagram.layers.has(currentLayer))
        diagram.layers.set(currentLayer, [])
      continue
    }

    const relMatch = text.match(/^(\w+)\s*-->\s*(?:\|\s*(\w+)\s*\|)?\s*(\w+)$/)
    if (relMatch) {
      const type = relMatch[2] ?? 'association'
      if (!RELATIONSHIP_SET.has(type)) {
        fail(
          stmt,
          `unknown relationship type "${type}" (expected ${ARCHIMATE_RELATIONSHIP_TYPES.join(', ')})`,
        )
      }
      diagram.relationships.push({
        source: relMatch[1]!,
        target: relMatch[3]!,
        type: type as ArchiMateRelationshipType,
      })
      relationshipLines.push(stmt)
      continue
    }

    const decl = parseElementLine(text)
    if (!decl) fail(stmt, 'unrecognized statement')
    if (!ELEMENT_SET.has(decl.type)) {
      fail(stmt, `unknown element type "${decl.type}"`)
    }
    if (!currentLayer) {
      fail(stmt, 'element declared outside a layer block (e.g. "business:")')
    }
    if (diagram.elements.has(decl.id)) {
      fail(stmt, `duplicate element id "${decl.id}"`)
    }
    const element: ArchiMateElement = {
      id: decl.id,
      label: decl.label,
      type: decl.type as ArchiMateElementType,
      layer: currentLayer,
    }
    diagram.elements.set(element.id, element)
    diagram.layers.get(currentLayer)!.push(element)
  }

  diagram.relationships.forEach((rel, idx) => {
    for (const end of [rel.source, rel.target]) {
      if (!diagram.elements.has(end)) {
        fail(
          relationshipLines[idx]!,
          `relationship refers to undeclared element "${end}"`,
        )
      }
    }
  })

  return diagram
}
