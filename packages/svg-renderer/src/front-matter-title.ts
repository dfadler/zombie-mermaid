// Mermaid draws a front matter `title:` above flowchart, state, class and ER
// diagrams (12.3.0: a 54px band, `.<type>TitleText` 18px text centred on the
// diagram at y=-25). Those renderers have no title slot, so the band is added
// to the finished SVG: the viewBox grows upward, nothing else moves.
import { escapeXml, measureTextWidth } from '@zombie-mermaid/core'

const BAND = 54
const SIZE = 18
const BASELINE = -25

export function addFrontMatterTitle(svg: string, title: string): string {
  const tag = /<svg [^>]*>/.exec(svg)![0]
  const [, w, h] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(tag)!
  const width = Number(w)
  const height = Number(h)
  // A title wider than the diagram widens the canvas on both sides.
  const side = Math.max(
    0,
    Math.ceil((measureTextWidth(title, SIZE, 400) - width) / 2),
  )
  const vbW = width + 2 * side
  const vbH = height + BAND
  const next = tag
    .replace(/viewBox="[^"]*"/, `viewBox="${-side} ${-BAND} ${vbW} ${vbH}"`)
    .replace(/ width="[^"]*"/, ` width="${vbW}"`)
    .replace(/ height="[^"]*"/, ` height="${vbH}"`)
  const text =
    `<text x="${width / 2}" y="${BASELINE}" text-anchor="middle" ` +
    `font-size="${SIZE}" fill="var(--_text)" class="front-matter-title">${escapeXml(title)}</text>`
  return svg.replace(tag, next).replace(/<\/svg>\s*$/, `${text}\n</svg>`)
}
