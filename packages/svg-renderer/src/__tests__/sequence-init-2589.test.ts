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
    const cfg = '{"messageMargin": 120, "mirrorActors": "no", "actorFontSize": 30}'
    expect(renderMermaidSVG(init(cfg))).toBe(renderMermaidSVG(body))
  })

  it('without the raw text the defaults apply', () => {
    const d = parseSequenceDiagram(splitStatements(NO_MIRROR))
    expect(d.mirrorActors).toBeUndefined()
  })
})

describe('sequence hideUnusedParticipants (#2589)', () => {
  const H = (b: string) =>
    `%%{init: {"sequence": {"hideUnusedParticipants": true}}}%%\nsequenceDiagram\n${b}`
  const ids = (b: string) => {
    const t = H(b)
    return parseSequenceDiagram(splitStatements(t), t).actors.map((a) => a.id)
  }
  const decl = '  participant A\n  participant B\n  participant C\n'

  it('drops a participant no message names; keeps one a note or activate names', () => {
    expect(ids(decl + '  A->>B: hi')).toEqual(['A', 'B'])
    expect(ids(decl + '  A->>B: hi\n  Note over C: n')).toEqual(['A', 'B', 'C'])
    expect(ids(decl + '  A->>B: hi\n  activate C')).toEqual(['A', 'B', 'C'])
  })

  it('box membership alone does not keep a participant', () => {
    const t = H(
      '  box Aqua G\n  participant A\n  participant C\n  end\n  A->>A: x',
    )
    const d = parseSequenceDiagram(splitStatements(t), t)
    expect(d.actors.map((a) => a.id)).toEqual(['A'])
    expect(d.boxes[0]!.actorIds).toEqual(['A'])
  })

  it('narrows the SVG and the ASCII output; off by default; empty diagram renders', () => {
    const src = decl + '  A->>B: hi'
    const plain = `sequenceDiagram\n${src}`
    expect(renderMermaidSVG(H(src))).not.toBe(renderMermaidSVG(plain))
    expect(renderMermaidASCII(H(src))).not.toContain('C')
    expect(renderMermaidASCII(plain)).toContain('C')
    expect(() => renderMermaidSVG(H('  participant A'))).not.toThrow()
    expect(() => renderMermaidASCII(H('  participant A'))).not.toThrow()
  })
})
