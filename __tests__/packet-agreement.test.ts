import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { renderMermaidSVG } from '../src/index.ts'

// Mermaid 12.3.0's render of every `Packet:` sample and a set of edge cases
// (scripts: render each source with the real mermaid, keep the SVG minus <style>).
const FIXTURE = JSON.parse(
  readFileSync(
    new URL('./fixtures/packet-official-12.3.0.json', import.meta.url),
    'utf8',
  ),
) as Record<string, { source: string; svg: string }>

interface Shape {
  size: string
  /** Every rect and text, in document order, as `tag attrs | text`. */
  items: string[]
}

const ATTRS = ['x', 'y', 'width', 'height', 'class', 'text-anchor']

/** The geometry both renderers must agree on; colours and styles are ours. */
function shape(svg: string): Shape {
  const vb = /viewBox="([^"]*)"/.exec(svg)![1]!
  const items: string[] = []
  for (const m of svg.matchAll(
    /<(rect|text)\b([^>]*?)\/?>(?:([^<]*)<\/text>)?/g,
  )) {
    const attrs = ATTRS.map((a) => {
      const v = new RegExp(`(?:^|\\s)${a}="([^"]*)"`).exec(m[2]!)?.[1]
      return v === undefined ? '' : `${a}=${v}`
    })
      .filter(Boolean)
      .join(' ')
    const text = (m[3] ?? '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
    // Mermaid always emits the title element, empty without a title.
    if (m[1] === 'text' && text === '' && attrs.includes('packetTitle'))
      continue
    items.push(`${m[1]} ${attrs} | ${text}`)
  }
  return { size: vb, items }
}

describe('packet agrees with mermaid 12.3.0', () => {
  for (const [name, { source, svg }] of Object.entries(FIXTURE)) {
    it(name, () => {
      const ours = shape(renderMermaidSVG(source))
      const theirs = shape(svg)
      expect(ours.items).toEqual(theirs.items)
      expect(ours.size).toBe(theirs.size)
    })
  }
})
