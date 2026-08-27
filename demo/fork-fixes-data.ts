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
   * Show a matched excerpt of the output markup instead of the render.
   *
   * A few fixes are invisible in a browser because the browser is forgiving
   * of the bug — the start-arrow marker below renders fine in Chrome and
   * degenerately in librsvg/Inkscape. Showing two identical pictures under
   * "Before / After" would be a false negative, so those entries show the
   * markup where the difference actually is.
   *
   * The value is a regular-expression source matched against the output.
   */
  excerpt?: string
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
    excerpt: '<marker id="arrowhead-start"[\\s\\S]*?</marker>',
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
]
