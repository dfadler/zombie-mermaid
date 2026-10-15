/**
 * Sample definitions for the zombie-mermaid visual test suite.
 *
 * Shared by:
 *   - __tests__/visual/*.visual.test.ts — the Playwright visual-regression suite
 *   - scripts/visual-diff.ts            — before/after rendering report
 *   - demo/diagram-pages-data.ts        — looks up one sample per diagram type by title
 *   - bench.ts                          — runs performance benchmarks under tsx (no browser)
 *   - vite.config.ts                    — dev server with live reload
 *
 * index.ts (the marketing home page) does not consume this file.
 *
 * Every supported feature, shape, edge type, block construct, and theme
 * variant is exercised by at least one sample.
 */

export interface Sample {
  title: string
  description: string
  source: string
  /** Optional category tag for grouping in the Table of Contents */
  category?: string
  /**
   * Whether this sample belongs in the `diagrams/<type>.html` gallery
   * (issue #713's curation) — distinct from being part of the visual-test
   * suite, which every sample in this file already is regardless of this
   * field. `true` only on the samples issue #713 explicitly chose as
   * illustrative/real-world-shaped; absent (not `false`) on everything
   * else, including a category's own already-featured
   * `DiagramTypeProfile.exampleTitle` sample and every visual-test-only
   * fixture. A new sample defaults to excluded — this only grows when
   * someone deliberately opts a sample in, not automatically as new
   * coverage fixtures are added. See docs/decisions/diagram-gallery-audit.md
   * for the reasoning behind which samples are marked `true`.
   */
  gallery?: true
  options?: {
    bg?: string
    fg?: string
    line?: string
    accent?: string
    muted?: string
    surface?: string
    border?: string
    font?: string
    padding?: number
    transparent?: boolean
    interactive?: boolean
    /** Passed straight through to the renderer's own option of the same name (see packages/core/src/types.ts's RenderOptions). */
    interactivity?: 'none' | 'static' | 'full'
  }
}

export const samples: Sample[] = [
  // ══════════════════════════════════════════════════════════════════════════
  //  HERO — Showcase diagram
  // ══════════════════════════════════════════════════════════════════════════

  // The hero showcase (demo site + README) presents this as the "after" side
  // of a before/after transform: raw Mermaid source on one side, this
  // rendered, animated, themeable diagram on the other. See index.ts's hero
  // section and scripts/generate-hero.ts.
  {
    title: 'zombie-mermaid',
    category: 'Hero',
    description: 'Mermaid rendering, made beautiful.',
    source: `stateDiagram-v2
    direction LR
    Layout e4@--> SVG: Vector
    Layout e5@--> ASCII: Text
    SVG e6@--> Theme
    ASCII e7@--> Theme
    e4@{ animate: true }
    e5@{ animate: true }
    e6@{ animate: true }
    e7@{ animate: true }`,
    // Animation is gated to interactivity: 'full' (#231) — this showcase is
    // specifically meant to animate, so it opts in explicitly.
    options: { transparent: true, interactivity: 'full' },
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  FLOWCHART — Shapes
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Simple Flow',
    category: 'Flowchart',
    description:
      'Basic linear flow with three nodes connected by solid arrows.',
    source: `graph TD
  A[Start] --> B[Process] --> C[End]`,
  },
  {
    title: 'Original Node Shapes',
    category: 'Flowchart',
    description:
      'Rectangle, rounded, diamond, stadium, and circle — the five shapes that cover most real flowcharts: a plain step, a start/end point, a decision, and a terminal marker.',
    source: `graph LR
  A[Rectangle] --> B(Rounded)
  B --> C{Diamond}
  C --> D([Stadium])
  D --> E((Circle))`,
  },
  {
    title: 'Batch 1 Shapes',
    category: 'Flowchart',
    description:
      'Subroutine, double circle, and hexagon — three specialty shapes for a predefined process, a double terminal, or a preparation step, beyond the five most common ones in Original Node Shapes.',
    source: `graph LR
  A[[Subroutine]] --> B(((Double Circle)))
  B --> C{{Hexagon}}`,
  },
  {
    title: 'Batch 2 Shapes',
    category: 'Flowchart',
    description:
      'Cylinder, asymmetric, trapezoid, and inverse trapezoid — four more specialty shapes, for a database, a flag or priority marker, or a manual operation, rounding out the full set alongside Batch 1 Shapes.',
    source: `graph LR
  A[(Database)] --> B>Flag Shape]
  B --> C[/Wider Bottom\\]
  C --> D[\\Wider Top/]`,
  },
  {
    title: 'All 12 Flowchart Shapes',
    category: 'Flowchart',
    gallery: true,
    description:
      'Every shape from Original Node Shapes and both Batch pages, chained into one reference diagram — the single chart to screenshot or copy from when you need to see all twelve at a glance instead of checking three separate pages.',
    source: `graph LR
  A[Rectangle] --> B(Rounded)
  B --> C{Diamond}
  C --> D([Stadium])
  D --> E((Circle))
  E --> F[[Subroutine]]
  F --> G(((Double Circle)))
  G --> H{{Hexagon}}
  H --> I[(Database)]
  I --> J>Flag]
  J --> K[/Trapezoid\\]
  K --> L[\\Inverse Trap/]`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  FLOWCHART — Edges
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'All Edge Styles',
    category: 'Flowchart',
    gallery: true,
    description:
      'Solid, dotted, and thick arrows side by side, each carrying its own label — the three edge weights compared directly, rather than picked from memory one at a time.',
    source: `graph TD
  A[Source] -->|solid| B[Target 1]
  A -.->|dotted| C[Target 2]
  A ==>|thick| D[Target 3]`,
  },
  {
    title: 'No-Arrow Edges',
    category: 'Flowchart',
    gallery: true,
    description:
      'Lines without arrowheads: solid `---`, dotted `-.-`, thick `===`.',
    source: `graph TD
  A[Node 1] ---|related| B[Node 2]
  B -.- C[Node 3]
  C === D[Node 4]`,
  },
  {
    title: 'Text-Embedded Labels',
    category: 'Flowchart',
    description:
      'Using `-- label -->` syntax instead of `-->|label|` for edge labels.',
    source: `flowchart TD
  A(Start) --> B{Is it sunny?}
  B -- Yes --> C[Go to the park]
  B -- No --> D[Stay indoors]
  C --> E[Finish]
  D --> E`,
  },
  {
    title: 'Bidirectional Arrows',
    category: 'Flowchart',
    gallery: true,
    description: 'Arrows in both directions: `<-->`, `<-.->`, `<==>`.',
    source: `graph LR
  A[Client] <-->|sync| B[Server]
  B <-.->|heartbeat| C[Monitor]
  C <==>|data| D[Storage]`,
  },
  {
    title: 'Parallel Links (&)',
    category: 'Flowchart',
    gallery: true,
    description: 'Using `&` to create multiple edges from/to groups of nodes.',
    source: `graph TD
  A[Input] & B[Config] --> C[Processor]
  C --> D[Output] & E[Log]`,
  },
  {
    title: 'Chained Edges',
    category: 'Flowchart',
    description: 'A long chain of nodes demonstrating edge chaining syntax.',
    source: `graph LR
  A[Step 1] --> B[Step 2] --> C[Step 3] --> D[Step 4] --> E[Step 5]`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  FLOWCHART — Edge Styling (linkStyle)
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'linkStyle: Color-Coded Edges',
    category: 'Flowchart',
    gallery: true,
    description:
      'Using `linkStyle` to color specific edges by index (0-based).',
    source: `graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Accept]
  B -->|No| D[Reject]
  C --> E[Done]
  D --> E
  linkStyle 0 stroke:#7aa2f7,stroke-width:3px
  linkStyle 1 stroke:#9ece6a,stroke-width:2px
  linkStyle 2 stroke:#f7768e,stroke-width:2px
  linkStyle default stroke:#565f89`,
  },
  {
    title: 'linkStyle: Default + Override',
    category: 'Flowchart',
    description:
      'Default edge style with index-specific overrides for critical paths.',
    source: `graph LR
  A[Request] --> B[Auth]
  B --> C[Process]
  C --> D[Response]
  B --> E[Reject]
  linkStyle default stroke:#6b7280,stroke-width:1px
  linkStyle 0,1,2 stroke:#22c55e,stroke-width:2px
  linkStyle 3 stroke:#ef4444,stroke-width:3px`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  FLOWCHART — Directions
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Direction: Left-Right (LR)',
    category: 'Flowchart',
    gallery: true,
    description: 'Horizontal layout flowing left to right.',
    source: `graph LR
  A[Input] --> B[Transform] --> C[Output]`,
  },
  {
    title: 'Direction: Bottom-Top (BT)',
    category: 'Flowchart',
    description: 'Vertical layout flowing from bottom to top.',
    source: `graph BT
  A[Foundation] --> B[Layer 2] --> C[Top]`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  FLOWCHART — Subgraphs
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Subgraphs',
    category: 'Flowchart',
    gallery: true,
    description: 'Grouped nodes inside labeled subgraph containers.',
    source: `graph TD
  subgraph Frontend
    A[React App] --> B[State Manager]
  end
  subgraph Backend
    C[API Server] --> D[Database]
  end
  B --> C`,
  },
  {
    title: 'Nested Subgraphs',
    category: 'Flowchart',
    gallery: true,
    description: 'Subgraphs inside subgraphs for hierarchical grouping.',
    source: `graph TD
  subgraph Cloud
    subgraph us-east [US East Region]
      A[Web Server] --> B[App Server]
    end
    subgraph us-west [US West Region]
      C[Web Server] --> D[App Server]
    end
  end
  E[Load Balancer] --> A
  E --> C`,
  },
  {
    title: 'Subgraph Direction Override',
    category: 'Flowchart',
    description:
      'Using `direction LR` inside a subgraph while the outer graph flows TD.',
    source: `graph TD
  subgraph pipeline [Processing Pipeline]
    direction LR
    A[Input] --> B[Parse] --> C[Transform] --> D[Output]
  end
  E[Source] --> A
  D --> F[Sink]`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  FLOWCHART — Styling
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: '::: Class Shorthand',
    category: 'Flowchart',
    description:
      'Assigning classes with `:::` syntax directly on node definitions.',
    source: `graph TD
  A[Normal]:::default --> B[Highlighted]:::highlight --> C[Error]:::error
  classDef default fill:#f4f4f5,stroke:#a1a1aa
  classDef highlight fill:#fbbf24,stroke:#d97706
  classDef error fill:#ef4444,stroke:#dc2626`,
  },
  {
    title: 'Inline Style Overrides',
    category: 'Flowchart',
    gallery: true,
    description:
      'Using `style` statements to override node fill and stroke colors.',
    source: `graph TD
  A[Default] --> B[Custom Colors] --> C[Another Custom]
  style B fill:#3b82f6,stroke:#1d4ed8,color:#ffffff
  style C fill:#10b981,stroke:#059669`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  FLOWCHART — Real-World Diagrams
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'CI/CD Pipeline',
    category: 'Flowchart',
    gallery: true,
    description:
      'A realistic CI/CD pipeline with decision points, feedback loops, and deployment stages.',
    source: `graph TD
  subgraph ci [CI Pipeline]
    A[Push Code] --> B{Tests Pass?}
    B -->|Yes| C[Build Image]
    B -->|No| D[Fix & Retry]
    D -.-> A
  end
  C --> E([Deploy Staging])
  E --> F{QA Approved?}
  F -->|Yes| G((Production))
  F -->|No| D`,
  },
  {
    title: 'System Architecture',
    category: 'Flowchart',
    gallery: true,
    description:
      'A microservices architecture with multiple services and data stores.',
    source: `graph LR
  subgraph clients [Client Layer]
    A([Web App]) --> B[API Gateway]
    C([Mobile App]) --> B
  end
  subgraph services [Service Layer]
    B --> D[Auth Service]
    B --> E[User Service]
    B --> F[Order Service]
  end
  subgraph data [Data Layer]
    D --> G[(Auth DB)]
    E --> H[(User DB)]
    F --> I[(Order DB)]
    F --> J([Message Queue])
  end`,
  },
  {
    title: 'Decision Tree',
    category: 'Flowchart',
    gallery: true,
    description: 'A branching decision flowchart with multiple outcomes.',
    source: `graph TD
  A{Is it raining?} -->|Yes| B{Have umbrella?}
  A -->|No| C([Go outside])
  B -->|Yes| D([Go with umbrella])
  B -->|No| E{Is it heavy?}
  E -->|Yes| F([Stay inside])
  E -->|No| G([Run for it])`,
  },
  {
    title: 'Git Branching Workflow',
    category: 'Flowchart',
    gallery: true,
    description: 'A git flow showing feature branches, PRs, and release cycle.',
    source: `graph LR
  A[main] --> B[develop]
  B --> C[feature/auth]
  B --> D[feature/ui]
  C --> E{PR Review}
  D --> E
  E -->|approved| B
  B --> F[release/1.0]
  F --> G{Tests?}
  G -->|pass| A
  G -->|fail| F`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  INTERACTIVITY & CONFIGURATION
  //
  //  Every sample on this page renders twice — SVG and ASCII. That is why
  //  these samples are worth having rather than describing: the pair shows,
  //  without anyone having to assert it, which features survive the trip to a
  //  terminal and which are browser-only.
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Interactivity: Links and Tooltips',
    category: 'Interactivity',
    description:
      '`click` turns a node into a real SVG `<a href>`, and a quoted tooltip becomes a native `<title>`. Both are plain markup — no JavaScript is involved, and the tooltip is also what a screen reader announces. Hover a node to see it, and note the ASCII panel below: a terminal has neither links nor hover, so the diagram degrades to its labels.',
    source: `flowchart LR
  Docs[Docs] --> Repo[Repo]
  Repo --> Guide[Guides]
  click Docs "https://mermaid.js.org" "The Mermaid language reference" _blank
  click Repo "https://github.com/dfadler/zombie-mermaid" "This repository" _blank
  click Guide "./" "A relative reference, resolved against this page"`,
  },
  {
    title: 'Interactivity: Curved Edges',
    category: 'Interactivity',
    description:
      'A diagram can configure its own rendering with `%%{init: ...}%%`. Here it asks for the `basis` curve, a direct port of d3’s `curveBasis`, so edges bow through their bend points instead of turning square corners. An explicit `curve` render option always wins over the directive.',
    source: `%%{init: {"flowchart": {"curve": "basis"}}}%%
flowchart TD
  Ingest[Ingest] --> Queue[Queue]
  Queue --> Worker[Worker]
  Queue --> Retry[Retry]
  Worker --> Store[(Store)]
  Retry --> Worker`,
  },
  {
    title: 'Interactivity: Step Routing',
    category: 'Interactivity',
    description:
      'The same directive with `step` instead, which routes every edge as right angles. The default stays `linear`, which still emits `<polyline class="edge">` so existing selectors keep working; only a non-linear curve switches the element to `<path>`.',
    source: `%%{init: {"flowchart": {"curve": "step"}}}%%
flowchart LR
  Client[Client] --> Gateway[Gateway]
  Gateway --> AuthSvc[Auth]
  Gateway --> DataSvc[Data]
  AuthSvc --> Cache[(Cache)]
  DataSvc --> Cache`,
  },
  {
    title: 'Interactivity: Animated Edge',
    category: 'Interactivity',
    description:
      'An edge can be given an id and animated: `e1@--> B` names it, and `e1@{ animate: true }` gives it a marching dash via CSS `@keyframes`, guarded by `prefers-reduced-motion`. This is the clearest case of a browser-only feature. The SVG above moves; the ASCII panel below draws an ordinary solid edge, with neither the motion nor the dash to hint that any was asked for. A static rasterizer sits between the two, capturing the dashes as a single frozen frame.',
    source: `flowchart LR
  Producer[Producer] e1@--> Broker[Broker]
  Broker e2@--> Consumer[Consumer]
  e1@{ animate: true }
  e2@{ animate: true }`,
    // Animation is gated to interactivity: 'full' (#231) — this sample
    // exists specifically to demonstrate it, so it opts in explicitly.
    options: { interactivity: 'full' },
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  STATE DIAGRAMS
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Basic State Diagram',
    category: 'State',
    description:
      'A simple `stateDiagram-v2` with start/end pseudostates and transitions.',
    source: `stateDiagram-v2
  [*] --> Idle
  Idle --> Active : start
  Active --> Idle : cancel
  Active --> Done : complete
  Done --> [*]`,
  },
  {
    title: 'State: Composite States',
    category: 'State',
    gallery: true,
    description: 'Nested composite states with inner transitions.',
    source: `stateDiagram-v2
  [*] --> Idle
  Idle --> Processing : submit
  state Processing {
    parse --> validate
    validate --> execute
  }
  Processing --> Complete : done
  Processing --> Error : fail
  Error --> Idle : retry
  Complete --> [*]`,
  },
  {
    title: 'State: Connection Lifecycle',
    category: 'State',
    gallery: true,
    description: 'TCP-like connection state machine with multiple states.',
    source: `stateDiagram-v2
  [*] --> Closed
  Closed --> Connecting : connect
  Connecting --> Connected : success
  Connecting --> Closed : timeout
  Connected --> Disconnecting : close
  Connected --> Reconnecting : error
  Reconnecting --> Connected : success
  Reconnecting --> Closed : max_retries
  Disconnecting --> Closed : done
  Closed --> [*]`,
  },

  {
    title: 'State: CJK State Names',
    category: 'State',
    gallery: true,
    description: 'State diagram using Chinese characters for state names.',
    source: `stateDiagram-v2
  [*] --> 空闲
  空闲 --> 处理中 : 提交
  处理中 --> 完成 : 成功
  处理中 --> 错误 : 失败
  错误 --> 空闲 : 重试
  完成 --> [*]`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  SEQUENCE DIAGRAMS — Core Features
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Sequence: Basic Messages',
    category: 'Sequence',
    description: 'Simple request/response between two participants.',
    source: `sequenceDiagram
  Alice->>Bob: Hello Bob!
  Bob-->>Alice: Hi Alice!`,
  },
  {
    title: 'Sequence: Participant Aliases',
    category: 'Sequence',
    description:
      'Using `participant ... as ...` for compact diagram IDs with readable labels.',
    source: `sequenceDiagram
  participant A as Alice
  participant B as Bob
  participant C as Charlie
  A->>B: Hello
  B->>C: Forward
  C-->>A: Reply`,
  },
  {
    title: 'Sequence: Actor Stick Figures',
    category: 'Sequence',
    gallery: true,
    description:
      'Using `actor` instead of `participant` renders stick figures instead of boxes.',
    source: `sequenceDiagram
  actor U as User
  participant S as System
  participant DB as Database
  U->>S: Click button
  S->>DB: Query
  DB-->>S: Results
  S-->>U: Display`,
  },
  {
    title: 'Sequence: Arrow Types',
    category: 'Sequence',
    gallery: true,
    description:
      'All arrow types: solid `->>` and dashed `-->>` with filled arrowheads, open arrows `-)` .',
    source: `sequenceDiagram
  A->>B: Solid arrow (sync)
  B-->>A: Dashed arrow (return)
  A-)B: Open arrow (async)
  B--)A: Open dashed arrow`,
  },
  {
    title: 'Sequence: Activation Boxes',
    category: 'Sequence',
    gallery: true,
    description: 'Using `+` and `-` to show when participants are active.',
    source: `sequenceDiagram
  participant C as Client
  participant S as Server
  C->>+S: Request
  S->>+S: Process
  S->>-S: Done
  S-->>-C: Response`,
  },
  {
    title: 'Sequence: Self-Messages',
    category: 'Sequence',
    gallery: true,
    description:
      'A participant sending a message to itself (displayed as a loop arrow).',
    source: `sequenceDiagram
  participant S as Server
  S->>S: Internal process
  S->>S: Validate
  S-->>S: Log`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  SEQUENCE DIAGRAMS — Blocks
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Sequence: Loop Block',
    category: 'Sequence',
    gallery: true,
    description: 'A `loop` construct wrapping repeated message exchanges.',
    source: `sequenceDiagram
  participant C as Client
  participant S as Server
  C->>S: Connect
  loop Every 30s
    C->>S: Heartbeat
    S-->>C: Ack
  end
  C->>S: Disconnect`,
  },
  {
    title: 'Sequence: Alt/Else Block',
    category: 'Sequence',
    gallery: true,
    description: 'Conditional branching with `alt` (if) and `else` blocks.',
    source: `sequenceDiagram
  participant C as Client
  participant S as Server
  C->>S: Login
  alt Valid credentials
    S-->>C: 200 OK
  else Invalid
    S-->>C: 401 Unauthorized
  else Account locked
    S-->>C: 403 Forbidden
  end`,
  },
  {
    title: 'Sequence: Opt Block',
    category: 'Sequence',
    gallery: true,
    description: 'Optional block — executes only if condition is met.',
    source: `sequenceDiagram
  participant A as App
  participant C as Cache
  participant DB as Database
  A->>C: Get data
  C-->>A: Cache miss
  opt Cache miss
    A->>DB: Query
    DB-->>A: Results
    A->>C: Store in cache
  end`,
  },
  {
    title: 'Sequence: Par Block',
    category: 'Sequence',
    gallery: true,
    description: 'Parallel execution with `par`/`and` constructs.',
    source: `sequenceDiagram
  participant C as Client
  participant A as AuthService
  participant U as UserService
  participant O as OrderService
  C->>A: Authenticate
  par Fetch user data
    A->>U: Get profile
  and Fetch orders
    A->>O: Get orders
  end
  A-->>C: Combined response`,
  },
  {
    title: 'Sequence: Critical Block',
    category: 'Sequence',
    description: 'Critical section that must complete atomically.',
    source: `sequenceDiagram
  participant A as App
  participant DB as Database
  A->>DB: BEGIN
  critical Transaction
    A->>DB: UPDATE accounts
    A->>DB: INSERT log
  end
  A->>DB: COMMIT`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  SEQUENCE DIAGRAMS — Notes
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Sequence: Notes (Right/Left/Over)',
    category: 'Sequence',
    gallery: true,
    description: 'Notes positioned to the right, left, or over participants.',
    source: `sequenceDiagram
  participant A as Alice
  participant B as Bob
  Note left of A: Alice prepares
  A->>B: Hello
  Note right of B: Bob thinks
  B-->>A: Reply
  Note over A,B: Conversation complete`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  SEQUENCE DIAGRAMS — Complex / Real-World
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Sequence: OAuth 2.0 Flow',
    category: 'Sequence',
    gallery: true,
    description: 'Full OAuth 2.0 authorization code flow with token exchange.',
    source: `sequenceDiagram
  actor U as User
  participant App as Client App
  participant Auth as Auth Server
  participant API as Resource API
  U->>App: Click Login
  App->>Auth: Authorization request
  Auth->>U: Login page
  U->>Auth: Credentials
  Auth-->>App: Authorization code
  App->>Auth: Exchange code for token
  Auth-->>App: Access token
  App->>API: Request + token
  API-->>App: Protected resource
  App-->>U: Display data`,
  },
  {
    title: 'Sequence: Database Transaction',
    category: 'Sequence',
    gallery: true,
    description: 'Multi-step database transaction with rollback handling.',
    source: `sequenceDiagram
  participant C as Client
  participant S as Server
  participant DB as Database
  C->>S: POST /transfer
  S->>DB: BEGIN
  S->>DB: Debit account A
  alt Success
    S->>DB: Credit account B
    S->>DB: INSERT audit_log
    S->>DB: COMMIT
    S-->>C: 200 OK
  else Insufficient funds
    S->>DB: ROLLBACK
    S-->>C: 400 Bad Request
  end`,
  },
  {
    title: 'Sequence: Microservice Orchestration',
    category: 'Sequence',
    gallery: true,
    description:
      'Complex multi-service flow with parallel calls and error handling.',
    source: `sequenceDiagram
  participant G as Gateway
  participant A as Auth
  participant U as Users
  participant O as Orders
  participant N as Notify
  G->>A: Validate token
  A-->>G: Valid
  par Fetch data
    G->>U: Get user
    U-->>G: User data
  and
    G->>O: Get orders
    O-->>G: Order list
  end
  G->>N: Send notification
  N-->>G: Queued
  Note over G: Aggregate response`,
  },
  {
    title: 'Sequence: Self-Messages with Notes',
    category: 'Sequence',
    description:
      'A self-message wrapped in a note inside a conditional block — useful for annotating a retry loop, an internal computation, or any step where a participant acts on itself without messaging anyone else.',
    source: `sequenceDiagram
  participant User
  participant Main as Main Process
  participant Renderer
  participant Timer as 3s Fallback Timer
  User->>Main: CMD+W
  Main->>Main: event.preventDefault()
  Main->>Renderer: WINDOW_CLOSE_REQUESTED
  Main->>Timer: Start 3s timer
  alt Multiple panels
    Renderer->>Renderer: closePanel(focusedId)
    Note over Renderer: Panel removed
    Note over Renderer: No confirmCloseWindow!
    Timer-->>Main: 3s elapsed → window.destroy()
  else Single panel
    Renderer->>Renderer: closePanel(lastId)
    Note over Renderer: Stack becomes []
    Renderer->>Renderer: Auto-select fires → new panel created!
    Note over Renderer: Panel reopens
    Timer-->>Main: 3s elapsed → window.destroy()
  end`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  CLASS DIAGRAMS — Core Features
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Class: Basic Class',
    category: 'Class',
    description:
      'A single class with attributes and methods, rendered as a 3-compartment box.',
    source: `classDiagram
  class Animal {
    +String name
    +int age
    +eat() void
    +sleep() void
  }`,
  },
  {
    title: 'Class: Visibility Markers',
    category: 'Class',
    gallery: true,
    description:
      'All four visibility levels: `+` (public), `-` (private), `#` (protected), `~` (package).',
    source: `classDiagram
  class User {
    +String name
    -String password
    #int internalId
    ~String packageField
    +login() bool
    -hashPassword() String
    #validate() void
    ~notify() void
  }`,
  },
  {
    title: 'Class: Interface Annotation',
    category: 'Class',
    gallery: true,
    description: 'Using `<<interface>>` annotation above the class name.',
    source: `classDiagram
  class Serializable {
    <<interface>>
    +serialize() String
    +deserialize(data) void
  }`,
  },
  {
    title: 'Class: Abstract Annotation',
    category: 'Class',
    description: 'Using `<<abstract>>` annotation for abstract classes.',
    source: `classDiagram
  class Shape {
    <<abstract>>
    +String color
    +area() double
    +draw() void
  }`,
  },
  {
    title: 'Class: Enum Annotation',
    category: 'Class',
    description: 'Using `<<enumeration>>` annotation for enum types.',
    source: `classDiagram
  class Status {
    <<enumeration>>
    ACTIVE
    INACTIVE
    PENDING
    DELETED
  }`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  CLASS DIAGRAMS — Relationships
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Class: Inheritance (<|--)',
    category: 'Class',
    description:
      'Inheritance relationship rendered with a hollow triangle marker.',
    source: `classDiagram
  class Animal {
    +String name
    +eat() void
  }
  class Dog {
    +String breed
    +bark() void
  }
  class Cat {
    +bool isIndoor
    +meow() void
  }
  Animal <|-- Dog
  Animal <|-- Cat`,
  },
  {
    title: 'Class: Composition (*--)',
    category: 'Class',
    description:
      'Composition — "owns" relationship with filled diamond marker.',
    source: `classDiagram
  class Car {
    +String model
    +start() void
  }
  class Engine {
    +int horsepower
    +rev() void
  }
  Car *-- Engine`,
  },
  {
    title: 'Class: Aggregation (o--)',
    category: 'Class',
    description: 'Aggregation — "has" relationship with hollow diamond marker.',
    source: `classDiagram
  class University {
    +String name
  }
  class Department {
    +String faculty
  }
  University o-- Department`,
  },
  {
    title: 'Class: Association (-->)',
    category: 'Class',
    description: 'Basic association — simple directed arrow.',
    source: `classDiagram
  class Customer {
    +String name
  }
  class Order {
    +int orderId
  }
  Customer --> Order`,
  },
  {
    title: 'Class: Dependency (..>)',
    category: 'Class',
    description: 'Dependency — dashed line with open arrow.',
    source: `classDiagram
  class Service {
    +process() void
  }
  class Repository {
    +find() Object
  }
  Service ..> Repository`,
  },
  {
    title: 'Class: Realization (..|>)',
    category: 'Class',
    description:
      'Realization — dashed line with hollow triangle (implements interface).',
    source: `classDiagram
  class Flyable {
    <<interface>>
    +fly() void
  }
  class Bird {
    +fly() void
    +sing() void
  }
  Bird ..|> Flyable`,
  },
  {
    title: 'Class: All 6 Relationship Types',
    category: 'Class',
    gallery: true,
    description:
      "Inheritance, composition, aggregation, association, dependency, and realization, chained into one diagram — the reference chart for telling all six markers apart at a glance instead of checking each relationship's own page.",
    source: `classDiagram
  A <|-- B : inheritance
  C *-- D : composition
  E o-- F : aggregation
  G --> H : association
  I ..> J : dependency
  K ..|> L : realization`,
  },
  {
    title: 'Class: Relationship Labels',
    category: 'Class',
    gallery: true,
    description: 'Labeled relationships between classes with descriptive text.',
    source: `classDiagram
  class Teacher {
    +String name
  }
  class Student {
    +String name
  }
  class Course {
    +String title
  }
  Teacher --> Course : teaches
  Student --> Course : enrolled in`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  CLASS DIAGRAMS — Complex / Real-World
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Class: Design Pattern — Observer',
    category: 'Class',
    gallery: true,
    description:
      'The Observer (publish-subscribe) design pattern with interface + concrete implementations.',
    source: `classDiagram
  class Subject {
    <<interface>>
    +attach(Observer) void
    +detach(Observer) void
    +notify() void
  }
  class Observer {
    <<interface>>
    +update() void
  }
  class EventEmitter {
    -List~Observer~ observers
    +attach(Observer) void
    +detach(Observer) void
    +notify() void
  }
  class Logger {
    +update() void
  }
  class Alerter {
    +update() void
  }
  Subject <|.. EventEmitter
  Observer <|.. Logger
  Observer <|.. Alerter
  EventEmitter --> Observer`,
  },
  {
    title: 'Class: MVC Architecture',
    category: 'Class',
    gallery: true,
    description:
      'Model-View-Controller pattern showing relationships between layers.',
    source: `classDiagram
  class Model {
    -data Map
    +getData() Map
    +setData(key, val) void
    +notify() void
  }
  class View {
    -model Model
    +render() void
    +update() void
  }
  class Controller {
    -model Model
    -view View
    +handleInput(event) void
    +updateModel(data) void
  }
  Controller --> Model : updates
  Controller --> View : refreshes
  View --> Model : reads
  Model ..> View : notifies`,
  },
  {
    title: 'Class: Full Hierarchy',
    category: 'Class',
    gallery: true,
    description:
      'A complete class hierarchy with abstract base, interfaces, and concrete classes.',
    source: `classDiagram
  class Animal {
    <<abstract>>
    +String name
    +int age
    +eat() void
    +sleep() void
  }
  class Mammal {
    +bool warmBlooded
    +nurse() void
  }
  class Bird {
    +bool canFly
    +layEggs() void
  }
  class Dog {
    +String breed
    +bark() void
  }
  class Cat {
    +bool isIndoor
    +purr() void
  }
  class Parrot {
    +String vocabulary
    +speak() void
  }
  Animal <|-- Mammal
  Animal <|-- Bird
  Mammal <|-- Dog
  Mammal <|-- Cat
  Bird <|-- Parrot`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  ER DIAGRAMS — Core Features
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'ER: Basic Relationship',
    category: 'ER',
    description: 'A simple one-to-many relationship between two entities.',
    source: `erDiagram
  CUSTOMER ||--o{ ORDER : places`,
  },
  {
    title: 'ER: Entity with Attributes',
    category: 'ER',
    gallery: true,
    description:
      'An entity with typed attributes and `PK`/`FK`/`UK` key badges.',
    source: `erDiagram
  CUSTOMER {
    int id PK
    string name
    string email UK
    date created_at
  }`,
  },
  {
    title: 'ER: Attribute Keys (PK, FK, UK)',
    category: 'ER',
    gallery: true,
    description: 'All three key constraint types rendered as badges.',
    source: `erDiagram
  ORDER {
    int id PK
    int customer_id FK
    string invoice_number UK
    decimal total
    date order_date
    string status
  }`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  ER DIAGRAMS — Cardinality Types
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'ER: Exactly One to Exactly One (||--||)',
    category: 'ER',
    description: 'One-to-one mandatory relationship.',
    source: `erDiagram
  PERSON ||--|| PASSPORT : has`,
  },
  {
    title: 'ER: Exactly One to Zero-or-Many (||--o{)',
    category: 'ER',
    description: "Classic one-to-many optional relationship (crow's foot).",
    source: `erDiagram
  CUSTOMER ||--o{ ORDER : places`,
  },
  {
    title: 'ER: Zero-or-One to One-or-Many (|o--|{)',
    category: 'ER',
    description: 'Optional on one side, at-least-one on the other.',
    source: `erDiagram
  SUPERVISOR |o--|{ EMPLOYEE : manages`,
  },
  {
    title: 'ER: One-or-More to Zero-or-Many (}|--o{)',
    category: 'ER',
    description: 'At-least-one to zero-or-many relationship.',
    source: `erDiagram
  TEACHER }|--o{ COURSE : teaches`,
  },
  {
    title: 'ER: All Cardinality Types',
    category: 'ER',
    gallery: true,
    description:
      "Every crow's-foot cardinality combination side by side — the reference chart for reading any combination at a glance instead of checking each relationship's own page.",
    source: `erDiagram
  A ||--|| B : "one-to-one"
  C ||--o{ D : "one-to-many"
  E |o--|{ F : opt-to-many
  G }|--o{ H : "many-to-many"`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  ER DIAGRAMS — Line Styles
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'ER: Identifying (Solid) Relationship',
    category: 'ER',
    description:
      'Solid line indicating an identifying relationship (child depends on parent for identity).',
    source: `erDiagram
  ORDER ||--|{ LINE_ITEM : contains`,
  },
  {
    title: 'ER: Non-Identifying (Dashed) Relationship',
    category: 'ER',
    description: 'Dashed line indicating a non-identifying relationship.',
    source: `erDiagram
  USER ||..o{ LOG_ENTRY : generates
  USER ||..o{ SESSION : opens`,
  },
  {
    title: 'ER: Mixed Identifying & Non-Identifying',
    category: 'ER',
    gallery: true,
    description: 'Both solid and dashed lines in the same diagram.',
    source: `erDiagram
  ORDER ||--|{ LINE_ITEM : contains
  ORDER ||..o{ SHIPMENT : ships-via
  PRODUCT ||--o{ LINE_ITEM : includes
  PRODUCT ||..o{ REVIEW : receives`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  ER DIAGRAMS — Complex / Real-World
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'ER: E-Commerce Schema',
    category: 'ER',
    gallery: true,
    description:
      'Full e-commerce database schema with customers, orders, products, and line items.',
    source: `erDiagram
  CUSTOMER {
    int id PK
    string name
    string email UK
  }
  ORDER {
    int id PK
    date created
    int customer_id FK
  }
  PRODUCT {
    int id PK
    string name
    float price
  }
  LINE_ITEM {
    int id PK
    int order_id FK
    int product_id FK
    int quantity
  }
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains
  PRODUCT ||--o{ LINE_ITEM : includes`,
  },
  {
    title: 'ER: Blog Platform Schema',
    category: 'ER',
    gallery: true,
    description: 'Blog system with users, posts, comments, and tags.',
    source: `erDiagram
  USER {
    int id PK
    string username UK
    string email UK
    date joined
  }
  POST {
    int id PK
    string title
    text content
    int author_id FK
    date published
  }
  COMMENT {
    int id PK
    text body
    int post_id FK
    int user_id FK
    date created
  }
  TAG {
    int id PK
    string name UK
  }
  USER ||--o{ POST : writes
  USER ||--o{ COMMENT : authors
  POST ||--o{ COMMENT : has
  POST }|--o{ TAG : tagged-with`,
  },
  {
    title: 'ER: School Management Schema',
    category: 'ER',
    gallery: true,
    description:
      'School system with students, teachers, courses, and enrollments.',
    source: `erDiagram
  STUDENT {
    int id PK
    string name
    date dob
    string grade
  }
  TEACHER {
    int id PK
    string name
    string department
  }
  COURSE {
    int id PK
    string title
    int teacher_id FK
    int credits
  }
  ENROLLMENT {
    int id PK
    int student_id FK
    int course_id FK
    string semester
    float grade
  }
  TEACHER ||--o{ COURSE : teaches
  STUDENT ||--o{ ENROLLMENT : enrolled
  COURSE ||--o{ ENROLLMENT : has`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  XY CHARTS (xychart-beta)
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'XY: Simple Bar Chart',
    category: 'XY Chart',
    description: 'Basic bar chart with categorical x-axis.',
    source: `xychart-beta
    title "Product Sales"
    x-axis [Widgets, Gadgets, Gizmos, Doodads, Thingamajigs]
    bar [150, 230, 180, 95, 310]`,
    options: { interactive: true },
  },
  {
    title: 'XY: Line Chart',
    category: 'XY Chart',
    gallery: true,
    description: 'Line chart showing revenue growth over years.',
    source: `xychart-beta
    title "Revenue Growth"
    x-axis [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]
    line [320, 420, 540, 680, 820, 950, 1080, 1200]`,
    options: { interactive: true },
  },
  {
    title: 'XY: Bar and Line Overlay',
    category: 'XY Chart',
    gallery: true,
    description: 'Bars with a line overlay and both axis titles.',
    source: `xychart-beta
    title "Monthly Revenue"
    x-axis "Month" [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec]
    y-axis "Revenue (USD)" 0 --> 10000
    bar [4200, 5000, 5800, 6200, 5500, 7000, 7800, 7200, 8400, 8100, 9000, 9200]
    line [4200, 5000, 5800, 6200, 5500, 7000, 7800, 7200, 8400, 8100, 9000, 9200]`,
    options: { interactive: true },
  },
  {
    title: 'XY: Horizontal Bars',
    category: 'XY Chart',
    gallery: true,
    description: 'Horizontal bar chart showing language popularity.',
    source: `xychart-beta horizontal
    title "Language Popularity"
    x-axis [Python, JavaScript, Java, Go, Rust]
    bar [30, 25, 20, 12, 8]`,
    options: { interactive: true },
  },
  {
    title: 'XY: Multiple Bar Series',
    category: 'XY Chart',
    gallery: true,
    description: 'Two bar series comparing years side by side.',
    source: `xychart-beta
    title "2023 vs 2024 Sales"
    x-axis [Q1, Q2, Q3, Q4]
    bar [200, 250, 300, 280]
    bar [230, 280, 320, 350]`,
    options: { interactive: true },
  },
  {
    title: 'XY: Dual Lines',
    category: 'XY Chart',
    gallery: true,
    description: 'Two lines comparing planned vs actual values.',
    source: `xychart-beta
    title "Planned vs Actual"
    x-axis [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug]
    line [100, 145, 190, 240, 280, 320, 360, 400]
    line [90, 130, 185, 235, 275, 340, 380, 420]`,
    options: { interactive: true },
  },
  {
    title: 'XY: Numeric X-Axis',
    category: 'XY Chart',
    gallery: true,
    description: 'Line chart using a numeric x-axis range.',
    source: `xychart-beta
    title "Distribution Curve"
    x-axis 0 --> 100
    line [4, 7, 13, 21, 31, 43, 58, 71, 84, 91, 95, 91, 84, 71, 58, 43, 31, 21, 13, 7, 4]`,
    options: { interactive: true },
  },
  {
    title: 'XY: 12-Month Dataset',
    category: 'XY Chart',
    description: 'Full year monthly data with bar and trend line.',
    source: `xychart-beta
    title "Monthly Active Users (2024)"
    x-axis [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec]
    y-axis "Users" 0 --> 30000
    bar [12000, 13500, 15200, 16800, 18500, 20100, 19800, 21500, 23000, 24200, 25800, 28000]
    line [12000, 13500, 15200, 16800, 18500, 20100, 19800, 21500, 23000, 24200, 25800, 28000]`,
    options: { interactive: true },
  },
  {
    title: 'XY: Horizontal Combined',
    category: 'XY Chart',
    description: 'Horizontal chart with both bars and a trend line.',
    source: `xychart-beta horizontal
    title "Budget vs Actual"
    x-axis [Eng, Sales, Marketing, Product, Ops, HR, Finance, Legal]
    bar [500, 350, 250, 200, 150, 120, 100, 80]
    line [480, 380, 230, 180, 160, 110, 95, 75]`,
    options: { interactive: true },
  },
  {
    title: 'XY: Sprint Burndown',
    category: 'XY Chart',
    gallery: true,
    description: 'Sprint burndown chart with actual and ideal lines.',
    source: `xychart-beta
    title "Sprint Burndown"
    x-axis [D1, D2, D3, D4, D5, D6, D7, D8, D9, D10]
    y-axis "Story Points" 0 --> 80
    line [72, 65, 58, 50, 45, 38, 30, 22, 12, 0]
    line [72, 65, 58, 50, 43, 36, 29, 22, 14, 0]`,
    options: { interactive: true },
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  Appended, not grouped with its category (see comment on the entry
  //  below) — the ASCII/SVG visual regression suites key baseline
  //  filenames off each sample's flat array index, so inserting anywhere
  //  but the very end renumbers every following baseline and forces a
  //  wall-of-unrelated-PNGs diff. Category display in the live demo groups
  //  by the `category` field, not array position, so this still shows up
  //  under "Sequence" there.
  // ══════════════════════════════════════════════════════════════════════════
  {
    title: 'Sequence: Alt/Else Long Label With Uninvolved Participant',
    category: 'Sequence',
    description:
      "A long alt/else condition label next to a participant with no messages inside that block — the block widens to fit the label without cutting off that participant's own lifeline, which matters once a real condition description runs longer than a word or two.",
    source: `sequenceDiagram
  participant A
  participant B
  participant C
  alt credentials valid
    A->>B: x
  else credentials rejected
    A->>B: y
  end`,
  },
  {
    title: 'Sequence: Create/Destroy Participants',
    category: 'Sequence',
    gallery: true,
    description:
      "Mermaid's own create/destroy example: Carl and Donald appear at the message that creates them, and Carl and Bob's lifelines end with a cross at the message that destroys them — useful for showing a participant's actual lifetime instead of assuming every actor exists for the whole diagram.",
    source: `sequenceDiagram
  Alice->>Bob: Hello Bob, how are you ?
  Bob->>Alice: Fine, thank you. And you?
  create participant Carl
  Alice->>Carl: Hi Carl!
  create actor D as Donald
  Carl->>D: Hi!
  destroy Carl
  Alice-xCarl: We are too many
  destroy Bob
  Bob->>Alice: I agree`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  C4 — appended at the end for the same flat-index baseline-filename
  //  reason as the Sequence entries above (see #1217).
  // ══════════════════════════════════════════════════════════════════════════
  {
    title: 'C4: System Context',
    category: 'C4',
    description:
      'A C4 System Context diagram: a person, an internal system in an enterprise boundary, and an external system, joined by labelled relationships.',
    source: `C4Context
  title System Context for Internet Banking
  Person(customer, "Personal Banking Customer", "A customer of the bank")
  Enterprise_Boundary(b0, "Bank") {
    System(banking, "Internet Banking System", "Lets customers view accounts")
    SystemDb(ledger, "Ledger", "Stores transactions")
  }
  System_Ext(mail, "E-mail System", "Sends e-mails")
  Rel(customer, banking, "Uses", "HTTPS")
  Rel(banking, ledger, "Reads from and writes to")
  Rel_Back(customer, mail, "Sends e-mails to")
  Rel(banking, mail, "Sends e-mail using")`,
  },
  {
    title: 'C4: Container With Boundary And BiRel',
    category: 'C4',
    gallery: true,
    description:
      'A C4 Container diagram: a system boundary holding containers, a database and a queue, with a bidirectional relationship and an external system.',
    source: `C4Container
  Person(user, "User")
  System_Boundary(sys, "Shop") {
    Container(web, "Web App", "React", "Storefront")
    Container(api, "API", "Node.js", "Business logic")
    ContainerDb(db, "Database", "PostgreSQL", "Orders")
    ContainerQueue(q, "Events", "Kafka")
  }
  System_Ext(pay, "Payments")
  Rel(user, web, "Browses")
  Rel(web, api, "Calls", "JSON/HTTPS")
  Rel(api, db, "Reads/writes", "SQL")
  BiRel(api, q, "Publishes", "AMQP")
  Rel(api, pay, "Charges cards")`,
  },
  {
    title: 'C4: Nested Boundaries Component',
    category: 'C4',
    gallery: true,
    description:
      'A C4 Component diagram with a boundary nested inside another boundary, plus components wired to a database outside both.',
    source: `C4Component
  Container_Boundary(api, "API Application") {
    Boundary(web, "Web Layer") {
      Component(ctl, "Controller", "Express", "Routes requests")
    }
    Component(svc, "Service", "TypeScript", "Business rules")
  }
  ContainerDb(db, "Database", "Postgres")
  Rel(ctl, svc, "Uses")
  BiRel(svc, db, "Reads and writes", "SQL")`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  Architecture — appended at the end for the same flat-index
  //  baseline-filename reason as the Sequence entries above (see #1218).
  // ══════════════════════════════════════════════════════════════════════════
  {
    title: 'Architecture: Services And Edge Sides',
    category: 'Architecture',
    description:
      'architecture-beta services only (no groups), joined on all four sides (L/R/T/B), with plain and arrowed edges and a mix of built-in and unknown icons.',
    source: `architecture-beta
  service db(database)[Database]
  service disk(disk)[Disk]
  service server(server)[Server]
  service cloud(cloud)[Cloud]
  service web(internet)[Web]
  service mystery(not-a-real-icon)[Unknown Icon]
  service bare[No Icon]
  db:R -- L:server
  server:R --> L:cloud
  server:B -- T:disk
  cloud:T <-- B:web
  web:R <--> L:mystery
  disk:R -- L:bare`,
  },
  {
    title: 'Architecture: Nested Groups And Junction',
    category: 'Architecture',
    gallery: true,
    description:
      'architecture-beta groups nested two deep, with a junction fanning one edge out to two services.',
    source: `architecture-beta
  group cloud(cloud)[Cloud]
  group api(server)[API Tier] in cloud
  group data(database)[Data Tier] in cloud
  service gw(internet)[Gateway] in api
  service app(server)[App] in api
  service db(database)[Primary DB] in data
  service replica(disk)[Replica] in data
  junction fan in cloud
  service client(internet)[Client]
  client:R --> L:gw
  gw:R -- L:app
  app:R -- L:fan
  fan:R --> L:db
  fan:B --> T:replica`,
  },
  {
    title: 'Architecture: Group-To-Group Edges',
    category: 'Architecture',
    gallery: true,
    description:
      'architecture-beta edges attached to a service\'s enclosing group with the {group} modifier, on one or both ends.',
    source: `architecture-beta
  group front(cloud)[Frontend]
  group back(server)[Backend]
  group store(database)[Storage]
  service ui(internet)[UI] in front
  service api(server)[API] in back
  service jobs(server)[Jobs] in back
  service db(database)[Postgres] in store
  ui{group}:R --> L:api{group}
  api:B -- T:db{group}
  jobs:R --> L:db`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  PIE CHARTS
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Pie: Basic',
    category: 'Pie',
    description:
      'Slices in source order, clockwise from 12 o\'clock, with whole-number percentages inside each slice and a legend on the right.',
    source: `pie title Pets adopted by volunteers
  "Dogs" : 386
  "Cats" : 85
  "Rats" : 15`,
  },
  {
    title: 'Pie: showData',
    category: 'Pie',
    gallery: true,
    description:
      '`pie showData` adds each slice\'s value to its legend row, printed as written.',
    source: `pie showData title Key elements in Product X
  "Calcium" : 42.96
  "Potassium" : 50.05
  "Magnesium" : 10.01
  "Iron" : 5`,
  },
  {
    title: 'Pie: Many Slices',
    category: 'Pie',
    gallery: true,
    description:
      'Fourteen slices: the twelve-colour palette repeats from the 13th slice.',
    source: `pie title Commits by weekday and team
  "Mon core" : 14
  "Mon docs" : 9
  "Tue core" : 13
  "Tue docs" : 8
  "Wed core" : 12
  "Wed docs" : 7
  "Thu core" : 11
  "Thu docs" : 7
  "Fri core" : 10
  "Fri docs" : 6
  "Sat core" : 5
  "Sat docs" : 3
  "Sun core" : 4
  "Sun docs" : 2`,
  },
  {
    title: 'Pie: Tiny Slices',
    category: 'Pie',
    gallery: true,
    description:
      'Slices under 1% of the total are left out of the pie but stay in the legend; zero-value slices are never drawn.',
    source: `pie showData title Browser share
  "Chrome" : 640
  "Safari" : 190
  "Firefox" : 120
  "Edge" : 45
  "Opera" : 4
  "Lynx" : 1
  "Netscape" : 0`,
  },
  {
    title: 'Pie: Single Slice',
    category: 'Pie',
    description: 'One slice fills the whole circle at 100%.',
    source: `pie title Uptime this week
  "Up" : 1`,
  },
  {
    title: 'Pie: Dark Theme',
    category: 'Pie',
    gallery: true,
    description:
      'The palette follows the theme accent and switches shade direction on a dark background.',
    source: `pie title Time spent
  accTitle: Time spent per activity
  accDescr: Coding takes half the day, meetings a quarter.
  "Coding" : 50
  "Meetings" : 25
  "Review" : 15
  "Email" : 10`,
    options: {
      bg: '#1a1b26',
      fg: '#a9b1d6',
      line: '#3d59a1',
      accent: '#7aa2f7',
      muted: '#565f89',
    },
  },

  // Pie edge cases. Each source here also has an ASCII golden of the same
  // name under packages/ascii-renderer/src/__tests__/testdata/{ascii,unicode}
  // (and some colour goldens under testdata/color/), so every case is pinned
  // in both renderers.
  {
    title: 'Pie: Empty',
    category: 'Pie',
    description:
      "A bare `pie` with no slices is valid: just the outline circle, at the pie's own width.",
    source: `pie`,
  },
  {
    title: 'Pie: Empty With Title',
    category: 'Pie',
    description: 'A title over an empty chart.',
    source: `pie title Nothing to show yet`,
  },
  {
    title: 'Pie: All Zero',
    category: 'Pie',
    description:
      'Every value is 0: nothing is drawn, every slice stays in the legend.',
    source: `pie showData title Nothing counted
  "Apples" : 0
  "Pears" : 0
  "Plums" : 0`,
  },
  {
    title: 'Pie: Tall Legend',
    category: 'Pie',
    description:
      'Twenty-four slices: the legend is taller than the 450px frame, so the viewBox grows to fit it.',
    source: `pie title Tickets by component
  "Component 01" : 30
  "Component 02" : 29
  "Component 03" : 28
  "Component 04" : 27
  "Component 05" : 26
  "Component 06" : 25
  "Component 07" : 24
  "Component 08" : 23
  "Component 09" : 22
  "Component 10" : 21
  "Component 11" : 20
  "Component 12" : 19
  "Component 13" : 18
  "Component 14" : 17
  "Component 15" : 16
  "Component 16" : 15
  "Component 17" : 14
  "Component 18" : 13
  "Component 19" : 12
  "Component 20" : 11
  "Component 21" : 10
  "Component 22" : 9
  "Component 23" : 8
  "Component 24" : 7`,
  },
  // No emoji in this one: the Linux CI image has no emoji font (they would
  // render as boxes), and ascii-geometry.visual.test.ts's xterm oracle uses
  // Unicode 6 widths, where most emoji are one cell. Emoji labels have a
  // text-only ASCII golden instead (testdata/*/pie_emoji_labels.txt).
  {
    title: 'Pie: Wide Characters',
    category: 'Pie',
    gallery: true,
    description:
      'Chinese, Japanese, Korean and fullwidth characters in the title and labels; text widths are display widths.',
    source: `pie title 宠物 ペット 반려동물
  "狗 Dogs" : 40
  "猫 Cats" : 30
  "さかな Fish" : 20
  "ＢＩＲＤ" : 10`,
  },
  {
    title: 'Pie: Long Labels',
    category: 'Pie',
    description:
      'Labels and a title are never truncated: the legend (and a title wider than the chart) widen the output instead.',
    source: `pie title Where the quarterly infrastructure budget actually went this year
  "Cloud compute for the continuous integration and nightly regression fleet" : 55
  "Storage" : 30
  "A label that is long but not the longest one in this chart" : 15`,
  },
  {
    title: 'Pie: showData Decimals',
    category: 'Pie',
    description:
      '`showData` prints values with `String(value)`: no thousands separators, and `42.10` becomes `42.1`.',
    source: `pie showData title Revenue by region
  "North" : 2500000.75
  "South" : 1000000
  "East" : 42.10
  "West" : 0.5`,
  },
  {
    title: 'Pie: Two Even Slices',
    category: 'Pie',
    description: 'Two equal slices, each 50%.',
    source: `pie title Coin flips
  "Heads" : 50
  "Tails" : 50`,
  },
  {
    title: 'Pie: Accessibility Only',
    category: 'Pie',
    description:
      "`accTitle` and a multi-line `accDescr { … }` with no `title`: they become the SVG's `<title>`/`<desc>` and are never drawn as text.",
    source: `pie
  accTitle: Survey answers
  accDescr {
    Most people answered yes.
    A few said no.
  }
  "Yes" : 70
  "No" : 30`,
  },
  {
    title: 'Pie: Label Edge Cases',
    category: 'Pie',
    description:
      'A repeated label keeps its first value, single-quoted and escaped labels are accepted, and markup characters are shown as text.',
    source: `pie title Labels <&> "quotes"
  "R&D" : 30
  'Single quoted' : 25
  "<script>" : 20
  "Say \\"hi\\"" : 15
  "R&D" : 99
  'It\\'s' : 10`,
  },
  {
    title: 'Pie: Percentage Boundaries',
    category: 'Pie',
    description:
      'Exactly 1% is drawn; 0.99%, 0.01% and -0 are not. `-0` is shown as `0`.',
    source: `pie showData title Percentage boundaries
  "Most" : 98
  "Exactly 1%" : 1
  "Just under 1%" : 0.99
  "One hundredth" : 0.01
  "Negative zero" : -0`,
  },
  {
    title: 'Pie: Custom Accent',
    category: 'Pie',
    description:
      'The palette is built from the theme accent, so overriding only `accent` recolours every slice.',
    source: `pie title Pets adopted by volunteers
  "Dogs" : 386
  "Cats" : 85
  "Rats" : 15
  "Birds" : 60
  "Fish" : 30`,
    options: {
      accent: '#d33682',
    },
  },
  {
    title: 'Pie: More Slices Than Bar Cells',
    category: 'Pie',
    description:
      'Sixty equal slices. The SVG draws every one; the 50-cell ASCII bar fits fifty, and the other ten are listed like slices under 1% (dot swatch, no percentage).',
    source: `pie title Sixty equal slices
${Array.from({ length: 60 }, (_, i) => `  "S${String(i + 1).padStart(2, '0')}" : 1`).join('\n')}`,
  },
  {
    title: 'Labeled Fan-In (LR)',
    category: 'Flowchart',
    description:
      'Several labeled edges into one node (#1467). In the ASCII panel each edge keeps its own lane, so every label sits on the stroke it names.',
    source: `flowchart LR
  A --> B
  A -->|first| C
  B -->|second| C
  A -->|third| D
  C -->|fourth| D
  B -->|fifth| D
  B -->|sixth| D
  A -->|seventh| D`,
  },
  {
    title: 'Direction: Right-Left (RL)',
    category: 'Flowchart',
    gallery: true,
    description:
      'Flow runs right to left; the first node sits at the right edge.',
    source: `graph RL
  A[Start] --> B{Check}
  B -->|yes| C[Done]
  B -->|no| D[Retry]
  D --> B`,
  },
  {
    title: 'Nested Subgraphs (RL)',
    category: 'Flowchart',
    gallery: true,
    description: 'Subgraphs inside subgraphs under a right-to-left direction.',
    source: `graph RL
  subgraph Outer
    subgraph Inner
      A --> B
    end
    B --> C
  end
  C --> D`,
  },
  {
    title: 'Nested Subgraphs (BT)',
    category: 'Flowchart',
    gallery: true,
    description: 'Subgraphs inside subgraphs under a bottom-to-top direction.',
    source: `graph BT
  subgraph Outer
    subgraph Inner
      A --> B
    end
    B --> C
  end
  C --> D`,
  },
  {
    title: 'Edges Into and Out of Subgraphs',
    category: 'Flowchart',
    gallery: true,
    description:
      'Edges that cross cluster borders, including exits from a cluster to several siblings (#1331, #1461).',
    source: `flowchart TD
  In[Request] --> A
  subgraph Cluster
    A --> B
    B --> C
  end
  Cluster --> X[Cache]
  Cluster --> Y[Log]
  B --> Z[Audit]
  C --> W[Reply]`,
  },
  {
    title: 'Vertical Edge Labels',
    category: 'Flowchart',
    gallery: true,
    description: 'Labels on edges in a top-down flow, including multi-word ones.',
    source: `flowchart TD
  A[Order] -->|validated| B[Payment]
  B -->|card declined| C[Retry]
  B -->|paid in full| D[Ship]
  C -->|give up| E[Cancel]`,
  },
  {
    title: 'Flowchart: CJK Labels',
    category: 'Flowchart',
    gallery: true,
    description:
      'Chinese, Japanese and Korean text in nodes, edge labels and a subgraph title.',
    source: `flowchart LR
  subgraph 前端
    A[用户] -->|请求| B[ログイン]
  end
  B -->|확인| C{결정}
  C -->|はい| D[完了]
  C -->|いいえ| A`,
  },
  {
    title: 'Sequence: CJK Participants',
    category: 'Sequence',
    gallery: true,
    description: 'Wide characters in participant names, messages and a note.',
    source: `sequenceDiagram
  participant 客户
  participant サーバー
  participant 데이터베이스
  客户->>サーバー: 要求を送信
  サーバー->>데이터베이스: 조회
  데이터베이스-->>サーバー: 결과
  Note over サーバー,데이터베이스: 캐시 사용
  サーバー-->>客户: 应答`,
  },
  {
    title: 'Sequence: Span Labels Across Lifelines',
    category: 'Sequence',
    gallery: true,
    description:
      'A long label on a message that crosses intermediate lifelines; the lifelines stay visible around it (#1119).',
    source: `sequenceDiagram
  participant A
  participant B
  participant C
  participant D
  A->>D: a label that spans the lifelines of B and C
  D-->>A: and a reply that also crosses them
  B->>C: adjacent
  A->>C: skips B`,
  },
  {
    title: 'Class: Namespaces',
    category: 'Class',
    gallery: true,
    description:
      'Classes grouped into namespaces, with a relationship across them.',
    source: `classDiagram
  namespace Shapes {
    class Circle {
      +radius
      +area()
    }
    class Square {
      +side
      +area()
    }
  }
  namespace Rendering {
    class Canvas {
      +draw(shape)
    }
  }
  Canvas --> Circle
  Canvas --> Square`,
  },  {
    title: 'State: Choice, Fork and Join',
    category: 'State',
    gallery: true,
    description:
      'Pseudo-states: a fork and join drawn as bars, a choice drawn as a diamond.',
    source: `stateDiagram-v2
  state f <<fork>>
  state j <<join>>
  state c <<choice>>
  [*] --> f
  f --> A
  f --> B
  A --> c
  c --> j
  B --> j
  j --> [*]`,
  },
  {
    title: 'State: Notes',
    category: 'State',
    gallery: true,
    description: 'One-line and block notes attached to a state.',
    source: `stateDiagram-v2
  [*] --> Active
  note right of Active : this is a note
  Active --> Idle
  note left of Idle
    a note
    over two lines
  end note
  Idle --> [*]`,
  },
  {
    title: 'State: Concurrent Regions',
    category: 'State',
    gallery: true,
    description: 'A composite state split into concurrent regions with --.',
    source: `stateDiagram-v2
  state Work {
    [*] --> A1
    A1 --> A2
    --
    [*] --> B1
    B1 --> B2
  }`,
  },
  {
    title: 'Pie: Donut Hole',
    category: 'Pie',
    description:
      '`%%{init: {"pie": {"donutHole": 0.5}}}%%` cuts a hole of half the radius in the SVG; Mermaid keeps the labels where they were. The ASCII bar chart has no centre to cut, so it is unchanged.',
    source: `%%{init: {"pie": {"donutHole": 0.5}}}%%
pie title Pets adopted by volunteers
  "Dogs" : 386
  "Cats" : 85
  "Rats" : 15`,
  },
  {
    title: 'ER: Word-Form Cardinalities and .- / -. Lines',
    category: 'ER',
    description:
      'Cardinalities written as words (`one to many`, `1 to 0+`, `zero or one to one or more`), the mirrored symbol pairs `o|--||` and `o{--o{`, and the `.-` / `-.` line forms, which draw a dashed (non-identifying) relationship.',
    source: `erDiagram
  CUSTOMER one to many ORDER : places
  ORDER 1 to 0+ LINE_ITEM : contains
  LINE_ITEM zero or one to one or more PRODUCT : lists
  PRODUCT o|--|| SUPPLIER : sourced_from
  SUPPLIER o{--o{ WAREHOUSE : stocks
  WAREHOUSE ||.-o{ SHELF : holds
  SHELF ||-.o{ BIN : holds`,
  },
  {
    title: 'Flowchart: Three Parallel Edges (TD)',
    category: 'Flowchart',
    description:
      'Exactly three labeled parallel edges between the same two nodes in a top-down graph. In ASCII each lane enters the target on its own row with its own arrowhead.',
    source: `flowchart TD
  A -->|first| B
  A -->|second| B
  A -->|third| B`,
  },
  {
    title: 'Flowchart: Three Parallel Edges Plus Reciprocal (TD)',
    category: 'Flowchart',
    description:
      'Three labeled parallel edges plus a reciprocal edge back, in a top-down graph. In ASCII the third lane keeps its own arrowhead row.',
    source: `flowchart TD
  A -->|first| B
  A -->|second| B
  A -->|third| B
  B -->|back| A`,
  },
  {
    title: 'Pie: Text Position',
    category: 'Pie',
    description:
      '`%%{init: {"pie": {"textPosition": 0.5}}}%%` moves the slice percentage labels from the default 0.75 of the radius to halfway out in the SVG. The ASCII bar chart has no slice labels to move, so it is unchanged.',
    source: `%%{init: {"pie": {"textPosition": 0.5}}}%%
pie title Pets adopted by volunteers
  "Dogs" : 386
  "Cats" : 85
  "Rats" : 15`,
  },
  {
    title: 'Flowchart: Four Parallel Edges (TD)',
    category: 'Flowchart',
    description:
      'Four labeled edges between the same two nodes (#1743). In the ASCII panel each lane enters the target on its own row with its own arrowhead.',
    source: `flowchart TD
  A -->|first| B
  A -->|second| B
  A -->|third| B
  A -->|fourth| B`,
  },
  {
    title: 'Flowchart: Five Cluster Exit Siblings (TD)',
    category: 'Flowchart',
    description:
      'Five labeled edges leave a subgraph for one target beside another exit (#1689). In the ASCII panel each sibling gets its own arrowhead; the fifth enters the low face.',
    source: `flowchart TD
  subgraph S [Cluster]
    a
  end
  Start --> S
  S -->|1| T
  S -->|2| T
  S -->|3| T
  S -->|4| T
  S -->|5| T
  S -->|other| U`,
  },
  {
    title: 'Pie: Legend Left',
    category: 'Pie',
    description:
      '`%%{init: {"pie": {"legendPosition": "left"}}}%%` puts the legend left of the pie and widens the frame to fit. The ASCII bar chart keeps its legend beside the bars, so it is unchanged.',
    source: `%%{init: {"pie": {"legendPosition": "left"}}}%%
pie title Pets adopted by volunteers
  "Dogs" : 386
  "Cats" : 85
  "Rats" : 15`,
  },
  {
    title: 'Pie: Legend Top',
    category: 'Pie',
    description:
      '`%%{init: {"pie": {"legendPosition": "top"}}}%%` stacks the legend above the pie and makes the frame taller. The ASCII bar chart keeps its legend beside the bars, so it is unchanged.',
    source: `%%{init: {"pie": {"legendPosition": "top"}}}%%
pie title Pets adopted by volunteers
  "Dogs" : 386
  "Cats" : 85
  "Rats" : 15`,
  },
  {
    title: 'Pie: Legend Bottom',
    category: 'Pie',
    description:
      '`%%{init: {"pie": {"legendPosition": "bottom"}}}%%` stacks the legend below the pie and makes the frame taller. The ASCII bar chart keeps its legend beside the bars, so it is unchanged.',
    source: `%%{init: {"pie": {"legendPosition": "bottom"}}}%%
pie title Pets adopted by volunteers
  "Dogs" : 386
  "Cats" : 85
  "Rats" : 15`,
  },
  {
    title: 'Pie: Legend Center',
    category: 'Pie',
    description:
      '`%%{init: {"pie": {"legendPosition": "center"}}}%%` draws the legend over the middle of the pie, centred, without resizing the frame. The ASCII bar chart keeps its legend beside the bars, so it is unchanged.',
    source: `%%{init: {"pie": {"legendPosition": "center"}}}%%
pie title Pets adopted by volunteers
  "Dogs" : 386
  "Cats" : 85
  "Rats" : 15`,
  },
  {
    title: 'Pie: Highlight Slice',
    category: 'Pie',
    description:
      '`%%{init: {"pie": {"highlightSlice": "Cats"}}}%%` draws the named slice 5% larger and fully opaque, as Mermaid does; `hover` only applies under a pointer, so a static image ignores it. The ASCII bar chart has no emphasis, so it is unchanged.',
    source: `%%{init: {"pie": {"highlightSlice": "Cats"}}}%%
pie title Pets adopted by volunteers
  "Dogs" : 386
  "Cats" : 85
  "Rats" : 15`,
  },
  {
    title: 'Fan-Out Under Half-Column Parent',
    category: 'Flowchart',
    description:
      'A chain of fan-outs ending at `G`, whose box has an even width. Each ASCII arrowhead sits directly under its stem, including the left one (#1914).',
    source: `flowchart TD
    A --> B
    A -->|no| C
    C --> D
    D --> E
    D --> F
    F --> G
    G --> H
    G --> I`,
  },
  {
    title: 'LR Fan-In With Bypass Edge',
    category: 'Flowchart',
    description:
      'The long edge from `A` to `C` runs under `B` from its own exit on `A` to its own arrowhead on `C`, instead of sharing the line out of `A` and the arrowhead of `B --> C` (#1915, #2043, #2044).',
    source: `flowchart LR
    A --> B
    A --> C
    B --> C`,
  },  {
    title: 'Sequence: Participant Types',
    category: 'Sequence',
    gallery: true,
    description:
      'All six `participant X@{ "type": ... }` kinds from Mermaid 12: boundary, control, entity and database draw an icon with the label below it, collections stacks two boxes, and queue is a horizontal cylinder (#2059). ASCII marks each with a one-line glyph above the label.',
    source: `sequenceDiagram
    participant B@{ "type": "boundary" }
    participant C@{ "type": "control" }
    participant E@{ "type": "entity" }
    participant D@{ "type": "database" }
    participant L@{ "type": "collections" }
    participant Q@{ "type": "queue" }
    participant P as Plain
    B->>C: request
    C->>E: load
    E->>D: select
    D->>L: rows
    L->>Q: enqueue
    Q->>P: done`,
  },
  {
    title: 'Duplicate Self-Loops',
    category: 'Flowchart',
    description:
      'Two identical self-loops on one node. They draw as one clean loop, with no junction leading into blank space (#2028).',
    source: `flowchart TD
    n0["a"]
    n0 --> n0
    n0 --> n0`,
  },
  {
    title: 'Reciprocal and Duplicate Edges RL',
    category: 'Flowchart',
    description:
      'A reciprocal pair plus a duplicate between two nodes in a right-to-left graph. Every stroke connects to something (#2030).',
    source: `flowchart RL
    n0["L6rc9iw"]
    n1(["9B531Zk"])
    n1 --> n0
    n0 --> n1
    n1 --> n0`,
  },
  {
    title: 'Decision Self-Loop with Duplicate Edges',
    category: 'Flowchart',
    description:
      'A decision node with a self-loop, duplicate parallel edges and a labeled back edge. The canvas stays rectangular (#2025).',
    source: `flowchart LR
    n0{"gSQ21Q"}
    n1["C"]
    n2(["OkfK"])
    n3("Q552S")
    n0 --> n0
    n0 --> n2
    n0 --> n2
    n0 --> n1
    n1 -->|000A| n0
    n0 --> n1`,
  },
  {
    title: 'LR Bypass Edge In A Chain',
    category: 'Flowchart',
    description:
      'In a chain, the edge from `A` to `C` leaves the bottom of `A`, runs under `B` and enters the bottom of `C`, so `B --> C` keeps its own arrowhead (#2043, #2044).',
    source: `flowchart LR
    A --> B
    B --> C
    C --> D
    A --> C`,
  },
  {
    title: 'Flowchart: Five Parallel Edges (TD)',
    category: 'Flowchart',
    description:
      'Five labeled edges between the same two nodes (#1826). In the ASCII panel the boxes grow so each lane still enters the target on its own row with its own arrowhead.',
    source: `flowchart TD
  A -->|first| B
  A -->|second| B
  A -->|third| B
  A -->|fourth| B
  A -->|fifth| B`,
  },
  {
    title: 'Flowchart: Five Parallel Edges with Reciprocals (LR)',
    category: 'Flowchart',
    description:
      'Three edges one way and two back between the same two nodes in a left-to-right graph (#1826). In the ASCII panel the reciprocals share the group and each edge keeps its own arrowhead.',
    source: `flowchart LR
  A -->|first| B
  A -->|second| B
  A -->|third| B
  B -->|back one| A
  B -->|back two| A`,
  },
  {
    title: 'Flowchart: Six Cluster Exit Siblings (TD)',
    category: 'Flowchart',
    description:
      'Six labeled edges leave a subgraph for one target beside another exit (#1826). In the ASCII panel the siblings share both side faces of the target, each on its own row.',
    source: `flowchart TD
  subgraph S [Cluster]
    a
  end
  Start --> S
  S -->|1| T
  S -->|2| T
  S -->|3| T
  S -->|4| T
  S -->|5| T
  S -->|6| T
  S -->|other| U`,
  },
  {
    title: 'ER: Remaining Cardinality Spellings',
    category: 'ER',
    description:
      'The other word and symbol spellings mermaid accepts: `only one`, `zero or more`, `one or many`, `many(0)`, `many(1)`, `1+`, `0+`, `zero or one`, and the `to` / `optionally to` connectors. Complements the word-form sample (#1788).',
    source: `erDiagram
  AUTHOR only one to zero or more BOOK : writes
  BOOK one or many to many(0) REVIEW : receives
  REVIEW many(1) optionally to 0+ COMMENT : attracts
  COMMENT 1+ to zero or one FLAG : raises`,
  },
  {
    title: 'Flowchart: Parallel Edges with Back Edges (TD)',
    category: 'Flowchart',
    description:
      'Four edges down and two back between the same two nodes in a top-down graph (#1826). In the ASCII panel the faces they share grow so each edge keeps its own arrowhead.',
    source: `flowchart TD
  A -->|f1| B
  A -->|f2| B
  A -->|f3| B
  A -->|f4| B
  B -->|b1| A
  B -->|b2| A`,
  },
  {
    title: 'Flowchart: Cluster Exit Siblings with No Other Exit (TD)',
    category: 'Flowchart',
    description:
      'Three labeled edges are the only way out of a subgraph (#1826). In the ASCII panel they leave on a shared stub and each enters the target on a face of its own.',
    source: `flowchart TD
  subgraph S [Cluster]
    a
  end
  Start --> S
  S -->|1| T
  S -->|2| T
  S -->|3| T`,
  },
  {
    title: 'Flowchart: Nine Cluster Exit Siblings (TD)',
    category: 'Flowchart',
    description:
      'Nine labeled edges leave a subgraph for one target beside another exit (#1826). In the ASCII panel the target grows a longer face so each sibling keeps an arrowhead of its own.',
    source: `flowchart TD
  subgraph S [Cluster]
    a
  end
  Start --> S
  S -->|1| T
  S -->|2| T
  S -->|3| T
  S -->|4| T
  S -->|5| T
  S -->|6| T
  S -->|7| T
  S -->|8| T
  S -->|9| T
  S -->|other| U`,
  },
  {
    title: 'Flowchart: Self-Loop with In and Out Neighbours (TD)',
    category: 'Flowchart',
    description:
      'A self-loop on a node that also has incoming and outgoing neighbours (#2070). In the ASCII panel the loop is a stroke of its own, nested inside the fan that passes its node.',
    source: `flowchart TD
  a["a"]
  b["b"]
  c["c"]
  a --> a
  b --> a
  a --> c
  b --> c
  c --> a`,
  },
  {
    title: 'Flowchart: Self-Loop with In and Out Neighbours (LR)',
    category: 'Flowchart',
    description:
      'A self-loop on a node that also has incoming and outgoing neighbours (#2070). In the ASCII panel the loop is a stroke of its own, nested inside the fan that passes its node.',
    source: `flowchart LR
  a["a"]
  b["b"]
  c["c"]
  a --> a
  b --> a
  a --> c
  b --> c
  c --> a`,
  },
  {
    title: 'Flowchart: Dense Duplicate Edges (TD)',
    category: 'Flowchart',
    description:
      'Ten edges over three nodes, four of them duplicates of one pair (#2072). In the ASCII panel every edge keeps a lane and an arrowhead of its own, as Mermaid draws one path per edge, and the faces grow to hold them.',
    source: `flowchart TD
  a["a"]
  b["b"]
  c["c"]
  a --> b
  a --> b
  a --> b
  a --> b
  b --> c
  b --> c
  a --> c
  a --> c
  c --> a
  c --> a`,
  },
  {
    title: 'Flowchart: Dense Duplicate Edges (LR)',
    category: 'Flowchart',
    description:
      'Ten edges over three nodes, four of them duplicates of one pair (#2072). In the ASCII panel every edge keeps a lane and an arrowhead of its own, as Mermaid draws one path per edge, and the faces grow to hold them.',
    source: `flowchart LR
  a["a"]
  b["b"]
  c["c"]
  a --> b
  a --> b
  a --> b
  a --> b
  b --> c
  b --> c
  a --> c
  a --> c
  c --> a
  c --> a`,
  },
  {
    title: 'ER: Multiple Keys per Attribute',
    category: 'ER',
    description:
      'An attribute can carry several keys, comma-separated with or without a space (`PK, FK` / `PK,FK`), with or without a comment (#2115). Both spellings render as `PK,FK`.',
    source: `erDiagram
  T {
    string a PK, FK "c"
    string b PK,FK
    string d PK
    string e FK
    string f UK
    string g PK, FK, UK
    string h PK,FK,UK "with comment"
  }`,
  },
  {
    title: 'ER: Style, classDef and Class',
    category: 'ER',
    description:
      'Entities styled three ways, as mermaid 12.1.0 and 12.2.0 paint them (#2107): `classDef` with `class`, the `:::` shorthand, and an inline `style` (which wins over the class). `classDef default` sets the stroke of every entity. In the ASCII panel the colours are ignored, as in every other diagram type.',
    source: `erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains
  CUSTOMER {
    int id PK
    string name
  }
  ORDER:::late {
    int id PK
    date due
  }
  LINE_ITEM {
    int qty
  }
  classDef default stroke:#475569
  classDef vip fill:#fef3c7,stroke:#d97706,stroke-width:3px
  classDef late fill:#fecaca,stroke:#dc2626,color:#7f1d1d
  class CUSTOMER vip
  style LINE_ITEM fill:#dbeafe,stroke:#2563eb`,
  },
  {
    title: 'Class: classDiagram-v2 Header',
    category: 'Class',
    description:
      '`classDiagram-v2` is accepted as an alias of `classDiagram`, as in Mermaid (#2117).',
    source: `classDiagram-v2
  Animal <|-- Duck
  Animal : +int age
  Animal : +eat()`,
  },
  {
    title: 'Class: Bidirectional Relationships',
    category: 'Class',
    description:
      '`<|--|>` and `<-->` draw their marker at both ends of the line (#2117).',
    source: `classDiagram
  Person <|--|> Employee
  Order <--> Customer : places`,
  },
  {
    title: 'Class: Lollipop Interface',
    category: 'Class',
    description:
      '`()--` and `--()` end the line in a circle, the lollipop interface notation (#2117). Mermaid draws the interface as a name and circle hung off its host. The ASCII panel does the same; the SVG keeps the class box and ends the line in the circle.',
    source: `classDiagram
  class Comparable {
    <<interface>>
  }
  Comparable ()-- Version
  Version --() Printable`,
  },
  {
    title: 'Class: Backtick Class Names',
    category: 'Class',
    description:
      'A backtick-quoted class name may contain spaces and punctuation, in `class` statements, relationships and members (#2117).',
    source: `classDiagram
  class \`Animal Class!\` {
    +int age
    +eat()
  }
  \`Animal Class!\` <|-- Duck
  \`Animal Class!\` : +String name`,
  },
  {
    title: 'Class: Mixed Newly Accepted Syntax',
    category: 'Class',
    description:
      'The `classDiagram-v2` header, a backtick name, bidirectional ends and lollipop interfaces in one diagram (#2117).',
    source: `classDiagram-v2
  \`Base Shape\` <|--|> Circle
  Circle <--> Canvas : draws
  Canvas ()-- Renderer
  Plugin --() Renderer`,
  },
]
