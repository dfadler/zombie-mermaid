/** An `actor` — drawn as a stick figure. */
export interface UsecaseActor {
  id: string
  label: string
  /** The `systemBoundary` it is declared in. */
  parentId?: string
  /** `<<stereotype>>`, drawn as «stereotype» above the label. */
  stereotype?: string
  /** `:::class` / `class` names, and `style` declarations. */
  classes?: string[]
  styles?: string[]
  /** `@{ type: hollow|awesome }` or `@{ icon: name }` (`icon`); absent for the plain stick figure. */
  type?: 'hollow' | 'awesome' | 'icon'
  /** The `@{ icon: name }` name. */
  icon?: string
  /** `@{ business: true }`: a slash through the figure. */
  business?: true
}

/** Any other named element: a use case. `Name(label)` / `Name` is an ellipse, `Name[label]` a rectangle. */
export interface UsecaseCase {
  id: string
  label: string
  shape: 'ellipse' | 'rect'
  parentId?: string
  stereotype?: string
  classes?: string[]
  styles?: string[]
  /** `@{ business: true }` (ellipses only): a slash through the ellipse. */
  business?: true
}

/** `systemBoundary Name … end`. */
export interface UsecaseBoundary {
  id: string
  label: string
  /** Ids of the actors and use cases declared inside, in source order. */
  members: string[]
  /** `@{ type: package }`: drawn with a tab holding the title; absent for the plain frame (`rect`). */
  type?: 'package'
}

/** `json Name @ { ... }`: a table of the JSON object's keys and values. */
export interface UsecaseJson {
  id: string
  /** One row per scalar, `a.b[0]` style paths for keys, as mermaid flattens them. */
  rows: Array<{ key: string; value: string }>
  classes?: string[]
  styles?: string[]
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
  arrow:
    | 'forward'
    | 'backward'
    | 'none'
    | 'circleEnd' // --o
    | 'crossEnd' // --x
    | 'circleStart' // o--
    | 'crossStart' // x--
  label?: string
  /** `A e1@--> B`; set by the edge id, so `e1@{ animate: true }` can name it. */
  id?: string
  animate?: boolean
  animation?: string
}

/** `classDef name fill:#f00,stroke:#333`; `styles` are the `prop:value` declarations. */
export interface UsecaseClassDef {
  id: string
  styles: string[]
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
  classDefs: UsecaseClassDef[]
  jsonNodes: UsecaseJson[]
}
