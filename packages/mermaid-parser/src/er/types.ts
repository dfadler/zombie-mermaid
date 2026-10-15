// ============================================================================
// ER diagram types
//
// Models the parsed and positioned representations of a Mermaid ER diagram.
// ER diagrams show database entities, their attributes, and relationships.
// ============================================================================

import type { Direction, StyleDirectives } from '@zombie-mermaid/core'

/**
 * Parsed ER diagram — logical structure from mermaid text.
 *
 * Extends {@link StyleDirectives} so `classDef` / `class` / `style` / `:::`
 * resolve through the same cascade flowcharts and class diagrams use (see
 * packages/core/src/style-directives.ts).
 */
export interface ErDiagram extends StyleDirectives {
  /** All entity definitions */
  entities: ErEntity[]
  /** Relationships between entities */
  relationships: ErRelationship[]
  /**
   * Overall layout direction, from a top-level `direction TB` / `direction LR`
   * / `direction BT` / `direction RL` statement. `undefined` when the diagram
   * doesn't specify one, in which case the layout falls back to its default.
   */
  direction?: Direction
}

export interface ErEntity {
  id: string
  /** Display name (same as id unless aliased) */
  label: string
  /** Entity attributes (columns) */
  attributes: ErAttribute[]
}

export interface ErAttribute {
  /** Data type (string, int, varchar, etc.) */
  type: string
  /** Attribute name */
  name: string
  /** Key constraints: PK, FK, UK */
  keys: Array<'PK' | 'FK' | 'UK'>
  /** Optional comment */
  comment?: string
}

/**
 * Cardinality notation (crow's foot):
 *   'one'       ||  ||  exactly one
 *   'zero-one'  |o  o|  zero or one
 *   'many'      }|  |{  one or more
 *   'zero-many' }o  o{  zero or more
 */
export type Cardinality = 'one' | 'zero-one' | 'many' | 'zero-many'

export interface ErRelationship {
  entity1: string
  entity2: string
  /** Cardinality at entity1's end */
  cardinality1: Cardinality
  /** Cardinality at entity2's end */
  cardinality2: Cardinality
  /** Relationship verb/label (e.g., "places", "contains") */
  label: string
  /** Whether the relationship is identifying (solid line) or non-identifying (dashed) */
  identifying: boolean
}

// ============================================================================
// Positioned ER diagram — ready for SVG rendering
// ============================================================================

export interface PositionedErDiagram {
  width: number
  height: number
  entities: PositionedErEntity[]
  relationships: PositionedErRelationship[]
}

export interface PositionedErEntity {
  id: string
  label: string
  attributes: ErAttribute[]
  x: number
  y: number
  width: number
  height: number
  /** Height of the header row */
  headerHeight: number
  /** Height per attribute row */
  rowHeight: number
  /** Inline styles resolved from classDef + `style` (fill, stroke, stroke-width, color) */
  inlineStyle?: Record<string, string>
  /** Style class assigned via `class A name` or `A:::name` — emitted onto the group's `class` attribute */
  className?: string
}

export interface PositionedErRelationship {
  entity1: string
  entity2: string
  cardinality1: Cardinality
  cardinality2: Cardinality
  label: string
  identifying: boolean
  /** Path points from entity1 to entity2 */
  points: Array<{ x: number; y: number }>
}
