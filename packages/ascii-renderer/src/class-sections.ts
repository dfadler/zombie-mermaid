// ============================================================================
// ASCII renderer — class box text
//
// Shared by the top-down drawing (class-diagram.ts) and the LR/RL drawing
// (class-flow.ts), so a class is the same box in both.
// ============================================================================

import type { ClassMember, ClassNode } from '@zombie-mermaid/mermaid-parser'
import { splitLines } from './multiline-utils.ts'

/**
 * A member as Mermaid prints it: visibility glued to the name (`-model Model`),
 * and a method's return type after ` : ` (`+start() : void`). Attributes keep
 * the `name: type` form the parser hands over.
 */
function formatMember(m: ClassMember): string {
  const vis = m.visibility + (m.visibility && m.visibilitySpace ? ' ' : '')
  if (m.isMethod) {
    const ret = m.type ? ` : ${m.type}` : ''
    return `${vis}${m.name}(${m.params || ''})${ret}`
  }
  return `${vis}${m.name}${m.type ? `: ${m.type}` : ''}`
}

/**
 * Build the text sections for a class box: [header], [attributes], [methods].
 * Mermaid always draws all three compartments, so an empty one stays as a
 * blank row. A note pseudo-class is one header-only box (`note`).
 */
export function buildClassSections(
  cls: ClassNode,
  useAscii: boolean,
  note = false,
): string[][] {
  // Header section: optional annotation + class name (may be multi-line)
  const header: string[] = []
  if (cls.annotation)
    header.push(useAscii ? `<<${cls.annotation}>>` : `«${cls.annotation}»`)
  header.push(...splitLines(cls.label))
  if (note) return [header]
  return [
    header,
    cls.attributes.map(formatMember),
    cls.methods.map(formatMember),
  ]
}
