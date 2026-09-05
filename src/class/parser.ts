import type {
  ClassDiagram,
  ClassNode,
  ClassRelationship,
  ClassMember,
  RelationshipType,
  ClassNamespace,
} from './types.ts'
import { normalizeBrTags } from '../multiline-utils.ts'
import { applyClickStatement } from '../click-directive.ts'
import {
  splitClassShorthand,
  tryApplyClassAssignment,
  tryApplyClassDef,
  tryApplyCssClass,
  tryApplyStyleStatement,
} from '../style-directives.ts'

// ============================================================================
// Class diagram parser
//
// Parses Mermaid classDiagram syntax into a ClassDiagram structure.
//
// Supported syntax:
//   class Animal { +String name; +eat() void }
//   class Shape { <<abstract>> }
//   Animal <|-- Dog           (inheritance)
//   Car *-- Engine            (composition)
//   Car o-- Wheel             (aggregation)
//   A --> B                   (association)
//   A ..> B                   (dependency)
//   A ..|> B                  (realization)
//   A "1" --> "*" B : label   (with cardinality + label)
//   Animal : +String name     (inline attribute)
//   namespace MyNamespace { class A { } }
//   click Animal "https://example.com" "Tooltip" _blank   (see docs/decisions/no-script-interactivity.md)
//   classDef name fill:#f96   /  style Animal fill:#f96   /  cssClass "A,B" name
//   class Animal:::name       (style-class shorthand, also on relationship ends)
//   note "text"  /  note for Animal "line1\nline2"
// ============================================================================

/**
 * Parse a Mermaid class diagram.
 * Expects the first line to be "classDiagram".
 */
// Audited for issue #100 (non-null assertions): every `!` in this file is
// either a bounds-checked loop-index array access (`lines[i]!` inside a
// `for (let i = 1; i < lines.length; ...)` loop) or a regex-mandatory-
// capture-group access after `.match()` (a group that isn't wrapped in an
// optional `(?:...)?`, so it always participates when the overall match
// succeeds). Both are the same idioms already accepted as justified
// elsewhere in this codebase (see src/parser.ts, PR #158, and this
// subsystem's earlier layout.ts/renderer.ts audit, PR #147, which fixed
// the genuinely risky assertions but didn't reach this file) —
// `noUncheckedIndexedAccess` can't see either guarantee, but removing the
// `!` would only replace a proven-safe assertion with an unreachable guard.
// Left as-is; no behavior change.
export function parseClassDiagram(lines: string[]): ClassDiagram {
  const diagram: ClassDiagram = {
    classes: [],
    relationships: [],
    namespaces: [],
    interactions: new Map(),
    classDefs: new Map(),
    classAssignments: new Map(),
    nodeStyles: new Map(),
    notes: [],
  }

  // Track classes by ID for deduplication
  const classMap = new Map<string, ClassNode>()
  // Track namespace nesting
  let currentNamespace: ClassNamespace | null = null
  // Track class body parsing
  let currentClass: ClassNode | null = null
  let braceDepth = 0

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!

    // --- Inside a class body block ---
    if (currentClass && braceDepth > 0) {
      if (line === '}') {
        braceDepth--
        if (braceDepth === 0) {
          currentClass = null
        }
        continue
      }

      // Check for annotation like <<interface>>
      const annotMatch = line.match(/^<<(\w+)>>$/)
      if (annotMatch) {
        currentClass.annotation = annotMatch[1]!
        continue
      }

      // Parse member: visibility, name, type, optional parens for method
      addMember(currentClass, line)
      continue
    }

    // --- click interaction: `click ClassName "url" "tooltip" _blank` / `click ClassName call fn()` ---
    if (/^click\s+/i.test(line)) {
      applyClickStatement(line, diagram.interactions)
      continue
    }

    // --- Notes: `note "text"` / `note for ClassName "text"` ---
    // Mermaid's grammar takes a quoted string (`noteText: STR`) and its
    // renderer splits the text on `\n` after JSON-parsing it (svgDraw.js
    // drawNote), so a literal `\n` in the source is a line break;
    // normalizeBrTags handles that and `<br/>`, the form the rest of this
    // repo's labels use. The class need not be declared first (or at all).
    const noteMatch = line.match(/^note\s+(?:for\s+(\S+)\s+)?"([^"]*)"\s*$/)
    if (noteMatch) {
      const forClass = noteMatch[1]
      diagram.notes.push({
        text: normalizeBrTags(noteMatch[2]!),
        ...(forClass ? { forClass } : {}),
      })
      continue
    }

    // --- Styling: `classDef`, `style`, `cssClass "A,B" name`, `class A,B name` ---
    // Shared with the flowchart parser (src/style-directives.ts). The
    // `class A,B name` assignment form is checked before the declaration
    // regexes below: a declaration never has a second bare-word token after
    // the class id (`class Animal`, `class Animal~T~`, `class Animal {`), so
    // the two can't collide. Mermaid's own class grammar only spells the
    // attachment as `cssClass "A,B" name` / `A:::name`; the flowchart-style
    // `class A,B name` is accepted here for parity with flowcharts.
    if (tryApplyClassDef(line, diagram)) continue
    if (tryApplyStyleStatement(line, diagram)) continue
    if (tryApplyCssClass(line, diagram)) continue
    if (tryApplyClassAssignment(line, diagram)) continue

    // --- Namespace block start ---
    const nsMatch = line.match(/^namespace\s+(\S+)\s*\{$/)
    if (nsMatch) {
      currentNamespace = { name: nsMatch[1]!, classIds: [] }
      continue
    }

    // --- Namespace end ---
    if (line === '}' && currentNamespace) {
      diagram.namespaces.push(currentNamespace)
      currentNamespace = null
      continue
    }

    // --- Class block start: `class ClassName {` or `class ClassName:::style {` ---
    const classBlockMatch = line.match(/^class\s+(\S+?)(?:\s*~(\w+)~)?\s*\{$/)
    if (classBlockMatch) {
      const id = declareClass(classBlockMatch[1]!, classBlockMatch[2])
      currentClass = classMap.get(id) ?? null
      braceDepth = 1
      continue
    }

    // --- Standalone class declaration (no body): `class ClassName` / `class ClassName:::style` ---
    const classOnlyMatch = line.match(/^class\s+(\S+?)(?:\s*~(\w+)~)?\s*$/)
    if (classOnlyMatch) {
      declareClass(classOnlyMatch[1]!, classOnlyMatch[2])
      continue
    }

    // --- Single-line body: `class ClassName { <<interface>> }` / `class ClassName:::style { -int size }` ---
    // One annotation or one member; `;`-separated members on a single line
    // are already split into separate statements upstream, so a multi-member
    // body can't reach here intact.
    const inlineBodyMatch = line.match(/^class\s+(\S+?)\s*\{\s*(.*?)\s*\}$/)
    if (inlineBodyMatch) {
      const id = declareClass(inlineBodyMatch[1]!, undefined)
      const cls = classMap.get(id)
      const body = inlineBodyMatch[2]!
      const annotMatch = body.match(/^<<(\w+)>>$/)
      if (cls && annotMatch) {
        cls.annotation = annotMatch[1]!
      } else if (cls && body) {
        addMember(cls, body)
      }
      continue
    }

    // --- Inline attribute: `ClassName : +String name` ---
    const inlineAttrMatch = line.match(/^(\S+?)\s*:\s*(.+)$/)
    if (inlineAttrMatch) {
      // Make sure this isn't a relationship line (those have arrows)
      const rest = inlineAttrMatch[2]!
      if (!rest.match(/<\|--|--|\*--|o--|-->|\.\.>|\.\.\|>/)) {
        addMember(ensureClass(classMap, inlineAttrMatch[1]!), rest)
        continue
      }
    }

    // --- Relationship ---
    // Pattern: [FROM] ["card"] ARROW ["card"] [TO] [: label]
    // Arrows: <|--, *--, o--, -->, ..|>, ..>
    // Can also be reversed: --o, --*, --|>
    const rel = parseRelationship(line)
    if (rel) {
      // Ensure both classes exist. Either end may carry the `:::style`
      // shorthand (Mermaid's docs warn against combining it with a relation
      // statement, but it's better to strip it than to mint a class whose id
      // is the literal `Animal:::someclass`).
      rel.from = declareClass(rel.from, undefined, false)
      rel.to = declareClass(rel.to, undefined, false)
      diagram.relationships.push(rel)
      continue
    }
  }

  diagram.classes = [...classMap.values()]
  return diagram

  /**
   * Register a class from a declaration token, splitting off any `:::style`
   * shorthand into `diagram.classAssignments`. Returns the bare id.
   *
   * @param generic - `~T~` generic parameter captured by the declaration regex
   * @param inNamespace - whether to record the class in the open namespace
   *                      (declarations do; relationship endpoints don't)
   */
  function declareClass(
    token: string,
    generic: string | undefined,
    inNamespace: boolean = true,
  ): string {
    const { id, className } = splitClassShorthand(token)
    const cls = ensureClass(classMap, id)
    if (generic) {
      cls.label = `${id}<${generic}>`
    }
    if (className) {
      diagram.classAssignments.set(id, className)
    }
    if (inNamespace && currentNamespace) {
      currentNamespace.classIds.push(id)
    }
    return id
  }
}

/** Parse one member line and file it under the class's attributes or methods. */
function addMember(cls: ClassNode, line: string): void {
  const member = parseMember(line)
  if (!member) return
  if (member.isMethod) {
    cls.methods.push(member.member)
  } else {
    cls.attributes.push(member.member)
  }
}

/** Ensure a class exists in the map, creating a default if needed */
function ensureClass(classMap: Map<string, ClassNode>, id: string): ClassNode {
  let cls = classMap.get(id)
  if (!cls) {
    cls = { id, label: id, attributes: [], methods: [] }
    classMap.set(id, cls)
  }
  return cls
}

/** Parse a class member line (attribute or method) */
function parseMember(
  line: string,
): { member: ClassMember; isMethod: boolean } | null {
  const trimmed = line.trim().replace(/;$/, '')
  if (!trimmed) return null

  // Extract visibility prefix
  let visibility: ClassMember['visibility'] = ''
  let rest = trimmed
  const visibilityChar = rest[0]
  if (
    visibilityChar === '+' ||
    visibilityChar === '-' ||
    visibilityChar === '#' ||
    visibilityChar === '~'
  ) {
    visibility = visibilityChar
    rest = rest.slice(1).trim()
  }

  // Check if it's a method (has parentheses)
  const methodMatch = rest.match(/^(.+?)\(([^)]*)\)(?:\s*(.+))?$/)
  if (methodMatch) {
    const name = methodMatch[1]!.trim()
    const params = methodMatch[2]?.trim() || undefined // Store the parameter string
    const type = methodMatch[3]?.trim()
    // Check for static ($) or abstract (*) markers
    const isStatic = name.endsWith('$') || rest.includes('$')
    const isAbstract = name.endsWith('*') || rest.includes('*')
    return {
      member: {
        visibility,
        name: name.replace(/[$*]$/, ''),
        type: type || undefined,
        isStatic,
        isAbstract,
        isMethod: true,
        params,
      },
      isMethod: true,
    }
  }

  // It's an attribute: [Type] name or name Type
  // Common patterns: "String name", "+int age", "name"
  const parts = rest.split(/\s+/)
  let name: string
  let type: string | undefined

  if (parts.length >= 2) {
    // "Type name" pattern
    type = parts[0]
    name = parts.slice(1).join(' ')
  } else {
    name = parts[0] ?? rest
  }

  const isStatic = name.endsWith('$')
  const isAbstract = name.endsWith('*')

  return {
    member: {
      visibility,
      name: name.replace(/[$*]$/, ''),
      type: type || undefined,
      isStatic,
      isAbstract,
      isMethod: false,
    },
    isMethod: false,
  }
}

/** Parse a relationship line into a ClassRelationship */
function parseRelationship(line: string): ClassRelationship | null {
  // Relationship regex — handles all arrow types with optional cardinality and labels
  // Pattern: FROM ["card"] ARROW ["card"] TO[:::style] [: label]
  // The `:::style` shorthand on TO is matched as its own group so the `:`
  // label separator that follows can't swallow it as a label of `::style`;
  // it's re-joined onto the id here and split off again by the caller.
  const match = line.match(
    /^(\S+?)\s+(?:"([^"]*?)"\s+)?(<\|--|<\|\.\.|\*--|o--|-->|--\*|--o|--\|>|\.\.>|\.\.\|>|<--|<\.\.?|--)\s+(?:"([^"]*?)"\s+)?(\S+?)(?::::([\w][\w-]*))?(?:\s*:\s*(.+))?$/,
  )
  if (!match) return null

  const from = match[1]!
  const rawFromCardinality = match[2]
  const fromCardinality = rawFromCardinality
    ? normalizeBrTags(rawFromCardinality)
    : undefined
  const arrow = match[3]!.trim()
  const rawToCardinality = match[4]
  const toCardinality = rawToCardinality
    ? normalizeBrTags(rawToCardinality)
    : undefined
  const to = match[6] ? `${match[5]!}:::${match[6]}` : match[5]!
  const rawLabel = match[7]?.trim()
  const label = rawLabel ? normalizeBrTags(rawLabel) : undefined

  const parsed = parseArrow(arrow)
  if (!parsed) return null

  return {
    from,
    to,
    type: parsed.type,
    markerAt: parsed.markerAt,
    label,
    fromCardinality,
    toCardinality,
  }
}

/**
 * Map arrow syntax to relationship type and marker placement side.
 * Prefix markers (`<|--`, `*--`, `o--`) place the UML shape at the 'from' end.
 * Suffix markers (`..|>`, `-->`, `..>`, `--*`, `--o`) place it at the 'to' end.
 */
function parseArrow(
  arrow: string,
): { type: RelationshipType; markerAt: 'from' | 'to' } | null {
  // Trim whitespace that might be captured by the regex
  const a = arrow.trim()
  switch (a) {
    case '<|--':
      return { type: 'inheritance', markerAt: 'from' }
    case '--|>':
      return { type: 'inheritance', markerAt: 'to' }
    case '<|..':
      return { type: 'realization', markerAt: 'from' }
    case '..|>':
      return { type: 'realization', markerAt: 'to' }
    case '*--':
      return { type: 'composition', markerAt: 'from' }
    case '--*':
      return { type: 'composition', markerAt: 'to' }
    case 'o--':
      return { type: 'aggregation', markerAt: 'from' }
    case '--o':
      return { type: 'aggregation', markerAt: 'to' }
    case '-->':
      return { type: 'association', markerAt: 'to' }
    case '<--':
      return { type: 'association', markerAt: 'from' }
    case '..>':
      return { type: 'dependency', markerAt: 'to' }
    case '<..':
      return { type: 'dependency', markerAt: 'from' }
    case '--':
      return { type: 'association', markerAt: 'to' }
    default:
      return null
  }
}
