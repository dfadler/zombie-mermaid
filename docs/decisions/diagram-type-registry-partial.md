# Diagram-type registry: partial adoption, not a single shared `layout` step

> **Addendum (issue #533 follow-up):** `sequence` and `class` have since been
> added to both `diagramRegistry` (`src/diagram-registry.ts`) and
> `asciiRegistry` (`src/ascii/registry.ts`), following exactly the
> `xychartModule`/`erModule` pattern described below — `class`'s SVG adapter
> derives `linksEnabled` the same way the original `renderClassSvg` switch
> case did (a `resolveLinksEnabled` helper duplicated from `src/index.ts`,
> for the same import-direction reason `xychartModule`'s comment already
> explains for `interactive`). Zero behavior change, confirmed by the full
> test suite and a direct before/after render diff (byte-identical) across
> sequence and class samples in both SVG (links enabled and disabled) and
> ASCII.

> **Addendum 2 (issue #745 — flowchart registered):** `flowchart` — the last
> holdout this document flagged below — is now registered on both sides too,
> closing out #533's original scope. Two things this document's "what would
> need to change first" section didn't fully anticipate:
>
> - **ASCII side:** `renderFlowchartAscii(text, config, colorMode, theme,
extras)` was extracted into its own `src/ascii/flowchart.ts`, mirroring
>   every other type's entry-point shape exactly — a pure, behavior-preserving
>   move of the five calls (`parseMermaid`, `convertToAsciiGraph`,
>   `createMapping`, `drawGraph`, `canvasToString`, plus the BT-flip and
>   OSC-8-hyperlink steps) that used to live inline in
>   `renderMermaidASCII`'s fallback. `extras` grew a `direction` field
>   (`FlowchartAsciiExtras`, folded into the shared `AsciiRenderExtras` in
>   `src/ascii/registry.ts`) since flowchart is the only ASCII type that
>   reads a direction override — no other registered type's `extras` field
>   needed one before.
> - **SVG side, `parse`'s signature:** `DiagramModule.parse` turned out to
>   need a second parameter, not just a `SvgRenderContext` change.
>   `parseMermaid`'s `%%{init: ...}%%` directive extraction reads raw,
>   un-commented lines, and its continuation-line merging needs each
>   statement's _originating physical line_ grouping — both already lost by
>   the time `splitStatements(decoded)` (what `xychartModule`/`erModule`/
>   `sequenceModule`/`classModule`'s parsers already take as `lines`) has
>   run. `parse` is now `(lines: string[], text: string) => TDiagram`; the
>   front door computes both once and passes both through. The four
>   already-registered types are unaffected — TypeScript allows a function
>   taking fewer parameters than its declared type to satisfy that type, so
>   `parse: parseXYChart` (etc.) needed no changes at all.
> - **SVG side, `SvgRenderContext`:** left unchanged, deliberately — see
>   `PositionedFlowchart` in `src/diagram-registry.ts` for why `curve`
>   (the one piece of state `applyInitConfig` used to fold in) is resolved
>   once in `layoutForSvg` and carried on the positioned result instead of
>   growing `SvgRenderContext` with a field only one type needs.
>   `animationEnabled`/`linksEnabled` needed no new carry-through: both
>   already derive from `options` alone via `resolveAnimationEnabled`/
>   `resolveLinksEnabled` (the latter pre-existing for `class`; the former
>   newly duplicated from `src/index.ts` the same way).
>
> Zero behavior change, confirmed by the full test suite and a real-terminal
> (not HTML-approximation) before/after ASCII capture plus an SVG
> before/after string diff, both byte-identical. Both front doors'
> registries are now total over `DiagramType` — no fallback switch remains
> in either `src/index.ts` or `src/ascii/index.ts`.

## Context

[#533](https://github.com/dfadler/zombie-mermaid/issues/533) observed that
`renderMermaidSVG`'s dispatch (`src/index.ts`) and `renderMermaidASCII`'s
dispatch (`src/ascii/index.ts`) each hand-maintain their own
`switch (diagramType)` over the same `DiagramType`, and that no single seam
owns "register a new diagram type" — confirmed by `git show --stat afa7e79`
(the xychart-beta PR, #40), which touched 7+ files including unrelated
`sequence/layout.ts`/`sequence/renderer.ts` as a side effect of adding one
new type. It proposed replacing both switches with a registry: one small
interface per diagram type — `{ detect, parse, layout, renderSvg,
renderAscii }`, each taking a shared context object, registered in one
table.

## Decision

Adopt the registry (`src/diagram-registry.ts`), but only for `xychart` and
`er` for now, and with `layout` split into an SVG-only `layoutForSvg` rather
than one step shared by both `renderSvg` and `renderAscii`.

### The signature-inconsistency claim, verified

Reading all five renderers' actual signatures (not trusting the issue's
cited line numbers, which had already shifted) confirms the inconsistency:

```
renderSvg(graph, colors, font, transparent, fontSizes, curve, embedSource, animationEnabled, linksEnabled, title, decorative, emit)
renderSequenceSvg(diagram, colors, font, transparent, fontSizes, embedSource, title, decorative, emit)
renderClassSvg(diagram, colors, font, transparent, fontSizes, embedSource, title, decorative, linksEnabled, emit)
renderErSvg(diagram, colors, font, transparent, fontSizes, embedSource, title, decorative, emit)
renderXYChartSvg(chart, colors, font, transparent, interactive, embedSource, title, decorative, emit)
```

`embedSource`/`title`/`decorative`/`emit` shift position across all five;
`linksEnabled` moves position between `renderSvg` and `renderClassSvg` and
is dropped entirely by `renderErSvg`; `renderXYChartSvg` substitutes
`interactive` where `renderSvg` has `curve`. The issue's claim holds.

### Why `layout` is NOT a shared step

The issue's sketch implies one `layout` result feeding both `renderSvg` and
`renderAscii`. Reading every ASCII per-type module shows this doesn't match
the codebase: SVG layout produces pixel coordinates
(`PositionedXYChart`, `PositionedErDiagram`, `PositionedGraph`, …), while
every ASCII renderer does its own, unrelated grid/canvas layout internally,
from raw text — see `src/ascii/xychart.ts`'s own file header: "Uses the
parsed `XYChart` type directly (not `PositionedXYChart`) since pixel
coordinates don't map to character grids." `parse` genuinely is shared
already (both front doors import the same `parseXYChart`/`parseErDiagram`/
etc.), which is why it stays a real interface method
(`DiagramModule.parse`); `layout` does not get the same treatment — modeling
a single shared layout step would be fiction, not simplification, so the
registry's `layoutForSvg` is explicitly SVG-only, and `renderAscii` reruns
its own parse+layout+render internally exactly as it does today.

### Why only two of five types are registered

- `xychart` and `er`: their SVG renderers' extra, non-shared parameter
  (`interactive` / — none) attaches cleanly to an adapter closure that
  derives it from `RenderOptions`, and their ASCII renderers
  (`renderXYChartAscii`, `renderErAscii`) already have the plain
  `(text, config, colorMode, theme)` shape with no extra options — no
  wrapper needed, the existing exported functions slot in directly.
- `sequence` / `class`: same shape of work as `xychart`/`er` on the SVG
  side (`class` needs a `linksEnabled` adapter, `sequence` needs none extra)
  but deliberately left for a follow-up to keep this change's diff small and
  the risk bounded, per the issue's own ask to migrate "one or two...types
  to prove the pattern, not all five at once."
- `flowchart`: not migrated in this pass, and non-trivially so. Unlike
  every other type, flowchart's _ASCII_ path has no per-type wrapper
  function at all today — `src/ascii/index.ts`'s `'flowchart'` case inlines
  five separate calls (`parseMermaid`, `convertToAsciiGraph`,
  `createMapping`, `drawGraph`, `canvasToString`) directly in the switch,
  where every other ASCII type has a single `renderXxxAscii(text, config,
colorMode, theme)` entry point. Registering flowchart would first require
  extracting that inline sequence into its own `renderFlowchartAscii`
  function — a pure, behavior-preserving extraction, but a separate, real
  piece of work, not something to fold silently into this registry PR.
  Flowchart's SVG path also carries `%%{init: ...}%%` directive handling
  (`applyInitConfig`) that no other type has, which the shared
  `SvgRenderContext` deliberately does not try to accommodate.

### What the registry interface looks like

```ts
// src/diagram-registry.ts

export interface SvgRenderContext {
  colors: DiagramColors
  font: string
  transparent: boolean
  fontSizes: FontSizes
  embedSource?: string
  title?: string
  decorative?: boolean
  emit: SvgEmitOptions
}

export interface AsciiRenderExtras {
  hyperlinks?: boolean // only `class` reads this today
}

export interface DiagramModule<TDiagram = unknown, TPositioned = unknown> {
  readonly type: DiagramType
  parse(lines: string[]): TDiagram
  layoutForSvg(diagram: TDiagram, options: RenderOptions): TPositioned
  renderSvg(
    positioned: TPositioned,
    ctx: SvgRenderContext,
    options: RenderOptions,
  ): string
  renderAscii(
    text: string,
    config: AsciiConfig,
    colorMode: ColorMode,
    theme: AsciiTheme,
    extras: AsciiRenderExtras,
  ): string
}

export const diagramRegistry: Partial<
  Record<DiagramType, DiagramModule<any, any>>
>
```

Both front doors look the current `diagramType` up in `diagramRegistry`
first; a hit dispatches through the four methods above, a miss falls
through to that front door's own (now smaller) switch, unchanged.
`src/diagram-type.ts` (`DiagramType` + `detectDiagramType`) is untouched —
it's exactly what both front doors already use to key into the table, so
there is no separate per-type `detect` method in practice.

## Consequences

- `src/index.ts`'s switch loses its `'xychart'` and `'er'` cases;
  `src/ascii/index.ts`'s loses the same two. Both front doors gained one
  identical `if (registered) { ... }` block instead.
- Zero behavior change: every existing renderer function
  (`renderXYChartSvg`, `renderErSvg`, `renderXYChartAscii`,
  `renderErAscii`, and their `parse`/`layout` counterparts) is called with
  byte-identical arguments in the byte-identical order as before —
  confirmed by running the full test suite unchanged and by a direct
  before/after render diff (SVG + ASCII, plain and `direction`-overridden ER)
  across representative xychart/ER samples.
- A follow-up that wants to migrate `sequence`/`class` can copy the
  `xychartModule`/`erModule` pattern directly. A follow-up that wants
  `flowchart` needs to first extract `renderFlowchartAscii` as its own
  step, and decide how (or whether) `SvgRenderContext` should carry
  `curve`/`animationEnabled`/`linksEnabled`/`applyInitConfig` — deliberately
  left open here rather than guessed at.
