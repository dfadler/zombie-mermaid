// ============================================================================
// ASCII renderer — class box text
//
// Shared by the top-down drawing (class-diagram.ts) and the LR/RL drawing
// (class-flow.ts), so a class is the same box in both.
// ============================================================================

import { formatClassMember } from '@zombie-mermaid/mermaid-parser'
import type { ClassNode } from '@zombie-mermaid/mermaid-parser'
import { splitLines } from './multiline-utils.ts'

/** Build the text sections for a class box: [header], [attributes], [methods] */
export function buildClassSections(cls: ClassNode): string[][] {
  // Header section: optional annotation + class name (may be multi-line)
  const header: string[] = []
  if (cls.annotation) header.push(`<<${cls.annotation}>>`)
  // Support multi-line class names
  const nameLines = splitLines(cls.label)
  header.push(...nameLines)

  // Attributes section
  const attrs = cls.attributes.map(formatClassMember)

  // Methods section
  const methods = cls.methods.map(formatClassMember)

  // Build sections from only the non-empty parts. Only attrs (2-section),
  // only methods (2-section), both (3-section), or neither (1-section, header only).
  const sections: string[][] = [header]
  if (attrs.length > 0) sections.push(attrs)
  if (methods.length > 0) sections.push(methods)
  return sections
}
