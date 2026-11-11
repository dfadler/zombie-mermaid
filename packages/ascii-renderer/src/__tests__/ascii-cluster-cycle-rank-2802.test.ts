/**
 * A cycle through a cluster boundary (`S --> X --> B`, B inside S) ranks
 * differently by declaration order, in mermaid@12.3.0 too (#2802, #2800).
 * Measured headless (node y; 12.3.0 and the 12.2.0 pin agree):
 *
 *   R, T:  R 36  T 124  X 124  A 273  B 381   X beside T, above A
 *   T, R:  T 36  A 185  B 293  R 317  X 405   X below B
 *
 * The two orders are not meant to rank alike. Both match with ELK hints (what
 * the CLI and root entry use) and on the plain grid. For R, T mermaid breaks the
 * cycle at `S --> X`, so X ranks above the cluster and T, a source with only
 * that cluster below it, sits beside X; `computeMinLevels` does the same (#3001).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { registerAsciiLayout } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidASCII } from '../index.ts'
import { renderMermaidSVG } from '../../../svg-renderer/src/index.ts'
import { asciiLayoutProvider } from '../../../../src/ascii-layout-provider.ts'

const src = (first: string, second: string): string => `flowchart TD
  ${first}
  ${second}
  subgraph S
    A --> B
  end
  R --> X
  T --> A
  X --> B
  S --> X`

const RT = src('R', 'T')
const TR = src('T', 'R')

const draw = (s: string, hints: boolean): string => {
  registerAsciiLayout(hints ? asciiLayoutProvider : undefined)
  return renderMermaidASCII(s, { colorMode: 'none' })
}
afterEach(() => registerAsciiLayout(undefined))

// Row of the box line that carries the label.
const rowOf = (out: string, label: string): number =>
  out
    .split('\n')
    .findIndex((l) => l.split('│').some((cell) => cell.trim() === label))

// Column of the box line that carries the label.
const colOf = (out: string, label: string): number => {
  const line = out.split('\n')[rowOf(out, label)]!
  return line.indexOf(label)
}

// mermaid@12.3.0 (node x): T 112, R 304, X 304, so T is left of R, X under R.
const rUnderXTLeft = (out: string): void => {
  expect(colOf(out, 'R')).toBe(colOf(out, 'X'))
  expect(colOf(out, 'T')).toBeLessThan(colOf(out, 'R'))
}

const xBesideTAboveA = (out: string): void => {
  const [x, t, a] = ['X', 'T', 'A'].map((l) => rowOf(out, l)) as number[]
  expect(x).toBeGreaterThanOrEqual(0)
  expect(x).toBe(t)
  expect(x).toBeLessThan(a!)
}
const xBelowB = (out: string): void => {
  expect(rowOf(out, 'B')).toBeGreaterThan(0)
  expect(rowOf(out, 'X')).toBeGreaterThan(rowOf(out, 'B'))
}

describe('cluster-boundary cycle ranks as mermaid@12.3.0 (#2802)', () => {
  it('R, T with ELK hints: X beside T, above A', () => {
    xBesideTAboveA(draw(RT, true))
  })
  it('T, R with ELK hints: X below B', () => {
    xBelowB(draw(TR, true))
  })
  it('T, R on the grid: X below B', () => {
    xBelowB(draw(TR, false))
  })
  it('R, T on the grid: X beside T, above A', () => {
    xBesideTAboveA(draw(RT, false))
  })

  // An isolated node has no child to sit above, so it stays on the first row.
  it('R, T on the grid with an isolated node: Z stays on the first row', () => {
    const out = draw(`${RT}\n  Z`, false)
    expect(out.split('\n')[2]).toMatch(/R.*Z/)
    xBesideTAboveA(out)
  })

  it('R, T on the grid: R above X, T to their left', () => {
    rUnderXTLeft(draw(RT, false))
  })

  // mermaid@12.3.0 draws `S --> X` from the cluster's bottom, round its right
  // side, into X's bottom, and `X --> B` into B's top (#3034). The ELK-hints
  // output draws exactly that, so the grid must equal it.
  it('R, T on the grid: S --> X goes round the cluster, as the ELK hints draw it', () => {
    const out = draw(RT, false)
    expect(out).toBe(draw(RT, true))
    // B's right face starts the edge; X's bottom face receives it.
    expect(out).toMatch(/│ +B +├/)
    expect(out.split('\n')[rowOf(out, 'X') + 3]).toMatch(/▲/)
  })

  it('R, T on the grid with an isolated node: S --> X still goes round the cluster', () => {
    const out = draw(`${RT}\n  Z`, false)
    expect(out).toMatch(/│ +B +├/)
  })

  it.each([
    ['R, T', RT],
    ['T, R', TR],
  ])('snapshots SVG and ASCII (grid and ELK hints) for %s', (_n, s) => {
    expect(renderMermaidSVG(s)).toMatchSnapshot('svg')
    expect(draw(s, false)).toMatchSnapshot('ascii-grid')
    expect(draw(s, true)).toMatchSnapshot('ascii-hints')
  })
})
