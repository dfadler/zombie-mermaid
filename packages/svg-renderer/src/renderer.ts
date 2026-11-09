import type {
  PositionedGraph,
  PositionedNode,
  PositionedEdge,
  PositionedGroup,
  Point,
  DiagramColors,
  SvgEmitOptions,
  CurveStyle,
} from '@zombie-mermaid/core'
import {
  svgOpenTag,
  buildStyleBlock,
  styleOpenTag,
  LINE_HEIGHT_RATIO,
  measureMultilineText,
  renderMultilineText,
  renderMultilineTextWithBackground,
  escapeXml,
  escapeAttr,
  safeHref,
  sanitizeClassName,
  f,
} from '@zombie-mermaid/core'
import type { FontSizes } from './styles.ts'
import {
  ASYMMETRIC_NOTCH,
  FONT_SIZES,
  FONT_WEIGHTS,
  STROKE_WIDTHS,
} from './styles.ts'
import {
  ICON_GLYPHS,
  TILE,
  TILE_FILL,
  UNKNOWN_GLYPH,
} from './architecture-icons.ts'
import {
  pointsToPath,
  roundedPath,
  MERMAID_CORNER_RADIUS,
} from './edge-curves.ts'
import {
  BANDLESS_TITLE_WEIGHT,
  COMPOSITE_BAND,
  edgeCrossesTitle,
  titleGapMask,
  titleTextBoxes,
} from './title-gaps.ts'

// ============================================================================
// SVG renderer — converts a PositionedGraph into an SVG string.
//
// Pure string concatenation, no DOM manipulation.
// Renders back-to-front: groups → edges → arrow heads → edge labels → nodes → node labels.
//
// All colors are referenced via CSS custom properties (var(--_xxx)) defined
// in the <style> block. The caller provides bg/fg (+ optional enrichment
// colors) via DiagramColors, which are set as inline CSS variables on the
// <svg> tag. See packages/core/src/theme.ts for the full variable system.
//
// Style spec:
// - All corners rx=0 ry=0 (sharp)
// - Stroke widths: outer box 1px, inner box 0.75px, connectors 0.75px
// - Arrow heads: filled triangles, 8px wide × 4.8px tall
// - Dashed edges: stroke-dasharray="4 4"
// - Font: Inter with weight per element type
// ============================================================================

/**
 * Render a positioned graph as an SVG string.
 *
 * @param colors - DiagramColors with bg/fg and optional enrichment variables.
 *                 These are set as CSS custom properties on the <svg> tag.
 *                 All element colors reference derived --_xxx variables.
 * @param transparent - If true, renders with transparent background.
 * @param embedSource - Original diagram source to stamp onto the root `<svg>`
 *                       as `data-src` (from `options.embedSource`). Omitted
 *                       when the option is off.
 * @param animationEnabled - Whether `e1@{ animate: true }` edges actually
 *                            animate (from `options.interactivity === 'full'`,
 *                            see `resolveAnimationEnabled` in
 *                            src/diagram-registry.ts).
 *                            Default true — preserves the previously-ungated
 *                            behavior for callers who don't pass it.
 * @param linksEnabled - Whether `click`-based `<a href>` links and `<title>`
 *                       tooltips render (from
 *                       `options.interactivity !== 'none'`, see
 *                       `resolveLinksEnabled` in src/diagram-registry.ts). Default true
 *                       — preserves the previously-ungated behavior for
 *                       callers who don't pass it.
 * @param title - Accessible name (from `options.title`). See svgOpenTag() in
 *                packages/core/src/theme.ts.
 * @param decorative - Marks the SVG decorative (from `options.decorative`).
 * @param emit - Strict-CSP controls (from `options.nonce` /
 *               `options.styleAttribute`, see #216): a `nonce` for every
 *               `<style>` element, and whether the root `style="…"`
 *               attribute is emitted at all. Default: no nonce, attribute on.
 */
export function renderSvg(
  graph: PositionedGraph,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
  fontSizes: FontSizes = FONT_SIZES,
  curve: CurveStyle = 'linear',
  embedSource?: string,
  animationEnabled: boolean = true,
  linksEnabled: boolean = true,
  title?: string,
  decorative?: boolean,
  emit: SvgEmitOptions = {},
): string {
  const parts: string[] = []

  // See #239: a click-based link renders as a focusable <a href> inside the
  // SVG, which role="img"/aria-hidden would hide from assistive tech while
  // leaving it Tab-reachable — svgOpenTag forces no root role in that case.
  // Uses the same safeHref() check renderNode uses to decide whether an <a>
  // is actually emitted — a rejected scheme or control character means no
  // link renders, so it shouldn't affect the SVG's accessibility semantics.
  // Gated by linksEnabled too: `interactivity: 'none'` strips the <a> below,
  // so it shouldn't count toward this decision either.
  const hasInteractiveLinks =
    linksEnabled &&
    graph.nodes.some((n) => Boolean(safeHref(n.interaction?.href)))

  // SVG root with CSS variables + style block + defs
  parts.push(
    withDataSrc(
      svgOpenTag(
        graph.width,
        graph.height,
        colors,
        transparent,
        title,
        decorative,
        hasInteractiveLinks,
        emit.styleAttribute,
        emit.description,
      ),
      embedSource,
    ),
  )
  parts.push(buildStyleBlock(font, false, emit.nonce, emit.bodyFont))
  // Keyframes for animated edges (`e1@{ animate: true }`). Emitted only when
  // an animated edge exists and animation is enabled, so an ordinary diagram
  // (or one rendered with `interactivity: 'none'`) gains no extra markup.
  if (animationEnabled && graph.edges.some((e) => e.animate)) {
    parts.push(edgeAnimationStyle(emit.nonce))
  }
  parts.push('<defs>')
  parts.push(arrowMarkerDefs(graph.stateDiagram === true))
  // Per-color arrow markers for edges with custom stroke via linkStyle
  const customStrokeColors = new Set<string>()
  for (const edge of graph.edges) {
    const head = headColorOf(edge)
    if (head) customStrokeColors.add(head)
  }
  for (const color of customStrokeColors) {
    parts.push(arrowMarkerDefsForColor(color, graph.stateDiagram === true))
  }
  // Circle / cross terminators (`--o`, `--x`), emitted only when used.
  const kinds = new Set<'circle' | 'cross'>()
  for (const e of graph.edges) {
    if (e.startMarker) kinds.add(e.startMarker)
    if (e.endMarker) kinds.add(e.endMarker)
  }
  for (const kind of kinds) parts.push(terminatorMarker(kind))
  // An edge that crosses a subgraph's title text is not painted over the text
  // (#1239). The mask is only emitted when some edge does, so a diagram with
  // no such edge is unchanged.
  const titleBoxes = titleTextBoxes(graph.groups, fontSizes)
  const crossingEdges = new Set(
    graph.edges.filter((e) => edgeCrossesTitle(e, titleBoxes)),
  )
  let titleGapMaskId: string | undefined
  if (crossingEdges.size > 0) {
    const mask = titleGapMask(titleBoxes, graph.width, graph.height)
    titleGapMaskId = mask.id
    parts.push(mask.markup)
  }
  parts.push('</defs>')

  // 1. Subgraph backgrounds (group rectangles with header bands)
  for (const group of graph.groups) {
    parts.push(renderGroup(group, font, fontSizes))
  }

  // 2. Edges (paths — rendered behind nodes)
  // Each edge is a <path> with semantic data-* attributes
  for (const edge of graph.edges) {
    parts.push(
      renderEdge(
        edge,
        curve,
        animationEnabled,
        crossingEdges.has(edge) ? titleGapMaskId : undefined,
        graph.stateDiagram === true,
      ),
    )
  }

  // 3. Edge labels (positioned at midpoint of edge)
  // Each label is wrapped in <g class="edge-label">
  for (const edge of graph.edges) {
    if (edge.label) {
      parts.push(renderEdgeLabel(edge, font, fontSizes))
    }
  }

  // 4. Nodes (shape + label wrapped in <g class="node">)
  for (const node of graph.nodes) {
    parts.push(
      renderNode(
        node,
        font,
        fontSizes,
        linksEnabled,
        graph.stateDiagram === true,
      ),
    )
  }

  parts.push('</svg>')

  return parts.join('\n')
}

// ============================================================================
// Arrow marker definitions
// ============================================================================

/**
 * Keyframes for `e1@{ animate: true }` edges — a marching-ants dash.
 *
 * CSS animation rather than SMIL: SMIL is deprecated in browsers, while a
 * CSS `@keyframes` block inside the SVG animates in browsers and is simply
 * ignored by static rasterizers, which render the first frame. The
 * `prefers-reduced-motion` guard stops the animation for users who have asked
 * the system for less movement — the edge still renders, just still.
 *
 * A second `<style>` element, so it takes the same `nonce` as the theme
 * block (see `styleOpenTag`) — under a nonce-based CSP it would otherwise be
 * the one un-nonced element on the page and get silently dropped.
 */
function edgeAnimationStyle(nonce?: string): string {
  return [
    styleOpenTag(nonce),
    '  @keyframes zm-edge-dash { to { stroke-dashoffset: -28; } }',
    '  .edge-animated { animation: zm-edge-dash 1s linear infinite; }',
    '  @media (prefers-reduced-motion: reduce) {',
    '    .edge-animated { animation: none; }',
    '  }',
    '</style>',
  ].join('\n')
}

/**
 * Reusable arrow head markers — both forward (end) and reverse (start) variants.
 * Arrow color uses the var(--_arrow) CSS variable.
 */
function arrowMarkerDefs(barb: boolean): string {
  return arrowMarkerPair('var(--_arrow)', '', barb)
}

/**
 * Arrow markers tinted to a specific color (for linkStyle stroke overrides).
 * IDs are suffixed with a sanitized color string to avoid collisions.
 */
function arrowMarkerDefsForColor(color: string, barb: boolean): string {
  return arrowMarkerPair(escapeAttr(color), f`-${markerSuffix(color)}`, barb)
}

/** Mermaid 12.2.0 `.edge-thickness-thick` (normal is 1px, same as ours). */
const THICK_EDGE_WIDTH = 3.5

/**
 * Build the forward (marker-end) + reverse (marker-start) arrow-head marker pair.
 *
 * Both heads share one polygon. The reverse head differs only by
 * orient="auto-start-reverse", which flips it 180° to point back out of
 * the start node — so the polygon must NOT be pre-reversed. Reversing both is
 * a double reversal: the head points into the line and vanishes in
 * librsvg/Inkscape/browsers.
 */
function arrowMarkerPair(
  color: string,
  idSuffix: string,
  barb: boolean,
): string {
  if (barb) return barbMarkerPair(color, idSuffix)
  // Mermaid 12.2.0 edges use the `pointEnd-margin` marker: viewBox 11.5x14 in a
  // 10.5x14 userSpaceOnUse box, i.e. a head 10.5 long and 14 * 10.5 / 11.5 =
  // 12.8 wide at any stroke width (#2475). The 8x8 `pointEnd` marker is unused.
  const w = 10.5
  const h = 12.8
  // Pull arrowhead back slightly (refX = w - 1) to prevent clipping at node boundaries.
  const refX = w - 1
  // Both fill and a thin stroke for better definition at small sizes.
  const style = f`fill="${color}" stroke="${color}" stroke-width="0.75" stroke-linejoin="round"`
  const polygon = f`<polygon points="0 0, ${w} ${h / 2}, 0 ${h}" ${style} />`
  const marker = (id: string, orient: string) =>
    f`  <marker id="${id}" markerWidth="${w}" markerHeight="${h}" refX="${refX}" refY="${h / 2}" markerUnits="userSpaceOnUse" orient="${orient}">` +
    f`\n    ${polygon}` +
    `\n  </marker>`
  return (
    marker(f`arrowhead${idSuffix}`, 'auto') +
    '\n' +
    marker(f`arrowhead-start${idSuffix}`, 'auto-start-reverse')
  )
}

/**
 * A state diagram's `stateDiagram-barbEnd-margin` head, as mermaid@12.3.0
 * draws it: a 20x14 userSpaceOnUse box, `M 19,7 L11,14 L13,7 L11,0 Z`, filled
 * with no stroke, refX 17 / refY 7. Same ids as the triangle pair.
 */
function barbMarkerPair(color: string, idSuffix: string): string {
  const marker = (id: string, orient: string) =>
    f`  <marker id="${id}" markerWidth="20" markerHeight="14" refX="17" refY="7" markerUnits="userSpaceOnUse" orient="${orient}">` +
    f`\n    <path d="M 19,7 L11,14 L13,7 L11,0 Z" fill="${color}" />` +
    `\n  </marker>`
  return (
    marker(f`arrowhead${idSuffix}`, 'auto') +
    '\n' +
    marker(f`arrowhead-start${idSuffix}`, 'auto-start-reverse')
  )
}

/**
 * Circle (`--o`) and cross (`--x`) terminators: mermaid 12.3.0's
 * `circleEnd-margin` / `crossEnd-margin` geometry (a ~3px gap before the node
 * border), one marker for both ends via `auto-start-reverse`. Mermaid's start
 * markers use a slightly different refX (0.6px more gap on the cross).
 */
function terminatorMarker(kind: 'circle' | 'cross'): string {
  return kind === 'circle'
    ? f`<marker id="circle" viewBox="0 0 10 10" refX="12.25" refY="5" markerUnits="userSpaceOnUse" markerWidth="14" markerHeight="14" orient="auto-start-reverse"><circle cx="5" cy="5" r="5" fill="var(--_arrow)"/></marker>`
    : f`<marker id="cross" viewBox="0 0 15 15" refX="17.7" refY="7.5" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" orient="auto-start-reverse"><path d="M1 1L14 14M1 14L14 1" stroke="var(--_arrow)" stroke-width="2.5"/></marker>`
}

/**
 * Mermaid ends a state edge `BARB_GAP` before the node border (its `-margin`
 * marker), so the barb's tip stops 3.5px short of the box and the line does not
 * poke through the head. Moves the arrowed end(s) of `edge` back by that much.
 */
const BARB_GAP = 5.5
function barbGap(edge: PositionedEdge): PositionedEdge['points'] {
  const pts = edge.points.map((p) => ({ ...p }))
  const pull = (end: number, next: number) => {
    const a = pts[end]!
    const b = pts[next]!
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    if (len <= BARB_GAP) return
    a.x += ((b.x - a.x) / len) * BARB_GAP
    a.y += ((b.y - a.y) / len) * BARB_GAP
  }
  // Circle / cross terminators carry their own clearance; only barbs get the gap.
  if (edge.hasArrowEnd && !edge.endMarker) pull(pts.length - 1, pts.length - 2)
  if (edge.hasArrowStart && !edge.startMarker) pull(0, 1)
  return pts
}

/** Sanitize a color value into a collision-free SVG ID suffix.
 *  Non-alphanumeric chars are hex-encoded so distinct inputs never collapse
 *  (e.g. "var(--line-1)" → "var28--line2d129", "var(--line1)" → "var28--line129"). */
/**
 * Mermaid 12.2.0 colours a head with the `linkStyle default` stroke when there is
 * one, else with the edge's own `linkStyle` stroke (#2476). `headColor` is the
 * default stroke, so with no default the edge's own stroke is what remains.
 */
function headColorOf(edge: PositionedEdge): string | undefined {
  return edge.headColor ?? edge.inlineStyle?.stroke
}

function markerSuffix(color: string): string {
  return color.replace(/[^a-zA-Z0-9]/g, (ch) => ch.charCodeAt(0).toString(16))
}

// ============================================================================
// Group rendering (subgraph backgrounds)
// ============================================================================

/** ` stroke-dasharray="…"` from a style's `stroke-dasharray`, or '' when absent or not a number list (#2551). */
function dashAttr(style: Record<string, string> | undefined): string {
  const d = style?.['stroke-dasharray']
  return d && /^[\d.\s,]+$/.test(d) ? f` stroke-dasharray="${d.trim()}"` : ''
}

/** Edge of the icon tile in an architecture group's corner, as Mermaid draws it. */
const ARCH_GROUP_ICON = 30

/** Half of mermaid@12.3.0's 24 px title box: its centre sits this far below its top. */
const TITLE_ONLY_HALF_LINE = 12

function renderGroup(
  group: PositionedGroup,
  font: string,
  fontSizes: FontSizes,
): string {
  const headerHeight = fontSizes.groupHeader + 16
  const parts: string[] = []

  // Concurrency region (state `--`): a dashed untitled box, no header band.
  if (group.region) {
    parts.push(
      f`<g class="subgraph subgraph-region" data-id="${escapeAttr(group.id)}">`,
      f`  <rect x="${group.x}" y="${group.y}" width="${group.width}" height="${group.height}" ` +
        f`rx="0" ry="0" fill="none" stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.outerBox}" stroke-dasharray="6 4" />`,
    )
    for (const child of group.children) {
      parts.push(renderGroup(child, font, fontSizes))
    }
    parts.push('</g>')
    return parts.join('\n')
  }

  // Architecture group (#2619): Mermaid draws a dashed, unfilled box with the
  // icon tile in its top-left corner and the title beside it, no header band.
  if (group.architecture) {
    const glyph = group.icon && (ICON_GLYPHS[group.icon] ?? UNKNOWN_GLYPH)
    parts.push(
      f`<g class="subgraph" data-id="${escapeAttr(group.id)}" data-label="${escapeAttr(group.label)}">`,
      f`  <rect x="${group.x}" y="${group.y}" width="${group.width}" height="${group.height}" fill="none" stroke="var(--_node-stroke)" stroke-width="${ARCH_GROUP_STROKE}" stroke-dasharray="${ARCH_GROUP_DASH}" />`,
    )
    if (glyph)
      parts.push(
        f`  <g transform="translate(${group.x + 1} ${group.y + 1}) scale(${ARCH_GROUP_ICON / TILE})"><rect width="${TILE}" height="${TILE}" fill="${TILE_FILL}" />${glyph}</g>`,
      )
    parts.push(
      '  ' +
        renderMultilineText(
          group.label,
          group.x + (glyph ? ARCH_GROUP_ICON + 4 : 6),
          group.y + 1 + ARCH_GROUP_ICON / 2,
          fontSizes.groupHeader,
          f`font-size="${fontSizes.groupHeader}" font-weight="400" fill="var(--_text)"`,
        ),
    )
    for (const child of group.children) {
      parts.push(renderGroup(child, font, fontSizes))
    }
    parts.push('</g>')
    return parts.join('\n')
  }

  // Opening <g> with semantic attributes for subgraph identification
  // data-id: original Mermaid subgraph ID
  // data-label: display label (may differ from ID)
  parts.push(
    f`<g class="subgraph" data-id="${escapeAttr(group.id)}" data-label="${escapeAttr(group.label)}">`,
  )

  // `style` / `class` on the subgraph (#2550); the header band follows the fill
  const gs = group.inlineStyle
  const stroke = escapeAttr(gs?.stroke ?? 'var(--_node-stroke)')
  const sw = escapeAttr(gs?.['stroke-width'] ?? String(STROKE_WIDTHS.outerBox))
  const dash = dashAttr(gs)
  const fill = escapeAttr(gs?.fill ?? 'var(--_group-fill)')
  const hdrFill = escapeAttr(gs?.fill ?? 'var(--_group-hdr)')

  // Outer rectangle. A state composite (#2651) is drawn as mermaid@12.3.0
  // draws it: the outer rect carries the band colour with rounded corners, and
  // a square-cornered body rect sits inside it (below).
  const bandless = group.bandless === true
  if (!group.titleOnly)
    parts.push(
      f`  <rect x="${group.x}" y="${group.y}" width="${group.width}" height="${group.height}" ` +
        f`rx="${bandless ? 0 : COMPOSITE_RADIUS}" ry="${bandless ? 0 : COMPOSITE_RADIUS}" fill="${bandless ? fill : hdrFill}" stroke="${stroke}" stroke-width="${sw}"${dash} />`,
    )

  // Flowchart subgraph (#2636): mermaid@12.3.0 draws no header band, only a
  // centred title along the top edge.
  if (group.bandless) {
    parts.push(
      '  ' +
        renderMultilineText(
          group.label,
          group.x + group.width / 2,
          // #2784: mermaid@12.3.0 hangs an empty subgraph's 24 px title box from
          // the middle of its slot (the box's top on the centre line), not
          // centred at the top edge like a framed subgraph's.
          group.titleOnly
            ? group.y + group.height / 2 + TITLE_ONLY_HALF_LINE
            : group.y + headerHeight / 2,
          fontSizes.groupHeader,
          f`text-anchor="middle" font-size="${fontSizes.groupHeader}" font-weight="${BANDLESS_TITLE_WEIGHT}" fill="${escapeAttr(gs?.color ?? 'var(--_text-sec)')}"`,
        ),
    )
    for (const child of group.children) {
      parts.push(renderGroup(child, font, fontSizes))
    }
    parts.push('</g>')
    return parts.join('\n')
  }

  // Body: mermaid's `inner` rect, which starts below the 26 px title band and
  // stops COMPOSITE_BODY_INSET short of the outer rect's bottom edge.
  parts.push(
    f`  <rect x="${group.x}" y="${group.y + COMPOSITE_BAND}" width="${group.width}" height="${Math.max(0, group.height - COMPOSITE_BAND - COMPOSITE_BODY_INSET)}" ` +
      f`rx="0" ry="0" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash} />`,
  )

  // A state composite (#2651): mermaid@12.3.0 centres a regular-weight title in
  // the band. (Icon groups are architecture groups, drawn above, never here.)
  const titleX = group.x + group.width / 2

  // Header label (supports multi-line via <br> tags)
  parts.push(
    '  ' +
      renderMultilineText(
        group.label,
        titleX,
        group.y + COMPOSITE_BAND / 2,
        fontSizes.groupHeader,
        f`text-anchor="middle" font-size="${fontSizes.groupHeader}" font-weight="${BANDLESS_TITLE_WEIGHT}" fill="${escapeAttr(gs?.color ?? 'var(--_text-sec)')}"`,
      ),
  )

  // Render nested groups recursively (inside this group)
  for (const child of group.children) {
    parts.push(renderGroup(child, font, fontSizes))
  }

  parts.push('</g>')

  return parts.join('\n')
}

// ============================================================================
// Edge rendering
// ============================================================================

function renderEdge(
  edge: PositionedEdge,
  curve: CurveStyle,
  animationEnabled: boolean = true,
  titleGapMaskId?: string,
  stateDiagram: boolean = false,
): string {
  if (edge.points.length < 2) return ''

  // `interactivity: 'none'` strips motion: the edge still renders (id,
  // data-* attributes, arrowheads) but never gets the animated class or dash.
  const animate = animationEnabled && (edge.animate ?? false)

  /*
   * An invisible link (`A ~~~ B`) still occupies its layout slot — that is
   * the whole point of the syntax — so the element is emitted with its data
   * attributes intact and only its paint suppressed. Omitting the element
   * entirely would lose it from DOM inspection and from `data-style` queries.
   */
  const invisible = edge.style === 'invisible'

  const dashArray = edge.style === 'dotted' ? ' stroke-dasharray="2 2"' : ''
  const baseStrokeWidth =
    edge.style === 'thick' ? THICK_EDGE_WIDTH : STROKE_WIDTHS.connector
  const strokeColor = invisible
    ? 'none'
    : escapeAttr(edge.inlineStyle?.stroke ?? 'var(--_line)')
  const strokeWidth = escapeAttr(
    edge.inlineStyle?.['stroke-width'] ?? String(baseStrokeWidth),
  )

  // Build marker attributes based on arrow direction flags
  // Use color-specific markers when edge has a custom stroke from linkStyle
  const head = headColorOf(edge)
  const suffix = head ? f`-${markerSuffix(head)}` : ''
  let markers = ''
  if (!invisible) {
    if (edge.hasArrowEnd)
      markers += f` marker-end="url(#${edge.endMarker ?? f`arrowhead${suffix}`})"`
    if (edge.hasArrowStart)
      markers += f` marker-start="url(#${edge.startMarker ?? f`arrowhead-start${suffix}`})"`
  }

  // Semantic data attributes for edge identification and inspection:
  // - class="edge": CSS targeting and type identification
  // - data-from/data-to: source and target node IDs
  // - data-style: edge style (solid, dotted, thick)
  // - data-arrow-start/end: arrow presence flags
  // - data-label: edge label if present (for quick lookup without traversing DOM)
  const dataAttrs = [
    // An animated edge (`e1@{ animate: true }`, with animation enabled)
    // carries an extra class; its keyframes live in the shared style block.
    f`class="edge${animate ? ' edge-animated' : ''}"`,
    f`data-from="${escapeAttr(edge.source)}"`,
    f`data-to="${escapeAttr(edge.target)}"`,
    f`data-style="${edge.style}"`,
    f`data-arrow-start="${edge.hasArrowStart}"`,
    f`data-arrow-end="${edge.hasArrowEnd}"`,
  ]
  if (edge.label) {
    dataAttrs.push(f`data-label="${escapeAttr(edge.label)}"`)
  }
  if (edge.id) {
    // Mermaid edge id (`A e1@--> B`), used to target the edge from CSS and
    // to attach the animation below.
    dataAttrs.push(f`data-id="${escapeAttr(edge.id)}"`)
  }

  // Marching ants need a dash pattern to march; supply one only when the
  // edge's own style hasn't already set stroke-dasharray.
  const animatedDash = animate && !dashArray ? ' stroke-dasharray="8 6"' : ''

  // Every edge is a <path>: mermaid@12.3.0 rounds orthogonal bends (#2635),
  // which a <polyline> cannot express. The default `linear` curve is that
  // rounded orthogonal route; other curves interpolate the same points.
  const points = stateDiagram ? barbGap(edge) : edge.points
  const d =
    curve === 'linear'
      ? roundedPath(points, MERMAID_CORNER_RADIUS)
      : pointsToPath(points, curve)

  return (
    f`<path ${dataAttrs.join(' ')} d="${d}" ` +
    f`fill="none" stroke="${strokeColor}" ` +
    f`stroke-width="${strokeWidth}"${dashArray}${animatedDash}${markers}` +
    (titleGapMaskId ? f` mask="url(#${titleGapMaskId})"` : '') +
    ' />'
  )
}

// `_font` isn't read here but is kept to match the `(entity, font)` signature
// threaded through the rest of the render* functions in this file.
function renderEdgeLabel(
  edge: PositionedEdge,
  _font: string,
  fontSizes: FontSizes,
): string {
  // Only called when edge.label is set (see call site), but narrow it here
  // too rather than trusting that invariant across the function boundary.
  if (!edge.label) return ''
  const label = edge.label

  // Use layout-computed label position when available (layout-aware, avoids collisions).
  // Fall back to geometric midpoint of the edge polyline.
  const mid = edge.labelPosition ?? edgeMidpoint(edge.points)
  // Mermaid 12.3.0: label box = text box, no padding, no border (#2854)
  const padding = 0

  // Measure text (works for both single and multi-line)
  const metrics = measureMultilineText(
    label,
    fontSizes.edgeLabel,
    FONT_WEIGHTS.edgeLabel,
  )

  // Wrap in <g class="edge-label"> with reference to the edge it belongs to
  const content = renderMultilineTextWithBackground(
    label,
    mid.x,
    mid.y,
    metrics.width,
    metrics.height,
    fontSizes.edgeLabel,
    padding,
    // Use --_text-sec for better contrast (was --_text-muted)
    f`text-anchor="middle" font-size="${fontSizes.edgeLabel}" font-weight="${FONT_WEIGHTS.edgeLabel}" fill="var(--_text-sec)"`,
    `fill="var(--bg)"`,
  )

  // Semantic wrapper: links label to its edge via data-from/data-to
  return (
    f`<g class="edge-label" data-from="${escapeAttr(edge.source)}" data-to="${escapeAttr(edge.target)}" data-label="${escapeAttr(label)}">\n` +
    f`  ${content.replace(/\n/g, '\n  ')}\n` +
    `</g>`
  )
}

/**
 * Get the point at `index`, throwing instead of silently producing
 * `undefined` (and downstream `NaN`s). The loops in `edgeMidpoint` only ever
 * pass indices derived from `points.length`, so this should never actually
 * throw — it exists because `noUncheckedIndexedAccess` can't prove that from
 * the loop bounds alone, and a loud failure here is far easier to diagnose
 * than silently corrupted coordinates.
 */
function requirePoint(points: Point[], index: number): Point {
  const point = points[index]
  if (!point) {
    // Unreachable — both call sites in edgeMidpoint only ever pass indices
    // in [0, points.length - 1].
    /* v8 ignore next */
    throw new Error(f`edgeMidpoint: missing point at index ${index}`)
  }
  return point
}

/** Get the midpoint of a polyline (by walking segments) */
function edgeMidpoint(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1) return points[0]!

  // Calculate total length
  let totalLength = 0
  for (let i = 1; i < points.length; i++) {
    totalLength += dist(requirePoint(points, i - 1), requirePoint(points, i))
  }

  // Walk to the halfway point
  let remaining = totalLength / 2
  for (let i = 1; i < points.length; i++) {
    const prev = requirePoint(points, i - 1)
    const curr = requirePoint(points, i)
    const segLen = dist(prev, curr)
    if (remaining <= segLen) {
      const t = remaining / segLen
      return {
        x: prev.x + t * (curr.x - prev.x),
        y: prev.y + t * (curr.y - prev.y),
      }
    }
    remaining -= segLen
  }

  return points[points.length - 1]!
}

function dist(a: Point, b: Point): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2)
}

// ============================================================================
// Node rendering
// ============================================================================

/**
 * Render a complete node: shape + label wrapped in a semantic <g> element.
 *
 * The group includes data attributes for:
 * - data-id: original Mermaid node ID (for edge matching)
 * - data-label: display label text
 * - data-shape: shape type (rectangle, diamond, circle, etc.)
 *
 * @param linksEnabled - Whether a `click`-based `<a href>` link and `<title>`
 *                       tooltip render (from `options.interactivity !==
 *                       'none'`). Default true.
 */
function renderNode(
  node: PositionedNode,
  font: string,
  fontSizes: FontSizes,
  linksEnabled: boolean = true,
  stateDiagram: boolean = false,
): string {
  const shape = renderNodeShape(node, stateDiagram)
  const label = renderNodeLabel(node, font, fontSizes)

  // Combine shape and label inside a semantic group
  // This enables reliable node identification without heuristics
  const parts: string[] = []
  const safeClassName = sanitizeClassName(node.className)
  const classAttr = safeClassName ? f`node ${safeClassName}` : 'node'

  const interaction = node.interaction
  const groupAttrs = [
    f`class="${classAttr}"`,
    f`data-id="${escapeAttr(node.id)}"`,
    f`data-label="${escapeAttr(node.label)}"`,
    f`data-shape="${node.shape}"`,
  ]
  /*
   * `click A call fn()` is deliberately absent from the markup. This renderer
   * produces a static SVG string and executes nothing a diagram supplies —
   * running diagram-authored script would make every rendered diagram an
   * execution vector. The binding is exposed as data instead, on the
   * `interactions` map `parseMermaid()` returns, and the `data-id` attribute
   * above is the hook a host binds it to. The inert `data-click-callback`
   * attribute once emitted here was removed in #216 — see
   * docs/decisions/no-script-interactivity.md.
   */
  parts.push(f`<g ${groupAttrs.join(' ')}>`)

  // An href becomes a real SVG link, which needs no script to work.
  // `interactivity: 'none'` strips it — a link is meaningless in
  // print/rasterized output, the target that level is meant for.
  const href = linksEnabled ? safeHref(interaction?.href) : undefined
  const indent = href ? '    ' : '  '
  if (href) {
    const targetAttr = interaction?.target
      ? f` target="${escapeAttr(interaction.target)}"`
      : ''
    parts.push(f`  <a href="${escapeAttr(href)}"${targetAttr}>`)
  }

  if (linksEnabled && interaction?.tooltip) {
    // <title> is SVG's native tooltip — no script, no CSS. Gated by
    // linksEnabled alongside href above: both come from the same `click`
    // statement, and 'none' strips both.
    parts.push(f`${indent}<title>${escapeXml(interaction.tooltip)}</title>`)
  }

  parts.push(f`${indent}${shape.replace(/\n/g, f`\n${indent}`)}`)
  if (label) {
    parts.push(f`${indent}${label.replace(/\n/g, f`\n${indent}`)}`)
  }

  if (href) parts.push('  </a>')
  parts.push('</g>')

  return parts.join('\n')
}

/** Gap from an icon tile's bottom edge to the centre of its label line. */
const SERVICE_LABEL_DROP = 13
/** Mermaid's architecture group border: 2px, dashed `8`. */
/** State composite chrome, measured from mermaid@12.3.0: corner radius, title band height, and the gap between the body rect and the outer rect's bottom edge. */
const COMPOSITE_RADIUS = 5
/** Corner radius of a state box in mermaid@12.3.0 (`rx="5"`). */
const STATE_BOX_RADIUS = 5
const COMPOSITE_BODY_INSET = 4
const ARCH_GROUP_STROKE = 2
const ARCH_GROUP_DASH = 8

/**
 * An architecture service as Mermaid draws it (#2518): an 80px tile with its
 * icon glyph, or a dashed empty box when the service names no icon.
 */
function renderServiceTile(
  x: number,
  y: number,
  icon: string,
  size: number = TILE,
): string {
  // `architecture.iconSize` scales the 80-unit tile and its glyph together.
  const at =
    size === TILE
      ? f`transform="translate(${x} ${y})"`
      : f`transform="translate(${x} ${y}) scale(${size / TILE})"`
  if (icon === '') {
    return f`<path ${at} d="M0,80 V5 Q0,0 5,0 H75 Q80,0 80,5 V80 Z" fill="none" stroke="var(--_node-stroke)" stroke-width="${ARCH_GROUP_STROKE}" stroke-dasharray="${ARCH_GROUP_DASH}" />`
  }
  const glyph = ICON_GLYPHS[icon] ?? UNKNOWN_GLYPH
  return f`<g ${at}><rect width="${TILE}" height="${TILE}" fill="${TILE_FILL}" />${glyph}</g>`
}

function renderNodeShape(node: PositionedNode, stateDiagram: boolean): string {
  const svg = renderNodeShapeBase(node, stateDiagram)
  // `style A stroke-dasharray:5 5`: stroke-dasharray inherits to every child shape.
  // mermaid@12.3.0 ignores every `style`/`classDef` on a `sm-circ`, dash included.
  const dash =
    node.icon === undefined && node.shape !== 'small-circle'
      ? dashAttr(node.inlineStyle)
      : ''
  return dash && svg ? f`<g${dash}>${svg}</g>` : svg
}

function renderNodeShapeBase(
  node: PositionedNode,
  stateDiagram: boolean,
): string {
  const { x, y, width, height, shape } = node
  if (node.icon !== undefined)
    return renderServiceTile(x, y, node.icon, node.width)
  // mermaid@12.3.0 (and 12.2.0) draw `sm-circ` in the default node colours whatever
  // `style` or `classDef` says, so the dot never reads the inline style.
  const inlineStyle = shape === 'small-circle' ? undefined : node.inlineStyle

  // Resolve fill and stroke — inline styles (from mermaid `style` directives)
  // override the CSS variable defaults. When no inline style is present, the
  // CSS variable handles theming automatically via color-mix() derivation.
  const fill = escapeAttr(inlineStyle?.fill ?? 'var(--_node-fill)')
  const stroke = escapeAttr(inlineStyle?.stroke ?? 'var(--_node-stroke)')
  const sw = escapeAttr(
    inlineStyle?.['stroke-width'] ?? String(STROKE_WIDTHS.innerBox),
  )
  // `style B rx:10,ry:10` rounds a plain rectangle (mermaid applies it to the rect only)
  const num = (v: string | undefined) =>
    v && /^\d+(\.\d+)?(px)?$/.test(v) ? parseFloat(v) : 0
  const rx = num(inlineStyle?.rx)
  const radius = {
    rx,
    ry: inlineStyle?.ry === undefined ? rx : num(inlineStyle.ry),
  }

  switch (shape) {
    case 'diamond':
      return renderDiamond(x, y, width, height, fill, stroke, sw)
    case 'rounded':
      return renderRoundedRect(
        x,
        y,
        width,
        height,
        fill,
        stroke,
        sw,
        stateDiagram ? STATE_BOX_RADIUS : 6,
      )
    case 'stadium':
      return renderStadium(x, y, width, height, fill, stroke, sw)
    case 'circle':
      return renderCircle(x, y, width, height, fill, stroke, sw)
    case 'subroutine':
      return renderSubroutine(x, y, width, height, fill, stroke, sw)
    case 'doublecircle':
      return renderDoubleCircle(x, y, width, height, fill, stroke, sw)
    case 'hexagon':
      return renderHexagon(x, y, width, height, fill, stroke, sw)
    case 'cylinder':
      return renderCylinder(x, y, width, height, fill, stroke, sw)
    case 'asymmetric':
      return renderAsymmetric(x, y, width, height, fill, stroke, sw)
    case 'trapezoid':
      return renderTrapezoid(x, y, width, height, fill, stroke, sw)
    case 'trapezoid-alt':
      return renderTrapezoidAlt(x, y, width, height, fill, stroke, sw)
    case 'parallelogram':
      return renderParallelogram(x, y, width, height, fill, stroke, sw)
    case 'parallelogram-alt':
      return renderParallelogramAlt(x, y, width, height, fill, stroke, sw)
    case 'state-start':
      return renderStateStart(x, y, width, height)
    case 'state-end':
      return renderStateEnd(x, y, width, height)

    // --- Expanded-syntax shapes (`A@{ shape: ... }`) ---
    case 'document':
      return renderDocument(x, y, width, height, fill, stroke, sw)
    case 'stacked-document':
      return renderStacked(x, y, width, height, fill, stroke, sw, true)
    case 'stacked-process':
      return renderStacked(x, y, width, height, fill, stroke, sw, false)
    case 'card':
      return renderCard(x, y, width, height, fill, stroke, sw)
    case 'lined-process':
      return renderLinedProcess(x, y, width, height, fill, stroke, sw)
    case 'divided-process':
      return renderDividedProcess(x, y, width, height, fill, stroke, sw)
    case 'window-pane':
      return renderWindowPane(x, y, width, height, fill, stroke, sw)
    case 'triangle':
      return renderTriangle(x, y, width, height, fill, stroke, sw, false)
    case 'flipped-triangle':
      return renderTriangle(x, y, width, height, fill, stroke, sw, true)
    case 'junction':
      return ''
    case 'filled-circle':
      return renderFilledCircle(x, y, width, height, stroke)
    case 'crossed-circle':
      return renderCrossedCircle(x, y, width, height, fill, stroke, sw)
    case 'fork-join':
      return renderForkJoin(x, y, width, height, stroke)
    case 'note':
      return renderNoteShape(
        x,
        y,
        width,
        height,
        escapeAttr(inlineStyle?.fill ?? 'var(--bg)'),
        stroke,
        sw,
      )
    case 'notched-pentagon':
      return renderNotchedPentagon(x, y, width, height, fill, stroke, sw)
    case 'sloped-rectangle':
      return renderSlopedRectangle(x, y, width, height, fill, stroke, sw)
    case 'flag':
      return renderFlag(x, y, width, height, fill, stroke, sw)
    case 'bow-tie-rectangle':
      return renderBowTie(x, y, width, height, fill, stroke, sw)
    case 'half-rounded-rectangle':
      return renderHalfRounded(x, y, width, height, fill, stroke, sw)
    case 'brace':
      return renderBraces(x, y, width, height, fill, stroke, sw, 'left')
    case 'brace-right':
      return renderBraces(x, y, width, height, fill, stroke, sw, 'right')
    case 'braces':
      return renderBraces(x, y, width, height, fill, stroke, sw, 'both')
    case 'bolt':
      return renderBolt(x, y, width, height, fill, stroke, sw)
    case 'cloud':
      return renderCloud(x, y, width, height, fill, stroke, sw)
    case 'horizontal-cylinder':
      return renderHorizontalCylinder(x, y, width, height, fill, stroke, sw)
    case 'tagged-rectangle':
      return renderTaggedRectangle(x, y, width, height, fill, stroke, sw)
    case 'fork-bar':
      return renderRect(x, y, width, height, fill, stroke, sw)
    case 'small-circle':
      return renderSmallCircle(x, y, width, height, fill, stroke, sw)
    case 'text':
    case 'anchor':
      // No outline — the label (rendered separately) is the whole node.
      return ''

    case 'rectangle':
    default:
      return renderRect(x, y, width, height, fill, stroke, sw, radius)
  }
}

// --- Basic shapes ---

function renderRect(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
  radius = { rx: 0, ry: 0 },
): string {
  return (
    f`<rect x="${x}" y="${y}" width="${w}" height="${h}" ` +
    f`rx="${radius.rx}" ry="${radius.ry}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
  )
}

function renderRoundedRect(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
  r: number,
): string {
  return (
    f`<rect x="${x}" y="${y}" width="${w}" height="${h}" ` +
    f`rx="${r}" ry="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
  )
}

function renderStadium(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const r = h / 2
  return (
    f`<rect x="${x}" y="${y}" width="${w}" height="${h}" ` +
    f`rx="${r}" ry="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
  )
}

function renderCircle(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const cx = x + w / 2
  const cy = y + h / 2
  const r = Math.min(w, h) / 2
  return (
    f`<circle cx="${cx}" cy="${cy}" r="${r}" ` +
    f`fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
  )
}

function renderDiamond(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const cx = x + w / 2
  const cy = y + h / 2
  const hw = w / 2
  const hh = h / 2
  const points = [
    f`${cx},${cy - hh}`, // Top
    f`${cx + hw},${cy}`, // Right
    f`${cx},${cy + hh}`, // Bottom
    f`${cx - hw},${cy}`, // Left
  ].join(' ')

  return f`<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
}

// --- Batch 1 shapes ---

/** Subroutine: rectangle with double vertical borders on left and right */
function renderSubroutine(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const inset = 8 // Distance from edge to inner vertical line
  return (
    f`<rect x="${x}" y="${y}" width="${w}" height="${h}" ` +
    f`rx="0" ry="0" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />` +
    f`\n<line x1="${x + inset}" y1="${y}" x2="${x + inset}" y2="${y + h}" ` +
    f`stroke="${stroke}" stroke-width="${sw}" />` +
    f`\n<line x1="${x + w - inset}" y1="${y}" x2="${x + w - inset}" y2="${y + h}" ` +
    f`stroke="${stroke}" stroke-width="${sw}" />`
  )
}

/** Double circle: two concentric circles with a gap between them */
function renderDoubleCircle(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const cx = x + w / 2
  const cy = y + h / 2
  const outerR = Math.min(w, h) / 2
  const innerR = outerR - 5 // 5px gap between rings
  return (
    f`<circle cx="${cx}" cy="${cy}" r="${outerR}" ` +
    f`fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />` +
    f`\n<circle cx="${cx}" cy="${cy}" r="${innerR}" ` +
    f`fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
  )
}

/** Hexagon: 6-point polygon with flat top/bottom and angled sides */
function renderHexagon(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  // Horizontal inset for the angled sides: mermaid@12.3.0 uses height / 3.5
  // (measured on one-, two- and three-line labels).
  const inset = h / 3.5
  const points = [
    f`${x + inset},${y}`, // top-left
    f`${x + w - inset},${y}`, // top-right
    f`${x + w},${y + h / 2}`, // mid-right
    f`${x + w - inset},${y + h}`, // bottom-right
    f`${x + inset},${y + h}`, // bottom-left
    f`${x},${y + h / 2}`, // mid-left
  ].join(' ')

  return f`<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
}

// --- Batch 2 shapes ---

/** Cylinder / database: top ellipse cap + body rect + bottom ellipse */
function renderCylinder(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const ry = 7 // Ellipse vertical radius for the cap
  const cx = x + w / 2
  const bodyTop = y + ry
  const bodyH = h - 2 * ry

  return (
    // Body rectangle (no top border — covered by top ellipse)
    f`<rect x="${x}" y="${bodyTop}" width="${w}" height="${bodyH}" ` +
    f`fill="${fill}" stroke="none" />` +
    // Left and right body borders
    f`\n<line x1="${x}" y1="${bodyTop}" x2="${x}" y2="${bodyTop + bodyH}" stroke="${stroke}" stroke-width="${sw}" />` +
    f`\n<line x1="${x + w}" y1="${bodyTop}" x2="${x + w}" y2="${bodyTop + bodyH}" stroke="${stroke}" stroke-width="${sw}" />` +
    // Bottom ellipse (half visible)
    f`\n<ellipse cx="${cx}" cy="${y + h - ry}" rx="${w / 2}" ry="${ry}" ` +
    f`fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />` +
    // Top ellipse (full, on top)
    f`\n<ellipse cx="${cx}" cy="${bodyTop}" rx="${w / 2}" ry="${ry}" ` +
    f`fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
  )
}

/** Asymmetric / flag: rectangle with a notch cut into the left edge */
function renderAsymmetric(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const points = [
    f`${x},${y}`, // Top-left
    f`${x + w},${y}`, // Top-right
    f`${x + w},${y + h}`, // Bottom-right
    f`${x},${y + h}`, // Bottom-left
    f`${x + ASYMMETRIC_NOTCH},${y + h / 2}`, // Notch tip (points inward)
  ].join(' ')

  return f`<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
}

/** Trapezoid [/text\]: wider bottom, narrower top */
function renderTrapezoid(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const inset = w * 0.15 // Top edge is narrower by this amount on each side
  const points = [
    f`${x + inset},${y}`, // top-left (indented)
    f`${x + w - inset},${y}`, // top-right (indented)
    f`${x + w},${y + h}`, // bottom-right (full width)
    f`${x},${y + h}`, // bottom-left (full width)
  ].join(' ')

  return f`<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
}

/** Trapezoid-alt [\text/]: wider top, narrower bottom */
function renderTrapezoidAlt(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const inset = w * 0.15 // Bottom edge is narrower
  const points = [
    f`${x},${y}`, // top-left (full width)
    f`${x + w},${y}`, // top-right (full width)
    f`${x + w - inset},${y + h}`, // bottom-right (indented)
    f`${x + inset},${y + h}`, // bottom-left (indented)
  ].join(' ')

  return f`<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
}

/**
 * Parallelogram [/text/]: leans right.
 *
 * Unlike the trapezoids, both sloped sides run the same direction — the top
 * edge shifts right by `inset` and the bottom edge shifts left by the same
 * amount, so opposite sides stay parallel.
 */
function renderParallelogram(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const inset = w * 0.15
  const points = [
    f`${x + inset},${y}`, // top-left (shifted right)
    f`${x + w},${y}`, // top-right
    f`${x + w - inset},${y + h}`, // bottom-right (shifted left)
    f`${x},${y + h}`, // bottom-left
  ].join(' ')

  return f`<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
}

/** Parallelogram-alt [\text\]: leans left — the mirror of renderParallelogram. */
function renderParallelogramAlt(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const inset = w * 0.15
  const points = [
    f`${x},${y}`, // top-left
    f`${x + w - inset},${y}`, // top-right (shifted left)
    f`${x + w},${y + h}`, // bottom-right
    f`${x + inset},${y + h}`, // bottom-left (shifted right)
  ].join(' ')

  return f`<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
}

// --- Expanded-syntax shapes (`A@{ shape: ... }`) ---
//
// Each of these is reachable only through the expanded metadata syntax; the
// classic bracket forms have no spelling for them. See
// packages/mermaid-parser/src/expanded-shapes.ts for the semantic-name →
// geometry alias table.

/** Shared attribute string for a filled, stroked path. */
function shapeAttrs(fill: string, stroke: string, sw: string): string {
  return f`fill="${fill}" stroke="${stroke}" stroke-width="${sw}"`
}

/**
 * Document: rectangle with a wavy bottom edge.
 *
 * The wave is two cubic segments — down then up — so the edge returns to its
 * starting height at the right corner and the shape tiles cleanly when
 * stacked (see renderStacked).
 */
function renderDocument(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const waveH = Math.min(10, h * 0.16)
  const base = y + h - waveH
  // Both ends land on `base`, so the left and right sides are the same
  // height. Ending the curve anywhere else makes every document node
  // visibly lopsided.
  const d =
    f`M ${x} ${y} L ${x + w} ${y} L ${x + w} ${base} ` +
    f`C ${x + w * 0.75} ${base + waveH * 1.8} ${x + w * 0.25} ${base - waveH * 0.8} ${x} ${base} Z`
  return f`<path d="${d}" ${shapeAttrs(fill, stroke, sw)} />`
}

/** Stacked document / process: offset copies behind the front shape. */
function renderStacked(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
  isDocument: boolean,
): string {
  const offset = 5
  const frontW = w - offset * 2
  const frontH = h - offset * 2
  const parts: string[] = []

  // Two offset copies behind, back to front.
  for (let i = 2; i >= 1; i--) {
    parts.push(
      f`<rect x="${x + offset * i}" y="${y + offset * (2 - i)}" width="${frontW}" height="${frontH}" ` +
        f`${shapeAttrs(fill, stroke, sw)} />`,
    )
  }

  parts.push(
    isDocument
      ? renderDocument(x, y + offset * 2, frontW, frontH, fill, stroke, sw)
      : f`<rect x="${x}" y="${y + offset * 2}" width="${frontW}" height="${frontH}" ${shapeAttrs(fill, stroke, sw)} />`,
  )

  return parts.join('\n')
}

/** Card / notched rectangle: top-left corner clipped. */
function renderCard(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const notch = Math.min(14, w * 0.12, h * 0.3)
  const points = [
    f`${x + notch},${y}`,
    f`${x + w},${y}`,
    f`${x + w},${y + h}`,
    f`${x},${y + h}`,
    f`${x},${y + notch}`,
  ].join(' ')
  return f`<polygon points="${points}" ${shapeAttrs(fill, stroke, sw)} />`
}

/** Lined process: rectangle with a vertical rule inset from the left edge. */
function renderLinedProcess(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const inset = Math.min(12, w * 0.12)
  return (
    f`<rect x="${x}" y="${y}" width="${w}" height="${h}" ${shapeAttrs(fill, stroke, sw)} />\n` +
    f`<line x1="${x + inset}" y1="${y}" x2="${x + inset}" y2="${y + h}" stroke="${stroke}" stroke-width="${sw}" />`
  )
}

/** Divided process: rectangle split by a horizontal rule near the top. */
function renderDividedProcess(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const split = y + Math.min(16, h * 0.3)
  return (
    f`<rect x="${x}" y="${y}" width="${w}" height="${h}" ${shapeAttrs(fill, stroke, sw)} />\n` +
    f`<line x1="${x}" y1="${split}" x2="${x + w}" y2="${split}" stroke="${stroke}" stroke-width="${sw}" />`
  )
}

/** Window pane / internal storage: rectangle quartered by a cross. */
function renderWindowPane(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const vx = x + Math.min(16, w * 0.16)
  const hy = y + Math.min(14, h * 0.28)
  return (
    f`<rect x="${x}" y="${y}" width="${w}" height="${h}" ${shapeAttrs(fill, stroke, sw)} />\n` +
    f`<line x1="${vx}" y1="${y}" x2="${vx}" y2="${y + h}" stroke="${stroke}" stroke-width="${sw}" />\n` +
    f`<line x1="${x}" y1="${hy}" x2="${x + w}" y2="${hy}" stroke="${stroke}" stroke-width="${sw}" />`
  )
}

/** Triangle, apex up (extract) or apex down (manual file). */
function renderTriangle(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
  flipped: boolean,
): string {
  const points = flipped
    ? [f`${x},${y}`, f`${x + w},${y}`, f`${x + w / 2},${y + h}`]
    : [f`${x + w / 2},${y}`, f`${x + w},${y + h}`, f`${x},${y + h}`]
  return f`<polygon points="${points.join(' ')}" ${shapeAttrs(fill, stroke, sw)} />`
}

/** Filled circle (junction): a solid dot, so it takes the stroke color as fill. */
function renderFilledCircle(
  x: number,
  y: number,
  w: number,
  h: number,
  stroke: string,
): string {
  const r = Math.min(w, h) / 2
  return f`<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${r}" fill="${stroke}" stroke="${stroke}" />`
}

/** Crossed circle (summary): circle with an X through it. */
function renderCrossedCircle(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const cx = x + w / 2
  const cy = y + h / 2
  const r = Math.min(w, h) / 2 - 2
  // Cross arms meet the circumference at 45°, so offset by r/√2.
  const d = r / Math.SQRT2
  return (
    f`<circle cx="${cx}" cy="${cy}" r="${r}" ${shapeAttrs(fill, stroke, sw)} />\n` +
    f`<line x1="${cx - d}" y1="${cy - d}" x2="${cx + d}" y2="${cy + d}" stroke="${stroke}" stroke-width="${sw}" />\n` +
    f`<line x1="${cx + d}" y1="${cy - d}" x2="${cx - d}" y2="${cy + d}" stroke="${stroke}" stroke-width="${sw}" />`
  )
}

/** Fork/join: a solid bar, drawn in the stroke color. */
function renderForkJoin(
  x: number,
  y: number,
  w: number,
  h: number,
  stroke: string,
): string {
  const barH = Math.min(8, h)
  return f`<rect x="${x}" y="${y + (h - barH) / 2}" width="${w}" height="${barH}" fill="${stroke}" stroke="${stroke}" />`
}

/**
 * Mermaid's cloud: its own arc path for a w0 by h0 label box, which spans
 * 1.25*w0 by h0 + 0.48*w0 starting 0.1*w0 left of and 0.225*w0 above its
 * origin. The node box is that span, so the origin sits inside it.
 */
function renderCloud(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const w0 = w / 1.25
  const h0 = h - 0.48 * w0
  const [r1, r2, r3, r4] = [0.15 * w0, 0.25 * w0, 0.35 * w0, 0.2 * w0]
  const d =
    f`M0 0 a${r1},${r1} 0 0,1 ${0.25 * w0},${-0.1 * w0} ` +
    f`a${r3},${r3} 1 0,1 ${0.4 * w0},${-0.1 * w0} ` +
    f`a${r2},${r2} 1 0,1 ${0.35 * w0},${0.2 * w0} ` +
    f`a${r1},${r1} 1 0,1 ${0.15 * w0},${0.35 * h0} ` +
    f`a${r4},${r4} 1 0,1 ${-0.15 * w0},${0.65 * h0} ` +
    f`a${r2},${r1} 1 0,1 ${-0.25 * w0},${0.15 * w0} ` +
    f`a${r3},${r3} 1 0,1 ${-0.5 * w0},0 ` +
    f`a${r1},${r1} 1 0,1 ${-0.25 * w0},${-0.15 * w0} ` +
    f`a${r1},${r1} 1 0,1 ${-0.1 * w0},${-0.35 * h0} ` +
    f`a${r4},${r4} 1 0,1 ${0.1 * w0},${-0.65 * h0} H0 V0 Z`
  return f`<path transform="translate(${x + 0.1 * w0} ${y + 0.225 * w0})" d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
}

/** Cylinder on its side: end caps are half-ellipses, the right one fully drawn. */
function renderHorizontalCylinder(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const ry = h / 2
  const rx = ry / (2.5 + h / 50)
  const body = w - 2 * rx
  return (
    f`<path d="M${x + rx},${y + h} a${rx},${ry} 0,0,1 0,${-h} l${body},0 a${rx},${ry} 0,0,1 0,${h} ` +
    f`l${-body},0 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />` +
    f`\n<path d="M${x + rx + body},${y} a${rx},${ry} 0,0,0 0,${h}" fill="none" stroke="${stroke}" stroke-width="${sw}" />`
  )
}

/** Rectangle with a filled dog-ear triangle in the bottom-right corner (0.2h). */
function renderTaggedRectangle(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const tag = 0.2 * h
  return (
    renderRect(x, y, w, h, fill, stroke, sw) +
    f`\n<polygon points="${x + w - tag},${y + h} ${x + w},${y + h} ${x + w},${y + h - tag}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
  )
}

/** Mermaid's small circle: a 14px circle in the node colours. */
function renderSmallCircle(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  return f`<circle cx="${x + w / 2}" cy="${y + h / 2}" r="7" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
}

/** State diagram note: a dog-eared box, like the sequence/class notes. */
function renderNoteShape(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const fold = 6
  const body = [
    f`${x},${y}`,
    f`${x + w - fold},${y}`,
    f`${x + w},${y + fold}`,
    f`${x + w},${y + h}`,
    f`${x},${y + h}`,
  ].join(' ')
  return (
    f`<polygon points="${body}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />\n` +
    f`<polygon points="${x + w - fold},${y} ${x + w},${y + fold} ${x + w - fold},${y + fold}" fill="var(--_inner-stroke)" stroke="${stroke}" stroke-width="${sw}" />`
  )
}

/** Notched pentagon (loop limit): both top corners clipped. */
function renderNotchedPentagon(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const notch = Math.min(14, w * 0.12, h * 0.3)
  const points = [
    f`${x + notch},${y}`,
    f`${x + w - notch},${y}`,
    f`${x + w},${y + notch}`,
    f`${x + w},${y + h}`,
    f`${x},${y + h}`,
    f`${x},${y + notch}`,
  ].join(' ')
  return f`<polygon points="${points}" ${shapeAttrs(fill, stroke, sw)} />`
}

/** Sloped rectangle (manual input): top edge slopes up to the right. */
function renderSlopedRectangle(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const slope = Math.min(12, h * 0.3)
  const points = [
    f`${x},${y + slope}`,
    f`${x + w},${y}`,
    f`${x + w},${y + h}`,
    f`${x},${y + h}`,
  ].join(' ')
  return f`<polygon points="${points}" ${shapeAttrs(fill, stroke, sw)} />`
}

/** Flag / paper tape: wavy top and bottom edges. */
function renderFlag(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const waveH = Math.min(8, h * 0.14)
  const d =
    f`M ${x} ${y + waveH} ` +
    f`C ${x + w * 0.25} ${y - waveH} ${x + w * 0.75} ${y + waveH * 2} ${x + w} ${y + waveH} ` +
    f`L ${x + w} ${y + h - waveH} ` +
    f`C ${x + w * 0.75} ${y + h + waveH} ${x + w * 0.25} ${y + h - waveH * 2} ${x} ${y + h - waveH} Z`
  return f`<path d="${d}" ${shapeAttrs(fill, stroke, sw)} />`
}

/** Bow-tie rectangle (stored data): left and right edges curve inward. */
function renderBowTie(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const bow = Math.min(14, w * 0.12)
  const d =
    f`M ${x + bow} ${y} L ${x + w} ${y} ` +
    f`Q ${x + w - bow * 1.4} ${y + h / 2} ${x + w} ${y + h} ` +
    f`L ${x + bow} ${y + h} ` +
    f`Q ${x + bow * 1.4} ${y + h / 2} ${x + bow} ${y} Z`
  return f`<path d="${d}" ${shapeAttrs(fill, stroke, sw)} />`
}

/** Delay / half-rounded rectangle: the right end is a semicircle. */
function renderHalfRounded(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const r = h / 2
  const straight = Math.max(0, w - r)
  const d =
    f`M ${x} ${y} L ${x + straight} ${y} ` +
    f`A ${r} ${r} 0 0 1 ${x + straight} ${y + h} ` +
    f`L ${x} ${y + h} Z`
  return f`<path d="${d}" ${shapeAttrs(fill, stroke, sw)} />`
}

/**
 * Brace shapes: a rectangle body flanked by curly braces.
 *
 * Mermaid's `brace`/`comment` is a left brace, `brace-r` a right brace, and
 * `braces` both. The body itself is unfilled so the braces read as annotation
 * marks rather than as a container.
 */
function renderBraces(
  x: number,
  y: number,
  w: number,
  h: number,
  _fill: string,
  stroke: string,
  sw: string,
  side: 'left' | 'right' | 'both',
): string {
  const armW = Math.min(10, w * 0.12)
  // Unfilled: a filled body reads as a container, which is the opposite of
  // what a brace annotation means. The rect stays only to reserve the
  // label area; `_fill` is deliberately unused.
  const parts = [
    f`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="none" />`,
  ]

  const leftBrace =
    f`M ${x + armW} ${y} Q ${x} ${y} ${x} ${y + h * 0.25} ` +
    f`Q ${x} ${y + h / 2} ${x - armW * 0.4} ${y + h / 2} ` +
    f`Q ${x} ${y + h / 2} ${x} ${y + h * 0.75} ` +
    f`Q ${x} ${y + h} ${x + armW} ${y + h}`
  const rightBrace =
    f`M ${x + w - armW} ${y} Q ${x + w} ${y} ${x + w} ${y + h * 0.25} ` +
    f`Q ${x + w} ${y + h / 2} ${x + w + armW * 0.4} ${y + h / 2} ` +
    f`Q ${x + w} ${y + h / 2} ${x + w} ${y + h * 0.75} ` +
    f`Q ${x + w} ${y + h} ${x + w - armW} ${y + h}`

  if (side === 'left' || side === 'both') {
    parts.push(
      f`<path d="${leftBrace}" fill="none" stroke="${stroke}" stroke-width="${sw}" />`,
    )
  }
  if (side === 'right' || side === 'both') {
    parts.push(
      f`<path d="${rightBrace}" fill="none" stroke="${stroke}" stroke-width="${sw}" />`,
    )
  }

  return parts.join('\n')
}

/** Lightning bolt (communication link). */
function renderBolt(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const points = [
    f`${x + w * 0.42},${y}`,
    f`${x + w},${y}`,
    f`${x + w * 0.62},${y + h * 0.42}`,
    f`${x + w},${y + h * 0.42}`,
    f`${x + w * 0.3},${y + h}`,
    f`${x + w * 0.5},${y + h * 0.55}`,
    f`${x},${y + h * 0.55}`,
  ].join(' ')
  return f`<polygon points="${points}" ${shapeAttrs(fill, stroke, sw)} />`
}

// --- Batch 3: State diagram pseudostates ---

/** State start: small filled circle using primary text color */
function renderStateStart(x: number, y: number, w: number, h: number): string {
  const cx = x + w / 2
  const cy = y + h / 2
  const r = Math.min(w, h) / 2
  return f`<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--_text)" stroke="none" />`
}

/** State end: bullseye — outer ring + inner filled circle using primary text color */
function renderStateEnd(x: number, y: number, w: number, h: number): string {
  const cx = x + w / 2
  const cy = y + h / 2
  // mermaid@12.3.0: a 7px ring (2px stroke) round a 2.5px dot.
  const outerR = Math.min(w, h) / 2
  const innerR = (outerR * 5) / 14
  return (
    f`<circle cx="${cx}" cy="${cy}" r="${outerR}" ` +
    f`fill="none" stroke="var(--_text)" stroke-width="2" />` +
    f`\n<circle cx="${cx}" cy="${cy}" r="${innerR}" fill="var(--_text)" stroke="none" />`
  )
}

// ============================================================================
// Node label rendering
// ============================================================================

// `_font` isn't read here but is kept to match the `(entity, font)` signature
// threaded through the rest of the render* functions in this file.
function renderNodeLabel(
  node: PositionedNode,
  _font: string,
  fontSizes: FontSizes,
): string {
  // State pseudostates have no label
  if (node.shape === 'state-start' || node.shape === 'state-end') {
    if (!node.label) return ''
  }

  // The asymmetric notch eats the left edge, so centre in the body (as mermaid does).
  const cx =
    node.x +
    node.width / 2 +
    (node.shape === 'asymmetric' ? ASYMMETRIC_NOTCH / 2 : 0)
  // An icon tile's label hangs below it, as Mermaid's does.
  // Its first line stays put and further (wrapped) lines hang below it.
  const labelLines = node.label.split('\n').length
  const cy =
    node.icon === undefined
      ? node.y + node.height / 2
      : node.y +
        node.height +
        SERVICE_LABEL_DROP +
        ((labelLines - 1) / 2) * fontSizes.nodeLabel * LINE_HEIGHT_RATIO

  // Resolve text color: an explicit `color` (style / classDef / class) wins,
  // otherwise the theme text color. A custom `fill` never changes the text
  // color, as in Mermaid 12.3.0 (#2637).
  const textColor = escapeAttr(node.inlineStyle?.color ?? 'var(--_text)')

  let attrs = f`text-anchor="middle" font-size="${fontSizes.nodeLabel}" font-weight="${FONT_WEIGHTS.nodeLabel}" fill="${textColor}"`

  // Per-node font-family override (from `style A font-family:...` or
  // classDef/class). Emitted as an inline `style` attribute rather than a
  // `font-family` presentation attribute: the global font is applied via a
  // `text { font-family: ... }` rule in the embedded <style> block (see
  // theme.ts buildStyleBlock), and a presentation attribute always loses to
  // any stylesheet rule regardless of selector specificity. An inline `style`
  // attribute has the highest priority in the cascade, so it reliably
  // overrides the global rule for just this node while every other node
  // keeps falling back to the global font stack. See issue #57.
  const fontFamily = node.inlineStyle?.['font-family']
  if (fontFamily) {
    attrs += f` style="font-family: ${escapeAttr(fontFamily)};"`
  }

  return renderMultilineText(node.label, cx, cy, fontSizes.nodeLabel, attrs)
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Escape a string for embedding as a *multiline-safe* XML attribute value —
 * `escapeAttr()` plus tab/LF/CR as numeric character references.
 *
 * A strict XML parser applies attribute-value normalization on the way in:
 * any literal tab, LF, or CR in the value is collapsed to a single space.
 * (This is why a standalone .svg file opened directly, or any output run
 * through `DOMParser` with an XML/`image/svg+xml` mimetype, would silently
 * flatten a multiline `data-src` back to one line.) Character references
 * are exempt from that normalization — `&#10;` round-trips as an actual
 * newline — so diagram source, which is virtually always multiline, needs
 * this rather than `escapeAttr()` alone to survive the trip intact.
 */
function escapeMultilineAttr(value: string): string {
  return escapeAttr(value)
    .replace(/\r/g, '&#13;')
    .replace(/\n/g, '&#10;')
    .replace(/\t/g, '&#9;')
}

/**
 * Splice a `data-src` attribute (the original diagram source, escaped) onto
 * an already-built root `<svg ...>` opening tag, e.g. from
 * `embedSource: true`. Applied to the string `svgOpenTag()` returns rather
 * than the diagram source's own markup, so it always lands on the root
 * element regardless of diagram type. No-op when `source` is undefined.
 */
export function withDataSrc(
  svgTag: string,
  source: string | undefined,
): string {
  if (source === undefined) return svgTag
  return svgTag.replace(
    '<svg ',
    f`<svg data-src="${escapeMultilineAttr(source)}" `,
  )
}
