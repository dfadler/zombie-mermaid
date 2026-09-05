# Supported Diagrams

## Statement separators

Newlines and semicolons both separate statements, for every diagram type:

```
flowchart TD;A-->B;B-->C
```

renders identically to

```
flowchart TD
  A-->B
  B-->C
```

A semicolon inside a quoted label (`A["a; b"]`) or ending a character
reference (`A[&amp;]`) is part of the text, not a separator.

Lines beginning with `%%` are comments and are ignored.

## Flowcharts

```
graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Process]
  B -->|No| D[End]
  C --> D
```

All directions supported: `TD` (top-down), `LR` (left-right), `BT` (bottom-top), `RL` (right-left).

### Node shapes

| Syntax        | Shape                                |
| ------------- | ------------------------------------ |
| `A[text]`     | rectangle                            |
| `A(text)`     | rounded                              |
| `A([text])`   | stadium                              |
| `A[[text]]`   | subroutine                           |
| `A[(text)]`   | cylinder                             |
| `A((text))`   | circle                               |
| `A(((text)))` | double circle                        |
| `A>text]`     | asymmetric                           |
| `A{text}`     | diamond                              |
| `A{{text}}`   | hexagon                              |
| `A[/text/]`   | parallelogram                        |
| `A[\text\]`   | parallelogram, leaning the other way |
| `A[/text\]`   | trapezoid                            |
| `A[\text/]`   | trapezoid, inverted                  |

Note the difference between the parallelograms and the trapezoids: a
parallelogram's delimiters mirror (`[/…/]`), a trapezoid's oppose (`[/…\]`).

### Edge types

| Syntax                | Meaning                     |
| --------------------- | --------------------------- |
| `A --> B`             | arrow                       |
| `A --- B`             | open link, no arrowhead     |
| `A -.-> B`            | dotted arrow                |
| `A ==> B`             | thick arrow                 |
| `A ~~~ B`             | invisible link              |
| `A <--> B`            | bidirectional               |
| `A --o B` / `A --x B` | circle / cross terminator   |
| `A -->\|text\| B`     | labelled arrow              |
| `A -- text --> B`     | labelled arrow, inline form |

Runs may be lengthened (`A ----> B`, `A ==== B`, `A -..-> B`, `A ~~~~ B`). In
Mermaid the extra characters are a layout-rank hint; they are parsed here but
the rank hint itself is not yet applied, so a longer edge currently renders the
same as its shortest form.

An invisible link (`A ~~~ B`) is laid out like any other edge but draws
nothing — useful for forcing rank or alignment without a visible connector.

### Expanded node syntax

Mermaid v11.3.0's metadata form is supported, which reaches shapes the bracket
syntax cannot spell:

```
flowchart TD
  A@{ shape: doc, label: "Report" }
  B@{ shape: cyl, label: "Database" }
  A --> B
```

Recognized keys: `shape`, `label`, `icon`, `img`, `form`, `w`, `h`,
`constraint`. A bare value is shorthand for the shape (`A@{ rounded }`).
Quoted values may contain commas, colons, and braces.

An unrecognized `shape:` name renders as a rectangle rather than failing the
diagram — Mermaid adds names regularly.

#### Shapes reached only through this syntax

| Names                                     | Rendered as                      |
| ----------------------------------------- | -------------------------------- |
| `doc`, `document`, `lin-doc`, `tag-doc`   | page with a wavy bottom edge     |
| `docs`, `documents`, `st-doc`             | stacked documents                |
| `procs`, `processes`, `st-rect`           | stacked rectangles               |
| `notch-rect`, `card`                      | rectangle, notched top-left      |
| `lin-rect`, `lin-proc`, `shaded-process`  | rectangle with a left rule       |
| `div-rect`, `div-proc`                    | rectangle split by a rule        |
| `win-pane`, `internal-storage`            | rectangle quartered by a cross   |
| `tri`, `triangle`, `extract`              | triangle, apex up                |
| `flip-tri`, `manual-file`                 | triangle, apex down              |
| `f-circ`, `junction`                      | filled circle                    |
| `cross-circ`, `summary`                   | circle with an X                 |
| `fork`, `join`                            | solid bar                        |
| `notch-pent`, `loop-limit`                | pentagon, clipped top corners    |
| `sl-rect`, `manual-input`                 | sloped top edge                  |
| `flag`, `paper-tape`                      | wavy top and bottom              |
| `bow-rect`, `stored-data`                 | concave left and right edges     |
| `delay`, `half-rounded-rectangle`         | one rounded end                  |
| `brace`, `comment` / `brace-r` / `braces` | left / right / both curly braces |
| `bolt`, `com-link`, `lightning-bolt`      | lightning bolt                   |
| `text`                                    | label with no outline            |
| `anchor`                                  | invisible point                  |

Mermaid's remaining names are aliases onto shapes the bracket syntax already
draws — `rect`/`process`, `cyl`/`database`, `diam`/`decision`, `hex`/`prepare`,
`lean-r`/`in-out`, `trap-b`/`priority`, and so on.

Because Mermaid's list is semantic while a renderer has a finite set of
outlines, some distinct names share one outline here — for example
`lin-doc` and `tag-doc` both draw a plain document. That is a rendering
choice, not a parse failure.

#### Icons and images

`icon:` and `img:` are parsed, and `form:` (`square`, `circle`, `rounded`)
selects the node's outline. This renderer draws neither FontAwesome glyphs
nor remote images, so a node with no `label:` shows its icon or image
reference as text instead of rendering blank.

#### ASCII rendering of these shapes

The ASCII grid has no diagonals and one glyph per corner, so these shapes are
distinguished by corner character alone. Shapes whose defining feature is
interior — a rule, a cross, a notch — keep plain box corners and rely on their
label; drawing a misleading outline would be worse.

### Configuration directives

A diagram can configure itself inline:

```
%%{init: {"flowchart": {"curve": "basis"}}}%%
flowchart TD
  A --> B --> C
```

Mermaid's relaxed JSON is accepted — unquoted keys and single quotes both
parse. A malformed directive is ignored rather than fatal.

**A directive supplies a default; it never overrides an explicit render
option.** The caller is closer to the user's intent than text embedded in a
diagram, and a diagram from an untrusted source should not be able to
override a host application's rendering choices.

Keys parsed but deliberately not acted on, and why:

| Key               | Why                                                                          |
| ----------------- | ---------------------------------------------------------------------------- |
| `securityLevel`   | nothing from a diagram is ever executed, so there is no sandbox to configure |
| `defaultRenderer` | ELK is the only layout engine                                                |
| `fontFamily`      | use the `font` render option                                                 |
| `htmlLabels`      | labels are always SVG text                                                   |
| `maxTextSize`     | no text-size limit is enforced                                               |

### Edge curves

`flowchart.curve` selects how a routed edge is drawn. It changes only the
drawn line — never where the edge goes.

| Value                             | Result                             |
| --------------------------------- | ---------------------------------- |
| `linear` (default)                | straight segments                  |
| `basis`                           | B-spline; cuts corners smoothly    |
| `natural`                         | straight runs with rounded corners |
| `step`, `stepBefore`, `stepAfter` | right-angle staircase              |

Two deliberate deviations, both visible in output:

- **`natural` rounds corners rather than interpolating through them.** ELK
  routes orthogonally, so every bend is a right angle, and at a right angle
  any C1-smooth _interpolating_ spline (d3's `curveNatural` included) must
  overshoot the corner — which rendered as a visible loop below a decision
  node. Rounding is smooth, never overshoots, and stays distinct from `basis`.
- **The step family leaves its final segment straight**, along the original
  approach direction. An SVG arrow marker takes its angle from the last path
  segment, so a staircase ending on a horizontal leg would point the arrowhead
  sideways into the node.

The default (`linear`) still emits `<polyline class="edge">`; only a
non-linear curve switches the element to `<path class="edge">`, so existing
CSS and DOM selectors keep working unless a curve is requested.

### Interactions

```
flowchart TD
  A --> B
  click A "https://example.com" "Tooltip" _blank
  click B call myHandler()
```

An `href` becomes a real SVG `<a>` link, which works in any browser with no
script. A tooltip becomes a `<title>` child.

**Only `http`, `https`, and `mailto` links, plus relative and fragment
references, are emitted.** A `javascript:` or `data:` href is dropped —
diagram text may be untrusted, and an executable href would make any page
that inlines the SVG vulnerable.

**A `call`/callback binding is recorded, never invoked.** This renderer emits
a static SVG string and executes nothing a diagram supplies. The binding is
exposed as `data-click-callback` so a host application can wire it up itself
if it chooses to trust the source.

### Edge IDs and animation

```
flowchart TD
  A e1@--> B
  e1@{ animate: true }
```

The id is emitted as `data-id` for CSS targeting. An animated edge gets a
marching-ants dash driven by CSS `@keyframes` — not SMIL, which browsers have
deprecated — and is guarded by `prefers-reduced-motion`, so a viewer who asked
the system for less movement gets a still edge. The keyframes are emitted only
when a diagram actually animates an edge.

Animation only renders under `interactivity: 'full'` (see
[api-reference.md](api-reference.md)) — the default (`'static'`) and `'none'`
both render an animated edge as a still line, since CSS animation is tier-2
_motion_. This is useful for print/rasterized output, where a CSS animation
would otherwise silently render as one static frame with no indication that
motion was intended.

### Styling

`classDef default` sets the base style for every node, as in Mermaid. A node's
own class (`class A foo` or `A:::foo`) overrides it property by property, and
an explicit `style A ...` directive overrides both.

### Known limitations

Three pieces of Mermaid's flowchart syntax are recognized as intentionally
out of scope rather than missing by accident. Each was audited against
upstream Mermaid in [#198](https://github.com/dfadler/zombie-mermaid/issues/198);
this section is that audit's record.

**Icons and images (`A@{ icon: ... }`, `A@{ img: ... }`, inline `fa:name`
text).** Rendering an icon means bundling or fetching an icon pack;
rendering an image means fetching a remote URL. Both break the invariant
that a diagram renders to a self-contained SVG with no network access —
this renderer draws neither. The `A@{ icon: ... }` / `A@{ img: ... }` forms
still parse (see [Icons and images](#icons-and-images) above): the
reference string is shown as the node's label when no explicit `label:` is
given, rather than the node going blank. Writing `fa:name` directly inside
an ordinary bracket label (`A["fa:fa-camera Camera"]`, Mermaid's older
syntax) isn't recognized as an icon reference at all — it's just the node's
literal text, identical to any other label content.

**Subgraph collapse (Mermaid v11.17.0+).** Mermaid added an interactive
expand/collapse affordance for subgraphs. This renderer's output is a
static SVG or ASCII string with no embedded script, so there is nowhere for
an expand/collapse _interaction_ to live — collapsing a subgraph would have
to mean picking one fixed rendered state (expanded or collapsed) at render
time, which is a different feature. The real collapse syntax also could not
be verified, since Mermaid itself isn't a dependency here; shipping a guess
at the grammar seemed worse than not shipping it. **A `collapse <id>`
statement, or `@{ ... }` metadata attached to a subgraph id, is not
recognized as collapse syntax — treat it as unsupported rather than a
no-op.** Verified empirically: both forms are absorbed by the ordinary node
parser instead, which adds a stray, disconnected node to the diagram (with
id `collapse`, or reusing the subgraph's own id) rather than leaving the
diagram unchanged. Omit this syntax rather than relying on it to be
harmlessly ignored.

## State Diagrams

```
stateDiagram-v2
  [*] --> Idle
  Idle --> Processing: start
  Processing --> Complete: done
  Complete --> [*]
```

## Sequence Diagrams

```
sequenceDiagram
  Alice->>Bob: Hello Bob!
  Bob-->>Alice: Hi Alice!
  Alice->>Bob: How are you?
  Bob-->>Alice: Great, thanks!
```

### Activations

Both of Mermaid's spellings are accepted and render identically:

```
sequenceDiagram
  Alice->>John: Hello John, how are you?
  activate John
  John-->>Alice: Great!
  deactivate John
```

is the same diagram as

```
sequenceDiagram
  Alice->>+John: Hello John, how are you?
  John-->>-Alice: Great!
```

A standalone `activate X` opens an activation bar on `X` at the row of the
message it follows; `deactivate X` closes the innermost open bar on `X` at
the row of the message it follows. That is exactly what the arrow shorthand
does — `+` activates the _recipient_ after the message, `-` deactivates the
_sender_ after it — so the two forms can be mixed freely, and activations
stack for the same actor in either spelling (a nested bar is offset slightly
to the right). An `activate` before the first message opens at the first
message row; a `deactivate` with nothing open is ignored rather than fatal
(Mermaid itself reports an error there).

The ASCII renderer does not currently draw activation bars for _either_
form; the standalone statements parse and are simply not drawn, the same as
the shorthand.

### Participant creation and destruction

Mermaid's `create` / `destroy` directives go on the line before the message
that creates or destroys the participant:

```
sequenceDiagram
  Alice->>Bob: Hello Bob, how are you ?
  Bob->>Alice: Fine, thank you. And you?
  create participant Carl
  Alice->>Carl: Hi Carl!
  create actor D as Donald
  Carl->>D: Hi!
  destroy Carl
  Alice-xCarl: We are too many
  destroy Bob
  Bob->>Alice: I agree
```

`create participant X` / `create actor X [as Label]` takes the same shape as
a plain declaration, so the alias and the participant/actor kind are kept.
The created participant's box is drawn centred on the row of the message
that creates it, instead of in the header, and its lifeline starts there;
the creating arrow stops at the box's edge. `destroy X` ends `X`'s lifeline
at the next message with a cross, and no footer box is drawn for it.

Mermaid's binding rules apply, with Mermaid's own error text: the message
right after `create` must have the created participant as its _recipient_
("only the recipient can be created"), the message right after `destroy`
must have the destroyed participant as its sender _or_ recipient, and a
`create` for an id that already exists is an error ("use `as` aliases to
simulate the behavior"). A directive with no message after it at all is
treated as a plain declaration rather than an error.

In ASCII output the cross sits on the row directly _under_ the destroying
arrow, not on the arrow row — a cross on the arrow row would replace the
arrowhead and read as a lost message (`-x`). One row is reserved for it. A
self-message cannot create its own recipient (the loop glyphs occupy the
box's cells), so that degenerate case keeps the header box.

### Participant grouping (`box ... end`)

`box <color?> <label?> ... end` groups a run of participants under a shared
background, spanning from the leftmost to the rightmost member declared
inside it:

```
sequenceDiagram
  box Aqua Group 1
  participant A
  participant B
  end
  participant C
  A->>B: hello
  B->>C: world
```

The header word (or an `rgb(...)`/`hsl(...)` call) is a colour if it matches
a CSS named colour, hex, or `rgb()`/`hsl()` function form; otherwise the
whole header is the label. `box transparent Group 1` is explicitly
colourless with a label (Mermaid's own convention), and either piece can be
omitted — `box`, `box Aqua`, and `box Group 1` are all valid. A box cannot
nest inside another box, and a participant can only belong to one box;
both are errors with Mermaid's own wording. A participant first declared
(or auto-created by a message) while a box is open joins it, matching
Mermaid's `addActor` rule; one declared after the box's `end` does not, even
if a later message places it visually between two grouped members.

In SVG, the group is a background rectangle with a themed stroke, drawn
behind everything else, with the label centred in a band above the
participant boxes. A colour is blended into the theme background via
`color-mix()` at a fixed percentage rather than painted as-is, so it reads
as an appropriate tint in both light and dark themes instead of the same
opaque swatch in both.

In ASCII output the group is a labelled bracket around the header boxes and
an unlabelled one around the footer boxes — not a full-height background,
which would otherwise cut through every message crossing the group's
boundary. Colour is not representable in ASCII and is ignored; only the
label, if any, is drawn. A participant created or destroyed inside an open
box is included in the box's span, but its header or footer bracket segment
reflects only the members actually present in that row (a created
participant has no header box to bracket; a destroyed one has no footer
box).

### Known limitations

None currently — `activate`/`deactivate`, `create`/`destroy`, and
`box ... end` are all recognized (see above).

## Class Diagrams

```
classDiagram
  Animal <|-- Duck
  Animal <|-- Fish
  Animal: +int age
  Animal: +String gender
  Animal: +isMammal() bool
  Duck: +String beakColor
  Duck: +swim()
  Duck: +quack()
```

### Interactions

```
classDiagram
  class Animal
  click Animal "https://example.com" "Tooltip" _blank
  click Duck call myHandler()
```

Same grammar, same href-safety rules, and same `interactivity` gating as the
flowchart/state [Interactions](#interactions) above — a `click` on a class
wraps its box in a real `<a>` link, a tooltip becomes a `<title>`, and a
`call`/`callback` binding is recorded as `data-click-callback` but never
invoked. Both parsers share the implementation (`src/click-directive.ts`), so
see that section for the full details.

### Known limitations

Not yet implemented — no matching syntax anywhere in `src/class/parser.ts`:

- **`note for X "text"` / standalone notes.** Class-diagram notes are not
  recognized.
- **`classDef`/`cssClass`, and the `:::` shorthand.** None of Mermaid's
  class-diagram styling syntax is recognized: `classDef className props`
  (defining a style) and `cssClass "nodeId1,nodeId2" className` (attaching
  one) are both silently ignored. This is separate from the plain
  `class ClassName` **declaration** form shown above, which is fully
  supported and parses correctly. The `:::` shorthand (`class
Animal:::someclass`) isn't cleanly ignored, though: the class-declaration
  regex captures the colons as part of the identifier, so this produces a
  class whose id and label are the literal string `Animal:::someclass`
  rather than a class named `Animal` with a style tag. If the declaration
  opens a multiline body (`class Animal:::someclass {`), the members on
  later lines still parse correctly — only the class's own id/label is
  wrong. A same-line body (`class Animal:::someclass { -int sizeInFeet }`)
  isn't recognized at all: the class-body regex requires the line to end
  with a bare `{`, so the whole line is dropped, not just misparsed.

## ER Diagrams

```
erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains
  PRODUCT ||--o{ LINE_ITEM : "is in"
```

**No `click` interaction support.** Unlike flowcharts and class diagrams,
Mermaid's own erDiagram grammar has no `click` directive to parse — as of
this writing it's an open, unmerged upstream feature request
([mermaid-js/mermaid#2880](https://github.com/mermaid-js/mermaid/issues/2880),
[PR #6985](https://github.com/mermaid-js/mermaid/pull/6985)), not a shipped
part of the language. A `click ENTITY ...` line inside an `erDiagram` is
silently ignored — not recognized as an entity, attribute, or relationship —
rather than guessed at ahead of whatever syntax upstream eventually settles
on. See [#292](https://github.com/dfadler/zombie-mermaid/issues/292).

## Inline Edge Styling

Use `linkStyle` to override edge colors and stroke widths — just like [Mermaid's linkStyle](https://mermaid.js.org/syntax/flowchart.html#styling-links):

```
graph TD
  A --> B --> C
  linkStyle 0 stroke:#ff0000,stroke-width:2px
  linkStyle default stroke:#888888
```

| Syntax                          | Effect                                 |
| ------------------------------- | -------------------------------------- |
| `linkStyle 0 stroke:#f00`       | Style a single edge by index (0-based) |
| `linkStyle 0,2 stroke:#f00`     | Style multiple edges at once           |
| `linkStyle default stroke:#888` | Default style applied to all edges     |

Index-specific styles override the default. Supported properties: `stroke`, `stroke-width`.

Works in both flowcharts and state diagrams.

## XY Charts

Bar charts, line charts, and combinations — using Mermaid's `xychart-beta` syntax.

**Bar chart:**

```
xychart-beta
    title "Monthly Revenue"
    x-axis [Jan, Feb, Mar, Apr, May, Jun]
    y-axis "Revenue ($K)" 0 --> 500
    bar [180, 250, 310, 280, 350, 420]
```

**Line chart:**

```
xychart-beta
    title "User Growth"
    x-axis [Jan, Feb, Mar, Apr, May, Jun]
    line [1200, 1800, 2500, 3100, 3800, 4500]
```

**Combined bar + line:**

```
xychart-beta
    title "Sales with Trend"
    x-axis [Jan, Feb, Mar, Apr, May, Jun]
    bar [300, 380, 280, 450, 350, 520]
    line [300, 330, 320, 353, 352, 395]
```

**Horizontal orientation:**

```
xychart-beta horizontal
    title "Language Popularity"
    x-axis [Python, JavaScript, Java, Go, Rust]
    bar [30, 25, 20, 12, 8]
```

**Axis configuration:**

- Categorical x-axis: `x-axis [A, B, C]`
- Numeric x-axis range: `x-axis 0 --> 100`
- Axis titles: `x-axis "Category" [A, B, C]`
- Y-axis range: `y-axis "Score" 0 --> 100`

**Multi-series:** Add multiple `bar` and/or `line` declarations. Each series gets a distinct color from a monochromatic palette derived from the theme's accent color.

For the original design proposal behind this feature, see [xychart-design.md](xychart-design.md) (historical).

### XY Chart Styling

The chart renderer follows a clean, minimal design philosophy, originally inspired by Apple's design language and Craft's interface for `beautiful-mermaid`:

- **Dot grid** — A subtle dot pattern fills the plot area instead of traditional solid grid lines
- **Rounded bars** — All bar corners are rounded for a modern, polished look
- **Smooth curves** — Line series use natural cubic spline interpolation, producing mathematically smooth curves through all data points (not straight segments or staircase steps)
- **Floating labels** — No visible axis lines or tick marks; labels float freely for a clutter-free aesthetic
- **Drop-shadow lines** — Each line series has a subtle shadow beneath it for depth
- **Monochromatic palette** — Series 0 uses the theme's accent color; additional series get darker/lighter shades of the same hue with subtle hue drift, adapting automatically to light or dark backgrounds
- **Interactive tooltips** — When rendered with `interactivity: 'full'` (or the deprecated `interactive: true`), hovering over bars or data points shows value tooltips. Multi-line tooltips appear when multiple series share an x-position
- **Sparse line dots** — Lines with 12 or fewer data points show data point dots by default for readability
- **Full theme support** — All 15 built-in themes (and custom themes) apply to charts. The accent color drives the entire series color palette
- **Live theme switching** — Chart series colors are CSS custom properties (`--xychart-color-N`), so theme changes apply instantly without re-rendering

## Accessibility

Every SVG diagram type gets `role="img"` on the root `<svg>`, so assistive
tech treats it as one image instead of a group whose node/edge labels get
announced individually and out of reading order.

```ts
renderMermaidSVG('graph TD\n  A --> B', {
  title: 'Flowchart: Build → Test → Ship',
})
```

`title` supplies the accessible name: `aria-labelledby` on the root points
at a `<title id="zm-title-N">` child holding the text — the standard
SVG/WAI-ARIA technique for naming inline SVG. The `zm-title-N` id is unique
per render call, so multiple diagrams inlined into one page never collide.
This library never invents a name on your behalf (a generated "flowchart
with 3 nodes" summary would be a confidently useless accessible name) — when
`title` is omitted the SVG still gets `role="img"`, but claims no name, the
same as an `<img>` with no `alt`.

For a diagram that's already described in surrounding prose, mark it
decorative instead of naming it:

```ts
renderMermaidSVG('graph TD\n  A --> B', { decorative: true })
```

This emits `aria-hidden="true"` in place of `role`/`aria-labelledby`/`<title>`,
and `title`, if also given, is ignored.

This is independent of the per-node/per-point `<title>` tooltips from
[Interactions](#interactions) (`click A "url" "Tooltip"`) and the XY chart's
`interactive` hover tips — those are unid'd `<title>` elements nested inside
each node/point's `<g>`, so they never collide with the root's generated id.

**A `click A "url"` link overrides both `role="img"` and `decorative`.** A
link renders as a real, focusable `<a href>` nested inside the SVG. Both
`role="img"` (which tells assistive tech to stop descending into children)
and `aria-hidden="true"` (which must never contain a focusable descendant,
per the WAI-ARIA spec) would make that link Tab-reachable but invisible to a
screen reader — so when any node has a link, the root gets no `role` at all,
regardless of what `title`/`decorative` asked for. `title` still applies if
given. See [issue #239](https://github.com/dfadler/zombie-mermaid/issues/239).

## ASCII Rendering

For terminal environments, CLI tools, or anywhere you need plain text, render to ASCII or Unicode box-drawing characters:

```typescript
import { renderMermaidASCII } from 'zombie-mermaid'

// Unicode mode (default) — prettier box drawing
const unicode = renderMermaidASCII(`graph LR; A --> B`)

// Pure ASCII mode — maximum compatibility
const ascii = renderMermaidASCII(`graph LR; A --> B`, { useAscii: true })
```

If you only need ASCII output, import from `zombie-mermaid/ascii` instead —
it never pulls in `elkjs`, the SVG layout engine, which the package root
statically imports regardless of whether you call `renderMermaidSVG`:

```typescript
import { renderMermaidASCII } from 'zombie-mermaid/ascii'
```

**Unicode output:**

```
┌───┐     ┌───┐
│   │     │   │
│ A │────►│ B │
│   │     │   │
└───┘     └───┘
```

**ASCII output:**

```
+---+     +---+
|   |     |   |
| A |---->| B |
|   |     |   |
+---+     +---+
```

### ASCII Options

```typescript
renderMermaidASCII(diagram, {
  useAscii: false,      // true = ASCII, false = Unicode (default)
  paddingX: 5,          // Horizontal spacing between nodes
  paddingY: 5,          // Vertical spacing between nodes
  boxBorderPadding: 1,  // Padding inside node boxes
  colorMode: 'auto',    // 'none' | 'auto' | 'ansi16' | 'ansi256' | 'truecolor' | 'html'
  theme: { ... },       // Partial<AsciiTheme> — override default colors
})
```

### ASCII XY Charts

XY charts render to ASCII with dedicated chart-drawing characters:

- **Bar charts** — `█` blocks (Unicode) or `#` (ASCII mode)
- **Line charts** — Staircase routing with rounded corners: `╭╮╰╯│─` (Unicode) or `+|-` (ASCII)
- **Multi-series** — Each series gets a distinct ANSI color from the theme's accent palette
- **Legends** — Automatically shown when multiple series are present
- **Horizontal charts** — Fully supported with categories on the y-axis
