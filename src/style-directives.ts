// ============================================================================
// Style directives — `classDef`, `class A,B name`, `cssClass "A,B" name`,
// `style A ...`, and the `A:::name` shorthand.
//
// Mermaid's flowchart and class diagrams share one styling grammar
// (https://mermaid.js.org/syntax/flowchart.html#styling-and-classes,
// https://mermaid.js.org/syntax/classDiagram.html#styling). The flowchart
// parser grew the first implementation; this module is that implementation
// lifted out so the class-diagram parser can reuse it rather than copy it
// (issue #420). Both parsers feed a `StyleDirectives` bag, and both layouts
// resolve a node's final style through `resolveNodeStyle` with the same
// cascade — so a `classDef default` means the same thing in every diagram
// type that supports it.
// ============================================================================

/** The three maps a styling-aware diagram carries. `MermaidGraph` and
 * `ClassDiagram` both satisfy this structurally. */
export interface StyleDirectives {
  /** Maps class names to their style properties (from `classDef name prop:val`) */
  classDefs: Map<string, Record<string, string>>
  /** Maps node IDs to their assigned class name (from `class A,B name`, `cssClass "A,B" name`, or `A:::name`) */
  classAssignments: Map<string, string>
  /** Maps node IDs to inline styles (from `style X fill:#f00,stroke:#333`) */
  nodeStyles: Map<string, Record<string, string>>
}

/** Parse "fill:#f00,stroke:#333" style property strings into a Record */
export function parseStyleProps(propsStr: string): Record<string, string> {
  // Strip trailing semicolons — Mermaid tolerates them (e.g. `stroke:#f00;`)
  const cleaned = propsStr.replace(/;\s*$/, '')
  const props: Record<string, string> = {}
  for (const pair of cleaned.split(',')) {
    const colonIdx = pair.indexOf(':')
    if (colonIdx > 0) {
      const key = pair.slice(0, colonIdx).trim()
      const val = pair.slice(colonIdx + 1).trim()
      if (key && val) {
        props[key] = val
      }
    }
  }
  return props
}

/**
 * `classDef name prop:val,prop:val` — define a named style class.
 *
 * Mermaid's `classList` rule accepts a comma-separated list of names
 * (`classDef a,b font-size:12pt`) in both the flowchart and class grammars;
 * every name in the list gets the same properties.
 *
 * Returns true when `line` was a classDef statement (and has been applied).
 */
export function tryApplyClassDef(
  line: string,
  target: StyleDirectives,
): boolean {
  const match = line.match(/^classDef\s+([\w,]+)\s+(.+)$/)
  if (!match) return false
  const props = parseStyleProps(match[2]!)
  for (const name of match[1]!.split(',')) {
    const trimmed = name.trim()
    if (trimmed) target.classDefs.set(trimmed, props)
  }
  return true
}

/**
 * `class A,B className` — attach a style class to one or more nodes.
 *
 * Allows an optional trailing semicolon (`class A,B foo;`) — Mermaid treats
 * it as valid/optional, and `classDef`/`style` already tolerate it via their
 * `(.+)$` capture. Without this, the semicolon form fails to match here and
 * falls through to node parsing, rendering a stray node labelled "class".
 *
 * Returns true when `line` was a class-assignment statement.
 */
export function tryApplyClassAssignment(
  line: string,
  target: StyleDirectives,
): boolean {
  const match = line.match(/^class\s+([\w,-]+)\s+(\w+)\s*;?\s*$/)
  if (!match) return false
  const className = match[2]!
  for (const id of match[1]!.split(',')) {
    target.classAssignments.set(id.trim(), className)
  }
  return true
}

/**
 * `cssClass "A,B" className` — the class-diagram grammar's own attachment
 * form (`cssClassStatement: CSSCLASS STR ALPHA` in classDiagram.jison).
 * Same effect as `class A,B className`.
 *
 * Returns true when `line` was a cssClass statement.
 */
export function tryApplyCssClass(
  line: string,
  target: StyleDirectives,
): boolean {
  const match = line.match(/^cssClass\s+"([^"]*)"\s+(\w+)\s*;?\s*$/)
  if (!match) return false
  const className = match[2]!
  for (const id of match[1]!.split(',')) {
    const trimmed = id.trim()
    if (trimmed) target.classAssignments.set(trimmed, className)
  }
  return true
}

/**
 * `style A,B fill:#f00,stroke:#333` — inline style on specific nodes.
 * Repeated `style` statements for the same node merge property by property.
 *
 * Returns true when `line` was a style statement.
 */
export function tryApplyStyleStatement(
  line: string,
  target: StyleDirectives,
): boolean {
  const match = line.match(/^style\s+([\w,-]+)\s+(.+)$/)
  if (!match) return false
  const props = parseStyleProps(match[2]!)
  for (const id of match[1]!.split(',').map((s) => s.trim())) {
    target.nodeStyles.set(id, { ...target.nodeStyles.get(id), ...props })
  }
  return true
}

/**
 * Split the `:::className` shorthand off a node/class identifier.
 *
 * `Animal:::someclass` → `{ id: 'Animal', className: 'someclass' }`;
 * an identifier without the shorthand comes back unchanged with no class.
 * Class names follow CSS identifier conventions (word characters and
 * hyphens), the same constraint the flowchart parser's CLASS_SHORTHAND_REGEX
 * applies.
 */
export function splitClassShorthand(identifier: string): {
  id: string
  className?: string
} {
  const match = identifier.match(/^(.+?):::([\w][\w-]*)$/)
  if (!match) return { id: identifier }
  return { id: match[1]!, className: match[2]! }
}

/**
 * Resolve the final inline style for a node from classDefs and nodeStyles.
 *
 * Cascade, weakest to strongest:
 *   1. `classDef default` — Mermaid's implicit base for every node
 *   2. the node's own assigned class (`class A foo` / `A:::foo`)
 *   3. an explicit `style A ...` directive
 *
 * Returns undefined when nothing in the cascade applies, so callers can fall
 * back to theme defaults without an empty-object check.
 */
export function resolveNodeStyle(
  nodeId: string,
  directives: StyleDirectives,
): Record<string, string> | undefined {
  let result: Record<string, string> | undefined

  /*
   * `classDef default` applies to every node without being assigned. It was
   * previously honored only when a node named it explicitly (`class X
   * default`), which silently diverges from Mermaid: a diagram styling all
   * its nodes via `classDef default` rendered unstyled with no error.
   */
  const defaultDef = directives.classDefs.get('default')
  if (defaultDef) {
    result = { ...defaultDef }
  }

  // Then the node's own class, overriding the default property by property.
  const className = directives.classAssignments.get(nodeId)
  if (className) {
    const classDef = directives.classDefs.get(className)
    if (classDef) {
      result = result ? { ...result, ...classDef } : { ...classDef }
    }
  }

  // Then, apply explicit style directives (override class styles)
  const nodeStyle = directives.nodeStyles.get(nodeId)
  if (nodeStyle) {
    result = result ? { ...result, ...nodeStyle } : { ...nodeStyle }
  }

  return result
}

/**
 * Validate a user-authored class name (from `:::className` or
 * `class A className`) before it's emitted into the SVG `class` attribute.
 *
 * The parsers already constrain class names to word characters and hyphens
 * (see `splitClassShorthand` above and the flowchart parser's
 * CLASS_SHORTHAND_REGEX), so this is a defense-in-depth allowlist rather
 * than an escaping step — a class name can't be made "safe" by escaping
 * since any character other than a valid CSS identifier character would
 * break the class token itself, not just the surrounding attribute quotes.
 * Anything that doesn't match a valid CSS identifier (letters, digits,
 * underscore, hyphen; not starting with a digit or a hyphen+digit) is
 * dropped rather than emitted.
 */
export function sanitizeClassName(
  className: string | undefined,
): string | undefined {
  if (!className) return undefined
  return /^-?[a-zA-Z_][a-zA-Z0-9_-]*$/.test(className) ? className : undefined
}
