// ============================================================================
// zombie-mermaid demo — "what this fork fixes" showcase data
//
// Each entry names a real bug this fork fixed, the commit that fixed it, and a
// diagram that demonstrates it. The generator renders every entry TWICE: once
// against upstream lukilabs/beautiful-mermaid (pinned at the fork point, see
// fork-fixes-before.ts; `fixCommit` is only the fork's fix, not the "before") and
// once against the working tree. Nothing here is hand-drawn — a "before" that
// stopped reproducing would show up as an identical pair, which the generator
// fails on rather than quietly publishing.
//
// Commits and PR numbers come from CHANGELOG.md.
// ============================================================================

export interface ForkFix {
  /** Stable slug, used for the anchor. */
  id: string
  /** Short title — what was broken. */
  title: string
  /** One or two sentences on the symptom, in user-visible terms. */
  symptom: string
  /** Mermaid source that demonstrates it. */
  source: string
  /** Commit that fixed it; "before" renders at this commit's parent. */
  fixCommit: string
  /** PR number for the fix. */
  pr: number
  /** Which renderer shows the difference most clearly. */
  render: 'svg' | 'ascii'
  /** What a reader should look at in the pair. */
  lookFor: string
  /**
   * Show a slice of the output markup instead of the render.
   *
   * A few fixes are invisible in a browser because the browser is forgiving
   * of the bug — the start-arrow marker below renders fine in Chrome and
   * degenerately in librsvg/Inkscape. Showing two identical pictures under
   * "Before / After" would be a false negative, so those entries show the
   * markup where the difference actually is.
   *
   * Both bounds are literal strings, not a pattern: the slice is found with
   * indexOf. A regex built from data would be both overkill and a standing
   * ReDoS smell for no benefit, since every excerpt here is a fixed tag.
   */
  excerpt?: { from: string; to: string }
  /**
   * Extra `renderMermaidSVG` options merged over the page's fixed colors, for a
   * fix that only shows up with a specific option set (e.g. `font`). SVG
   * entries only; the ASCII path ignores it.
   */
  options?: Record<string, unknown>
  /**
   * Upstream `lukilabs/beautiful-mermaid` issue or pull request number(s) this
   * fix resolves (a PR number works: `/issues/N` redirects to `/pull/N`, and
   * `fetchRescuedIssues` resolves both via `issueOrPullRequest`).
   *
   * Several entries share one commit but map to distinct upstream reports
   * (e.g. one PR fixing both ER aliases and ER `direction`), and one upstream
   * issue is sometimes split across two commits that each fix a different
   * symptom of it — hence an array on each side rather than a 1:1 field.
   * Omitted for fixes that don't trace back to a specific numbered issue.
   */
  upstreamIssues?: number[]
  /**
   * Which page section the entry belongs to. Omitted = the main "fixes" group,
   * whose claim is that the After matches real Mermaid.
   *   - `features`: Mermaid-matching output for something upstream beautiful-mermaid
   *     lacks entirely (a new diagram type, an unsupported directive).
   *   - `markup`: a fix visible only in the SVG markup (an excerpt); it makes no
   *     Mermaid-parity claim.
   */
  group?: 'features' | 'markup'
  /**
   * Set while the After still differs from Mermaid: the entry stays in this file
   * (so its source, commit and wording are kept) but is not on the page, in the
   * "before" renders, or in the screenshot capture. The value names the renderer
   * fix cluster that will bring it back (#2619). The PR that fixes the cluster
   * deletes this line, regenerates the screenshot and the drift-guard snapshot.
   */
  parked?: string
}

/** Every entry, parked ones included. The page and its tooling read {@link forkFixes}. */
export const allForkFixes: ForkFix[] = [
  {
    id: 'no-space-arrows',
    title: 'Arrows with no surrounding space dropped the edge',
    symptom:
      'The bare-node-id scanner greedily ate the arrow’s leading dashes, producing a node literally named `A--` and no edge at all — silently, with no error.',
    source: 'flowchart LR\n  A-->B\n  B-->C',
    fixCommit: '37264a5',
    pr: 80,
    render: 'svg',
    lookFor:
      'Before: one mis-named node and no arrows. After: three nodes, two edges.',
    upstreamIssues: [140],
  },
  {
    id: 'quoted-brackets',
    title: 'Brackets inside a quoted label corrupted the label',
    symptom:
      'The shape-delimiter scanner treated the first `]` *inside* a quoted string as the node’s closing bracket, truncating the label mid-word.',
    source: 'flowchart LR\n  A["test [] brackets"] --> B["fine"]',
    fixCommit: '37264a5',
    pr: 80,
    render: 'svg',
    lookFor:
      'Before: the label is cut off at the inner bracket. After: it reads in full.',
    upstreamIssues: [125],
  },
  {
    id: 'cjk-subgraph-id',
    title: 'CJK subgraph ids produced an empty id',
    symptom:
      'The subgraph-id pattern was ASCII-only (`[\\w-]+`), so a non-ASCII id fell through to title slugification — which stripped every character, leaving an empty id.',
    source:
      'flowchart TD\n  subgraph 柜体 [Cabinet]\n    A[Shelf] --> B[Door]\n  end\n  B --> C[Done]',
    fixCommit: '29d6711',
    pr: 71,
    render: 'svg',
    lookFor:
      'Before: the subgraph frame is missing or mislabelled. After: it renders with its title.',
    upstreamIssues: [89],
  },
  {
    id: 'cjk-box-width',
    title: 'CJK labels overflowed their own ASCII box',
    symptom:
      'Box width was measured in UTF-16 code units, but a CJK glyph occupies two terminal columns — so the right border landed inside the label it was supposed to enclose.',
    source: 'flowchart TD\n  A[日本語テスト] --> B[終了]',
    fixCommit: '1c5f215',
    pr: 94,
    render: 'ascii',
    lookFor:
      'Before: the right border sits inside the text and rows are ragged. After: every row is the same width.',
    upstreamIssues: [12, 13, 119, 122],
  },
  {
    id: 'circle-cross-edges',
    parked: 'ascii-layout-details',
    title: 'Circle and cross edge terminators dropped the target node',
    symptom:
      '`A --o B` and `A --x B` were not recognised by the arrow regex, so parsing broke out of the edge loop early — losing the edge *and* the node it pointed at.',
    source: 'flowchart LR\n  A --o B\n  B --x C',
    fixCommit: '77b5e3d',
    pr: 91,
    render: 'ascii',
    lookFor:
      'Before: only A and B render, with no edges at all — C is gone. After: all three nodes and both edges.',
    upstreamIssues: [109, 137],
  },
  {
    id: 'er-cardinality',
    title: 'ER “zero or more” cardinality was silently dropped',
    symptom:
      'Cardinality strings were normalised by sorting their characters, which conflated `}o` with the unrelated `{o`/`o{` and left it unrecognised. The relationship was dropped, and with only one relationship in the diagram, so were both entities.',
    source: 'erDiagram\n  TAG }o--|| PRODUCT : labels',
    fixCommit: '15bc7ff',
    pr: 51,
    render: 'ascii',
    lookFor:
      'Before: nothing renders at all — losing the cardinality dropped the only relationship, and with it both entities. After: the full diagram, crow’s-foot marker included.',
    upstreamIssues: [124],
  },
  {
    id: 'start-arrow-markers',
    group: 'markup',
    title: 'Bidirectional arrows rendered invisible in some renderers',
    symptom:
      '`orient="auto-start-reverse"` already rotates the start arrowhead 180°, but its polygon was *also* pre-reversed — a double reversal that pointed the head into the line. librsvg and Inkscape drew it as degenerate or invisible.',
    source: 'flowchart LR\n  A <--> B',
    fixCommit: 'e1a222c',
    pr: 50,
    render: 'svg',
    excerpt: { from: '<marker id="arrowhead-start"', to: '</marker>' },
    lookFor:
      'Chrome tolerates the double reversal, so both sides *look* the same in a browser — which is why this pair shows the marker definition instead of the picture. Compare the `points`: before they run `8 0, 0 2.5, 8 5` (already reversed), after `0 0, 8 2.5, 0 5` (shared with the forward marker, letting `auto-start-reverse` do the rotation once).',
  },
  {
    id: 'nested-subgraph-direction',
    title: 'Nested subgraph direction overrides were ignored',
    symptom:
      'A `direction` inside a nested subgraph had no effect, and edges crossing a subgraph boundary fell back to a naive path or failed to route.',
    source:
      'flowchart TD\n  subgraph Outer\n    direction LR\n    subgraph Inner\n      direction TB\n      A --> B\n    end\n    C --> A\n  end\n  B --> D',
    fixCommit: 'e989be1',
    pr: 93,
    render: 'svg',
    lookFor:
      'Before: the inner group ignores its direction and the crossing edge routes poorly.',
  },
  {
    id: 'fan-in-grouping',
    title: 'Fan-in roots were interleaved instead of grouped',
    symptom:
      'Root nodes were placed without regard to what they fed into, so `A1, A2 → A` and `B1, B2 → B` interleaved on the grid instead of sitting together above their own target. The same PR also bounded A* pathfinding and made root detection order-independent, fixing two heap-exhaustion crashes on dense graphs.',
    source:
      'flowchart TD\n  A1 --> A\n  B1 --> B\n  A2 --> A\n  B2 --> B\n  A --> C\n  B --> C',
    fixCommit: '5fa08d0',
    pr: 89,
    render: 'ascii',
    lookFor:
      'Before: the top row reads A1, B1, A2, B2 — the two groups interleaved. After: A1, A2, B1, B2, each pair above its own target.',
    upstreamIssues: [64, 65, 68, 111, 112],
  },
  {
    id: 'class-trailing-semicolon',
    title: 'A trailing semicolon on `class` produced a stray node',
    symptom:
      '`class B highlight;` is valid Mermaid, but the regex was anchored without the semicolon — so the statement fell through to node parsing and rendered a node labelled "class".',
    source:
      'flowchart LR\n  A --> B\n  classDef highlight fill:#f9d5e5,stroke:#b5838d\n  class B highlight;',
    fixCommit: '50d8568',
    pr: 53,
    render: 'svg',
    lookFor:
      'Before: a spurious "class" node appears. After: B is simply styled.',
  },
  {
    id: 'font-css-variable',
    group: 'markup',
    title: 'A CSS `var(...)` font was quoted into a dead font name',
    symptom:
      "`{ font: 'var(--font-family-body)' }` is the natural way to inherit a host page's font, but the value was wrapped in quotes (an inert font name, not a `var()` call) and also URL-encoded into a Google Fonts `@import` that can never resolve.",
    source: 'flowchart LR\n  A --> B',
    fixCommit: '6b5da99',
    pr: 79,
    render: 'svg',
    options: { font: 'var(--font-family-body)' },
    excerpt: { from: 'text { font-family:', to: 'sans-serif;' },
    lookFor:
      "The browser renders both the same until a host page defines the variable, so this pair shows the `font-family` rule. Before: the reference is quoted, an inert font name (the build also emitted a failing Google Fonts `@import` for it). After: it is unquoted, so the host page's variable resolves, and the `@import` is gone.",
    upstreamIssues: [18],
  },
  {
    id: 'sequence-leading-note',
    title: 'Sequence notes before the first message vanished',
    symptom:
      'A note written before any message parses with `afterIndex: -1`, but layout only ever looked notes up by a real message index — so it was never positioned or drawn.',
    source:
      'sequenceDiagram\n  Note over Alice: Ready to begin\n  Alice->>Bob: Hello\n  Bob-->>Alice: Hi',
    fixCommit: '554d7b4',
    pr: 72,
    render: 'ascii',
    lookFor:
      'Before: the leading note is missing entirely. After: it renders above the first message.',
    upstreamIssues: [53],
  },
  {
    id: 'er-entity-alias',
    title: 'ER entity aliases discarded the alias and every attribute',
    symptom:
      'The entity-header pattern did not recognize `id[Alias]` bodies at all, so the line fell back to matching only the bare id — losing the alias *and* the entire attribute block that followed it.',
    source:
      'erDiagram\n  p[Person] { string firstName }\n  a["Customer Account"] { string email }\n  p ||--o| a : has',
    fixCommit: '6e8a8b9',
    pr: 81,
    render: 'svg',
    lookFor:
      'Before: two boxes labeled only "p" and "a", each showing "(no attributes)" — the alias line failed to parse past the id. After: "Person" and "Customer Account", each with its attribute.',
    upstreamIssues: [129],
  },
  {
    id: 'er-direction',
    title: 'ER `direction` directive had no effect on layout',
    symptom:
      'The top-level `direction` statement was parsed but never threaded into the ELK layout options, so `direction TB` rendered identically to the default left-to-right layout.',
    source:
      'erDiagram\n  direction TB\n  CUSTOMER ||--o{ ORDER : places\n  ORDER ||--|{ LINE_ITEM : contains\n  PRODUCT ||--o{ LINE_ITEM : includes',
    fixCommit: '6e8a8b9',
    pr: 81,
    render: 'svg',
    lookFor:
      'Before: entities lay out left-to-right regardless of the `direction TB` statement. After: they stack top-to-bottom.',
    upstreamIssues: [131],
  },
  {
    id: 'subgraph-frame-merge',
    parked: 'ascii-layout-details',
    title: 'An edge-less subgraph member merged two sibling subgraph frames',
    symptom:
      'Root-node placement treated an edge-less node as a shared "root" regardless of which subgraph it belonged to, so one subgraph’s bounding box could balloon out to enclose an unrelated sibling — corrupting both frames and interleaving their titles.',
    source:
      'flowchart TB\n  subgraph a["Frontend tier"]\n    a1["load balancer"]\n  end\n  subgraph b["Application tier"]\n    b1["worker pool"]\n    b2["api server"]\n  end\n  a1 --> b1',
    fixCommit: 'a52458c',
    pr: 96,
    render: 'ascii',
    lookFor:
      'Before: the two subgraph frames merge into one box with a garbled title. After: two distinct, disjoint frames.',
    upstreamIssues: [143],
  },
  {
    id: 'invisible-links',
    title: '`~~~` invisible-link syntax was not recognized',
    symptom:
      'The arrow regex had no alternative for `~~~`, so Mermaid’s invisible-link syntax — used to connect or order nodes without drawing a connector — failed to parse as an edge at all.',
    source: 'flowchart LR\n  A --> B\n  A ~~~ C',
    fixCommit: '673d3da',
    pr: 206,
    render: 'ascii',
    lookFor:
      'Before: C is disconnected from the rest of the graph — the `~~~` link is dropped entirely. After: C sits in the layout slot the invisible link puts it in, with no visible connector drawn to it.',
    upstreamIssues: [144],
  },
  {
    id: 'class-attribute-on-svg',
    group: 'markup',
    title: 'A node’s custom class never reached the rendered SVG',
    symptom:
      'The class name from `:::className` or `class A,B className` was resolved for inline fill/stroke, but never written onto the element itself, so external CSS had nothing to select.',
    source:
      'flowchart LR\n  A[Start]:::highlight --> B[End]\n  classDef highlight fill:#f9d5e5,stroke:#b5838d',
    fixCommit: '7b4828b',
    pr: 75,
    render: 'svg',
    excerpt: { from: '<g class="node', to: 'data-id="A"' },
    lookFor:
      'Both sides look identical on screen — the fill color already worked before this fix. Compare the markup: before, node A’s group carries only `class="node"`; after, `class="node highlight"`, so a stylesheet rule like `.highlight { }` can finally target it.',
    upstreamIssues: [80],
  },
  {
    id: 'text-embedded-edge-labels',
    title: 'Text-embedded edge labels (`-- Yes -->`) were not parsed',
    symptom:
      'Mermaid’s inline label syntax on an arrow body — as opposed to the `-->|Yes|` pipe form — had no parser support. The label vanished, and the mis-tokenization also swallowed the bracketed label off the node the arrow pointed at.',
    source:
      'flowchart TD\n  A(Start) --> B{Is it sunny?}\n  B -- Yes --> C[Go to the park]\n  B -- No --> D[Stay indoors]\n  C --> E[Finish]\n  D --> E',
    fixCommit: '9d722cf',
    pr: 49,
    render: 'svg',
    lookFor:
      'Before: the "Yes"/"No" edge labels are gone, and C and D render as bare ids instead of "Go to the park" / "Stay indoors". After: every edge and every node keeps its label.',
    upstreamIssues: [32],
  },
  {
    id: 'decision-label-stray-tee',
    title: 'A decision node’s edge label could land on a stray tee character',
    symptom:
      'The box-start connector always drew a tee/junction glyph based on the edge’s exit direction alone, with no check that a real perpendicular border line existed at that cell — so a label that shifted the attachment point left a disconnected `├` floating with blank cells on both sides.',
    source:
      'flowchart LR\n  A{Decision} -->|Yes| B[Do thing]\n  A -->|No| C[Other thing]',
    fixCommit: '376be39',
    pr: 95,
    render: 'ascii',
    lookFor:
      'Before: a stray ├ sits disconnected on the "Yes" edge’s row. After: a plain ─ line in its place.',
    upstreamIssues: [121],
  },
  {
    id: 'class-blank-compartment',
    title: 'Class boxes now print their members and names the way Mermaid does',
    symptom:
      'Mermaid draws every class as three compartments (name, attributes, methods), even when one is empty: the blank attribute compartment is correct, and the fork change that removed it (#92) was wrong. It also centres the name, writes `«interface»` for an annotation, and prints a method as `+start() : void`. Upstream left-aligned the name, wrote `<<interface>>`, and printed `+start: void`.',
    source:
      'classDiagram\n  class Service {\n    +start() void\n    +stop() void\n  }',
    fixCommit: 'dbc2e44',
    pr: 2627,
    render: 'ascii',
    lookFor:
      'Before: a left-aligned name and `+start: void`. After: a centred name, the same blank attribute compartment (Mermaid draws it too), and `+start() : void`, as Mermaid 12.3.0 draws it.',
  },
  {
    id: 'class-label-column-width',
    title: 'Long class relationship labels on narrow classes were truncated',
    symptom:
      'A class’s column was sized from its box alone, never from the relationship label that had to fit beside it — so single-letter classes with labels like `inheritance` had every label squeezed into the box’s own width and cut to `…`.',
    source:
      'classDiagram\n  A <|-- B : inheritance\n  C *-- D : composition\n  E o-- F : aggregation\n  G --> H : association\n  I ..> J : dependency\n  K ..|> L : realization',
    fixCommit: '60a40d2',
    pr: 512,
    render: 'ascii',
    lookFor:
      'Before: five of the six labels read `inheri…`, `composi…`, and so on. After: the columns spread apart just enough for all six to render in full.',
  },
  {
    id: 'class-fanned-relationships',
    title:
      'More than two relationships between narrow classes overwrote each other',
    symptom:
      'Each relationship in a group got its own column offset, but the offsets were then clamped back inside the box — a width-5 box only has room for three — so several relationships collapsed onto one connection point and the last one drawn silently overwrote the rest.',
    source:
      'classDiagram\n  class A\n  class B\n  A --> B : one\n  A --> B : two\n  A --> B : three\n  A --> B : four',
    fixCommit: '60a40d2',
    pr: 512,
    render: 'ascii',
    lookFor:
      'Before: only `four` survives, on two lines. After: `one`, `two`, `three`, and `four` each sit on their own lane, joined to the boxes by a short jog, with four distinct arrowheads.',
  },
  {
    id: 'class-label-detour-routing',
    title: 'A detoured relationship’s label ignored its own routed path',
    symptom:
      'A relationship’s label always anchored on the straight-line midpoint between its source and target boxes, even when its line detoured around an intermediate box to avoid it — so the label sat wherever the *unrouted* line would have gone, not the *actual* one, reading as though it terminated at the wrong box.',
    source:
      'classDiagram\n  class Model {\n    -data Map\n    +getData() Map\n    +setData(key, val) void\n    +notify() void\n  }\n  class View {\n    -model Model\n    +render() void\n    +update() void\n  }\n  class Controller {\n    -model Model\n    -view View\n    +handleInput(event) void\n    +updateModel(data) void\n  }\n  Controller --> Model : updates\n  Controller --> View : refreshes\n  View --> Model : reads\n  Model ..> View : notifies',
    fixCommit: '1bf8096',
    pr: 514,
    render: 'ascii',
    lookFor:
      'Before: `refreshes` and `updates` sit stacked on adjacent rows above the single arrowhead entering Model, reading as though both terminate there. After: `refreshes` sits beside its own detour line, past Model’s right border, clearly distinct from `updates`.',
  },
  {
    id: 'class-generic-types',
    title: 'Class member generics kept mermaid’s raw `~T~` tildes',
    symptom:
      'Mermaid converts `List~Observer~` to `List<Observer>` before rendering; the class parser here kept the tildes, so both the SVG and ASCII output showed `List~Observer~` — flagged by the weekly form-judge audit (#418).',
    source:
      'classDiagram\n  class EventEmitter {\n    -List~Observer~ observers\n    +attach(Observer) void\n  }\n  class Observer {\n    <<interface>>\n    +update() void\n  }\n  EventEmitter --> Observer',
    fixCommit: '2a06338',
    pr: 505,
    render: 'ascii',
    lookFor:
      'Before: the EventEmitter attribute reads `List~Observer~`. After: it reads `List<Observer>`, the form real mermaid renders.',
  },
  {
    id: 'edge-label-diagonal-fallback',
    title: 'An edge label could float next to a different edge’s line',
    symptom:
      'When an edge’s route fell back to a direct path (every L-shaped route and A* blocked — e.g. the third edge leaving the same side of a node), its label was centered on the never-drawn diagonal between the two legs that actually get drawn, landing in open grid next to an unrelated edge’s connector: `┆thick` two columns away from the thick edge’s own `┃`. Flagged by the weekly form-judge audit (#418).',
    source:
      'graph TD\n  A[Source] -->|solid| B[Target 1]\n  A -.->|dotted| C[Target 2]\n  A ==>|thick| D[Target 3]',
    fixCommit: '64c8dd4',
    pr: 505,
    render: 'ascii',
    lookFor:
      'Before: "thick" sits glued to the dotted edge’s ┆ column. After: it sits on the thick edge’s own ┃ line, like "dotted" does on its ┆ line.',
  },
  {
    id: 'state-classdef-styling',
    title: 'State diagrams ignored classDef, class, and ::: styling',
    symptom:
      'State diagrams silently dropped `classDef`, `class A,B name`, and `State:::name`, and `S1:::foo --> S2` swallowed S1 into a bogus `::foo --> S2` state, so styled states rendered unstyled with a stray label.',
    source:
      'stateDiagram-v2\n  classDef hot fill:#f00,color:#fff\n  classDef cool fill:#39f,color:#fff\n  [*] --> S1:::hot\n  S1 --> S2\n  S2:::cool --> S3\n  class S3 hot',
    fixCommit: 'f01ed876',
    pr: 1178,
    render: 'svg',
    lookFor:
      'Before: a stray `::hot` label on the first transition and no colors. After: S1 and S3 are red, S2 is blue.',
  },
  {
    id: 'edge-label-space-before-pipe',
    title: 'A space before the edge label pipe dropped the target node',
    symptom:
      '`A --> |deploy| B` required the `|label|` to touch the arrow, so with a space before the pipe the parser lost both the label and the node it pointed at.',
    source: 'graph LR\n  A --> |deploy| B\n  B --> |verify| C',
    fixCommit: '700b97bcb',
    pr: 1367,
    render: 'svg',
    lookFor:
      'Before: the labels and the nodes B and C are missing. After: three nodes, two labelled edges.',
    upstreamIssues: [155],
  },
  {
    id: 'flowchart-cycle-direction',
    title: 'A cyclic top-down flowchart could be laid out upside down',
    symptom:
      'The layout engine broke cycles with its own heuristic and could reverse the wrong edge, drawing the whole flow backwards (the last step at the top). Cycles are now broken the way mermaid.js does, depth-first from the first node.',
    source:
      'flowchart TD\n  A[main] --> B[develop]\n  B --> C[Tests?]\n  C -->|fail| B\n  C -->|pass| A',
    fixCommit: 'e894cf060',
    pr: 1313,
    render: 'svg',
    lookFor:
      'Before: the flow is inverted, starting from the wrong node. After: `main` is at the top and the flow reads downward.',
    upstreamIssues: [83],
  },
  {
    id: 'ascii-sequence-self-arrow-in-block',
    title: 'A self-arrow inside alt/loop was drawn outside its block',
    symptom:
      'The block’s right wall was sized from lifeline positions only, ignoring a self-arrow’s loop glyphs and label, so the loop’s corners were overwritten by the wall.',
    source:
      'sequenceDiagram\n  participant A\n  participant B\n  loop retry\n    A->>A: a rather long self message\n  end\n  A->>B: done',
    fixCommit: 'd35d92114',
    pr: 84,
    render: 'ascii',
    lookFor:
      'Before: the loop wall clips the self-arrow. After: the block encloses the whole arrow and label.',
    upstreamIssues: [108],
  },
  {
    id: 'ascii-edge-line-style-bleed',
    title: 'ASCII fan-out edges bled their line style into each other',
    symptom:
      'Edges with different styles leaving one node shared a routing corridor, and the later thick edge overwrote the dotted edge’s glyphs. Separately, two edges routed through a shared node could land on the same column and read as one line.',
    source:
      'graph LR\n  C(Mobile App) --> B(API Gateway)\n  B --> E(User Service)\n  B -.-> F(Cache)\n  B ==> G(Queue)',
    fixCommit: '43bac5abf',
    pr: 1093,
    render: 'ascii',
    lookFor:
      'Before: the dotted edge’s leg is drawn with heavy glyphs. After: each edge keeps its own style.',
    upstreamIssues: [63],
  },
  {
    id: 'invalid-style-colors',
    title: 'An invalid colour in style/classDef painted the node black',
    symptom:
      'A value that is not a CSS colour (`fill:notacolor`) was written into the SVG as an attribute, which browsers paint black (or stroke as none). Mermaid ignores the bad declaration, and so do we now.',
    source:
      'flowchart LR\n  A[Fill word] --> B[Stroke word]\n  style A fill:notacolor\n  style B fill:#ffe6cc,stroke:notacolor,stroke-width:4px',
    fixCommit: '3861e50d',
    pr: 1922,
    render: 'svg',
    lookFor:
      'Before: the first node is solid black and the second has no border. After: both fall back to the theme paint, and the valid fill and stroke width stay.',
  },
  {
    id: 'ascii-er-stacked-center',
    title: 'A narrower stacked ER entity sat off-center, so its edge jogged',
    symptom:
      'Each stacked ER row started at the left edge, so a narrower entity was left-aligned under its neighbor while the relationship attaches at each box’s center, and the edge jogged sideways between two off-center stems.',
    source:
      'erDiagram\n  INSTALL }o--|| PROJECT : scopes\n  INSTALL {\n    string scope\n    string installPath\n  }',
    fixCommit: '436c50ed',
    pr: 2245,
    render: 'ascii',
    lookFor:
      'Before: PROJECT is left-aligned and the edge jogs left halfway down. After: PROJECT is centered under INSTALL, one straight vertical edge joins them, and INSTALL is a table with the name centered and type and name in separate columns, as in Mermaid.',
  },
  {
    id: 'elk-invalid-hitboxes-wide-labels',
    title: 'Disconnected pairs with wide edge labels crashed the layout',
    symptom:
      'ELK’s post-compaction pass threw `Invalid hitboxes for scanline constraint calculation` when a graph had two or more components with wide inline edge labels, so nothing rendered. The layout now retries once without post-compaction.',
    source:
      'flowchart TD\n  A -->|a longer label here| B\n  C -->|a longer label here| D\n  E -->|a longer label here| F\n  G -->|a longer label here| H',
    fixCommit: 'e63ed989d',
    pr: 1976,
    render: 'svg',
    lookFor:
      'Before: an error instead of a diagram. After: four labelled pairs.',
  },
  {
    id: 'ascii-fanout-arrowhead-column',
    title: 'An ASCII fan-out arrowhead sat one column off its stem',
    symptom:
      'Under an even-width box, the bundled arrowhead took its column from the box’s own centre while the stem was drawn in the middle grid column’s centre, so the head landed one column right of the line feeding it.',
    source:
      'flowchart TD\n    A --> B\n    A -->|no| C\n    C --> D\n    D --> E\n    D --> F\n    F --> G\n    G --> H\n    G --> I',
    fixCommit: 'd028603db',
    pr: 1989,
    render: 'ascii',
    lookFor:
      'Before: the `▼` under `G` is shifted one column from the vertical line above it. After: head and stem line up.',
  },
  {
    id: 'svg-coordinates-two-decimals',
    group: 'markup',
    title: 'SVG coordinates carried float noise like 142.38427299999998',
    symptom:
      'Layout and curve maths wrote full floating-point precision into every coordinate, bloating the SVG for no visible benefit. Numbers are now rounded to 2 decimal places and a non-finite value is written as 0, not `NaN`.',
    source:
      'graph TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Do thing]\n  B -->|No| D[Other thing]\n  C --> E((End))\n  D --> E',
    fixCommit: '5cc12f3f',
    pr: 1163,
    render: 'svg',
    excerpt: { from: 'class="edge"', to: '/>' },
    lookFor:
      'The picture is the same, so this shows the first edge’s markup. Before: the edge’s `points` carries long decimal tails. After: its path data `d` has at most 2 decimal places.',
    upstreamIssues: [77],
  },
  {
    id: 'ascii-longest-path-layering',
    parked: 'ascii-flow-axis-faces',
    title: 'ASCII put a node in the row of the parent that placed it first',
    symptom:
      'A node took the level of whichever parent placed it first and was never revisited, so with `A --> D` and `B --> D` it landed beside `B` and `B --> D` ran sideways. Nodes are now ranked by longest path, with back edges ignored, as mermaid does. The same source also fixed edge labels losing the spaces between their words: an edge label drawn over a stroke treated its spaces as transparent, so `long label` printed as `long─label`.',
    source:
      'graph TD\nA -->|x| B\nB -->|long label| A\nA -->|long label| C\nC -->|ab| A\nB -->|mid| D\nA -->|ab| D\nD -->|x| A',
    fixCommit: '7a4925a3',
    pr: 1345,
    render: 'ascii',
    lookFor:
      'Before: `D` sits in the same row as `B`. After: `D` is below `B` and `B --> D` drops straight down.',
    upstreamIssues: [69],
  },
  {
    id: 'labeled-sink-layer',
    title: 'Leaves of labelled edges drifted a layer past their siblings',
    symptom:
      'With inline edge labels, ELK’s post-compaction slid a sink into the gap the label layer leaves, one layer past its siblings. mermaid keeps the sink level with them.',
    source:
      'graph TD\n  A{Is it raining?} -->|Yes| B{Have umbrella?}\n  A -->|No| C([Go outside])\n  B -->|Yes| D([Go with umbrella])\n  B -->|No| E{Is it heavy?}\n  E -->|Yes| F([Stay inside])\n  E -->|No| G([Run for it])',
    fixCommit: '97586aa0',
    pr: 2018,
    render: 'svg',
    lookFor:
      'Before: `Go outside` hangs below `Have umbrella?`. After: it sits level with it, as in mermaid 12.1.0 and 12.2.0.',
  },
  {
    id: 'class-balanced-placement',
    title: 'A class diagram’s parent was not centred over its children',
    symptom:
      'Class layouts did not set ELK’s balanced node placement, which flowcharts and ER diagrams already did, so a parent sat off-centre from its children.',
    source:
      'classDiagram\n  class Animal {\n    +String name\n    +eat() void\n  }\n  class Dog {\n    +String breed\n    +bark() void\n  }\n  class Cat {\n    +bool isIndoor\n    +meow() void\n  }\n  Animal <|-- Dog\n  Animal <|-- Cat',
    fixCommit: '43a96c11',
    pr: 2023,
    render: 'svg',
    lookFor:
      'Before: `Animal` is off to one side. After: it is centred above `Dog` and `Cat`.',
  },
  {
    id: 'ascii-lane-faces-five-parallel',
    parked: 'ascii-flow-axis-faces',
    title: 'Five or more parallel ASCII edges merged their arrowheads',
    symptom:
      'Each parallel edge gets its own cell on a node’s face, but a default box face has three cells, so past that the extra edges shared one arrowhead. The face is now lengthened to one cell per edge, and cluster exits handle six siblings.',
    source:
      'flowchart TD\n  A -->|first| B\n  A -->|second| B\n  A -->|third| B\n  A -->|fourth| B\n  A -->|fifth| B',
    fixCommit: '44dc4754',
    pr: 2080,
    render: 'ascii',
    lookFor:
      'Before: fewer arrowheads than edges. After: one arrowhead per labelled edge.',
  },
  {
    id: 'ascii-lane-faces-forward-and-back',
    parked: 'ascii-flow-axis-faces',
    title: 'ASCII forward and back edge groups shared faces and merged heads',
    symptom:
      'In TD/BT, the forward and back edge groups between one pair use the same side faces but were sized separately, so with more than three edges in all two arrowheads merged. A lone cluster exit group and eight or more cluster siblings had the same problem.',
    source:
      'flowchart TD\n  A -->|f1| B\n  A -->|f2| B\n  A -->|f3| B\n  A -->|f4| B\n  B -->|b1| A\n  B -->|b2| A',
    fixCommit: '72e0eb78',
    pr: 2093,
    render: 'ascii',
    lookFor:
      'Before: two arrowheads merge on a shared face. After: each of the six edges ends in its own head.',
  },
  {
    id: 'ascii-back-edges-flow-faces',
    title: 'ASCII back-edges looped round the side faces, unlike mermaid',
    symptom:
      'A TD back-edge left and re-entered a node’s right face (LR: the bottom face). mermaid 12.1.0 draws it on the flow-axis faces: out of the source’s top, up a lane beside the column, into the target’s bottom, with its own port and arrowhead.',
    source: 'flowchart TD\n  a --> b\n  b --> c\n  c --> a',
    fixCommit: '3dea4e87',
    pr: 2137,
    render: 'ascii',
    lookFor:
      'Before: the back-edge hooks round the right side into `a`’s right face. After: it leaves `c`’s top and enters `a`’s bottom.',
  },
  {
    id: 'ascii-feedback-edge-sibling-order',
    parked: 'ascii-flow-axis-faces',
    title:
      'ASCII subgraph order and feedback edges followed mermaid 11, not 12',
    symptom:
      'In the CI/CD pipeline the ASCII layout put `Fix & Retry` at the very bottom, below `QA Approved?`; mermaid 12.1.0 and 12.2.0 draw it beside `Build Image`. Sibling subgraphs tied by a shared parent came out in reversed order (West left of East); mermaid 12 keeps declaration order.',
    source:
      'graph TD\n  subgraph ci [CI Pipeline]\n    A[Push Code] --> B{Tests Pass?}\n    B -->|Yes| C[Build Image]\n    B -->|No| D[Fix & Retry]\n    D -.-> A\n  end\n  C --> E([Deploy Staging])\n  E --> F{QA Approved?}\n  F -->|Yes| G((Production))\n  F -->|No| D',
    fixCommit: 'b55b7fae',
    pr: 2148,
    render: 'ascii',
    lookFor:
      'Before: `Fix & Retry` hangs below `QA Approved?`. After: it sits beside `Build Image`, and the QA `No` edge rises into it.',
  },
  {
    id: 'er-multi-key-attributes',
    title: 'An ER attribute with two keys lost one of them',
    symptom:
      'An attribute written `PK, FK` showed only `FK`, and `PK,FK` showed no key at all. Mermaid shows `PK,FK` for both spellings.',
    source:
      'erDiagram\n  T {\n    string a PK, FK "c"\n    string b PK,FK\n    string d PK\n  }',
    fixCommit: '63236dbb',
    pr: 2125,
    render: 'svg',
    lookFor:
      'Before: row `a` shows only `FK` and row `b` shows no key. After: both show `PK,FK`.',
  },
  {
    id: 'er-style-classdef',
    title: 'ER style, classDef and class were ignored',
    symptom:
      'An ER entity given `style`, `classDef` plus `class`, or the `:::` shorthand rendered unstyled, although mermaid paints it.',
    source:
      'erDiagram\n  CUSTOMER ||--o{ ORDER : places\n  classDef hot fill:#fecaca,stroke:#dc2626\n  class ORDER hot\n  style CUSTOMER fill:#dbeafe,stroke:#2563eb',
    fixCommit: '10ce9a2a',
    pr: 2132,
    render: 'svg',
    lookFor:
      'Before: both entities use the theme colours. After: `CUSTOMER` is blue and `ORDER` is red.',
  },
  {
    id: 'er-ascii-crossings-labels',
    // Parked on a named limit (#2630): Mermaid 12.3.0 orders ER layers with ELK,
    // and among equal-crossing orders its choice (here the mirror of ours) cannot
    // be derived from the source; ordering by crossings alone made the router's
    // port and row assignment worse (see the PR for #2630).
    parked: 'ascii-er',
    title:
      'ER ASCII edges crossed without a junction and labels were ambiguous',
    symptom:
      'In ASCII, crossing ER edges drew no junction, a label could sit between two verticals or against another edge’s corner, and an edge could run along its box’s border.',
    source:
      'erDiagram\n  ORDER ||--|{ LINE_ITEM : contains\n  ORDER ||..o{ SHIPMENT : ships-via\n  PRODUCT ||--o{ LINE_ITEM : includes\n  PRODUCT ||..o{ REVIEW : receives',
    fixCommit: '2615a669',
    pr: 2142,
    render: 'ascii',
    lookFor:
      'Before: a plain `│` where two edges cross and labels beside two lines. After: a `┼` at the crossing and each label on or beside its own edge.',
  },
  {
    id: 'ascii-face-capacity-loops',
    title: 'ASCII dense duplicate edges and self-loops shared one cell',
    symptom:
      'A node’s side face was sized for reciprocal and duplicate edges only. Self-loop ends and back-edges also take a cell, so the face came out short and two edge ends shared a cell: merged arrowheads and `├`/`┤` tick marks.',
    source:
      'flowchart RL\n  n0["n0"]\n  n1["n1"]\n  n1 --> n0\n  n0 --> n1\n  n1 --> n0\n  n1 --> n0\n  n1 --> n1\n  n0 --> n0\n  n0 --> n1\n  n1 --> n0\n  n0 --> n1\n  n0 --> n1',
    fixCommit: '12c90faa',
    pr: 2186,
    render: 'ascii',
    lookFor:
      'Before: arrowheads merge and tick marks are lost where edges share a cell. After: each edge end has its own cell.',
  },
  {
    id: 'sequence-rect-color',
    title: 'Sequence `rect <color>` highlights were drawn as labelled frames',
    symptom:
      'The colour after `rect` was parsed as a block label, so it was never applied and its text was printed in a frame header (`rect [rgb(255,0,0)]`) instead of painting the background.',
    source:
      'sequenceDiagram\n  participant A\n  participant B\n  rect rgba(200,150,255,0.5)\n    A->>B: hi\n    B-->>A: ok\n  end\n  A->>B: after',
    fixCommit: 'eae88b98',
    pr: 2241,
    render: 'svg',
    lookFor:
      'Before: a grey frame with the colour text in its header tab. After: a purple background behind the two messages, with no frame.',
  },
  {
    id: 'entity-codes',
    title: 'Mermaid entity codes in labels printed literally',
    symptom:
      'Labels written with Mermaid entity codes (`#quot;`, `#lt;`, `#gt;`, `#35;`) showed the raw code instead of the character, so a label meant to read “Say” <hi> came out as `#quot;Say#quot; #lt;hi#gt;`. Ported from upstream beautiful-mermaid #158 (thiccyoda).',
    source: 'flowchart LR\n  A["#quot;Say#quot; #lt;hi#gt;"] --> B["x #35;1"]',
    fixCommit: '1d80500b',
    pr: 1368,
    render: 'svg',
    lookFor:
      'Before: the literal text `#quot;Say#quot; #lt;hi#gt;` and `x #35;1`. After: `"Say" <hi>` and `x #1`.',
  },
  {
    id: 'sequence-nested-blocks',
    title: 'Nested sequence blocks were drawn stacked, not nested, in ASCII',
    symptom:
      'A block inside another block (`alt` containing `loop`, `opt`) was laid out as if it were a sibling: its header and walls landed on the container’s walls, so the nesting was unreadable.',
    source:
      'sequenceDiagram\n  participant A\n  participant B\n  alt cache hit\n    loop every retry\n      A->>B: fetch\n    end\n  else cache miss\n    opt warm up\n      B->>B: rebuild\n    end\n  end',
    fixCommit: 'd0f6a4e9',
    pr: 2622,
    render: 'ascii',
    lookFor:
      'Before: the inner `loop` and `opt` headers collide with the `alt` frame. After: each sits one column inside the `alt`’s walls.',
  },
  {
    id: 'xychart-bar-series-overlap',
    title: 'XY chart bar series were drawn side by side, not overlapping',
    symptom:
      'Two `bar` series on the same categories were split into narrow adjacent bars, while mermaid 12.3.0 draws each series centred on the category with later series on top.',
    source:
      'xychart-beta\n  title "2023 vs 2024 Sales"\n  x-axis [Q1, Q2, Q3, Q4]\n  bar [50, 60, 70, 80]\n  bar [60, 70, 80, 90]',
    fixCommit: '1941517f',
    pr: 2508,
    render: 'svg',
    lookFor:
      'Before: each quarter shows two thin bars next to each other. After: the two bars share one centred, full-width slot and overlap.',
  },
  {
    id: 'ascii-opposing-edges-diamond',
    parked: 'ascii-flow-axis-faces',
    title: 'ASCII opposing edges merged into one route at a diamond',
    symptom:
      'Two edges between the same pair (`B -->|no| D` and `D --> B`) in a left-to-right chart drew a single merged route when B was a diamond or D a parallelogram, so the loop-back looked like one two-way line.',
    source:
      'graph LR\n  A[/Read Input/] --> B{Valid?}\n  B -->|yes| C[\\Write Output\\]\n  B -->|no| D[/Ask Again/]\n  D --> B',
    fixCommit: 'd725006c',
    pr: 2509,
    render: 'ascii',
    lookFor:
      'Before: one stroke leaves the diamond’s bottom vertex. After: no leaves the right corner and drops into the parallelogram; the return runs under it into the diamond’s lower-right face, without crossing.',
  },
  {
    id: 'architecture-junction-group-icons',
    group: 'features',
    title:
      'Architecture junctions drew a gray disc and group icons were dropped',
    symptom:
      'An `architecture-beta` `junction` was drawn as a filled gray disc with a gap in the edge on both sides, and the icon named by `group id(icon)` was not drawn in the group header. mermaid 12.2.0 and 12.3.0 draw the junction as an invisible join and put the icon beside the title.',
    source:
      'architecture-beta\n  group cloud(cloud)[Cloud]\n  service gw(internet)[Gateway] in cloud\n  service db(database)[Primary DB] in cloud\n  service replica(disk)[Replica] in cloud\n  junction fan in cloud\n  gw:R -- L:fan\n  fan:R --> L:db\n  fan:B --> T:replica',
    fixCommit: '427597e2',
    pr: 2573,
    render: 'svg',
    lookFor:
      'Before: a gray disc on the Gateway edge and a bare "Cloud" title. After: the edges meet in a single join and the cloud icon sits left of the title.',
  },
  {
    id: 'flowchart-subgraph-node-style',
    title: 'Flowchart subgraph style/class and node dash/radius were ignored',
    symptom:
      'A `style` on a subgraph id left the cluster default grey, and a node `style` dropped `stroke-dasharray` and `rx`/`ry`, while mermaid 12.3.0 applies all of them.',
    source:
      'flowchart TD\n  subgraph one [First Title]\n    A --> B\n  end\n  style one fill:#fdd,stroke:#f00,stroke-width:3px\n  style A stroke-dasharray:5 5\n  style B rx:10,ry:10',
    fixCommit: 'c75bab50',
    pr: 2570,
    render: 'svg',
    lookFor:
      'Before: a grey cluster and two plain solid, square nodes. After: a pink cluster with a thick red border, a dashed A and a rounded B.',
  },
  {
    id: 'ascii-label-canvas-edge',
    parked: 'ascii-layout-details',
    title: 'ASCII edge label cut off at the canvas edge',
    symptom:
      'In a right-to-left state diagram, the label `e1` on an edge running down the outermost column printed as `1`, because its first character fell past the edge of the canvas.',
    source:
      'stateDiagram-v2\n direction RL\n S0-->S1\n S0-->S2\n S1-->S3\n S1-->S4 : e0\n S1-->S0\n S4-->S0 : e1\n S4-->S0',
    fixCommit: '1e019fa1',
    pr: 2572,
    render: 'ascii',
    lookFor:
      'Before: the right edge reads `└1`. After: the canvas is one column wider and the label reads `└e1`.',
  },
  {
    id: 'sequence-block-label-layout',
    title: 'Sequence block labels were laid out unlike mermaid.js',
    symptom:
      'The `[label]` sat inside a wide tab, divider labels were left-aligned on the same row as their message label, and the frame stood about 47px outside the lifelines. In ASCII a long label pushed the wall far past the last lifeline.',
    source:
      'sequenceDiagram\n  participant App\n  participant Broker\n  critical Establish connection\n    App->>Broker: connect\n  option Network timeout\n    Broker-->>App: retry\n  option Credentials denied\n    Broker-->>App: abort\n  end',
    fixCommit: '646631b9',
    pr: 2568,
    render: 'svg',
    lookFor:
      'Before: the tab swallows the label, `[Network timeout]` shares a row with `retry`, and the frame is far wider than the lifelines. After: the tab holds only `critical`, each divider label is centred on its own row above its message, and the frame hugs the lifelines, drawn dotted with a notched tab, as in mermaid 12.3.0.',
  },
  {
    id: 'class-cardinality-sides',
    title: 'Class cardinality labels shared one side of the edge',
    symptom:
      'Both cardinality labels sat on the left of a top-down edge, and class members printed `+ String name` and `+ run(): void` with extra spaces.',
    source:
      'classDiagram\n  class Animal {\n    +String name\n    +run() void\n  }\n  Animal "1" --> "*" Owner',
    fixCommit: 'eee92285',
    pr: 2574,
    render: 'svg',
    lookFor:
      'Before: `1` and `*` are both left of the line, members read `+ run(): void`. After: `1` is left and `*` right, members read `+run() : void`, as in mermaid 12.2.0.',
  },
  {
    id: 'ascii-lr-compact-labeled-fanout',
    title:
      'ASCII LR fan-out with a labelled edge drew three times as tall as mermaid',
    symptom:
      'A box with a labelled edge to its first child was moved into a slot of its own in a left-to-right chart, so the second-rank nodes sat about ten empty rows apart and one edge detoured around its neighbour. The same source also fixed a label overwriting the arrowhead: when a label did not fit on its run next to a sibling edge stem, it slid onto the cell beside the target box and printed `┬e1│ S2 │` with no arrowhead.',
    source:
      'flowchart LR\n  S0 --> |e0| S1\n  S1 --> |e1| S2\n  S1 --> S3\n  S0 --> S4',
    fixCommit: '88fda603',
    pr: 2575,
    render: 'ascii',
    lookFor:
      'Before: S1 and S2 at the top, S3 and S4 about ten rows below. After: a compact staircase, S1/S4 in the first column and S2/S3 in the second, as mermaid draws it.',
  },
  {
    id: 'flowchart-expanded-shapes-draw',
    title:
      'Flowchart cloud, h-cyl, tag-rect, sm-circ and fork drew as rough approximations',
    symptom:
      '`@{ shape: cloud }` was a rectangle, `h-cyl` a vertical cylinder, `tag-rect` had no dog-ear, `sm-circ` was a labelled box and `fork` drew its label over a horizontal bar.',
    source:
      'flowchart LR\nA@{ shape: cloud, label: "cloud" }\nB@{ shape: h-cyl, label: "h-cyl" }\nC@{ shape: tag-rect, label: "tag" }\nD@{ shape: sm-circ }\nE@{ shape: fork }\nA --> B --> C --> D --> E',
    fixCommit: '47ea03c0',
    pr: 2581,
    render: 'svg',
    lookFor:
      'Before: a plain box, a vertical cylinder, an undecorated box, a box labelled D and a labelled bar. After: a cloud, a horizontal cylinder, a dog-eared box, a small circle and an unlabelled upright bar, as in mermaid 12.2.0.',
  },
  {
    id: 'flowchart-linkstyle-head-colour',
    title: 'A coloured flowchart edge kept a grey arrowhead',
    symptom:
      'An edge given its own `linkStyle` stroke was drawn in that colour but its arrowhead stayed the default grey, unlike mermaid.',
    source:
      'graph TD\n  A --> B\n  A --> C\n  linkStyle 0 stroke:#f00,stroke-width:2px',
    fixCommit: 'c4137f7d',
    pr: 2580,
    render: 'svg',
    lookFor:
      'Before: the A to B line is red with a grey head. After: the head is red too, as in mermaid 12.2.0; the A to C edge keeps its grey head.',
  },
  {
    id: 'class-annotation-guillemets',
    title: 'Class annotations were drawn as `<<interface>>`',
    symptom:
      'SVG class diagrams printed an annotation with two angle brackets on each side; mermaid.js draws guillemets.',
    source:
      'classDiagram\n  class Serializable {\n    <<interface>>\n    +serialize() String\n    +deserialize(data) void\n  }',
    fixCommit: '5cab1ddd',
    pr: 2539,
    render: 'svg',
    lookFor:
      'Before: `<<interface>>` above the class name. After: `«interface»`, as in mermaid 12.2.0.',
  },
  {
    id: 'sequence-critical-option',
    title: 'An option inside a critical block vanished',
    symptom:
      'Each `option` in a `critical` block was dropped silently, along with its `[label]` and the divider line.',
    source:
      'sequenceDiagram\n  participant A as App\n  participant B as Broker\n  critical Establish connection\n    A->>B: connect\n  option Network timeout\n    B->>A: retry\n  option Credentials denied\n    B->>A: abort\n  end',
    fixCommit: '34bc03a7',
    pr: 2540,
    render: 'svg',
    lookFor:
      'Before: one undivided block, the retry and abort messages run on. After: a dashed divider with its `[label]` for each option, as in mermaid 12.3.0.',
  },
  {
    id: 'flowchart-circle-cross-terminators',
    title: 'Flowchart `--o` and `--x` edges ended in a plain arrowhead',
    symptom:
      'SVG flowcharts drew an arrowhead for `A --o B`, `A --x B`, `o--` and `x--` edges; the marker the parser recorded was dropped by the layout.',
    source:
      'flowchart LR\n  A --o B\n  C --x D\n  E o--o F\n  G x--x H\n  I --> J',
    fixCommit: '360d4f0b',
    pr: 2541,
    render: 'svg',
    lookFor:
      'Before: every edge ends in an arrowhead. After: a filled circle for `o`, a cross for `x`, and the arrowhead only on `I --> J`, as in mermaid 12.2.0.',
  },
  {
    id: 'xychart-numeric-x-range',
    title: 'A numeric xychart x-axis range was laid out as categories',
    symptom:
      '`x-axis 0 --> 100` spaced the points evenly like categories, so tick labels and bars landed where mermaid.js does not put them.',
    source:
      'xychart-beta\n  title "Sales"\n  x-axis 0 --> 100\n  y-axis "Revenue" 0 --> 100\n  bar [10, 40, 25, 70]\n  line [10, 40, 25, 70]',
    fixCommit: 'ed96f8d0',
    pr: 2543,
    render: 'svg',
    lookFor:
      'Before: four evenly spaced category slots. After: a linear axis with a label at every tick of the range and the points placed by value, as in mermaid 12.3.0.',
  },
  {
    id: 'architecture-group-row-level',
    group: 'features',
    title: 'Architecture groups rode off the row of the node they link to',
    symptom:
      'A group whose member links to a node outside it was centred on that node as a whole, so `Primary DB` sat 54px above the main row, service labels hung on the group border, and a `T`/`B` edge into a group ran beside the group instead of under its other end. The same source also fixed a service under a junction staying in its group column: `fan:B --> T:replica` left `replica` beside `Primary DB` instead of under the junction.',
    source:
      'architecture-beta\n  group cloud(cloud)[Cloud]\n  group api(server)[API Tier] in cloud\n  group data(database)[Data Tier] in cloud\n  service gw(internet)[Gateway] in api\n  service app(server)[App] in api\n  service db(database)[Primary DB] in data\n  service replica(disk)[Replica] in data\n  junction fan in cloud\n  service client(internet)[Client]\n  client:R --> L:gw\n  gw:R -- L:app\n  app:R -- L:fan\n  fan:R --> L:db\n  fan:B --> T:replica',
    fixCommit: '08ef003d',
    pr: 2538,
    render: 'svg',
    lookFor:
      'Before: the Data Tier group is shifted up, `Primary DB` sits above the main row and `Replica` beside it, with service labels on the group border. After: `Primary DB` is level with the gateway row, the `fan:B` edge drops straight down into `Replica` beneath the junction, and every label stays inside its group.',
  },
  {
    id: 'yaml-front-matter',
    title: 'A leading YAML front matter block made every diagram fail',
    symptom:
      '`---\ntitle: T\n---\nflowchart TD\n  A-->B` threw "Invalid mermaid header" for every diagram type, though mermaid.js and GitHub accept it. Its `config:` now applies like `%%{init}%%`, here dropping the mirrored participant row.',
    source:
      '---\nconfig:\n  sequence:\n    mirrorActors: false\n---\nsequenceDiagram\n  participant A as Alice\n  participant B as Bob\n  A->>B: Hello\n  B-->>A: Hi',
    fixCommit: '8757f5d2',
    pr: 2597,
    render: 'svg',
    lookFor:
      'Before: an error instead of a diagram. After: the diagram renders and the `config:` block drops the footer row of Alice and Bob boxes, as in mermaid 12.3.0.',
  },
  {
    id: 'sequence-init-mirror-actors',
    group: 'features',
    title:
      'Sequence `%%{init}%%` mirrorActors and showSequenceNumbers were ignored',
    symptom:
      '`%%{init: {"sequence": {"mirrorActors": false}}}%%` still drew the participant row under the lifelines, and `showSequenceNumbers: true` drew no message numbers, while mermaid 12.3.0 honours both.',
    source:
      '%%{init: {"sequence": {"mirrorActors": false, "showSequenceNumbers": true}}}%%\nsequenceDiagram\n  participant A as Alice\n  participant B as Bob\n  A->>B: Hello\n  B-->>A: Hi',
    fixCommit: 'c3872265',
    pr: 2600,
    render: 'svg',
    lookFor:
      'Before: a footer row of Alice and Bob boxes and unnumbered arrows. After: no footer row and the messages numbered 1 and 2, as in mermaid 12.3.0.',
  },
  {
    id: 'sequence-nested-rect-order',
    title: 'A sequence rect nested inside another rect was hidden',
    symptom:
      'The inner `rect` was painted before the outer one, so the opaque outer fill covered it and its highlight never showed.',
    source:
      'sequenceDiagram\n  participant A\n  participant B\n  rect rgb(200, 220, 255)\n    A->>B: outer\n    rect rgb(255, 220, 200)\n      B->>A: inner\n    end\n  end',
    fixCommit: '01982344',
    pr: 2595,
    render: 'svg',
    lookFor:
      'Before: only the outer blue highlight shows. After: the inner orange highlight sits on top of it around the `inner` message, as in mermaid 12.3.0.',
  },
  {
    id: 'sequence-note-over-span',
    title: 'A sequence note over two participants shrank to its text',
    symptom:
      '`Note over A,B` was sized to its text and centred between the two lifelines, so a short note touched neither; mermaid spans it across both.',
    source:
      'sequenceDiagram\n  participant Alice\n  participant Bob\n  Alice->>Bob: hello there friend\n  Note over Alice,Bob: hi',
    fixCommit: '9791be18',
    pr: 2598,
    render: 'svg',
    lookFor:
      'Before: a small note floating between the lifelines. After: the note spans from just left of Alice to just right of Bob, as in mermaid 12.3.0.',
  },
  {
    id: 'sequence-multiline-label-spacing',
    title: 'Multi-line sequence labels crowded the frame border and the arrow',
    symptom:
      'A `<br/>` message label ran its second line onto the arrow, and a `<br/>` frame label put its second line right above the first message label.',
    source:
      'sequenceDiagram\n  participant A\n  participant B\n  loop first line<br/>second line\n    A->>B: message line one<br/>message line two\n  end\n  A->>B: after',
    fixCommit: '485fdd40',
    pr: 2599,
    render: 'svg',
    lookFor:
      'Before: `message line two` sits on the arrow and `second line` touches the message label. After: the arrow drops below both message lines and the first message clears the frame label, as in mermaid 12.3.0.',
  },
]

/** Entries shown on the page: everything not parked. */
export const forkFixes: ForkFix[] = allForkFixes.filter((f) => !f.parked)

export const parkedForkFixes: ForkFix[] = allForkFixes.filter((f) => f.parked)
