// ============================================================================
// Requirement diagram types
//
// The parsed model of a Mermaid `requirementDiagram`, plus the positioned
// model the SVG renderer draws (`PositionedRequirementDiagram`, produced by
// `layoutRequirementDiagramSync` in `@zombie-mermaid/svg-renderer`). The ASCII
// renderer lowers the parsed model to the flowchart model.
// ============================================================================

import type { StyleDirectives } from '@zombie-mermaid/core'

/** The six requirement kinds, as written in the source. */
export type RequirementKind =
  | 'requirement'
  | 'functionalRequirement'
  | 'interfaceRequirement'
  | 'performanceRequirement'
  | 'physicalRequirement'
  | 'designConstraint'

/** The seven relationship types. */
export type RequirementRelationType =
  | 'contains'
  | 'copies'
  | 'derives'
  | 'satisfies'
  | 'verifies'
  | 'refines'
  | 'traces'

/** A requirement box or an element box. */
export interface RequirementNode {
  /** The name; it is also the id relationships refer to. */
  id: string
  /** `element` boxes carry `elementType` / `docRef`, requirements the rest. */
  kind: 'requirement' | 'element'
  /** Mermaid's display type: `Functional Requirement`, `Element`, ... */
  typeLabel: string
  // Requirement fields; empty when not given.
  requirementId: string
  text: string
  /** `Low` / `Medium` / `High`, or ''. */
  risk: string
  /** `Analysis` / `Demonstration` / `Inspection` / `Test`, or ''. */
  verifyMethod: string
  // Element fields; empty when not given.
  elementType: string
  docRef: string
}

export interface RequirementRelationship {
  type: RequirementRelationType
  /** The id the arrow starts at (the container, for `contains`). */
  src: string
  /** The id the arrow points at. */
  dst: string
}

/** A parsed Mermaid requirement diagram. */
export interface RequirementDiagram extends StyleDirectives {
  /** Requirements first, then elements, each in source order (Mermaid's order). */
  nodes: RequirementNode[]
  relationships: RequirementRelationship[]
  /** `direction TB|BT|LR|RL`; the last one wins. Unset lays out top to bottom. */
  direction?: 'TB' | 'BT' | 'LR' | 'RL'
}

// ============================================================================
// Positioned model — ready for SVG rendering
// ============================================================================

export interface PositionedRequirementNode {
  id: string
  kind: 'requirement' | 'element'
  /** Row 0 of the box: `<<Requirement>>`. */
  typeText: string
  /** Row 1 of the box, bold. */
  name: string
  /** The rows under the divider (`ID: 1`, `Text: ...`), empty ones dropped. */
  rows: string[]
  x: number
  y: number
  width: number
  height: number
  /** The divider's y, absolute; absent without body rows. */
  dividerY?: number
  inlineStyle?: Record<string, string>
  className?: string
}

export interface PositionedRequirementEdge {
  type: RequirementRelationType
  src: string
  dst: string
  /** `<<satisfies>>`. */
  label: string
  /** From the source box to the target box. */
  points: Array<{ x: number; y: number }>
  labelPoint: { x: number; y: number }
  labelWidth: number
  labelHeight: number
}

export interface PositionedRequirementDiagram {
  width: number
  height: number
  nodes: PositionedRequirementNode[]
  edges: PositionedRequirementEdge[]
}
