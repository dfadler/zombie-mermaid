// ============================================================================
// zombie-mermaid demo — "what this fork fixes" showcase data
//
// Each entry names a real bug this fork fixed, the commit that fixed it, and a
// diagram that demonstrates it. The generator renders every entry TWICE: once
// against the tree at `fixCommit^` (the code immediately before the fix) and
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
   * Upstream `lukilabs/beautiful-mermaid` issue number(s) this fix resolves.
   *
   * Several entries share one commit but map to distinct upstream reports
   * (e.g. one PR fixing both ER aliases and ER `direction`), and one upstream
   * issue is sometimes split across two commits that each fix a different
   * symptom of it — hence an array on each side rather than a 1:1 field.
   * Omitted for fixes that don't trace back to a specific numbered issue.
   */
  upstreamIssues?: number[]
}

export const forkFixes: ForkFix[] = [
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
    id: 'class-blank-compartment',
    title: 'Class diagrams grew a blank compartment',
    symptom:
      'A class with methods but no attributes rendered an empty middle compartment where the attribute list would have been.',
    source:
      'classDiagram\n  class Service {\n    +start() void\n    +stop() void\n  }',
    fixCommit: '407355c',
    pr: 92,
    render: 'ascii',
    lookFor:
      'Before: an empty compartment between the name and the methods. After: none.',
  },
  {
    id: 'class-shorthand-label',
    title: 'A class shorthand before the brackets discarded the label',
    symptom:
      '`A:::external[External User]` — the shape patterns require the id to sit immediately before its brackets, so the `:::` token in between made every pattern miss and the label was thrown away.',
    source: 'flowchart LR\n  A:::external[External User] --> B[Internal]',
    fixCommit: 'ffa9a85',
    pr: 77,
    render: 'svg',
    lookFor: 'Before: the node shows its bare id. After: it shows its label.',
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
    id: 'cjk-state-names',
    title: 'CJK state names failed to parse in state diagrams',
    symptom:
      'stateDiagram transition and state-name patterns were ASCII-only (`\\w`), so a diagram made entirely of Chinese, Japanese, or Korean state names failed to match a single one of them.',
    source:
      'stateDiagram-v2\n  [*] --> 空闲\n  空闲 --> 处理中 : 提交\n  处理中 --> 完成',
    fixCommit: '9d722cf',
    pr: 49,
    render: 'svg',
    lookFor:
      'Before: a blank canvas — every state name failed to parse, leaving nothing to draw. After: all three states and both transitions render.',
    upstreamIssues: [43],
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
    id: 'er-label-truncation',
    title: 'Long ER relationship labels were truncated in ASCII output',
    symptom:
      'Labels longer than a fixed 6-character inter-entity gap were silently cut off — `"ordered in"` rendered as `"ordere"` — and even short labels sat flush against both entity boxes.',
    source:
      'erDiagram\n  CUSTOMER ||--o{ ORDER : places\n  PRODUCT ||--o{ LINE_ITEM : "ordered in"',
    fixCommit: 'f0683b0',
    pr: 88,
    render: 'ascii',
    lookFor:
      'Before: the second relationship label reads "ordere". After: it reads "ordered in" in full, with padding from both boxes.',
    upstreamIssues: [121],
  },
  {
    id: 'er-stray-tee',
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
    id: 'class-label-column-width',
    title: 'Long class relationship labels on narrow classes were truncated',
    symptom:
      'A class’s column was sized from its box alone, never from the relationship label that had to fit beside it — so single-letter classes with labels like `inheritance` had every label squeezed into the box’s own width and cut to `…`.',
    source:
      'classDiagram\n  A <|-- B : inheritance\n  C *-- D : composition\n  E o-- F : aggregation\n  G --> H : association\n  I ..> J : dependency\n  K ..|> L : realization',
    fixCommit: '60a40d2',
    // TODO: set to the PR that carries 60a40d2 once it is opened.
    pr: 0,
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
    // TODO: set to the PR that carries 60a40d2 once it is opened.
    pr: 0,
    render: 'ascii',
    lookFor:
      'Before: only `four` survives, on two lines. After: `one`, `two`, `three`, and `four` each sit on their own lane, joined to the boxes by a short jog, with four distinct arrowheads.',
  },
  {
    id: 'class-generic-types',
    title: 'Class member generics kept mermaid’s raw `~T~` tildes',
    symptom:
      'Mermaid converts `List~Observer~` to `List<Observer>` before rendering; the class parser here kept the tildes, so both the SVG and ASCII output showed `List~Observer~` — flagged by the weekly form-judge audit (#418).',
    source:
      'classDiagram\n  class EventEmitter {\n    -List~Observer~ observers\n    +attach(Observer) void\n  }\n  class Observer {\n    <<interface>>\n    +update() void\n  }\n  EventEmitter --> Observer',
    fixCommit: '2a06338',
    // TODO(#418 sweep): replace with the PR number once the PR is opened —
    // the branch was pushed without GitHub write access.
    pr: 0,
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
    // TODO(#418 sweep): replace with the PR number once the PR is opened —
    // the branch was pushed without GitHub write access.
    pr: 0,
    render: 'ascii',
    lookFor:
      'Before: "thick" sits glued to the dotted edge’s ┆ column. After: it sits on the thick edge’s own ┃ line, like "dotted" does on its ┆ line.',
  },
]
