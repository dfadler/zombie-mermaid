// ============================================================================
// Class diagram types
//
// Models the parsed and positioned representations of a Mermaid class diagram.
// Class diagrams show UML class relationships, inheritance, composition, etc.
// ============================================================================

import type { NodeInteraction } from '../types.ts'
import type { StyleDirectives } from '../style-directives.ts'

/**
 * Parsed class diagram — logical structure from mermaid text.
 *
 * Extends {@link StyleDirectives} so `classDef` / `cssClass` / `style` /
 * `:::` resolve through the same cascade flowcharts use (see
 * src/style-directives.ts).
 */
export interface ClassDiagram extends StyleDirectives {
  /** All class definitions */
  classes: ClassNode[]
  /** Relationships between classes */
  relationships: ClassRelationship[]
  /** Optional namespace groupings */
  namespaces: ClassNamespace[]
  /** Maps class IDs to interactions declared by `click` statements */
  interactions: Map<string, NodeInteraction>
  /** Notes, in source order — `note "text"` and `note for X "text"` */
  notes: ClassNote[]
}

/**
 * A class-diagram note. Mermaid lays an attached note out as its own node
 * joined to the class by a dotted, arrowless link (classDb.getData); a free
 * note is a lone node.
 */
export interface ClassNote {
  /** Note text; `\n` / `<br/>` in the source are already normalized to newlines */
  text: string
  /** Class this note is attached to (`note for X`); absent for a free note */
  forClass?: string
}

export interface ClassNode {
  id: string
  label: string
  /** Annotation like <<interface>>, <<abstract>>, <<service>>, <<enumeration>> */
  annotation?: string
  /** Class attributes (fields/properties) */
  attributes: ClassMember[]
  /** Class methods (functions) */
  methods: ClassMember[]
}

export interface ClassMember {
  /** Visibility: + public, - private, # protected, ~ package */
  visibility: '+' | '-' | '#' | '~' | ''
  /** Member name */
  name: string
  /** Type annotation (e.g., "String", "int", "void") */
  type?: string
  /** Whether the member is static (underlined in UML) */
  isStatic?: boolean
  /** Whether the member is abstract (italic in UML) */
  isAbstract?: boolean
  /** Whether the member is a method (renders with parentheses) */
  isMethod?: boolean
  /** Method parameters (e.g., "data", "key, val") — only for methods */
  params?: string
}

/** Relationship types following UML conventions */
export type RelationshipType =
  | 'inheritance' // A <|-- B   (solid line, hollow triangle)
  | 'composition' // A *-- B    (solid line, filled diamond)
  | 'aggregation' // A o-- B    (solid line, hollow diamond)
  | 'association' // A --> B    (solid line, open arrow)
  | 'dependency' // A ..> B    (dashed line, open arrow)
  | 'realization' // A ..|> B   (dashed line, hollow triangle)

export interface ClassRelationship {
  from: string
  to: string
  type: RelationshipType
  /**
   * Which end of the relationship line has the UML marker (triangle, diamond, arrow).
   * Determined by the arrow syntax direction:
   *   - Prefix markers like `<|--`, `*--`, `o--` → 'from' (marker on left/from side)
   *   - Suffix markers like `..|>`, `-->`, `..>`, `--*`, `--o` → 'to' (marker on right/to side)
   */
  markerAt: 'from' | 'to'
  /** Label on the relationship line */
  label?: string
  /** Cardinality at the "from" end (e.g., "1", "*", "0..1") */
  fromCardinality?: string
  /** Cardinality at the "to" end */
  toCardinality?: string
}

export interface ClassNamespace {
  name: string
  classIds: string[]
}

// ============================================================================
// Positioned class diagram — ready for SVG rendering
// ============================================================================

export interface PositionedClassDiagram {
  width: number
  height: number
  classes: PositionedClassNode[]
  relationships: PositionedClassRelationship[]
  notes: PositionedClassNote[]
}

export interface PositionedClassNote {
  /** Layout id — never collides with a class id (class ids contain no spaces) */
  id: string
  text: string
  /** Class this note is attached to, when that class exists in the diagram */
  forClass?: string
  x: number
  y: number
  width: number
  height: number
  /** Routed path of the dotted note→class link; absent for a free note */
  linkPoints?: Array<{ x: number; y: number }>
}

export interface PositionedClassNode {
  id: string
  label: string
  annotation?: string
  attributes: ClassMember[]
  methods: ClassMember[]
  x: number
  y: number
  width: number
  height: number
  /** Height of the header section (name + annotation) */
  headerHeight: number
  /** Height of the attributes section */
  attrHeight: number
  /** Height of the methods section */
  methodHeight: number
  /** Interaction from a `click` statement — an href wraps the class box in an <a> */
  interaction?: NodeInteraction
  /** Inline styles resolved from classDef + `style` statements — override theme defaults */
  inlineStyle?: Record<string, string>
  /** Style class assigned via `cssClass`, `class A name`, or `:::name` — emitted onto the group's `class` attribute so external CSS can target it */
  className?: string
}

export interface PositionedClassRelationship {
  from: string
  to: string
  type: RelationshipType
  /** Which end of the line has the UML marker — propagated from ClassRelationship */
  markerAt: 'from' | 'to'
  label?: string
  fromCardinality?: string
  toCardinality?: string
  /** Path points from source to target */
  points: Array<{ x: number; y: number }>
  /** ELK-computed label center position (avoids overlaps between nearby edges) */
  labelPosition?: { x: number; y: number }
}
