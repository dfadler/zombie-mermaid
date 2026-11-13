/**
 * #2988: a group that is one row of two services sits further above the
 * services below it than mermaid@12.3.0's single-service pitch (200): +15.6px
 * for one outside service, +26.2px for two. Heights are mermaid@12.3.0's
 * viewBox heights (442.6, 453.15). The width stays ~1-2px narrower (#2682).
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII, renderMermaidSVG } from '../index.ts'

const head = `architecture-beta
  group g(cloud)[G]
  service a(server)[A] in g
  service b(database)[B] in g
  service c(disk)[C]
`
const cases = {
  'below the right member': `${head}  a:R -- L:b\n  b:B -- T:c`,
  'below the left member': `${head}  a:R -- L:b\n  a:B -- T:c`,
  'two outside services': `${head}  service d(disk)[D]\n  a:R -- L:b\n  a:B -- T:c\n  b:B -- T:d`,
  // Not fitted: a group of one cell, and a row of three, keep the plain pitch.
  'group of one cell': `architecture-beta
  group g(cloud)[G]
  service a(server)[A] in g
  service c(disk)[C]
  a:B -- T:c`,
  'service in another group below': `architecture-beta
  group g(cloud)[G]
  group h(cloud)[H]
  service a(server)[A] in g
  service b(database)[B] in g
  service c(disk)[C] in h
  a:R -- L:b
  b:B -- T:c`,
  'iconSize off the default': `%%{init: {"architecture": {"iconSize": 60}}}%%\n${head}  a:R -- L:b\n  b:B -- T:c`,
} as const
const heights: Record<keyof typeof cases, number> = {
  'below the right member': 442.6,
  'below the left member': 442.6,
  'two outside services': 453.15,
  'group of one cell': 426.9,
  'service in another group below': NaN, // Only snapshotted.
  'iconSize off the default': NaN, // Only snapshotted.
}
const height = (svg: string): number =>
  Number(/viewBox="\S+ \S+ \S+ (\S+)"/.exec(svg)![1])

describe('architecture group row of two (#2988)', () => {
  for (const [name, src] of Object.entries(cases) as [
    keyof typeof cases,
    string,
  ][]) {
    it(name, () => {
      const svg = renderMermaidSVG(src)
      if (!Number.isNaN(heights[name]))
        expect(Math.abs(height(svg) - heights[name])).toBeLessThan(1)
      expect(svg).toMatchSnapshot('svg')
      expect(renderMermaidASCII(src)).toMatchSnapshot('ascii')
    })
  }
})
