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
      const member = parseMember(line)
      if (member) {
        if (member.isMethod) {
          currentClass.methods.push(member.member)
        } else {
          currentClass.attributes.push(member.member)
        }
      }
      continue
    }

    // --- click interaction: `click ClassName "url" "tooltip" _blank` / `click ClassName call fn()` ---
    if (/^click\s+/i.test(line)) {
      applyClickStatement(line, diagram.interactions)
      continue
    }

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

    // --- Class block start: `class ClassName {` or `class ClassName` ---
    const classBlockMatch = line.match(/^class\s+(\S+?)(?:\s*~(\w+)~)?\s*\{$/)
    if (classBlockMatch) {
      const id = classBlockMatch[1]!
      const generic = classBlockMatch[2]
      const cls = ensureClass(classMap, id)
      if (generic) {
        cls.label = `${id}<${generic}>`
      }
      currentClass = cls
      braceDepth = 1
      if (currentNamespace) {
        currentNamespace.classIds.push(id)
      }
      continue
    }

    // --- Standalone class declaration (no body): `class ClassName` ---
    const classOnlyMatch = line.match(/^class\s+(\S+?)(?:\s*~(\w+)~)?\s*$/)
    if (classOnlyMatch) {
      const id = classOnlyMatch[1]!
      const generic = classOnlyMatch[2]
      const cls = ensureClass(classMap, id)
      if (generic) {
        cls.label = `${id}<${generic}>`
      }
      if (currentNamespace) {
        currentNamespace.classIds.push(id)
      }
      continue
    }

    // --- Inline annotation: `class ClassName { <<interface>> }` (single line) ---
    const inlineAnnotMatch = line.match(
      /^class\s+(\S+?)\s*\{\s*<<(\w+)>>\s*\}$/,
    )
    if (inlineAnnotMatch) {
      const cls = ensureClass(classMap, inlineAnnotMatch[1]!)
      cls.annotation = inlineAnnotMatch[2]!
      continue
    }

    // --- Inline attribute: `ClassName : +String name` ---
    const inlineAttrMatch = line.match(/^(\S+?)\s*:\s*(.+)$/)
    if (inlineAttrMatch) {
      // Make sure this isn't a relationship line (those have arrows)
      const rest = inlineAttrMatch[2]!
      if (!rest.match(/<\|--|--|\*--|o--|-->|\.\.>|\.\.\|>/)) {
        const cls = ensureClass(classMap, inlineAttrMatch[1]!)
        const member = parseMember(rest)
        if (member) {
          if (member.isMethod) {
            cls.methods.push(member.member)
          } else {
            cls.attributes.push(member.member)
          }
        }
        continue
      }
    }

    // --- Relationship ---
    // Pattern: [FROM] ["card"] ARROW ["card"] [TO] [: label]
    // Arrows: <|--, *--, o--, -->, ..|>, ..>
    // Can also be reversed: --o, --*, --|>
    const rel = parseRelationship(line)
    if (rel) {
      // Ensure both classes exist
      ensureClass(classMap, rel.from)
      ensureClass(classMap, rel.to)
      diagram.relationships.push(rel)
      continue
    }
  }

  diagram.classes = [...classMap.values()]
  return diagram
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

/** Count occurrences of `needle` in `input`. */
function countOccurrence(input: string, needle: string): number {
  return Math.max(0, input.split(needle).length - 1)
}

/**
 * Convert one comma-free (or already re-joined) segment's `~`-delimited
 * generics to angle brackets, pairing the outermost `~`s first so nested
 * generics like `List~List~T~~` become `List<List<T>>`. A segment with a
 * single `~` is left alone — there's nothing to pair it with — and an odd
 * count with a leading `~` keeps that leading one as-is (mermaid treats it
 * as literal text, not a delimiter). Mirrors mermaid's `processSet`.
 */
function convertGenericSegment(input: string): string {
  const tildeCount = countOccurrence(input, '~')
  if (tildeCount <= 1) return input

  let text = input
  let keepLeadingTilde = false
  if (tildeCount % 2 !== 0 && text.startsWith('~')) {
    text = text.slice(1)
    keepLeadingTilde = true
  }

  const chars = [...text]
  let open = chars.indexOf('~')
  let close = chars.lastIndexOf('~')
  while (open !== -1 && close !== -1 && open !== close) {
    chars[open] = '<'
    chars[close] = '>'
    open = chars.indexOf('~')
    close = chars.lastIndexOf('~')
  }
  if (keepLeadingTilde) chars.unshift('~')
  return chars.join('')
}

/**
 * Convert mermaid's `~T~` generic syntax to the `<T>` form mermaid itself
 * renders — `List~Observer~` → `List<Observer>`, `Map~K,V~` → `Map<K,V>`,
 * `List~List~T~~` → `List<List<T>>`.
 *
 * Port of mermaid's `parseGenericTypes` (packages/mermaid/src/diagrams/
 * common/common.ts): the text is split on commas so a comma *inside* a
 * generic (`Map~K,V~`) can be re-joined with its neighbors — two adjacent
 * comma-separated pieces that each carry exactly one `~` are the two halves
 * of one generic — before each piece's `~` pairs are converted outermost-first.
 */
export function parseGenericTypes(input: string): string {
  const pieces = input.split(/(,)/)
  const output: string[] = []
  for (let i = 0; i < pieces.length; i++) {
    let piece = pieces[i]!
    if (piece === ',' && i > 0 && i + 1 < pieces.length) {
      const previous = pieces[i - 1]!
      const next = pieces[i + 1]!
      if (
        countOccurrence(previous, '~') === 1 &&
        countOccurrence(next, '~') === 1
      ) {
        piece = `${previous},${next}`
        i++
        output.pop()
      }
    }
    output.push(convertGenericSegment(piece))
  }
  return output.join('')
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

  // Mermaid renders `List~Observer~` as `List<Observer>` (its own
  // `parseGenericTypes`). It's applied per field below — name, params and
  // return type separately, the way mermaid's ClassMember does — rather
  // than to the whole line, since the comma re-join inside
  // parseGenericTypes would otherwise pair a `~` in the params with one in
  // the return type. Doing it after the visibility prefix is stripped also
  // keeps a package-visibility `~` from pairing with a generic's.

  // Check if it's a method (has parentheses)
  const methodMatch = rest.match(/^(.+?)\(([^)]*)\)(?:\s*(.+))?$/)
  if (methodMatch) {
    const name = parseGenericTypes(methodMatch[1]!.trim())
    const rawParams = methodMatch[2]?.trim()
    const params = rawParams ? parseGenericTypes(rawParams) : undefined // Store the parameter string
    const rawType = methodMatch[3]?.trim()
    const type = rawType ? parseGenericTypes(rawType) : undefined
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
  const parts = parseGenericTypes(rest).split(/\s+/)
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
  // Pattern: FROM ["card"] ARROW ["card"] TO [: label]
  const match = line.match(
    /^(\S+?)\s+(?:"([^"]*?)"\s+)?(<\|--|<\|\.\.|\*--|o--|-->|--\*|--o|--\|>|\.\.>|\.\.\|>|<--|<\.\.?|--)\s+(?:"([^"]*?)"\s+)?(\S+?)(?:\s*:\s*(.+))?$/,
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
  const to = match[5]!
  const rawLabel = match[6]?.trim()
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
