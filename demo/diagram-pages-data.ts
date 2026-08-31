/**
 * Content for the per-diagram-type/per-theme SEO landing pages (`pages.ts`).
 *
 * Each entry pairs one of the 6 diagram types this library renders with a
 * small, representative Mermaid source (pulled from `samples-data.ts` so the
 * pages show real, already-vetted output rather than a hand-typed stand-in)
 * and a short, concrete intro paragraph. `pages.ts` crosses this list with
 * every key in `THEMES` (see `src/theme.ts`) to generate one page per
 * (diagram type × theme) combination.
 */

export interface DiagramTypeProfile {
  /** URL segment, e.g. "flowchart" -> /diagrams/flowchart/<theme>.html */
  slug: string
  /** Display label, e.g. "Flowchart" */
  label: string
  /** The Mermaid header keyword(s) that select this diagram type. */
  keyword: string
  /** Mermaid source rendered on every page for this type (theme-independent). */
  source: string
  /** One-paragraph, type-specific intro — real content, not templated boilerplate. */
  intro: string
}

export const DIAGRAM_TYPE_PROFILES: DiagramTypeProfile[] = [
  {
    slug: 'flowchart',
    label: 'Flowchart',
    keyword: 'graph / flowchart',
    source: `graph TD
  A[Start] --> B[Process] --> C[End]`,
    intro:
      'Flowcharts map a process as boxes and arrows and are the most commonly used Mermaid diagram — CI pipelines, decision trees, onboarding steps. zombie-mermaid supports the full shape set (rounded, diamond, stadium, subroutine, cylinder, hexagon, and more), subgraphs, and both straight and curved edges.',
  },
  {
    slug: 'state',
    label: 'State diagram',
    keyword: 'stateDiagram-v2',
    source: `stateDiagram-v2
  [*] --> Idle
  Idle --> Active : start
  Active --> Idle : cancel
  Active --> Done : complete
  Done --> [*]`,
    intro:
      'State diagrams show every state a system can be in and the events that move it between them — useful for anything with a lifecycle: a connection, an order, a UI component. zombie-mermaid supports nested composite states, start/end pseudostates, and animated edge transitions.',
  },
  {
    slug: 'sequence',
    label: 'Sequence diagram',
    keyword: 'sequenceDiagram',
    source: `sequenceDiagram
  Alice->>Bob: Hello Bob!
  Bob-->>Alice: Hi Alice!`,
    intro:
      'Sequence diagrams show the order messages pass between participants over time — the standard way to document an API call, an auth handshake, or a distributed-systems trace. zombie-mermaid supports actors, activation boxes, and every Mermaid arrow type.',
  },
  {
    slug: 'class',
    label: 'Class diagram',
    keyword: 'classDiagram',
    source: `classDiagram
  class Animal {
    +String name
    +int age
    +eat() void
    +sleep() void
  }`,
    intro:
      'Class diagrams document a type’s attributes, methods, and visibility in a compact, 3-compartment box — the standard UML notation for object-oriented design docs and API references. zombie-mermaid renders all four visibility markers and inheritance/composition relationships.',
  },
  {
    slug: 'er',
    label: 'ER diagram',
    keyword: 'erDiagram',
    source: `erDiagram
  CUSTOMER ||--o{ ORDER : places`,
    intro:
      'Entity-relationship diagrams describe a database schema: entities, their attributes, and the cardinality of the relationships between them. zombie-mermaid renders the full crow’s-foot notation along with PK/FK/UK key badges on typed attributes.',
  },
  {
    slug: 'xy-chart',
    label: 'XY chart',
    keyword: 'xychart-beta',
    source: `xychart-beta
    title "Product Sales"
    x-axis [Widgets, Gadgets, Gizmos, Doodads, Thingamajigs]
    bar [150, 230, 180, 95, 310]`,
    intro:
      'XY charts plot bar and line series against a shared axis — the one Mermaid diagram type that’s a data chart rather than a graph of nodes and edges. zombie-mermaid renders both bar and line series, mixed on one chart if needed.',
  },
]
