// ============================================================================
// ArchiMate diagram types
//
// The parsed model for the `archimate-layered` DSL. Element and relationship
// vocabulary follows the ArchiMate 3.2 specification (The Open Group); the
// DSL itself is not part of Mermaid or ArchiMate, it originates from
// lukilabs/beautiful-mermaid#34 (see `parser.ts`).
// ============================================================================

/** ArchiMate layers (and the strategy/motivation/physical/migration aspects). */
export const ARCHIMATE_LAYERS = [
  'strategy',
  'motivation',
  'business',
  'application',
  'technology',
  'physical',
  'implementation',
] as const

export type ArchiMateLayer = (typeof ARCHIMATE_LAYERS)[number]

/** Every element type the DSL accepts, keyed by the layer that owns it. */
export const ARCHIMATE_ELEMENT_TYPES = {
  business: [
    'actor',
    'role',
    'process',
    'function',
    'service',
    'object',
    'event',
    'interface',
    'collaboration',
    'interaction',
    'contract',
    'representation',
    'product',
  ],
  application: [
    'component',
    'collaboration',
    'interface',
    'function',
    'interaction',
    'process',
    'event',
    'service',
    'dataObject',
  ],
  technology: [
    'node',
    'device',
    'systemSoftware',
    'artifact',
    'communicationNetwork',
    'path',
    'interface',
    'function',
    'process',
    'interaction',
    'event',
    'service',
  ],
  strategy: ['resource', 'capability', 'valueStream', 'courseOfAction'],
  motivation: [
    'stakeholder',
    'driver',
    'assessment',
    'goal',
    'outcome',
    'principle',
    'requirement',
    'constraint',
    'meaning',
    'value',
  ],
  physical: ['equipment', 'facility', 'distributionNetwork', 'material'],
  implementation: [
    'workPackage',
    'deliverable',
    'implementationEvent',
    'plateau',
    'gap',
  ],
} as const satisfies Record<ArchiMateLayer, readonly string[]>

export type ArchiMateElementType =
  (typeof ARCHIMATE_ELEMENT_TYPES)[ArchiMateLayer][number]

/** The eleven ArchiMate relationship types the DSL accepts. */
export const ARCHIMATE_RELATIONSHIP_TYPES = [
  'composition',
  'aggregation',
  'assignment',
  'realization',
  'serving',
  'access',
  'influence',
  'triggering',
  'flow',
  'specialization',
  'association',
] as const

export type ArchiMateRelationshipType =
  (typeof ARCHIMATE_RELATIONSHIP_TYPES)[number]

export interface ArchiMateElement {
  id: string
  label: string
  type: ArchiMateElementType
  layer: ArchiMateLayer
}

export interface ArchiMateRelationship {
  source: string
  target: string
  type: ArchiMateRelationshipType
}

export interface ArchiMateDiagram {
  /** Elements per layer, in declaration order. Only layers that were opened. */
  layers: Map<ArchiMateLayer, ArchiMateElement[]>
  /** All elements by id, in declaration order. */
  elements: Map<string, ArchiMateElement>
  relationships: ArchiMateRelationship[]
}
