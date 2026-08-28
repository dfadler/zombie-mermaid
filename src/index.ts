// ============================================================================
// zombie-mermaid — public API
//
// Renders Mermaid diagrams to styled SVG strings.
// Framework-agnostic, no DOM required. Pure TypeScript.
//
// Supported diagram types:
//   - Flowcharts (graph TD / flowchart LR)
//   - State diagrams (stateDiagram-v2)
//   - Sequence diagrams (sequenceDiagram)
//   - Class diagrams (classDiagram)
//   - ER diagrams (erDiagram)
//
// Theming uses CSS custom properties (--bg, --fg, + optional enrichment).
// See src/theme.ts for the full variable system.
//
// Usage:
//   import { renderMermaidSVG } from 'zombie-mermaid'
//   const svg = renderMermaidSVG('graph TD\n  A --> B')
// ============================================================================

export type { RenderOptions, MermaidGraph, PositionedGraph } from './types.ts'
export type { DiagramColors, ThemeName } from './theme.ts'
export { fromShikiTheme, THEMES, DEFAULTS } from './theme.ts'
export { parseMermaid } from './parser.ts'
export { renderMermaidASCII, renderMermaidAscii } from './ascii/index.ts'
export type { AsciiRenderOptions } from './ascii/index.ts'

import { decodeXML } from 'entities'
import { parseMermaid } from './parser.ts'
import { layoutGraphSync } from './layout.ts'
import { renderSvg } from './renderer.ts'
import type { RenderOptions } from './types.ts'
import type { DiagramColors } from './theme.ts'
import { DEFAULTS } from './theme.ts'
import { resolveFontSizes } from './styles.ts'
import { detectDiagramType } from './diagram-type.ts'
import type { DiagramType } from './diagram-type.ts'
import { applyInitConfig } from './init-directive.ts'
import { splitStatements } from './statements.ts'

import { parseSequenceDiagram } from './sequence/parser.ts'
import { layoutSequenceDiagram } from './sequence/layout.ts'
import { renderSequenceSvg } from './sequence/renderer.ts'
import { parseClassDiagram } from './class/parser.ts'
import { layoutClassDiagramSync } from './class/layout.ts'
import { renderClassSvg } from './class/renderer.ts'
import { parseErDiagram } from './er/parser.ts'
import { layoutErDiagramSync } from './er/layout.ts'
import { renderErSvg } from './er/renderer.ts'
import { parseXYChart } from './xychart/parser.ts'
import { layoutXYChart } from './xychart/layout.ts'
import { renderXYChartSvg } from './xychart/renderer.ts'

/**
 * Build a DiagramColors object from render options.
 * Uses DEFAULTS for bg/fg when not provided, and passes through
 * optional enrichment colors (line, accent, muted, surface, border).
 */
function buildColors(options: RenderOptions): DiagramColors {
  return {
    bg: options.bg ?? DEFAULTS.bg,
    fg: options.fg ?? DEFAULTS.fg,
    line: options.line,
    accent: options.accent,
    muted: options.muted,
    surface: options.surface,
    border: options.border,
  }
}

/**
 * Resolve the effective interactivity level, defaulting unset to `'static'`.
 * See `RenderOptions.interactivity` for what each level means.
 */
function resolveInteractivity(
  options: RenderOptions,
): 'none' | 'static' | 'full' {
  return options.interactivity ?? 'static'
}

/**
 * Whether flowchart/state-diagram edge animation (`e1@{ animate: true }`)
 * should render. Gated behind `interactivity !== 'none'` — both the default
 * (`'static'`) and `'full'` allow it, which preserves today's ungated
 * behavior for callers who don't touch `interactivity`. Tightening this to
 * `'full'`-only (the stricter tier-2 reading from the ADR) is tracked as
 * follow-up work.
 */
function resolveAnimationEnabled(options: RenderOptions): boolean {
  return resolveInteractivity(options) !== 'none'
}

/**
 * Whether xychart hover tooltips should render.
 *
 * `interactivity` takes precedence over the deprecated `interactive`
 * boolean when both are set. When only the deprecated boolean is set, it
 * keeps controlling this exactly as before — `true` enables tooltips,
 * `false`/unset does not — so existing callers see no behavior change.
 */
function resolveXYChartInteractive(options: RenderOptions): boolean {
  if (options.interactivity !== undefined) {
    return options.interactivity === 'full'
  }
  return options.interactive ?? false
}

/**
 * Render Mermaid diagram text to an SVG string — synchronously.
 *
 * Uses elk.bundled.js with a direct FakeWorker bypass (no setTimeout(0) delay).
 * The ELK singleton is created lazily on first use and cached forever.
 *
 * Use this in React components with useMemo() to avoid flash:
 *   const svg = useMemo(() => renderMermaidSVG(code, opts), [code])
 *
 * @param text - Mermaid source text
 * @param options - Rendering options (colors, font, spacing)
 * @returns A self-contained SVG string
 *
 * @example
 * ```ts
 * const svg = renderMermaidSVG('graph TD\n  A --> B')
 *
 * // With theme
 * const svg = renderMermaidSVG('graph TD\n  A --> B', {
 *   bg: '#1a1b26', fg: '#a9b1d6'
 * })
 *
 * // With CSS variables (for live theme switching)
 * const svg = renderMermaidSVG('graph TD\n  A --> B', {
 *   bg: 'var(--background)', fg: 'var(--foreground)', transparent: true
 * })
 *
 * // With the original source stamped onto the root <svg> as data-src —
 * // handy for a "copy source" button or an "open in Mermaid Live" link
 * // without re-attaching it via string surgery on the output.
 * const svg = renderMermaidSVG('graph TD\n  A --> B', { embedSource: true })
 *
 * // With an accessible name — role="img" + aria-labelledby pointing at a
 * // <title> child, so assistive tech announces the diagram instead of
 * // reading every node label individually (see issue #215).
 * const svg = renderMermaidSVG('graph TD\n  A --> B', {
 *   title: 'Flowchart: Build → Test → Ship'
 * })
 *
 * // Decorative diagram — already described in surrounding prose, so it's
 * // hidden from assistive tech (aria-hidden="true") instead of named.
 * const svg = renderMermaidSVG('graph TD\n  A --> B', { decorative: true })
 * ```
 */
export function renderMermaidSVG(
  text: string,
  options: RenderOptions = {},
): string {
  // Captured before decodeXML() below so `embedSource` stamps the exact
  // string the caller passed in, not the entity-decoded version used
  // internally for parsing.
  const originalText = text

  // Decode XML entities that may leak from markdown parsers (e.g. rehype-raw).
  // Without this, escapeXml() double-encodes them: &lt; → &amp;lt; → literal "&lt;" in SVG.
  text = decodeXML(text)

  const colors = buildColors(options)
  const font = options.font ?? 'Inter'
  const transparent = options.transparent ?? false
  const fontSizes = resolveFontSizes(options.fontSizes)
  const diagramType: DiagramType = detectDiagramType(text)
  const embedSource = options.embedSource ? originalText : undefined
  const title = options.title
  const decorative = options.decorative

  const lines = splitStatements(text)

  switch (diagramType) {
    case 'sequence': {
      const diagram = parseSequenceDiagram(lines)
      const positioned = layoutSequenceDiagram(diagram, options)
      return renderSequenceSvg(
        positioned,
        colors,
        font,
        transparent,
        fontSizes,
        embedSource,
        title,
        decorative,
      )
    }
    case 'class': {
      const diagram = parseClassDiagram(lines)
      const positioned = layoutClassDiagramSync(diagram, options)
      return renderClassSvg(
        positioned,
        colors,
        font,
        transparent,
        fontSizes,
        embedSource,
        title,
        decorative,
      )
    }
    case 'er': {
      const diagram = parseErDiagram(lines)
      const positioned = layoutErDiagramSync(diagram, options)
      return renderErSvg(
        positioned,
        colors,
        font,
        transparent,
        fontSizes,
        embedSource,
        title,
        decorative,
      )
    }
    case 'xychart': {
      const chart = parseXYChart(lines)
      const positioned = layoutXYChart(chart, options)
      return renderXYChartSvg(
        positioned,
        colors,
        font,
        transparent,
        resolveXYChartInteractive(options),
        embedSource,
        title,
        decorative,
      )
    }
    case 'flowchart':
    default: {
      const graph = parseMermaid(text)
      // A diagram's own `%%{init: ...}%%` supplies defaults; an explicit
      // render option always wins. See src/init-directive.ts.
      const effective = graph.initConfig
        ? applyInitConfig(options, graph.initConfig)
        : options
      const positioned = layoutGraphSync(graph, effective)
      return renderSvg(
        positioned,
        colors,
        font,
        transparent,
        fontSizes,
        effective.curve ?? 'linear',
        embedSource,
        resolveAnimationEnabled(options),
        title,
        decorative,
      )
    }
  }
}

/**
 * Render Mermaid diagram text to an SVG string — async.
 *
 * Same result as renderMermaidSVG() but returns a Promise.
 * Useful in async contexts (server handlers, data loaders, etc.)
 */
export async function renderMermaidSVGAsync(
  text: string,
  options: RenderOptions = {},
): Promise<string> {
  return renderMermaidSVG(text, options)
}

// ---------------------------------------------------------------------------
// Backward-compatible aliases
// ---------------------------------------------------------------------------

/** @deprecated Use `renderMermaidSVG` */
export const renderMermaidSync = renderMermaidSVG

/** @deprecated Use `renderMermaidSVGAsync` */
export const renderMermaid = renderMermaidSVGAsync
