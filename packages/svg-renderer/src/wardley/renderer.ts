// ============================================================================
// Wardley map SVG renderer
//
// Draws a parsed WardleyMap the way Mermaid's renderer does
// (diagrams/wardley/wardleyRenderer.ts, mermaid 12.3.0): a fixed-size canvas
// (900 x 600 unless `size` says otherwise) with a 48px padding, an evolution
// axis along the bottom with the stage labels, a visibility axis up the left,
// and every element placed by projecting its percentage coordinates into the
// padded area. Layers, bottom to top, as Mermaid appends them: background,
// title, axes, stages, pipelines, links, trends, nodes, annotations, notes,
// accelerators, deaccelerators. Class names are Mermaid's (`wardley-map`,
// `wardley-node`, `wardley-link--dashed`, `wardley-trend`, …).
//
// Colours follow Mermaid's default theme mapped onto this library's CSS custom
// properties, so every theme applies: axis, component and link strokes are
// `--fg`, text is `--_text`, the evolution arrows (Mermaid's `#dc3545`) use the
// theme accent. Mermaid's fixed greys on the build/buy/outsource overlays
// become mixes of `--fg` into `--bg`. There is no interactivity: Mermaid has
// none for this type. The `wardley-beta` config keys and
// `themeVariables.wardley` are not read (see docs/known-differences.md).
// ============================================================================

import type { WardleyMap, WardleyNode } from '@zombie-mermaid/mermaid-parser'
import { WARDLEY_DEFAULT_STAGES } from '@zombie-mermaid/mermaid-parser'
import type { DiagramColors, SvgEmitOptions } from '@zombie-mermaid/core'
import {
  svgOpenTag,
  buildStyleBlock,
  styleOpenTag,
  escapeXml,
} from '@zombie-mermaid/core'
import { withDataSrc } from '../renderer.ts'
import { estimateTextWidth } from '../styles.ts'

/** Mermaid's default `wardley-beta` config. */
export const WARDLEY = {
  width: 900,
  height: 600,
  padding: 48,
  nodeRadius: 6,
  nodeLabelOffset: 8,
  axisFontSize: 12,
  labelFontSize: 10,
} as const

/** Numbers as Mermaid writes them, minus the float noise: no `-0`, at most 2 decimals. */
function n(v: number): string {
  const s = String(Math.round(v * 100) / 100)
  return s === '-0' ? '0' : s
}

const STYLE = (nonce?: string): string => `${styleOpenTag(nonce)}
  .wardley-background { fill: var(--bg); }
  .wardley-title { fill: var(--_text); font-size: ${n(WARDLEY.axisFontSize * 1.05)}px; font-weight: bold; text-anchor: middle; dominant-baseline: middle; }
  .wardley-axes line { stroke: var(--fg); stroke-width: 1; }
  .wardley-axis-label { fill: var(--_text); font-size: ${WARDLEY.axisFontSize}px; font-weight: bold; text-anchor: middle; }
  .wardley-stage-label { fill: var(--_text); font-size: ${WARDLEY.axisFontSize - 2}px; text-anchor: middle; }
  .wardley-stage-divider { stroke: var(--fg); stroke-width: 1; stroke-dasharray: 5 5; opacity: 0.8; }
  .wardley-link { stroke: var(--fg); stroke-width: 1; }
  .wardley-link--dashed { stroke-dasharray: 6 6; }
  .wardley-link-label { fill: var(--_text); font-size: ${WARDLEY.labelFontSize}px; text-anchor: middle; dominant-baseline: middle; }
  .wardley-link-arrow { fill: var(--fg); stroke: none; }
  .wardley-pipeline-box { fill: none; stroke: var(--fg); stroke-width: 1.5; }
  .wardley-pipeline-evolution-link { stroke: var(--fg); stroke-width: 1; stroke-dasharray: 4 4; }
  .wardley-trend { stroke: var(--accent, #dc3545); stroke-width: 1; stroke-dasharray: 4 4; }
  .wardley-trend-arrow { fill: var(--accent, #dc3545); stroke: none; }
  .wardley-node circle, .wardley-node rect { fill: var(--bg); stroke: var(--fg); stroke-width: 1; }
  .wardley-node .wardley-outsource-overlay { fill: color-mix(in srgb, var(--fg) 60%, var(--bg)); }
  .wardley-node .wardley-buy-overlay { fill: color-mix(in srgb, var(--fg) 20%, var(--bg)); }
  .wardley-node .wardley-build-overlay { fill: color-mix(in srgb, var(--fg) 8%, var(--bg)); }
  .wardley-node .wardley-market-dot { stroke-width: 2; }
  .wardley-node line { stroke: var(--fg); stroke-width: 1; }
  .wardley-node line.wardley-inertia { stroke-width: 6; }
  .wardley-node-label { fill: var(--_text); font-size: ${WARDLEY.labelFontSize}px; }
  .wardley-node--anchor .wardley-node-label { fill: var(--fg); font-weight: bold; text-anchor: middle; dominant-baseline: middle; }
  .wardley-annotation-line { stroke: var(--fg); stroke-width: 1.5; stroke-dasharray: 4 4; }
  .wardley-annotation circle, .wardley-annotations-box rect { fill: var(--bg); stroke: var(--fg); stroke-width: 1.5; }
  .wardley-annotation text { fill: var(--_text); font-size: 10px; font-weight: bold; text-anchor: middle; dominant-baseline: central; }
  .wardley-annotations-box text { fill: var(--_text); font-size: 11px; dominant-baseline: middle; }
  .wardley-notes text { fill: var(--_text); font-size: 11px; font-weight: bold; }
  .wardley-accelerators path, .wardley-deaccelerators path { fill: var(--bg); stroke: var(--fg); stroke-width: 1; }
  .wardley-accelerators text, .wardley-deaccelerators text { fill: var(--_text); font-size: 10px; font-weight: bold; text-anchor: middle; }
</style>`

interface Pos {
  x: number
  y: number
  node: WardleyNode
}

/** Render a parsed Wardley map as an SVG string (see the header for the structure). */
export function renderWardleySvg(
  map: WardleyMap,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
  embedSource?: string,
  title?: string,
  decorative?: boolean,
  emit: SvgEmitOptions = {},
): string {
  const pad = WARDLEY.padding
  const r = WARDLEY.nodeRadius
  const squareSize = r * 1.6
  const width = map.size?.width ?? WARDLEY.width
  const height = map.size?.height ?? WARDLEY.height
  const chartW = width - pad * 2
  const chartH = height - pad * 2
  const projectX = (v: number): number => pad + (v / 100) * chartW
  const projectY = (v: number): number => height - pad - (v / 100) * chartH

  const markerEnd = 'wardley-link-arrow-end'
  const markerStart = 'wardley-link-arrow-start'
  const markerTrend = 'wardley-trend-arrow'

  const p: string[] = []
  p.push(
    withDataSrc(
      svgOpenTag(
        width,
        height,
        colors,
        transparent,
        title,
        decorative,
        undefined,
        emit.styleAttribute,
        emit.description,
      ),
      embedSource,
    ),
    buildStyleBlock(font, false, emit.nonce, emit.bodyFont),
    STYLE(emit.nonce),
    '<defs>',
    `<marker id="${markerTrend}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" class="wardley-trend-arrow"/></marker>`,
    `<marker id="${markerEnd}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" class="wardley-link-arrow"/></marker>`,
    `<marker id="${markerStart}" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M 10 0 L 0 5 L 10 10 z" class="wardley-link-arrow"/></marker>`,
    '</defs>',
    '<g class="wardley-map">',
  )
  if (!transparent)
    p.push(
      `<rect class="wardley-background" width="${width}" height="${height}"/>`,
    )
  if (map.title)
    p.push(
      `<text class="wardley-title" x="${n(width / 2)}" y="${n(pad / 2)}">${escapeXml(map.title)}</text>`,
    )

  // Axes and stages.
  const bottom = height - pad
  p.push(
    '<g class="wardley-axes">',
    `<line x1="${pad}" x2="${width - pad}" y1="${bottom}" y2="${bottom}"/>`,
    `<line x1="${pad}" x2="${pad}" y1="${pad}" y2="${bottom}"/>`,
    `<text class="wardley-axis-label wardley-axis-label-x" x="${n(pad + chartW / 2)}" y="${n(height - pad / 4)}">Evolution</text>`,
    `<text class="wardley-axis-label wardley-axis-label-y" x="${n(pad / 3)}" y="${n(pad + chartH / 2)}" transform="rotate(-90 ${n(pad / 3)} ${n(pad + chartH / 2)})">Visibility</text>`,
    '</g>',
  )
  const stages =
    map.stages && map.stages.length > 0
      ? map.stages
      : [...WARDLEY_DEFAULT_STAGES]
  const bounds =
    map.stageBoundaries && map.stageBoundaries.length === stages.length
      ? map.stageBoundaries
      : undefined
  p.push('<g class="wardley-stages">')
  stages.forEach((stage, i) => {
    const start = bounds
      ? i === 0
        ? 0
        : (bounds[i - 1] as number)
      : i / stages.length
    const end = bounds ? (bounds[i] as number) : (i + 1) / stages.length
    const startX = pad + start * chartW
    const endX = pad + end * chartW
    if (i > 0)
      p.push(
        `<line class="wardley-stage-divider" x1="${n(startX)}" x2="${n(startX)}" y1="${pad}" y2="${bottom}"/>`,
      )
    p.push(
      `<text class="wardley-stage-label" x="${n((startX + endX) / 2)}" y="${n(height - pad / 1.5)}">${escapeXml(stage)}</text>`,
    )
  })
  p.push('</g>')

  const positions = new Map<string, Pos>()
  for (const node of map.nodes)
    positions.set(node.id, { x: projectX(node.x), y: projectY(node.y), node })

  // Pipelines: a box around the components, the parent square above it.
  if (map.pipelines.length > 0) {
    const boxes: string[] = []
    const joins: string[] = []
    for (const pipeline of map.pipelines) {
      if (pipeline.componentIds.length === 0) continue
      const sorted = pipeline.componentIds
        .map((id) => positions.get(id))
        .filter((c): c is Pos => c !== undefined)
        .sort((a, b) => a.node.x - b.node.x)
      for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i] as Pos
        const b = sorted[i + 1] as Pos
        joins.push(
          `<line class="wardley-pipeline-evolution-link" x1="${n(a.x)}" y1="${n(a.y)}" x2="${n(b.x)}" y2="${n(b.y)}"/>`,
        )
      }
      let minX = Infinity
      let maxX = -Infinity
      let y = 0
      for (const id of pipeline.componentIds) {
        const pos = positions.get(id)
        if (!pos) continue
        minX = Math.min(minX, pos.x)
        maxX = Math.max(maxX, pos.x)
        y = pos.y
      }
      if (minX === Infinity) continue
      const boxPad = 15
      const boxH = r * 4
      const boxTop = y - boxH / 2
      const parent = positions.get(pipeline.nodeId)
      if (parent) {
        parent.x = (minX + maxX) / 2
        parent.y = boxTop - squareSize / 6
      }
      boxes.push(
        `<rect class="wardley-pipeline-box" x="${n(minX - boxPad)}" y="${n(boxTop)}" width="${n(maxX - minX + boxPad * 2)}" height="${n(boxH)}" rx="4" ry="4"/>`,
      )
    }
    p.push(
      '<g class="wardley-pipelines">',
      ...boxes,
      '</g>',
      '<g class="wardley-pipeline-links">',
      ...joins,
      '</g>',
    )
  }

  // Links: trimmed to the node edges; a link inside a pipeline is not drawn.
  const inPipeline = new Map<string, Set<string>>()
  for (const pipeline of map.pipelines)
    inPipeline.set(pipeline.nodeId, new Set(pipeline.componentIds))
  const edge = (node: WardleyNode): number =>
    node.isPipelineParent ? squareSize / Math.SQRT2 : r
  const links: string[] = []
  const labels: string[] = []
  for (const link of map.links) {
    const s = positions.get(link.source)
    const t = positions.get(link.target)
    if (!s || !t || inPipeline.get(link.target)?.has(link.source)) continue
    const dx = t.x - s.x
    const dy = t.y - s.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    // Two nodes on one spot have no direction to draw.
    if (distance === 0) continue
    const cls = `wardley-link${link.dashed ? ' wardley-link--dashed' : ''}`
    const markers =
      (link.flow === 'forward' || link.flow === 'bidirectional'
        ? ` marker-end="url(#${markerEnd})"`
        : '') +
      (link.flow === 'backward' || link.flow === 'bidirectional'
        ? ` marker-start="url(#${markerStart})"`
        : '')
    links.push(
      `<line class="${cls}" x1="${n(s.x + (dx / distance) * edge(s.node))}" y1="${n(s.y + (dy / distance) * edge(s.node))}" x2="${n(t.x - (dx / distance) * edge(t.node))}" y2="${n(t.y - (dy / distance) * edge(t.node))}"${markers}/>`,
    )
    if (link.label) {
      // Beside the middle of the link, turned to run along it and never upside down.
      const lx = (s.x + t.x) / 2 + (dy / distance) * 8
      const ly = (s.y + t.y) / 2 + (-dx / distance) * 8
      let angle = (Math.atan2(dy, dx) * 180) / Math.PI
      if (angle > 90 || angle < -90) angle += 180
      labels.push(
        `<text class="wardley-link-label" x="${n(lx)}" y="${n(ly)}" transform="rotate(${n(angle)} ${n(lx)} ${n(ly)})">${escapeXml(link.label)}</text>`,
      )
    }
  }
  p.push('<g class="wardley-links">', ...links, ...labels, '</g>')

  // Trends (`evolve`): a dashed arrow to the target, stopping short of it.
  const trends: string[] = []
  for (const trend of map.trends) {
    const origin = positions.get(trend.nodeId)
    if (!origin) continue
    const tx = projectX(trend.targetX)
    const ty = projectY(trend.targetY)
    const dx = tx - origin.x
    const dy = ty - origin.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    const short = r + 2
    const x2 = distance > short ? tx - (dx / distance) * short : tx
    const y2 = distance > short ? ty - (dy / distance) * short : ty
    trends.push(
      `<line class="wardley-trend" x1="${n(origin.x)}" y1="${n(origin.y)}" x2="${n(x2)}" y2="${n(y2)}" marker-end="url(#${markerTrend})"/>`,
    )
  }
  p.push('<g class="wardley-trends">', ...trends, '</g>')

  // Nodes.
  p.push('<g class="wardley-nodes">')
  const smallR = r * 0.7
  const triR = r * 1.2
  const cos30 = Math.cos(Math.PI / 6)
  const sin30 = Math.sin(Math.PI / 6)
  for (const node of map.nodes) {
    const pos = positions.get(node.id) as Pos
    const { x, y } = pos
    const anchor = node.kind === 'anchor'
    p.push(
      `<g class="wardley-node${node.kind === 'pipeline-component' ? '' : ` wardley-node--${node.kind}`}${node.kind === 'pipeline-component' ? ' wardley-node--pipeline-component' : ''}">`,
    )
    const overlay = (cls: string): string =>
      `<circle class="${cls}" cx="${n(x)}" cy="${n(y)}" r="${n(r * 2)}"/>`
    if (node.strategy === 'outsource')
      p.push(overlay('wardley-outsource-overlay'))
    if (node.strategy === 'buy') p.push(overlay('wardley-buy-overlay'))
    if (node.strategy === 'build') p.push(overlay('wardley-build-overlay'))
    if (node.strategy === 'market') {
      p.push(overlay('wardley-market-overlay'))
    }
    if (!node.isPipelineParent && node.strategy !== 'market' && !anchor)
      p.push(`<circle cx="${n(x)}" cy="${n(y)}" r="${r}"/>`)
    if (node.strategy === 'market') {
      const pts = [
        [x, y - triR],
        [x - triR * cos30, y + triR * sin30],
        [x + triR * cos30, y + triR * sin30],
      ] as const
      for (let i = 0; i < 3; i++) {
        const a = pts[i] as readonly [number, number]
        const b = pts[(i + 1) % 3] as readonly [number, number]
        p.push(
          `<line class="wardley-market-line" x1="${n(a[0])}" y1="${n(a[1])}" x2="${n(b[0])}" y2="${n(b[1])}"/>`,
        )
      }
      for (const [dx, dy] of pts)
        p.push(
          `<circle class="wardley-market-dot" cx="${n(dx)}" cy="${n(dy)}" r="${n(smallR)}"/>`,
        )
    }
    if (node.isPipelineParent)
      p.push(
        `<rect x="${n(x - squareSize / 2)}" y="${n(y - squareSize / 2)}" width="${n(squareSize)}" height="${n(squareSize)}"/>`,
      )
    if (node.inertia) {
      let off = node.isPipelineParent ? squareSize / 2 + 15 : r + 15
      if (node.strategy) off += r + 10
      const h = node.isPipelineParent ? squareSize : r * 2
      p.push(
        `<line class="wardley-inertia" x1="${n(x + off)}" y1="${n(y - h / 2)}" x2="${n(x + off)}" y2="${n(y + h / 2)}"/>`,
      )
    }
    // Label: an anchor's is centred on it (offset only when given); others sit up and right.
    let lx: number
    let ly: number
    if (anchor) {
      lx = node.labelOffsetX !== undefined ? x + node.labelOffsetX : x
      ly = node.labelOffsetY !== undefined ? y + node.labelOffsetY : y - 3
    } else {
      lx =
        x +
        (node.labelOffsetX ??
          WARDLEY.nodeLabelOffset + (node.strategy ? 10 : 0))
      ly =
        y +
        (node.labelOffsetY ??
          -(WARDLEY.nodeLabelOffset + (node.strategy ? 10 : 0)))
    }
    p.push(
      `<text class="wardley-node-label" x="${n(lx)}" y="${n(ly)}">${escapeXml(node.label)}</text>`,
      '</g>',
    )
  }
  p.push('</g>')

  // Annotations: numbered circles, and the list of their texts in a box.
  if (map.annotations.length > 0) {
    p.push('<g class="wardley-annotations">')
    for (const a of map.annotations)
      p.push(
        `<g class="wardley-annotation"><circle cx="${n(projectX(a.x))}" cy="${n(projectY(a.y))}" r="10"/><text x="${n(projectX(a.x))}" y="${n(projectY(a.y))}">${a.number}</text></g>`,
      )
    if (map.annotationsBox) {
      const boxPad = 10
      const lineH = 16
      const fontSize = 11
      const listed = map.annotations
        .filter((a) => a.text)
        .sort((a, b) => a.number - b.number)
        .map((a) => `${a.number}. ${a.text}`)
      if (listed.length > 0) {
        const widest = Math.max(
          ...listed.map((t) => estimateTextWidth(t, fontSize, 400)),
        )
        const boxW = widest + boxPad * 2 + 105
        // 13: the height Chromium reports for a line of 11px text.
        const boxH = listed.length * lineH + boxPad * 2 + 13 / 2
        const bx = Math.max(
          pad,
          Math.min(projectX(map.annotationsBox.x), width - pad - boxW),
        )
        const by = Math.max(
          pad,
          Math.min(projectY(map.annotationsBox.y), height - pad - boxH),
        )
        p.push(
          '<g class="wardley-annotations-box">',
          `<rect x="${n(bx)}" y="${n(by)}" width="${n(boxW)}" height="${n(boxH)}" rx="4" ry="4"/>`,
          ...listed.map(
            (t, i) =>
              `<text x="${n(bx + boxPad)}" y="${n(by + boxPad + (i + 1) * lineH)}">${escapeXml(t)}</text>`,
          ),
          '</g>',
        )
      }
    }
    p.push('</g>')
  }

  if (map.notes.length > 0) {
    p.push('<g class="wardley-notes">')
    for (const note of map.notes)
      p.push(
        `<text x="${n(projectX(note.x))}" y="${n(projectY(note.y))}">${escapeXml(note.text)}</text>`,
      )
    p.push('</g>')
  }

  // Accelerators point right, deaccelerators left; the name sits under the arrow.
  const arrows = (
    list: WardleyMap['accelerators'],
    cls: string,
    path: (x: number, y: number) => string,
  ): void => {
    if (list.length === 0) return
    p.push(`<g class="${cls}">`)
    for (const a of list) {
      const x = projectX(a.x)
      const y = projectY(a.y)
      p.push(
        `<path d="${path(x, y)}"/>`,
        `<text x="${n(x + 30)}" y="${n(y + 30)}">${escapeXml(a.name)}</text>`,
      )
    }
    p.push('</g>')
  }
  const W = 60
  const H = 15
  const HEAD = 20
  arrows(
    map.accelerators,
    'wardley-accelerators',
    (x, y) =>
      `M ${n(x)} ${n(y - H)} L ${n(x + W - HEAD)} ${n(y - H)} L ${n(x + W - HEAD)} ${n(y - H - 8)} L ${n(x + W)} ${n(y)} L ${n(x + W - HEAD)} ${n(y + H + 8)} L ${n(x + W - HEAD)} ${n(y + H)} L ${n(x)} ${n(y + H)} Z`,
  )
  arrows(
    map.deaccelerators,
    'wardley-deaccelerators',
    (x, y) =>
      `M ${n(x + W)} ${n(y - H)} L ${n(x + HEAD)} ${n(y - H)} L ${n(x + HEAD)} ${n(y - H - 8)} L ${n(x)} ${n(y)} L ${n(x + HEAD)} ${n(y + H + 8)} L ${n(x + HEAD)} ${n(y + H)} L ${n(x + W)} ${n(y + H)} Z`,
  )

  p.push('</g>', '</svg>')
  return p.join('\n')
}
