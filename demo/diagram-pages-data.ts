/**
 * Content for the per-diagram-type/per-theme SEO landing pages (`pages.ts`).
 *
 * Each entry pairs one of the 6 diagram types this library renders with a
 * small, representative Mermaid source, a short, concrete intro paragraph,
 * and a longer "About" paragraph (`about`) paraphrased from that type's own
 * page in Mermaid's docs (`docsUrl`) for the page's "About" section. `pages.ts`
 * crosses this list with every key in `THEMES` (see `packages/core/src/
 * theme.ts`) to generate one page per (diagram type × theme) combination.
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

import { samples, type Sample } from '../site-src/samples-data.ts'
import type { Accent } from './components/primitives.tsx'

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
  /**
   * Which of primitives.tsx's six accents identifies this type across the
   * redesign (#590) — the breadcrumb's current-page ink, the "Source →
   * render" card border/glow, and this type's own crosslink icon on every
   * *other* type's page. Fixed by the design canvas's FlowchartDetail
   * artboard (`https://claude.ai/code/artifact/2f623662-5eaf-42c4-9fd9-c21588e34993`),
   * whose "Keep exploring" crosslink cards assign violet/cyan/amber/pink/green
   * to State/Sequence/Class/ER/XY chart respectively; flowchart itself (the
   * current page there) is blue by elimination — the one accent no
   * crosslink card uses.
   */
  accent: Accent
  /**
   * The "Source → render" section's h2, e.g. "A deploy pipeline, start to
   * finish." — type-specific, one sentence, naming the concrete example
   * `source` renders. Verbatim from the canvas for `flowchart` and
   * `sequence` (the design canvas at
   * `https://claude.ai/code/artifact/2f623662-5eaf-42c4-9fd9-c21588e34993`
   * has `FlowchartDetail.dc.html` and `SequenceDetail.dc.html` artboards —
   * the #602-606 audit confirmed the canvas has no
   * `StateDetail`/`ClassDetail`/`ErDetail`/`XyChartDetail` artboard to
   * pull from, so `state`/`class`/`er`/`xy-chart` stay hand-written
   * placeholders in the same voice as `intro` rather than canvas-verbatim
   * copy — there's nothing to verify them against). If one of those four
   * artboards is added to the canvas later, pull its real copy the same
   * way this file's `flowchart`/`sequence` entries do.
   */
  exampleHeading: string
  /**
   * The source-panel's file-tab label, e.g. "pipeline.mmd" — cosmetic, but
   * type-specific so every page doesn't show the same filename.
   */
  sourceFilename: string
  /**
   * The "About" section's h2 — type-specific, in the same voice as
   * `exampleHeading`, naming what that section actually covers (the
   * notation's background and its key syntax constructs).
   */
  aboutHeading: string
  /**
   * The "About" section's one-paragraph deep-dive on this diagram type —
   * longer and more syntax-specific than `intro` (which stays a short lede
   * under the page `h1`). Paraphrased from the corresponding page under
   * Mermaid's own docs (`docsUrl`), in this file's own voice rather than
   * quoted verbatim.
   */
  about: string
  /**
   * The canonical Mermaid documentation page for this diagram type's
   * syntax — the "About" section's outbound link target, and the
   * `about` paragraph's source of truth. Points at mermaid.ai's hosted
   * docs (the project's current home for what used to live at
   * mermaid.js.org), not this repo's own docs.
   */
  docsUrl: string
}

export const DIAGRAM_TYPE_PROFILES: DiagramTypeProfile[] = [
  {
    slug: 'flowchart',
    label: 'Flowchart',
    keyword: 'graph / flowchart',
    source: sampleSource('Simple Flow'),
    intro:
      'Flowcharts map a process as boxes and arrows and are the most commonly used Mermaid diagram — CI pipelines, decision trees, onboarding steps. zombie-mermaid supports the full shape set (rounded, diamond, stadium, subroutine, cylinder, hexagon, and more), subgraphs, and both straight and curved edges.',
    accent: 'blue',
    exampleHeading: 'A deploy pipeline, start to finish.',
    sourceFilename: 'pipeline.mmd',
    aboutHeading: 'Where flowcharts come from, and how the syntax works.',
    about:
      'Flowcharts represent a process as nodes and edges — a general-purpose diagramming notation that predates computing and is still the default way most teams sketch a sequence of steps and decisions. Mermaid’s syntax sets a graph direction (top-down, left-right, bottom-up, or right-left), connects nodes with arrow-style edges, and offers more than 30 node shapes, from a plain rectangle to a stadium, cylinder, or subroutine box. Subgraphs group related nodes into their own labeled box, and edges can carry labels, alternate styles, or be hidden entirely for layout control.',
    docsUrl: 'https://mermaid.ai/open-source/syntax/flowchart.html',
  },
  {
    slug: 'state',
    label: 'State diagram',
    keyword: 'stateDiagram-v2',
    source: sampleSource('Basic State Diagram'),
    intro:
      'State diagrams show every state a system can be in and the events that move it between them — useful for anything with a lifecycle: a connection, an order, a UI component. zombie-mermaid supports nested composite states, start/end pseudostates, and animated edge transitions.',
    accent: 'violet',
    exampleHeading: "A connection's full lifecycle, state by state.",
    sourceFilename: 'connection.mmd',
    aboutHeading: 'Where state diagrams come from, and how the syntax works.',
    about:
      'State diagrams describe every state a system can be in and the transitions that move it from one to the next — a notation rooted in finite-state-machine theory and used anywhere behavior depends on history: a network connection, an order’s lifecycle, a UI component’s interaction states. Mermaid’s syntax marks the start and end of a flow with a `[*]` pseudostate, lets a composite state nest a whole sub-diagram inside a single box to model layered behavior, and supports choice points, forks, and joins for diagrams where more than one transition can happen at once.',
    docsUrl: 'https://mermaid.ai/open-source/syntax/stateDiagram.html',
  },
  {
    slug: 'sequence',
    label: 'Sequence diagram',
    keyword: 'sequenceDiagram',
    source: sampleSource('Sequence: Basic Messages'),
    intro:
      'Sequence diagrams show the order messages pass between participants over time — the standard way to document an API call, an auth handshake, or a distributed-systems trace. zombie-mermaid supports actors, activation boxes, and every Mermaid arrow type.',
    accent: 'cyan',
    exampleHeading: 'An authenticated API call, message by message.',
    sourceFilename: 'auth-flow.mmd',
    aboutHeading:
      'Where sequence diagrams come from, and how the syntax works.',
    about:
      'Sequence diagrams show messages passing between participants in the order they happen — the standard way software teams document an API call, an authentication handshake, or a trace across several services. Mermaid’s syntax defines participants as plain actors or typed as a boundary, database, or queue, then connects them with more than half a dozen arrow styles — solid, dotted, or crossed, synchronous or async — to encode exactly what kind of message is being sent. Activation bars mark how long a participant is doing work, and blocks like `alt`, `par`, and `loop` group messages into conditional, parallel, or repeated flows.',
    docsUrl: 'https://mermaid.ai/open-source/syntax/sequenceDiagram.html',
  },
  {
    slug: 'class',
    label: 'Class diagram',
    keyword: 'classDiagram',
    source: sampleSource('Class: Basic Class'),
    intro:
      'Class diagrams document a type’s attributes, methods, and visibility in a compact, 3-compartment box — the standard UML notation for object-oriented design docs and API references. zombie-mermaid renders all four visibility markers and inheritance/composition relationships.',
    accent: 'amber',
    exampleHeading: "A type's shape, one compartment at a time.",
    sourceFilename: 'shape.mmd',
    aboutHeading: 'Where class diagrams come from, and how the syntax works.',
    about:
      'Class diagrams are UML’s notation for a type’s shape — its attributes, its methods, and how it relates to every other type in the system — the standard reference for object-oriented design docs and for translating a design straight into code. Mermaid’s syntax marks each member’s visibility with `+` (public), `-` (private), `#` (protected), or `~` (package), and distinguishes relationships like inheritance, composition, aggregation, and plain association, each with its own arrowhead. Classes can carry stereotypes such as `<<Interface>>` or `<<Abstract>>` and be grouped into namespaces for larger diagrams.',
    docsUrl: 'https://mermaid.ai/open-source/syntax/classDiagram.html',
  },
  {
    slug: 'er',
    label: 'ER diagram',
    keyword: 'erDiagram',
    source: sampleSource('ER: Basic Relationship'),
    intro:
      'Entity-relationship diagrams describe a database schema: entities, their attributes, and the cardinality of the relationships between them. zombie-mermaid renders the full crow’s-foot notation along with PK/FK/UK key badges on typed attributes.',
    accent: 'pink',
    exampleHeading: "A schema's entities, and how they relate.",
    sourceFilename: 'schema.mmd',
    aboutHeading: 'Where ER diagrams come from, and how the syntax works.',
    about:
      'Entity-relationship diagrams describe a database schema: the entities in a domain, the attributes each one carries, and the cardinality of the relationships that connect them. Mermaid’s syntax uses crow’s-foot notation to mark whether a relationship is one-to-one, one-to-many, or many-to-many, and a solid or dashed connecting line to distinguish identifying from non-identifying relationships. Attributes can declare a type, a name, and key markers — PK, FK, or UK — so a rendered diagram doubles as a readable schema reference, not just a shape.',
    docsUrl:
      'https://mermaid.ai/open-source/syntax/entityRelationshipDiagram.html',
  },
  {
    slug: 'xy-chart',
    label: 'XY chart',
    keyword: 'xychart-beta',
    source: sampleSource('XY: Bar and Line Overlay'),
    intro:
      'XY charts plot bar and line series against a shared axis — the one Mermaid diagram type that’s a data chart rather than a graph of nodes and edges. zombie-mermaid renders both bar and line series, mixed on one chart if needed.',
    accent: 'green',
    exampleHeading: 'Two series, one shared axis.',
    sourceFilename: 'chart.mmd',
    aboutHeading: 'Where XY charts come from, and how the syntax works.',
    about:
      'XY charts plot data across two numeric axes — the one Mermaid diagram type that’s a data chart rather than a graph of nodes and edges, useful for a quick bar or line chart living alongside process diagrams in the same document. Mermaid’s syntax sets the chart’s orientation (vertical by default, or horizontal), titles and ranges for each axis, and any number of named `line` or `bar` series drawn from a plain array of numbers — mixed on the same chart if needed, with named series appearing automatically in a legend.',
    docsUrl: 'https://mermaid.ai/open-source/syntax/xyChart.html',
  },
]

/**
 * `samples-data.ts`'s `Sample.category` string for each `DiagramTypeProfile`
 * slug — not the same spelling as `label` ("State diagram" vs. "State"),
 * so this stays its own small table rather than deriving one from the
 * other. `Sample.category` is also used by categories this map doesn't
 * cover (`'Hero'`, `'Interactivity'`), which never carry `gallery: true`
 * (see samples-data.ts's `Sample.gallery` doc comment) and so never need a
 * `DiagramTypeProfile` entry of their own.
 */
const GALLERY_CATEGORY: Record<string, string> = {
  flowchart: 'Flowchart',
  state: 'State',
  sequence: 'Sequence',
  class: 'Class',
  er: 'ER',
  'xy-chart': 'XY Chart',
}

/**
 * The samples-data.ts#713 curated for `slug`'s "More examples" section
 * (`demo/components/diagram-page.tsx`'s `MoreExamplesSection`) — every
 * sample whose `category` matches this type and whose `gallery` field is
 * `true`, in samples-data.ts's own declared order. Never re-derives the
 * curation (see docs/decisions/diagram-gallery-scope.md): a sample opts in
 * by setting `gallery: true` there, not by anything computed here.
 */
export function moreExamplesFor(slug: string): Sample[] {
  const category = GALLERY_CATEGORY[slug]
  if (!category) return []
  return samples.filter(
    (sample) => sample.category === category && sample.gallery === true,
  )
}

/**
 * Every real sample for a diagram type — not gated by `sample.gallery`,
 * unlike {@link moreExamplesFor}. Backs the per-sample detail pages
 * (`/diagrams/<type>/<sample>.html`; see docs/decisions/diagram-tag-search.md's
 * Context section and issue #989): the decision there was to show every
 * example rather than the `moreExamplesFor` curated subset, since each one
 * now gets its own indexable page instead of a shared "More examples" tile.
 * Same order as `samples-data.ts` declares them.
 */
export function allExamplesFor(slug: string): Sample[] {
  const category = GALLERY_CATEGORY[slug]
  if (!category) return []
  return samples.filter((sample) => sample.category === category)
}

/**
 * URL-safe slug for one sample's detail page, e.g. "CI/CD Pipeline" ->
 * "ci-cd-pipeline". Lowercases, replaces every run of non-alphanumeric
 * characters with a single hyphen, and trims leading/trailing hyphens —
 * the same scheme used to slug a `DiagramTypeProfile.slug` by hand
 * elsewhere in this file, just applied to a sample title instead of typed
 * out per type. Not guaranteed collision-free against a pathological title,
 * but every real samples-data.ts title in the six diagram-type categories
 * produces a distinct slug (checked by `__tests__/demo-diagram-pages-data.test.ts`).
 */
export function sampleSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
