// ============================================================================
// Architecture diagram types (Mermaid `architecture-beta`)
// ============================================================================

/** A port on a service/junction: left, right, top, bottom. */
export type ArchitecturePort = 'L' | 'R' | 'T' | 'B'

export interface ArchitectureGroup {
  id: string
  /** Icon name from `(icon)`; kept for consumers, not drawn (see to-graph). */
  icon?: string
  /** `[Title]`; falls back to the id. */
  title: string
  /** Enclosing group id, from `in <parent>`. */
  parent?: string
}

export interface ArchitectureService {
  id: string
  icon?: string
  title: string
  parent?: string
}

export interface ArchitectureJunction {
  id: string
  parent?: string
}

export interface ArchitectureEdge {
  source: string
  sourcePort: ArchitecturePort
  /** `{group}` modifier: the edge attaches to the enclosing group's border. */
  sourceGroup: boolean
  target: string
  targetPort: ArchitecturePort
  targetGroup: boolean
  /** `<--` / `<-->`: arrowhead at the source end. */
  arrowStart: boolean
  /** `-->` / `<-->`: arrowhead at the target end. */
  arrowEnd: boolean
}

export interface ArchitectureDiagram {
  groups: ArchitectureGroup[]
  services: ArchitectureService[]
  junctions: ArchitectureJunction[]
  edges: ArchitectureEdge[]
}
