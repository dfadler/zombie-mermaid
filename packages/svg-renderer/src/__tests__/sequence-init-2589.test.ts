/**
 * #2589: `%%{init: {"sequence": {...}}}%%` honours `mirrorActors: false` (no
 * participant row under the lifelines) and `showSequenceNumbers: true`
 * (= `autonumber`). Checked against mermaid 12.3.0; the other sequence keys
 * are listed in docs/known-differences.md.
 */
import { describe, it, expect } from 'vitest'
import { parseSequenceDiagram } from '@zombie-mermaid/mermaid-parser'
import { splitStatements } from '@zombie-mermaid/core'
import { renderMermaidASCII, renderMermaidSVG } from '../../../../src/index.ts'

const body = `sequenceDiagram
  box Aqua Grp
  participant A as Alice
  participant B as Bob
  end
  A->>B: Hello
  B-->>A: Hi`
const init = (cfg: string) => `%%{init: {"sequence": ${cfg}}}%%\n${body}`
const NO_MIRROR = init('{"mirrorActors": false}')

describe('sequence %%{init}%% (#2589)', () => {
  it('mirrorActors: false drops the footer row in SVG', () => {
    const base = renderMermaidSVG(body)
    const svg = renderMermaidSVG(NO_MIRROR)
    expect(base.match(/actor-footer/g)?.length).toBeGreaterThan(0)
    expect(svg).not.toContain('actor-footer')
    const h = (s: string) => Number(/viewBox="0 0 \S+ (\S+)"/.exec(s)![1])
    expect(h(svg)).toBeLessThan(h(base))
  })

  it('mirrorActors: false drops the footer row and bracket in ASCII', () => {
    const base = renderMermaidASCII(body).trimEnd().split('\n')
    const out = renderMermaidASCII(NO_MIRROR).trimEnd().split('\n')
    expect(out.filter((l) => l.includes('Alice'))).toHaveLength(1)
    expect(base.filter((l) => l.includes('Alice'))).toHaveLength(2)
    expect(out.length).toBeLessThan(base.length)
  })

  it('mirrorActors: true keeps the footer', () => {
    expect(renderMermaidSVG(init('{"mirrorActors": true}'))).toBe(
      renderMermaidSVG(body),
    )
  })

  it('showSequenceNumbers: true numbers messages like autonumber', () => {
    const d = parseSequenceDiagram(
      splitStatements(init('{"showSequenceNumbers": true}')),
      init('{"showSequenceNumbers": true}'),
    )
    expect(d.messages.map((m) => m.seqNumber)).toEqual([1, 2])
    expect(renderMermaidSVG(init('{"showSequenceNumbers": true}'))).not.toBe(
      renderMermaidSVG(body),
    )
  })

  it('other keys and non-boolean values are ignored', () => {
    const cfg = '{"actorMargin": 120, "mirrorActors": "no", "wrap": true}'
    expect(renderMermaidSVG(init(cfg))).toBe(renderMermaidSVG(body))
  })

  it('without the raw text the defaults apply', () => {
    const d = parseSequenceDiagram(splitStatements(NO_MIRROR))
    expect(d.mirrorActors).toBeUndefined()
  })
})
