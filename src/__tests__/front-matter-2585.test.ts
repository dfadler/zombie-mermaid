import { describe, it, expect } from 'vitest'
import {
  renderMermaidSVG,
  renderMermaidASCII,
  validateMermaid,
} from '../index.ts'
import { stripFrontMatter, splitStatements } from '@zombie-mermaid/core'

const fm = '---\ntitle: T\n---\n'
const bodies: Record<string, string> = {
  flowchart: 'flowchart TD\n  A-->B',
  sequence: 'sequenceDiagram\n  A->>B: hi',
  class: 'classDiagram\n  A <|-- B',
  er: 'erDiagram\n  A ||--o{ B : has',
  pie: 'pie\n  "a": 1\n  "b": 2',
  state: 'stateDiagram-v2\n  [*] --> A',
  c4: 'C4Context\n  Person(a, "A")',
  architecture: 'architecture-beta\n  service a(server)[A]',
}

describe('front matter (#2585)', () => {
  for (const [name, body] of Object.entries(bodies)) {
    it(`${name}: same output with and without front matter`, () => {
      expect(renderMermaidSVG(fm + body)).toBe(renderMermaidSVG(body))
      expect(renderMermaidASCII(fm + body)).toBe(renderMermaidASCII(body))
    })
  }

  it('config: maps to the init directive', () => {
    const body = 'flowchart TD\n  A-->B\n  A-->C'
    const viaFm = renderMermaidSVG(
      '---\nconfig:\n  flowchart:\n    curve: stepAfter\n---\n' + body,
    )
    const viaInit = renderMermaidSVG(
      `%%{init: {"flowchart": {"curve": "stepAfter"}}}%%\n` + body,
    )
    expect(viaFm).toBe(viaInit)
    expect(viaFm).not.toBe(renderMermaidSVG(body))
  })

  it('keeps line numbers for errors after the block', () => {
    expect(() =>
      validateMermaid(fm + 'erDiagram\n  A ||--o{ B\n  ???'),
    ).toThrow(/Line 5: ER relationship/)
  })

  it('unterminated block errors at the opening fence', () => {
    expect(() =>
      renderMermaidSVG('---\ntitle: T\nflowchart TD\nA-->B'),
    ).toThrow(/Line 1: Unterminated front matter/)
  })

  it('matches mermaid 12.3.0: block must start at character 0 and be non-empty', () => {
    for (const src of [
      '\n---\nt: 1\n---\nflowchart TD',
      '---\n---\nflowchart TD',
    ]) {
      expect(stripFrontMatter(src)).toBe(src)
      expect(() => renderMermaidSVG(src)).toThrow(/Invalid mermaid header/)
    }
  })

  it('a lone fence is unterminated', () => {
    expect(() => stripFrontMatter('---')).toThrow(/Line 1: Unterminated/)
  })

  it('only a leading block counts; yaml oddities and CRLF are tolerated', () => {
    expect(stripFrontMatter('')).toBe('')
    expect(stripFrontMatter('flowchart TD\n---\nx\n---')).toBe(
      'flowchart TD\n---\nx\n---',
    )
    const crlf = '---\r\ntitle: T\r\n---\r\nflowchart TD\r\nA-->B'
    expect(splitStatements(crlf)[0]!.text).toBe('flowchart TD')
    const odd =
      '---\n# c\n\ntitle: T\nconfig:\n  bad line\n  theme: "dark"\n  a:\n    b: 1 # n\n    c: true\n  d: x\nother:\n  k: v\n---\nflowchart TD'
    expect(stripFrontMatter(odd).split('\n')[0]).toBe(
      '%%{init: {"theme":"dark","a":{"b":1,"c":true},"d":"x"}}%%',
    )
  })
})
