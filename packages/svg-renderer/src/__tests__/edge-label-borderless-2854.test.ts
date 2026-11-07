/**
 * #2854: mermaid 12.3.0 draws a flowchart/state edge label as a box exactly
 * the size of its text (zero padding) with no border. We drew an 8px-padded
 * box with a 1px stroke and rx=2.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'

function labelRect(svg: string): string {
  const m = svg.match(/<g class="edge-label"[^>]*>\s*(<rect [^>]*\/>)/)
  if (!m) throw new Error('no edge-label rect')
  return m[1]!
}

describe('edge label background (#2854)', () => {
  it.each([
    ['plain', 'flowchart TD\n A -->|yes| B', 1],
    ['multi-line', 'flowchart TD\n A -->|"one<br/>two"| B', 2],
    ['html-ish', 'flowchart TD\n A -->|"<b>bold</b> x"| B', 1],
    ['state', 'stateDiagram-v2\n [*] --> A\n A --> B: go', 1],
  ])('%s: no border, no rounding, tight box', async (_n, src) => {
    const svg = await renderMermaidSVG(src)
    const rect = labelRect(svg)
    expect(rect).not.toMatch(/stroke|rx=|ry=/)
    expect(rect).toContain('fill="var(--bg)"')
  })

  it('box height is exactly the text height (no vertical padding)', async () => {
    const one = labelRect(await renderMermaidSVG('flowchart TD\n A -->|yes| B'))
    const two = labelRect(
      await renderMermaidSVG('flowchart TD\n A -->|"yes<br/>yes"| B'),
    )
    const h = (r: string) => Number(/height="([\d.]+)"/.exec(r)![1])
    expect(h(two)).toBeCloseTo(h(one) * 2, 5)
  })
})
