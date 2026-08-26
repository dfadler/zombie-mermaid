# Supported Diagrams

## Flowcharts

```
graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Process]
  B -->|No| D[End]
  C --> D
```

All directions supported: `TD` (top-down), `LR` (left-right), `BT` (bottom-top), `RL` (right-left).

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

## ER Diagrams

```
erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains
  PRODUCT ||--o{ LINE_ITEM : "is in"
```

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

The chart renderer follows a clean, minimal design philosophy inspired by Apple and Craft:

- **Dot grid** — A subtle dot pattern fills the plot area instead of traditional solid grid lines
- **Rounded bars** — All bar corners are rounded for a modern, polished look
- **Smooth curves** — Line series use natural cubic spline interpolation, producing mathematically smooth curves through all data points (not straight segments or staircase steps)
- **Floating labels** — No visible axis lines or tick marks; labels float freely for a clutter-free aesthetic
- **Drop-shadow lines** — Each line series has a subtle shadow beneath it for depth
- **Monochromatic palette** — Series 0 uses the theme's accent color; additional series get darker/lighter shades of the same hue with subtle hue drift, adapting automatically to light or dark backgrounds
- **Interactive tooltips** — When rendered with `interactive: true`, hovering over bars or data points shows value tooltips. Multi-line tooltips appear when multiple series share an x-position
- **Sparse line dots** — Lines with 12 or fewer data points show data point dots by default for readability
- **Full theme support** — All 15 built-in themes (and custom themes) apply to charts. The accent color drives the entire series color palette
- **Live theme switching** — Chart series colors are CSS custom properties (`--xychart-color-N`), so theme changes apply instantly without re-rendering

## ASCII Rendering

For terminal environments, CLI tools, or anywhere you need plain text, render to ASCII or Unicode box-drawing characters:

```typescript
import { renderMermaidASCII } from 'zombie-mermaid'

// Unicode mode (default) — prettier box drawing
const unicode = renderMermaidASCII(`graph LR; A --> B`)

// Pure ASCII mode — maximum compatibility
const ascii = renderMermaidASCII(`graph LR; A --> B`, { useAscii: true })
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
