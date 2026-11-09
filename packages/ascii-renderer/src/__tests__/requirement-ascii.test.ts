/**
 * Requirement diagram ASCII/Unicode rendering: boxes, labelled lines and the
 * markers that tell `contains` from the rest. Whole-output snapshots of every
 * gallery sample live in __tests__/__ascii-snapshots__/.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (text: string, useAscii = false, direction?: 'LR') =>
  renderMermaidASCII(text, { colorMode: 'none', useAscii, direction })

const BASIC = `requirementDiagram
requirement test_req {
id: 1
text: the test text.
risk: high
verifymethod: test
}
element test_entity {
type: simulation
}
test_entity - satisfies -> test_req`

describe('requirement ASCII', () => {
  it('draws each box with its type, name and rows', () => {
    const out = render(BASIC)
    for (const line of [
      '<<Requirement>>',
      'test_req',
      'ID: 1',
      'Text: the test text.',
      'Risk: High',
      'Verification: Test',
      '<<Element>>',
      'test_entity',
      'Type: simulation',
    ])
      expect(out, line).toContain(line)
  })

  it('draws the relationship dotted with an arrowhead at the target', () => {
    const out = render(BASIC)
    expect(out).toContain('<<satisfies>>')
    expect(out).toContain('┆')
    // The element is above the requirement, the arrow points down at it.
    expect(out.indexOf('test_entity')).toBeLessThan(out.indexOf('test_req'))
    expect(out).toContain('▼')
  })

  it('draws `contains` solid with a circle at the container', () => {
    const out = render(
      'requirementDiagram\nrequirement a {\n}\nrequirement b {\n}\na - contains -> b',
    )
    expect(out).toContain('<<contains>>')
    expect(out).toContain('●')
    expect(out).not.toContain('┆')
    expect(out).not.toContain('▼')
  })

  it('uses plain characters in ASCII mode', () => {
    const out = render(BASIC, true)
    expect(out).not.toMatch(/[^\x00-\x7f]/)
    expect(out).toContain('<<satisfies>>')
  })

  it('honours `direction LR` and the direction option', () => {
    const rows = (t: string) => t.split('\n').length
    const tb = rows(render(BASIC))
    const lr = rows(
      render(BASIC.replace('requirementDiagram\n', 'requirementDiagram\ndirection LR\n')),
    )
    expect(lr).toBeLessThan(tb)
    expect(rows(render(BASIC, false, 'LR'))).toBe(lr)
  })

  it('draws a bare header as nothing', () => {
    expect(render('requirementDiagram').trim()).toBe('')
  })

  it('paints in colour modes', () => {
    const out = renderMermaidASCII(BASIC, { colorMode: 'truecolor' })
    expect(out).toContain('\u001b[')
  })

  it('draws a front matter title over the diagram', () => {
    const out = render('---\ntitle: My Reqs\n---\n' + BASIC)
    expect(out.split('\n')[0]).toContain('My Reqs')
  })
})
