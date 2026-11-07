// ============================================================================
// Mindmap SVG renderer
//
// Draws a PositionedMindmap (see ./layout.ts) in Mermaid's structure and paint
// order: edges first, then every node (shape, then label). Styling follows
// Mermaid's mindmap styles.ts, mapped onto this library's CSS custom
// properties so every theme applies:
//
//   Mermaid                           here
//   cScale0..10 section fills         --mm-color-0..10: the theme accent and
//                                     getSeriesColor() shades of it, mixed
//                                     into --bg so the label stays readable
//   section-root git0 + white label   --fg fill with a --bg label
//   .section-N line (underline) 3px   the same colour, darker, 3px
//   .edge-depth-N thickness           17 - 3 * (N + 1) px, 3px once not positive
//   labels (HTML, 16px)               <text>, 16px, one line per label line
//
// Mermaid fills with its own hsl colours and picks black or white labels per
// section; here the colours follow the theme (a documented difference).
// ============================================================================

import type {
  PositionedMindmap,
  PositionedMindmapNode,
} from '@zombie-mermaid/mermaid-parser'
import type { DiagramColors, SvgEmitOptions } from '@zombie-mermaid/core'
import {
  svgOpenTag,
  buildStyleBlock,
  styleOpenTag,
  escapeXml,
} from '@zombie-mermaid/core'
import { withDataSrc } from '../renderer.ts'
import { pieColorValue } from '../pie/renderer.ts'
import { MINDMAP } from './layout.ts'

const r = (n: number): string => String(Math.round(n * 100) / 100)

/** Class names a node asks for with `:::`, reduced to safe CSS identifiers. */
function userClasses(className: string | undefined): string {
  if (className === undefined) return ''
  return className
    .split(/\s+/)
    .filter((c) => /^[A-Za-z_][\w-]*$/.test(c))
    .map((c) => ` ${c}`)
    .join('')
}

function mindmapStyles(
  chart: PositionedMindmap,
  colors: DiagramColors,
  nonce?: string,
): string {
  const used = new Set<number>()
  for (const n of chart.nodes) if (n.section !== undefined) used.add(n.section)
  const indices = [...used].sort((a, b) => a - b)
  const vars = indices.map(
    (i) =>
      `    --mm-color-${i}: ${pieColorValue(i, colors.accent, colors.bg)};`,
  )
  const rules = indices.map(
    (i) =>
      `  .mm-s${i} .mm-shape { fill: color-mix(in srgb, var(--mm-color-${i}) 32%, var(--bg)); }\n` +
      `  .mm-s${i} .mm-underline { stroke: var(--mm-color-${i}); }\n` +
      `  .mm-edge.mm-s${i} { stroke: var(--mm-color-${i}); }`,
  )
  return `${styleOpenTag(nonce)}
  .mm-edge { fill: none; }
  .mm-shape { stroke: none; }
  .mm-underline { stroke-width: 3px; }
  .mm-root .mm-shape { fill: var(--fg); }
  .mm-label { fill: var(--_text); font-size: ${MINDMAP.fontSize}px; font-weight: 400; text-anchor: middle; }
  .mm-root .mm-label { fill: var(--bg); }
  .mm-bold { font-weight: 700; }
  .mm-italic { font-style: italic; }
  svg {
${vars.join('\n')}
  }
${rules.join('\n')}
</style>`
}

function renderLabel(n: PositionedMindmapNode): string {
  const top = -n.labelHeight / 2
  const lines = n.lines.map((runs, k) => {
    const y = top + MINDMAP.lineHeight * (k + 0.5)
    const spans = runs
      .map((run) => {
        const cls = `${run.bold ? 'mm-bold' : ''}${run.bold && run.italic ? ' ' : ''}${run.italic ? 'mm-italic' : ''}`
        // Collapsed whitespace at the ends of a line is not drawn.
        const text = escapeXml(run.text)
        return cls === '' ? text : `<tspan class="${cls}">${text}</tspan>`
      })
      .join('')
    return `<text x="0" y="${r(y)}" dy="0.35em" class="mm-label" xml:space="preserve">${spans.trim()}</text>`
  })
  return lines.join('')
}

function renderNode(n: PositionedMindmapNode): string {
  const cls =
    `mm-node ${n.section === undefined ? 'mm-root' : `mm-s${n.section}`}` +
    ` mm-${n.node.shape}${userClasses(n.node.className)}`
  let shape = ''
  if (n.radius !== undefined) {
    shape = `<circle class="mm-shape" r="${r(n.radius)}" cx="0" cy="0"/>`
  } else if (n.rect !== undefined) {
    const { width, height, radius } = n.rect
    shape =
      `<rect class="mm-shape"${radius ? ` rx="${radius}" ry="${radius}"` : ''}` +
      ` x="${r(-width / 2)}" y="${r(-height / 2)}" width="${r(width)}" height="${r(height)}"/>`
  } else if (n.points !== undefined) {
    shape = `<polygon class="mm-shape" points="${n.points}"/>`
  } else if (n.path !== undefined) {
    shape = `<path class="mm-shape" d="${n.path}"/>`
  }
  if (n.underline) {
    const w = n.width / 2
    const y = n.height / 2
    shape += `<line class="mm-underline" x1="${r(-w)}" y1="${r(y)}" x2="${r(w)}" y2="${r(y)}"/>`
  }
  return (
    `<g class="${cls}" data-id="node_${n.node.id}" transform="translate(${r(n.x)}, ${r(n.y)})">` +
    shape +
    renderLabel(n) +
    `</g>`
  )
}

/**
 * Render a positioned mindmap as an SVG string.
 *
 * The accessible name is `title` (from `options.title`) when given; a mindmap
 * has no title statement of its own. Both are dropped when `decorative` is
 * set, see svgOpenTag() in packages/core/src/theme.ts.
 */
export function renderMindmapSvg(
  chart: PositionedMindmap,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
  embedSource?: string,
  title?: string,
  decorative?: boolean,
  emit: SvgEmitOptions = {},
): string {
  const parts: string[] = []
  parts.push(
    withDataSrc(
      svgOpenTag(
        chart.width,
        chart.height,
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
  )
  parts.push(buildStyleBlock(font, false, emit.nonce, emit.bodyFont))
  parts.push(mindmapStyles(chart, colors, emit.nonce))
  parts.push(
    `<g transform="translate(${r(-chart.originX)}, ${r(-chart.originY)})">`,
  )
  parts.push(`<g class="mm-edges">`)
  for (const e of chart.edges) {
    const sw = 17 - 3 * (e.depth + 1)
    parts.push(
      `<path d="${e.path}" class="mm-edge ${e.section === undefined ? '' : `mm-s${e.section}`}"` +
        ` stroke-width="${sw > 0 ? sw : 3}" data-edge="edge_${e.from}_${e.to}"/>`,
    )
  }
  parts.push(`</g>`)
  parts.push(`<g class="mm-nodes">`)
  for (const n of chart.nodes) parts.push(renderNode(n))
  parts.push(`</g></g></svg>`)
  return parts.join('\n')
}
