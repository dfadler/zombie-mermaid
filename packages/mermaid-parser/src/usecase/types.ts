/** An `actor` — drawn as a stick figure. */
export interface UsecaseActor {
  id: string
  label: string
  /** The `systemBoundary` it is declared in. */
  parentId?: string
}

/** Any other named element: a use case. `Name(label)` / `Name` is an ellipse, `Name[label]` a rectangle. */
export interface UsecaseCase {
  id: string
  label: string
  shape: 'ellipse' | 'rect'
  parentId?: string
}

/** `systemBoundary Name … end`. */
export interface UsecaseBoundary {
  id: string
  label: string
  /** Ids of the actors and use cases declared inside, in source order. */
  members: string[]
}

export type UsecaseRelationshipType =
  | 'association'
  | 'include'
  | 'extend'
  | 'generalization'

export interface UsecaseRelationship {
  source: string
  target: string
  type: UsecaseRelationshipType
  /**
   * An association's line: `-->` (`forward`), `<--` (`backward`) or `--`
   * (`none`). The other types always draw an arrowhead at the target.
   */
  arrow: 'forward' | 'backward' | 'none'
  label?: string
}

/** `note for Id "text"`. */
export interface UsecaseNote {
  target: string
  label: string
}

export type UsecaseDirection = 'TB' | 'TD' | 'BT' | 'LR' | 'RL'

export interface UsecaseDiagram {
  direction: UsecaseDirection
  actors: UsecaseActor[]
  useCases: UsecaseCase[]
  boundaries: UsecaseBoundary[]
  relationships: UsecaseRelationship[]
  notes: UsecaseNote[]
}
