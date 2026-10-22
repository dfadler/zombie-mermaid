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
   * Extra `renderMermaidSVG` options merged over the page's fixed colors, for a
   * fix that only shows up with a specific option set (e.g. `font`). SVG
   * entries only; the ASCII path ignores it.
   */
  options?: Record<string, unknown>
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
    id: 'font-css-variable',
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
    id: 'ascii-vertical-label-beside-stroke',
    title: 'ASCII vertical edge labels were printed over the edge line',
    symptom:
      'A label on a vertical edge was drawn on top of the stroke, so the line ran through the gaps between its words (`long─label`) or vanished under the text.',
    source: 'graph TD\n  A -->|long label| B\n  B -->|ab| C',
    fixCommit: '9be4d3692',
    pr: 1332,
    render: 'ascii',
    lookFor:
      'Before: the label replaces the edge line on its row. After: the line runs unbroken and the label sits one cell beside it.',
    upstreamIssues: [154],
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
    id: 'ascii-er-shorter-entity-row',
    title: 'An ER relationship beside a shorter entity landed on its border',
    symptom:
      'The relationship row was the left entity’s midpoint, so beside a shorter entity it fell on that box’s bottom border and the cardinality marker ran into the corner.',
    source:
      'erDiagram\n  CUSTOMER ||--o{ ORDER : places\n  CUSTOMER {\n    int id PK\n    string name\n    string email\n    string phone\n    string address\n  }\n  ORDER {\n    int id PK\n  }',
    fixCommit: '87336e06',
    pr: 1913,
    render: 'ascii',
    lookFor:
      'Before: the ╟ marker collides with ORDER’s └ corner. After: the line meets ORDER at a ├ junction inside the box.',
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
      'Before: PROJECT is left-aligned and the edge jogs left halfway down. After: PROJECT is centered under INSTALL and one straight vertical edge joins them.',
  },
  {
    id: 'c4-empty-boundary-frame-width',
    title: 'A C4 empty boundary frame ran past the right edge of the SVG',
    symptom:
      'An empty deployment node got its default 216px width after the diagram width was measured, so its frame was drawn partly outside the SVG and clipped at the edge.',
    source:
      'C4Deployment\n  Deployment_Node(dc, \"DC\", \"Ubuntu\") {\n    Container(app, \"App\", \"Java\")\n  }\n  Deployment_Node(empty, \"Empty\", \"x\")',
    fixCommit: 'fa02ffe3a',
    pr: 1965,
    render: 'svg',
    lookFor:
      'Before: the `Empty` frame is cut off at the right edge. After: the SVG is wider and the frame is fully drawn. mermaid 12.2.0 rejects this input, so this shows only what our output does.',
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
    id: 'node-text-contrast-on-custom-fill',
    title: 'Node text was unreadable on a dark classDef/style fill',
    symptom:
      'A node with a custom `fill` but no explicit `color` always got the theme’s text colour, so dark text could land on a dark fill (and light text on a light one).',
    source:
      'flowchart LR\n  A[Dark fill] --> B[Light fill]\n  classDef dark fill:#1e293b\n  classDef light fill:#fde68a\n  class A dark\n  class B light',
    fixCommit: 'f2e76bb0',
    pr: 76,
    render: 'svg',
    lookFor:
      'Before: both labels use the same theme text colour, so one of them is hard to read. After: each label is black or white, picked from its own fill. An explicit `color` still wins.',
    upstreamIssues: [115],
  },
  {
    id: 'svg-coordinates-two-decimals',
    title: 'SVG coordinates carried float noise like 142.38427299999998',
    symptom:
      'Layout and curve maths wrote full floating-point precision into every coordinate, bloating the SVG for no visible benefit. Numbers are now rounded to 2 decimal places and a non-finite value is written as 0, not `NaN`.',
    source:
      'graph TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Do thing]\n  B -->|No| D[Other thing]\n  C --> E((End))\n  D --> E',
    fixCommit: '5cc12f3f',
    pr: 1163,
    render: 'svg',
    excerpt: { from: '<polyline', to: '/>' },
    lookFor:
      'The picture is the same, so this shows the first edge’s markup. Before: `points` carries long decimal tails. After: at most 2 decimal places.',
    upstreamIssues: [77],
  },
  {
    id: 'ascii-longest-path-layering',
    title: 'ASCII put a node in the row of the parent that placed it first',
    symptom:
      'A node took the level of whichever parent placed it first and was never revisited, so with `A --> D` and `B --> D` it landed beside `B` and `B --> D` ran sideways. Nodes are now ranked by longest path, with back edges ignored, as mermaid does.',
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
]
