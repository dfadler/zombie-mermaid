/**
 * The construct/tag taxonomy for single-tag diagram search pages
 * (zombie-mermaid#991, implementing the single-tag portion of
 * docs/decisions/diagram-tag-search.md).
 *
 * Every tag is detected mechanically from a sample's own Mermaid `source`
 * text — a regex (or keyword line match) per construct — rather than
 * hand-assigned per sample. Over 86 real samples across six diagram types,
 * a deterministic detector is both more accurate (no sample silently
 * missing a tag someone forgot to type) and auditable (the rule that
 * assigned a tag is right here, not implicit in a hand-typed list) than
 * manual tagging would have been. Every rule below was written against,
 * and verified by `scripts/print-tag-coverage.ts` to actually match, real
 * samples-data.ts sources — not guessed at.
 *
 * Deliberately modest rather than exhaustive: covers real, genuinely
 * distinct, searchable constructs (the five illustrative tags drafted on
 * the design canvas for one Flowchart example were never meant to be the
 * final list — see the doc decision's "real construct taxonomy" ask) —
 * not one tag per every possible shape/keyword variant. A rule some
 * category's real samples never trigger is fine and expected (only a few
 * of these are genuinely cross-type; most are type-specific by nature of
 * the construct itself, e.g. a decision diamond only exists in
 * flowcharts) — `pages.ts` only generates a page for a tag that actually
 * has at least one match, per the decision doc's "never the full
 * permutation/power set" rule (that rule is about multi-tag combinations,
 * out of scope here, but the same "real matches only" instinct applies to
 * single tags too: an unused rule just never produces a page).
 */
import type { Sample } from '../site-src/samples-data.ts'

export interface TagRule {
  /** URL slug, e.g. "subgraph" -> /diagrams/tag/subgraph.html. */
  slug: string
  /** Display label, e.g. "Subgraph". */
  label: string
  /** One sentence explaining the construct, shown on the tag's own page. */
  description: string
  /**
   * The real Mermaid docs page (and, where one actually exists, the
   * anchor) documenting this construct — e.g.
   * `https://mermaid.ai/open-source/syntax/classDiagram.html#annotations-on-classes`
   * for `stereotype-annotation`. Every anchor here was verified against
   * that page's real `id="..."` heading attributes (not guessed at) —
   * where no construct-specific heading exists (e.g. Class's three
   * relationship-arrow tags), this points at the closest real section
   * that documents it (`#defining-relationship`) rather than a
   * fabricated anchor.
   */
  docsUrl: string
  /** Whether `sample` uses this construct, tested against its real `source`. */
  test: (sample: Sample) => boolean
}

/**
 * True when `source` contains a Mermaid statement keyword at the start of
 * a line (ignoring leading whitespace) — e.g. `loop`, `alt`, `Note`. Safer
 * than a bare substring test: won't match the word appearing inside a
 * label or comment. Plain string methods plus one *literal* `/\w/` check
 * for the trailing word-boundary, not `new RegExp(keyword)` — a
 * dynamically-built regex trips Semgrep's `detect-non-literal-regexp`
 * (every caller here passes a hardcoded keyword, never attacker input, but
 * removing the pattern entirely is cleaner than a suppression comment for
 * something a static scanner can't verify by itself).
 */
function hasLineKeyword(source: string, keyword: string): boolean {
  return source.split('\n').some((line) => {
    const trimmed = line.trimStart()
    if (!trimmed.startsWith(keyword)) return false
    const nextChar = trimmed.charAt(keyword.length)
    return nextChar === '' || !/\w/.test(nextChar)
  })
}

export const TAG_RULES: readonly TagRule[] = [
  // -- Flowchart --
  {
    slug: 'subgraph',
    label: 'Subgraph',
    description:
      'Grouping nodes inside a labeled `subgraph` container, for a diagram whose flow naturally breaks into stages or systems.',
    docsUrl: 'https://mermaid.ai/open-source/syntax/flowchart.html#subgraphs',
    test: (s) => s.category === 'Flowchart' && /subgraph\s/i.test(s.source),
  },
  {
    slug: 'decision-diamond',
    label: 'Decision Diamond',
    description:
      "A `{label}` diamond node — Mermaid's branch-point shape, for a yes/no or multi-way decision in the flow.",
    docsUrl:
      'https://mermaid.ai/open-source/syntax/flowchart.html#decision-diamond',
    test: (s) => s.category === 'Flowchart' && /\{[^{}]+\}/.test(s.source),
  },
  {
    slug: 'dashed-edge',
    label: 'Dashed Edge',
    description:
      'A `-.->` dashed connector — typically a feedback loop, a retry path, or any edge meant to read as secondary to the main flow.',
    docsUrl: 'https://mermaid.ai/open-source/syntax/flowchart.html#dotted-link',
    test: (s) => /-\.-{1,2}>/.test(s.source),
  },
  {
    slug: 'bidirectional-edge',
    label: 'Bidirectional Edge',
    description:
      'An edge that points both ways (`<-->`, `<-.->`, `<==>`) — two nodes that affect each other rather than a strict one-way flow.',
    docsUrl:
      'https://mermaid.ai/open-source/syntax/flowchart.html#multi-directional-arrows',
    test: (s) => /<-{1,3}\.?-{0,2}>|<==>/.test(s.source),
  },
  {
    slug: 'custom-node-shape',
    label: 'Custom Node Shape',
    description:
      'A node drawn as something other than a plain rectangle or rounded box — a stadium, circle, hexagon, cylinder, subroutine, or trapezoid — for when a shape itself should carry meaning.',
    docsUrl: 'https://mermaid.ai/open-source/syntax/flowchart.html#node-shapes',
    test: (s) =>
      s.category === 'Flowchart' &&
      /\(\[|\(\(|\{\{|\[\[|\[\(|[A-Za-z0-9_]>|\[\/|\[\\/.test(s.source),
  },
  {
    slug: 'link-style',
    label: 'linkStyle',
    description:
      'Using `linkStyle` to color or restyle specific edges by index — for calling out a critical path or grouping edges visually.',
    docsUrl:
      'https://mermaid.ai/open-source/syntax/flowchart.html#styling-links',
    test: (s) => /linkStyle\s/.test(s.source),
  },
  {
    slug: 'custom-node-styling',
    label: 'Custom Node Styling',
    description:
      'Using `style`/`:::` to override a node’s own fill or stroke color, or assign it a class, independent of the active theme.',
    docsUrl:
      'https://mermaid.ai/open-source/syntax/flowchart.html#styling-and-classes',
    test: (s) => /:::|^\s*style\s/m.test(s.source),
  },
  // -- Sequence --
  {
    slug: 'loop-block',
    label: 'Loop Block',
    description:
      'A `loop` block wrapping a repeated exchange of messages — polling, retries, or any cycle in the interaction.',
    docsUrl: 'https://mermaid.ai/open-source/syntax/sequenceDiagram.html#loops',
    test: (s) => hasLineKeyword(s.source, 'loop'),
  },
  {
    slug: 'conditional-block',
    label: 'Conditional Block',
    description:
      'An `alt`/`else` or `opt` block — a branch in the message flow that depends on a runtime condition.',
    docsUrl: 'https://mermaid.ai/open-source/syntax/sequenceDiagram.html#alt',
    test: (s) =>
      hasLineKeyword(s.source, 'alt') || hasLineKeyword(s.source, 'opt'),
  },
  {
    slug: 'parallel-block',
    label: 'Parallel Block',
    description:
      'A `par`/`and` block — messages that happen concurrently rather than strictly in sequence.',
    docsUrl:
      'https://mermaid.ai/open-source/syntax/sequenceDiagram.html#parallel',
    test: (s) => hasLineKeyword(s.source, 'par'),
  },
  {
    slug: 'critical-block',
    label: 'Critical Block',
    description:
      'A `critical` block — a section that must run to completion atomically, with optional `option` fallback paths.',
    docsUrl:
      'https://mermaid.ai/open-source/syntax/sequenceDiagram.html#critical-region',
    test: (s) => hasLineKeyword(s.source, 'critical'),
  },
  {
    slug: 'note-annotation',
    label: 'Note',
    description:
      'A `Note` positioned over, left of, or right of a participant — free-text context attached to a specific point in the exchange.',
    docsUrl: 'https://mermaid.ai/open-source/syntax/sequenceDiagram.html#notes',
    test: (s) => hasLineKeyword(s.source, 'Note'),
  },
  {
    slug: 'participant-lifecycle',
    label: 'Participant Create/Destroy',
    description:
      'A `create`/`destroy` participant — an actor that appears or disappears partway through the diagram instead of existing for its entire length.',
    docsUrl:
      'https://mermaid.ai/open-source/syntax/sequenceDiagram.html#actor-creation-and-destruction-v10-3-0',
    test: (s) =>
      hasLineKeyword(s.source, 'create') || hasLineKeyword(s.source, 'destroy'),
  },
  // -- Class --
  {
    slug: 'inheritance-relationship',
    label: 'Inheritance',
    description:
      'A `<|--` inheritance relationship — a hollow-triangle "is-a" link between a subclass and its parent.',
    docsUrl:
      'https://mermaid.ai/open-source/syntax/classDiagram.html#defining-relationship',
    test: (s) => s.category === 'Class' && /<\|--/.test(s.source),
  },
  {
    slug: 'composition-relationship',
    label: 'Composition',
    description:
      'A `*--` composition relationship — a filled-diamond "owns and controls the lifetime of" link.',
    docsUrl:
      'https://mermaid.ai/open-source/syntax/classDiagram.html#defining-relationship',
    test: (s) => s.category === 'Class' && /\*--/.test(s.source),
  },
  {
    slug: 'aggregation-relationship',
    label: 'Aggregation',
    description:
      'An `o--` aggregation relationship — a hollow-diamond "has, but doesn’t own the lifetime of" link.',
    docsUrl:
      'https://mermaid.ai/open-source/syntax/classDiagram.html#defining-relationship',
    // Scoped to Class: ER's crow's-foot cardinality notation (e.g.
    // `|o--|{`) contains the same "o--" substring for an unrelated reason
    // (zero-or-one cardinality, not aggregation) -- verified via
    // scripts/print-tag-coverage.ts, which caught this real false match
    // before it shipped.
    test: (s) => s.category === 'Class' && /o--/.test(s.source),
  },
  {
    slug: 'stereotype-annotation',
    label: 'Stereotype Annotation',
    description:
      'An `<<interface>>`, `<<abstract>>`, or `<<enumeration>>` stereotype above a class name, marking its role beyond a plain concrete class.',
    docsUrl:
      'https://mermaid.ai/open-source/syntax/classDiagram.html#annotations-on-classes',
    test: (s) => /<<\s*(interface|abstract|enumeration)\s*>>/i.test(s.source),
  },
  // -- ER --
  {
    slug: 'attribute-keys',
    label: 'Attribute Keys',
    description:
      'A `PK`/`FK`/`UK` key badge on a typed attribute — marking a primary, foreign, or unique key inline in the schema.',
    docsUrl:
      'https://mermaid.ai/open-source/syntax/entityRelationshipDiagram.html#attribute-keys-and-comments',
    test: (s) => /\b(PK|FK|UK)\b/.test(s.source),
  },
  {
    slug: 'non-identifying-relationship',
    label: 'Non-Identifying Relationship',
    description:
      'A dashed (`..`) relationship line — the child entity doesn’t depend on the parent for its own identity, unlike a solid identifying relationship.',
    docsUrl:
      'https://mermaid.ai/open-source/syntax/entityRelationshipDiagram.html#identification',
    test: (s) => s.category === 'ER' && /\.\./.test(s.source),
  },
  // -- XY Chart --
  {
    slug: 'bar-series',
    label: 'Bar Series',
    description: 'A `bar` series — categorical values plotted as bars.',
    docsUrl: 'https://mermaid.ai/open-source/syntax/xyChart.html#bar-chart',
    test: (s) => s.category === 'XY Chart' && /\bbar\s/.test(s.source),
  },
  {
    slug: 'line-series',
    label: 'Line Series',
    description: 'A `line` series — values plotted as a connected line.',
    docsUrl: 'https://mermaid.ai/open-source/syntax/xyChart.html#line-chart',
    test: (s) => s.category === 'XY Chart' && /\bline\s/.test(s.source),
  },
  // -- State --
  {
    slug: 'composite-state',
    label: 'Composite State',
    description:
      'A `state X { ... }` block — a state that contains its own nested sub-states and transitions.',
    docsUrl:
      'https://mermaid.ai/open-source/syntax/stateDiagram.html#composite-states',
    test: (s) =>
      s.category === 'State' && /^\s*state\s+\S+\s*\{/m.test(s.source),
  },
] as const
