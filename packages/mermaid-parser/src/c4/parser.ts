import { normalizeBrTags, type Statement } from '@zombie-mermaid/core'
import type {
  C4Boundary,
  C4Diagram,
  C4Element,
  C4ElementKind,
  C4LayoutHint,
  C4ElementShape,
  C4Relationship,
  C4Variant,
} from './types.ts'

// ============================================================================
// C4 diagram parser
//
// Supported syntax (Mermaid C4 macros):
//   Person / Person_Ext (alias, label, descr)
//   System[Db|Queue][_Ext] (alias, label, descr)
//   Container[Db|Queue][_Ext] (alias, label, techn, descr)
//   Component[Db|Queue][_Ext] (alias, label, techn, descr)
//   Boundary / Enterprise_Boundary / System_Boundary / Container_Boundary
//     (alias, label[, type]) { ... }
//   Deployment_Node / Node / Node_L / Node_R (alias, label, type, descr) { ... }
//   Rel / BiRel / Rel_U|Up|D|Down|L|Left|R|Right|Back (from, to, label, techn)
//   RelIndex (index, from, to, label, techn)
//   title <text>
//
// `Rel_U/D/L/R` record a placement hint (`C4Relationship.layout`) the
// renderers use to steer layout. Accepted and ignored (styling / layout
// config this renderer does not honor): UpdateElementStyle, UpdateRelStyle, UpdateLayoutConfig, LAYOUT_*,
// SHOW_LEGEND, SHOW_FLOATING_LEGEND, AddElementTag, AddRelTag,
// AddBoundaryTag, RoleTag. Named arguments (`$tags="x"`, `$link=...`) are
// dropped.
// ============================================================================

const HEADERS: Record<string, C4Variant> = {
  c4context: 'context',
  c4container: 'container',
  c4component: 'component',
  c4dynamic: 'dynamic',
  c4deployment: 'deployment',
}

const IGNORED_MACRO =
  /^(?:UpdateElementStyle|UpdateRelStyle|UpdateLayoutConfig|LAYOUT_[A-Z_]+|SHOW_LEGEND|SHOW_FLOATING_LEGEND|AddElementTag|AddRelTag|AddBoundaryTag|RoleTag)\b/

const ELEMENT_NAME = /^(Person|System|Container|Component)(Db|Queue)?(_Ext)?$/
const BOUNDARY_NAME =
  /^(?:Boundary|Enterprise_Boundary|System_Boundary|Container_Boundary)$/
const NODE_NAME = /^(?:Deployment_Node|Node|Node_L|Node_R)$/
const REL_NAME =
  /^(Rel|BiRel|Rel_U|Rel_Up|Rel_D|Rel_Down|Rel_L|Rel_Left|Rel_R|Rel_Right|Rel_Back|RelIndex)$/

const BOUNDARY_TYPES: Record<string, string> = {
  Enterprise_Boundary: 'ENTERPRISE',
  System_Boundary: 'SYSTEM',
  Container_Boundary: 'CONTAINER',
}

const REL_HINTS: Record<string, C4LayoutHint> = {
  Rel_U: 'up',
  Rel_Up: 'up',
  Rel_D: 'down',
  Rel_Down: 'down',
  Rel_L: 'left',
  Rel_Left: 'left',
  Rel_R: 'right',
  Rel_Right: 'right',
}

function unquote(a: string): string {
  const t = a.trim()
  const inner =
    t.length >= 2 && t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t
  return normalizeBrTags(inner)
}

/**
 * Split a macro's argument list on top-level commas. Double-quoted strings
 * may contain commas and parentheses; `$name=value` named arguments are
 * dropped. Returns null when a quote is unbalanced.
 */
function splitArgs(inner: string): string[] | null {
  const raw: string[] = []
  let cur = ''
  let inQuote = false
  for (const ch of inner) {
    if (ch === '"') inQuote = !inQuote
    if (ch === ',' && !inQuote) {
      raw.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  if (inQuote) return null
  raw.push(cur)
  return raw
    .map((a) => a.trim())
    .filter((a) => !a.startsWith('$'))
    .map(unquote)
}

/** `Name(args)` optionally followed by ` {`. */
const MACRO = /^([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)\s*(\{)?\s*$/

function fail(stmt: Statement, msg: string): never {
  throw new Error(`C4 diagram, line ${stmt.line}: ${msg} — "${stmt.text}"`)
}

/**
 * Parse a Mermaid C4 diagram. Expects the first statement to be a
 * `C4Context` / `C4Container` / `C4Component` / `C4Dynamic` /
 * `C4Deployment` header.
 */
export function parseC4Diagram(lines: Statement[]): C4Diagram {
  const variant = HEADERS[lines[0]?.text.trim().toLowerCase() ?? '']
  if (!variant) {
    throw new Error(
      `C4 diagram: expected a header of C4Context, C4Container, C4Component, C4Dynamic or C4Deployment, got "${lines[0]?.text ?? ''}"`,
    )
  }

  const diagram: C4Diagram = {
    variant,
    elements: [],
    boundaries: [],
    relationships: [],
  }
  const aliases = new Set<string>()
  const stack: C4Boundary[] = []
  /** Boundary declared on the previous statement without an inline `{`. */
  let pendingBoundary: C4Boundary | undefined

  const claim = (stmt: Statement, alias: string | undefined): string => {
    if (!alias) fail(stmt, 'missing alias (first argument)')
    if (aliases.has(alias)) fail(stmt, `duplicate alias "${alias}"`)
    aliases.add(alias)
    return alias
  }

  for (let i = 1; i < lines.length; i++) {
    const stmt = lines[i]!
    const line = stmt.text

    if (line === '}') {
      if (stack.length === 0) fail(stmt, 'unmatched "}"')
      stack.pop()
      continue
    }
    // Brace on its own line, directly after a boundary macro.
    if (line === '{') {
      if (!pendingBoundary) fail(stmt, 'unexpected "{"')
      stack.push(pendingBoundary)
      pendingBoundary = undefined
      continue
    }
    pendingBoundary = undefined

    const titleMatch = line.match(/^title(?:\s+(.*))?$/i)
    if (titleMatch) {
      diagram.title = normalizeBrTags((titleMatch[1] ?? '').trim())
      continue
    }

    if (IGNORED_MACRO.test(line)) continue

    const m = line.match(MACRO)
    if (!m) fail(stmt, 'unrecognized statement')
    const name = m[1]!
    const opensBlock = m[3] === '{'
    const args = splitArgs(m[2]!)
    if (!args) fail(stmt, 'unbalanced quotes')

    const el = name.match(ELEMENT_NAME)
    if (el) {
      if (opensBlock) fail(stmt, `"${name}" cannot contain a block`)
      const kind = el[1]!.toLowerCase() as C4ElementKind
      const shape: C4ElementShape =
        el[2] === 'Db' ? 'db' : el[2] === 'Queue' ? 'queue' : 'default'
      const hasTech = kind === 'container' || kind === 'component'
      const alias = claim(stmt, args[0])
      const element: C4Element = {
        alias,
        kind,
        shape,
        external: el[3] !== undefined,
        label: args[1] || alias,
      }
      const technology = hasTech ? args[2] : undefined
      const description = hasTech ? args[3] : args[2]
      if (technology) element.technology = technology
      if (description) element.description = description
      diagram.elements.push(element)
      stack.at(-1)?.elementAliases.push(alias)
      continue
    }

    if (BOUNDARY_NAME.test(name) || NODE_NAME.test(name)) {
      const isNode = NODE_NAME.test(name)
      const alias = claim(stmt, args[0])
      const boundary: C4Boundary = {
        alias,
        label: args[1] || alias,
        elementAliases: [],
        children: [],
      }
      // Only deployment nodes and the generic `Boundary` take a type arg;
      // System_/Container_/Enterprise_Boundary have (alias, label) only.
      // Mermaid labels every frame with a type: the macro's own for the
      // typed boundaries, else the explicit argument, else a default.
      const typed = BOUNDARY_TYPES[name]
      if (typed) boundary.type = typed
      else if (args[2] && (isNode || name === 'Boundary'))
        boundary.type = args[2]
      else boundary.type = isNode ? 'node' : 'system'
      if (isNode && args[3]) boundary.description = args[3]
      const parent = stack.at(-1)
      if (parent) parent.children.push(boundary)
      else diagram.boundaries.push(boundary)
      if (opensBlock) stack.push(boundary)
      else pendingBoundary = boundary
      continue
    }

    const rel = name.match(REL_NAME)
    if (rel) {
      const indexed = name === 'RelIndex'
      const a = indexed ? args.slice(1) : args
      if (!a[0] || !a[1]) {
        fail(stmt, 'a relationship needs "from" and "to" aliases')
      }
      const r: C4Relationship = {
        from: a[0],
        to: a[1],
        label: a[2] ?? '',
        bidirectional: name === 'BiRel',
      }
      if (a[3]) r.technology = a[3]
      if (name === 'Rel_Back') r.reversed = true
      const hint = REL_HINTS[name]
      if (hint) r.layout = hint
      diagram.relationships.push(r)
      continue
    }

    fail(stmt, `unknown C4 macro "${name}"`)
  }

  if (stack.length > 0) {
    throw new Error(
      `C4 diagram: boundary "${stack.at(-1)!.alias}" is missing its closing "}"`,
    )
  }
  // Mermaid ignores RelIndex's index argument: in C4Dynamic every relationship
  // is numbered by its position in the source, and no other variant numbers.
  if (diagram.variant === 'dynamic') {
    diagram.relationships.forEach((r, i) => {
      r.index = String(i + 1)
    })
  }
  for (const r of diagram.relationships) {
    for (const end of [r.from, r.to]) {
      if (!aliases.has(end)) {
        throw new Error(
          `C4 diagram: relationship refers to undeclared alias "${end}"`,
        )
      }
    }
  }
  return diagram
}
