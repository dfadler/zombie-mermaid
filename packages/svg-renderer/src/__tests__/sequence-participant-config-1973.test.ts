/**
 * #1973 / #2059: `participant X@{ "type": ... }` draws Mermaid 12's six
 * participant kinds. The SVG tests build the diagram by hand (no parser);
 * ASCII takes source text, so its tests go through the parser.
 */
import { describe, it, expect } from 'vitest'
import type { SequenceDiagram } from '@zombie-mermaid/mermaid-parser'
import { renderMermaidASCII } from '../../../../src/index.ts'
import { layoutSequenceDiagram } from '../sequence/layout.ts'
import { renderSequenceSvg } from '../sequence/renderer.ts'

const svgFor = (participantType?: string): string => {
  const d: SequenceDiagram = {
    actors: [
      {
        id: 'A',
        label: 'Alpha',
        type: 'participant',
        ...(participantType && { participantType }),
      },
      { id: 'B', label: 'Beta', type: 'participant' },
    ],
    messages: [
      {
        from: 'A',
        to: 'B',
        label: 'hi',
        lineStyle: 'solid',
        arrowHead: 'filled',
      },
    ],
    blocks: [],
    notes: [],
    activations: [],
    boxes: [],
  } as unknown as SequenceDiagram
  return renderSequenceSvg(layoutSequenceDiagram(d), { bg: '#fff', fg: '#000' })
}

/** The `<g class="actor" data-id="A">` group of the typed participant. */
const actorA = (svg: string): string =>
  /<g class="actor" data-id="A"[\s\S]*?\n<\/g>/.exec(svg)![0]

describe('participant @{ type } SVG', () => {
  const plain = actorA(svgFor())

  it('plain participant is a single rounded rect', () => {
    expect(plain).toContain('<rect')
    expect(plain).not.toContain('<circle')
  })

  it.each([
    ['boundary', ['<circle', 'M1 6V18M1 12H7']],
    ['control', ['<circle', 'M13 1L10 4L13 7']],
    ['entity', ['<circle', 'M3 22H21']],
    ['database', ['A10 3.5 0 0 1 22 5V19', 'A10 3.5 0 0 0 22 5']],
  ])('%s is an icon with the label below it', (type, marks) => {
    const g = actorA(svgFor(type))
    for (const m of marks) expect(g).toContain(m)
    expect(g).not.toContain('<rect')
    expect(g).toContain('scale(')
    expect(g).toContain('Alpha')
  })

  it('collections stacks two boxes', () => {
    expect(actorA(svgFor('collections')).match(/<rect/g)).toHaveLength(2)
  })

  it('queue is a horizontal cylinder', () => {
    const g = actorA(svgFor('queue'))
    expect(g).not.toContain('<rect')
    expect(g).toContain('A8,20 0 0 1')
  })

  it('unknown types keep the plain box', () => {
    expect(actorA(svgFor('bogus'))).toBe(plain)
  })

  it('uses theme tokens only', () => {
    for (const t of ['boundary', 'control', 'entity', 'database', 'queue']) {
      const g = actorA(svgFor(t))
      expect(g).toContain('var(--_node-stroke)')
      expect(g).not.toMatch(/#[0-9a-f]{3,6}/i)
    }
  })
})

describe('participant @{ type } ASCII', () => {
  const marker = (type: string, ascii: boolean): string =>
    renderMermaidASCII(
      `sequenceDiagram\n  participant A@{ "type": "${type}" }\n  A->>A: x`,
      { useAscii: ascii },
    )

  it.each([
    ['boundary', '|-O'],
    ['control', '(@)'],
    ['entity', '_O_'],
    ['database', '(_)'],
    ['collections', '[[]]'],
    ['queue', '>>>'],
  ])('%s draws the %s marker in both charsets', (type, glyph) => {
    expect(marker(type, false)).toContain(glyph)
    expect(marker(type, true)).toContain(glyph)
  })

  it('unknown types keep the plain box', () => {
    expect(marker('bogus', false)).toBe(
      renderMermaidASCII('sequenceDiagram\n  participant A\n  A->>A: x'),
    )
  })
})
