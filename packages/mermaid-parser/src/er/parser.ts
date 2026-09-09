import type {
  ErDiagram,
  ErEntity,
  ErAttribute,
  ErRelationship,
  Cardinality,
} from './types.ts'
import {
  normalizeBrTags,
  toDirection,
  type Statement,
} from '@zombie-mermaid/core'

// ============================================================================
// ER diagram parser
//
// Parses Mermaid erDiagram syntax into an ErDiagram structure.
//
// Supported syntax:
//   CUSTOMER ||--o{ ORDER : places
//   CUSTOMER {
//     string name PK
//     int age
//     string email UK "user email"
//   }
//
// Cardinality notation:
//   ||  ||  exactly one
//   |o  o|  zero or one
//   }|  |{  one or more
//   }o  o{  zero or more
//
// Line style:
//   --  identifying (solid line)
//   ..  non-identifying (dashed line)
// ============================================================================

/**
 * Parse a Mermaid ER diagram.
 * Expects the first line to be "erDiagram".
 */
// Audited for issue #100 (non-null assertions): every `!` in this file is
// either a bounds-checked loop-index array access (`lines[i]!` inside a
// `for (let i = 1; i < lines.length; ...)` loop) or a regex-mandatory-
// capture-group access after `.match()` (a group that isn't wrapped in an
// optional `(?:...)?`, so it always participates when the overall match
// succeeds). Both are the same idioms already accepted as justified
// elsewhere in this codebase (see src/parser.ts, PR #158, and this
// subsystem's layout.ts/renderer.ts audit, PR #148, which fixed the
// genuinely risky assertions there but didn't reach this file — PR #146
// separately reviewed this file's `as` casts, which are a different
// concern from these `!`s) — `noUncheckedIndexedAccess` can't see either
// guarantee, but removing the `!` would only replace a proven-safe
// assertion with an unreachable guard. Left as-is; no behavior change.
export function parseErDiagram(lines: Statement[]): ErDiagram {
  const diagram: ErDiagram = {
    entities: [],
    relationships: [],
  }

  // Track entities by ID for deduplication
  const entityMap = new Map<string, ErEntity>()
  // Track entity body parsing
  let currentEntity: ErEntity | null = null

  for (let i = 1; i < lines.length; i++) {
    const stmt = lines[i]!
    const line = stmt.text

    // --- Inside entity body ---
    if (currentEntity) {
      if (line === '}') {
        currentEntity = null
        continue
      }

      // Attribute line: type name [PK|FK|UK] ["comment"]
      const attr = parseAttribute(line)
      if (attr) {
        currentEntity.attributes.push(attr)
      }
      continue
    }

    // --- direction directive: `direction TB` / `direction LR` / etc. ---
    // ER diagrams have no subgraph nesting, so a single top-level direction
    // applies to the whole diagram (unlike flowcharts, where `direction` can
    // also appear per-subgraph).
    const dirMatch = line.match(/^direction\s+(TD|TB|LR|BT|RL)\s*$/i)
    if (dirMatch) {
      diagram.direction = toDirection(dirMatch[1]!)
      continue
    }

    // --- Entity block start: `ENTITY_NAME {`, `id[Alias Label] {`, or
    // `id["Quoted Alias"] {` — optionally with the body (and even the
    // closing `}`) inline on the same line, e.g. `p[Person] { string name }`.
    const entityBlockMatch = line.match(/^(\S+?)(?:\[(.+)\])?\s*\{(.*)$/)
    if (entityBlockMatch) {
      const id = entityBlockMatch[1]!
      const aliasRaw = entityBlockMatch[2]
      const alias =
        aliasRaw !== undefined
          ? normalizeBrTags(aliasRaw.trim().replace(/^["']|["']$/g, ''))
          : undefined
      const entity = ensureEntity(entityMap, id, alias)

      const trailing = entityBlockMatch[3]!.trim()
      const closesInline = trailing.endsWith('}')
      const body = closesInline ? trailing.slice(0, -1).trim() : trailing
      for (const part of body
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)) {
        const attr = parseAttribute(part)
        if (attr) entity.attributes.push(attr)
      }

      // Only keep the block open for subsequent attribute lines when this
      // line didn't already close it.
      if (!closesInline) {
        currentEntity = entity
      }
      continue
    }

    // --- Relationship: `ENTITY1 cardinality1--cardinality2 ENTITY2 : label` ---
    const rel = parseRelationshipLine(line, stmt.line)
    if (rel) {
      // Ensure both entities exist
      ensureEntity(entityMap, rel.entity1)
      ensureEntity(entityMap, rel.entity2)
      diagram.relationships.push(rel)
      continue
    }
  }

  diagram.entities = [...entityMap.values()]
  return diagram
}

/**
 * Ensure an entity exists in the map. When `alias` is provided (from an
 * `id[Alias]` entity-block header), it becomes the display label while the
 * map key — and every relationship reference — stays keyed off the raw `id`.
 */
function ensureEntity(
  entityMap: Map<string, ErEntity>,
  id: string,
  alias?: string,
): ErEntity {
  let entity = entityMap.get(id)
  if (!entity) {
    entity = { id, label: alias ?? id, attributes: [] }
    entityMap.set(id, entity)
  } else if (alias !== undefined) {
    entity.label = alias
  }
  return entity
}

/** Parse an attribute line inside an entity block */
function parseAttribute(line: string): ErAttribute | null {
  // Format: type name [PK|FK|UK [...]] ["comment"]
  const match = line.match(/^(\S+)\s+(\S+)(?:\s+(.+))?$/)
  if (!match) return null

  const type = match[1]!
  const name = match[2]!
  const rest = match[3]?.trim() ?? ''

  // Extract key constraints (PK, FK, UK) and optional comment
  const keys: ErAttribute['keys'] = []
  let comment: string | undefined

  // Extract quoted comment first (supports <br> tags)
  const commentMatch = rest.match(/"([^"]*)"/)
  if (commentMatch) {
    comment = normalizeBrTags(commentMatch[1]!)
  }

  // Extract key constraints
  const restWithoutComment = rest.replace(/"[^"]*"/, '').trim()
  for (const part of restWithoutComment.split(/\s+/)) {
    const upper = part.toUpperCase()
    if (upper === 'PK' || upper === 'FK' || upper === 'UK') {
      keys.push(upper)
    }
  }

  return { type, name, keys, comment }
}

/**
 * Parse a relationship line.
 *
 * Cardinality symbols on each side of the line style:
 *   Left side (entity1):  ||  |o  }|  }o
 *   Line:                 --  (identifying) or  ..  (non-identifying)
 *   Right side (entity2): ||  o|  |{  o{
 *
 * Full pattern example: CUSTOMER ||--o{ ORDER : places
 */
function parseRelationshipLine(
  line: string,
  lineNumber: number,
): ErRelationship | null {
  // Loosely match a line shaped like a relationship attempt: two bare
  // tokens flanking a `--`/`..`-based marker, with an optional `: label`.
  // A line with no such marker at all doesn't look like a relationship
  // attempt and falls through silently (returns null), same as before —
  // that part of the parser's leniency is unchanged.
  //
  // Everything that *does* match this shape is validated below and either
  // returns a fully-parsed relationship or throws an actionable error.
  // Before this pass, an invalid cardinality token or a missing/empty
  // label silently dropped the *entire* line (both entities included)
  // with zero indication anything was wrong — see issue #541 (parser
  // error-message quality audit — this parser had zero throw sites before
  // this pass).
  const attempt = line.match(
    /^(\S+)\s+(\S*(?:--|\.\.)\S*)\s+(\S+)\s*(?::\s*(.*))?$/,
  )
  if (!attempt) return null

  const entity1 = attempt[1]!
  const cardinalityStr = attempt[2]!
  const entity2 = attempt[3]!
  const hasLabel = attempt[4] !== undefined
  const rawLabel = attempt[4]?.trim() ?? ''

  // Cardinality symbols on each side of the line style:
  //   Left side (entity1):  ||  |o  }|  }o
  //   Line:                 --  (identifying) or  ..  (non-identifying)
  //   Right side (entity2): ||  o|  |{  o{
  // `shapeMatch` only confirms the token is built from crow's-foot
  // characters around a line-style marker — `parseLeftCardinality`/
  // `parseRightCardinality` still reject a shape match that isn't one of
  // the four valid two-character combinations per side (e.g. a lone "|").
  const shapeMatch = cardinalityStr.match(/^([|o}{]*)(--|\.\.?)([|o}{]*)$/)
  const cardinality1 = shapeMatch ? parseLeftCardinality(shapeMatch[1]!) : null
  const cardinality2 = shapeMatch ? parseRightCardinality(shapeMatch[3]!) : null

  if (!cardinality1 || !cardinality2) {
    throw new Error(
      `Line ${lineNumber}: Invalid ER relationship cardinality "${cardinalityStr}" in "${line}". ` +
        'Left side must be one of ||, |o, }|, }o; right side must be one of ||, o|, |{, o{ (e.g. "||--o{").',
    )
  }

  if (!hasLabel || rawLabel.length === 0) {
    throw new Error(
      `Line ${lineNumber}: ER relationship "${entity1} ${cardinalityStr} ${entity2}" is missing a ": label" — expected e.g. "${entity1} ${cardinalityStr} ${entity2} : label".`,
    )
  }

  // Strip surrounding quotes if present, then normalize br tags.
  const label = normalizeBrTags(rawLabel.replace(/^["']|["']$/g, ''))
  const identifying = shapeMatch![2] === '--'

  return { entity1, entity2, cardinality1, cardinality2, label, identifying }
}

/**
 * Parse a left-side (entity1) cardinality notation string.
 * The crow's-foot character sits nearer the entity, so left- and
 * right-side notations are mirror images of each other and must be
 * matched exactly rather than order-normalized (sorting `}o` and `o{`
 * to the same key conflates "zero or more" with malformed input).
 */
function parseLeftCardinality(str: string): Cardinality | null {
  if (str === '||') return 'one'
  if (str === '|o') return 'zero-one'
  if (str === '}|') return 'many'
  if (str === '}o') return 'zero-many'
  return null
}

/** Parse a right-side (entity2) cardinality notation string. */
function parseRightCardinality(str: string): Cardinality | null {
  if (str === '||') return 'one'
  if (str === 'o|') return 'zero-one'
  if (str === '|{') return 'many'
  if (str === 'o{') return 'zero-many'
  return null
}
