/**
 * Content for the per-diagram-type/per-theme SEO landing pages (`pages.ts`).
 *
 * Each entry pairs one of the 6 diagram types this library renders with a
 * small, representative Mermaid source and a short, concrete intro
 * paragraph. `pages.ts` crosses this list with every key in `THEMES` (see
 * `src/theme.ts`) to generate one page per (diagram type × theme)
 * combination.
 *
 * `source` is looked up from `samples-data.ts` by title (via `sampleSource`
 * below) rather than duplicated as a hand-typed string literal — the
 * visual-test suite, the interactive gallery, and this page's diagram then
 * always show the exact same, already-vetted Mermaid source for a given
 * example. A sample referenced here that's later renamed or removed from
 * samples-data.ts fails this file's own build (see `sampleSource`) instead
 * of silently drifting into a source these pages claim is "real" but no
 * longer matches anything actually exercised elsewhere.
 */

import { samples } from '../samples-data.ts'

/**
 * The Mermaid source of the samples-data.ts sample titled `title` — the
 * exact string that sample's own gallery card and visual-test baseline
 * render, so this page's diagram is never a hand-typed stand-in that can
 * quietly diverge from what the library actually renders elsewhere.
 * Throws at module load (i.e. this file's own import, not lazily) if no
 * sample has that title, so a stale reference — the title was renamed, or
 * the sample was deleted — fails the build loudly rather than leaving this
 * page showing content nothing else in the repo still vouches for.
 */
function sampleSource(title: string): string {
  const sample = samples.find((s) => s.title === title)
  if (!sample) {
    throw new Error(
      `demo/diagram-pages-data.ts: no samples-data.ts sample titled "${title}" (renamed or removed?)`,
    )
  }
  return sample.source
}

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
    source: sampleSource('Simple Flow'),
    intro:
      'Flowcharts map a process as boxes and arrows and are the most commonly used Mermaid diagram — CI pipelines, decision trees, onboarding steps. zombie-mermaid supports the full shape set (rounded, diamond, stadium, subroutine, cylinder, hexagon, and more), subgraphs, and both straight and curved edges.',
  },
  {
    slug: 'state',
    label: 'State diagram',
    keyword: 'stateDiagram-v2',
    source: sampleSource('Basic State Diagram'),
    intro:
      'State diagrams show every state a system can be in and the events that move it between them — useful for anything with a lifecycle: a connection, an order, a UI component. zombie-mermaid supports nested composite states, start/end pseudostates, and animated edge transitions.',
  },
  {
    slug: 'sequence',
    label: 'Sequence diagram',
    keyword: 'sequenceDiagram',
    source: sampleSource('Sequence: Basic Messages'),
    intro:
      'Sequence diagrams show the order messages pass between participants over time — the standard way to document an API call, an auth handshake, or a distributed-systems trace. zombie-mermaid supports actors, activation boxes, and every Mermaid arrow type.',
  },
  {
    slug: 'class',
    label: 'Class diagram',
    keyword: 'classDiagram',
    source: sampleSource('Class: Basic Class'),
    intro:
      'Class diagrams document a type’s attributes, methods, and visibility in a compact, 3-compartment box — the standard UML notation for object-oriented design docs and API references. zombie-mermaid renders all four visibility markers and inheritance/composition relationships.',
  },
  {
    slug: 'er',
    label: 'ER diagram',
    keyword: 'erDiagram',
    source: sampleSource('ER: Basic Relationship'),
    intro:
      'Entity-relationship diagrams describe a database schema: entities, their attributes, and the cardinality of the relationships between them. zombie-mermaid renders the full crow’s-foot notation along with PK/FK/UK key badges on typed attributes.',
  },
  {
    slug: 'xy-chart',
    label: 'XY chart',
    keyword: 'xychart-beta',
    source: sampleSource('XY: Simple Bar Chart'),
    intro:
      'XY charts plot bar and line series against a shared axis — the one Mermaid diagram type that’s a data chart rather than a graph of nodes and edges. zombie-mermaid renders both bar and line series, mixed on one chart if needed.',
  },
]
