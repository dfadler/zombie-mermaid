// ============================================================================
// Sankey SVG renderer
//
// Draws a PositionedSankey (see ./layout.ts) in Mermaid's structure: a
// `nodes` group of bars, a `node-labels` group, then a `links` group of
// ribbons (a stroked cubic path whose width is the flow), each filled with a
// source-to-target gradient, the source or target colour, or a fixed colour
// (`linkColor`). Styling follows Mermaid's default theme, mapped onto this
// library's CSS custom properties so every theme applies:
//
//   Mermaid                         here
//   schemeTableau10 node colours    --sankey-color-N: the theme accent, then
//                                   getSeriesColor() shades of it (as pie does)
//   label text                      var(--_text)
//   outlined label halo             var(--bg)
//
// `nodeColors` and a literal `linkColor` are CSS colours and are used as given.
// There is no hover or interactivity: Mermaid has none for this type.
// ============================================================================

import type {
  PositionedSankey,
  PositionedSankeyNode,
} from '@zombie-mermaid/mermaid-parser'
import type { DiagramColors, SvgEmitOptions } from '@zombie-mermaid/core'
import {
  svgOpenTag,
  paletteClass,
  withRootClass,
  buildStyleBlock,
  styleOpenTag,
  escapeXml,
  escapeAttr,
} from '@zombie-mermaid/core'
import { withDataSrc } from '../renderer.ts'
import { pieColorValue } from '../pie/renderer.ts'

/** Mermaid's ordinal scale cycles through ten colours. */
const PALETTE = 10

function r(n: number): string {
  return String(Math.round(n * 100) / 100)
}

function sankeyStyles(
  sk: PositionedSankey,
  colors: DiagramColors,
  nonce?: string,
): { css: string; cls: string } {
  const used = [
    ...new Set(
      sk.nodes
        .filter((n) => n.color === undefined)
        .map((n) => n.index % PALETTE),
    ),
  ].sort((a, b) => a - b)
  const vars = used.map(
    (c) =>
      `    --sankey-color-${c}: ${pieColorValue(c, colors.accent, colors.bg)};`,
  )
  const rules = used.map(
    (c) =>
      `  .sk-f${c} { fill: var(--sankey-color-${c}); }\n` +
      `  .sk-s${c} { stroke: var(--sankey-color-${c}); }\n` +
      `  .sk-t${c} { stop-color: var(--sankey-color-${c}); }`,
  )
  const cls = paletteClass(vars)
  const css = `${styleOpenTag(nonce)}
  .node-labels { fill: var(--_text); }
  .sankey-label-bg { stroke: var(--bg); stroke-width: 4px; stroke-linejoin: round; paint-order: stroke; }
  .sankey-label-fg { fill: var(--_text); }
  .node rect { shape-rendering: crispEdges; }
  .link { fill: none; stroke-opacity: 0.5; mix-blend-mode: multiply; }${
    vars.length > 0 ? `\n  .${cls} {\n${vars.join('\n')}\n  }` : ''
  }
${rules.join('\n')}
</style>`
  return { css, cls }
}

/** `class="sk-f3"` for a theme colour, `fill="red"` for a configured one. */
function paint(
  node: PositionedSankeyNode,
  kind: 'f' | 's' | 't',
  attr: 'fill' | 'stroke' | 'stop-color',
): string {
  return node.color === undefined
    ? ` class="sk-${kind}${node.index % PALETTE}"`
    : ` ${attr}="${escapeAttr(node.color)}"`
}

/**
 * Render a positioned sankey as an SVG string.
 *
 * The accessible name is `title` (from `options.title`, or the diagram's own
 * `accTitle` via the front door); Mermaid's sankey has no visible title.
 * It is dropped when `decorative` is set — see svgOpenTag() in
 * packages/core/src/theme.ts.
 */
export function renderSankeySvg(
  sk: PositionedSankey,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
  embedSource?: string,
  title?: string,
  decorative?: boolean,
  emit: SvgEmitOptions = {},
): string {
  const parts: string[] = []
  const { css, cls } = sankeyStyles(sk, colors, emit.nonce)
  parts.push(
    withDataSrc(
      withRootClass(
        svgOpenTag(
          sk.width,
          sk.height,
          colors,
          transparent,
          title,
          decorative,
          undefined,
          emit.styleAttribute,
          emit.description,
        ),
        cls,
      ),
      embedSource,
    ),
  )
  parts.push(buildStyleBlock(font, false, emit.nonce, emit.bodyFont))
  parts.push(css)

  parts.push('<g class="nodes">')
  for (const n of sk.nodes) {
    parts.push(
      `<g class="node" transform="translate(${r(n.x0)},${r(n.y0)})"><rect height="${r(n.y1 - n.y0)}" width="${r(n.x1 - n.x0)}"${paint(n, 'f', 'fill')}/></g>`,
    )
  }
  parts.push('</g>')

  const dy = sk.options.showValues ? '0' : '0.35'
  const label = (n: PositionedSankeyNode, cls?: string): string =>
    `<text${cls ? ` class="${cls}"` : ''} x="${r(n.label.x)}" y="${r(n.label.y)}" dy="${dy}em" text-anchor="${n.label.anchor}">${escapeXml(n.label.text)}</text>`
  parts.push('<g class="node-labels" font-size="14">')
  if (sk.options.labelStyle === 'outlined') {
    for (const n of sk.nodes) parts.push(label(n, 'sankey-label-bg'))
    for (const n of sk.nodes) parts.push(label(n, 'sankey-label-fg'))
  } else {
    for (const n of sk.nodes) parts.push(label(n))
  }
  parts.push('</g>')

  const mode = sk.options.linkColor
  parts.push('<g class="links" fill="none" stroke-opacity="0.5">')
  sk.links.forEach((l, i) => {
    const s = sk.nodes[l.source]!
    const t = sk.nodes[l.target]!
    const mid = r((l.x0 + l.x1) / 2)
    const d = `M${r(l.x0)},${r(l.y0)}C${mid},${r(l.y0)},${mid},${r(l.y1)},${r(l.x1)},${r(l.y1)}`
    let stroke: string
    let defs = ''
    if (mode === 'gradient') {
      const id = `sankey-link-${i}`
      defs =
        `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${r(l.x0)}" x2="${r(l.x1)}">` +
        `<stop offset="0%"${paint(s, 't', 'stop-color')}/>` +
        `<stop offset="100%"${paint(t, 't', 'stop-color')}/></linearGradient>`
      stroke = ` stroke="url(#${id})"`
    } else if (mode === 'source') stroke = paint(s, 's', 'stroke')
    else if (mode === 'target') stroke = paint(t, 's', 'stroke')
    else stroke = ` stroke="${escapeAttr(mode)}"`
    parts.push(
      `<g class="link">${defs}<path d="${d}"${stroke} stroke-width="${r(Math.max(1, l.width))}"/></g>`,
    )
  })
  parts.push('</g>')
  parts.push('</svg>')
  return parts.join('\n')
}
