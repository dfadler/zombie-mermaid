// ============================================================================
// Class member formatting — shared between the SVG (layout.ts) and ASCII
// (ascii/class-diagram.ts) renderers so method parentheses/params can't drift
// between the two again. See issue #290.
// ============================================================================

import type { ClassMember } from './types.ts'

/** Format a class member as a display string: visibility + name(+params for methods) + optional type */
export function formatClassMember(m: ClassMember): string {
  const vis = m.visibility ? `${m.visibility} ` : ''
  const name = m.isMethod ? `${m.name}(${m.params || ''})` : m.name
  const type = m.type ? `: ${m.type}` : ''
  return `${vis}${name}${type}`
}
