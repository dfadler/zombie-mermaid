import { describe, expect, it } from 'vitest'
import { renderMermaidASCII } from '../index.ts'

// #1457: bundled (fan-in / fan-out) bidirectional start heads sit one cell
// outside the source border, never on it. A fan-in source keeps the same
// exit tee a unidirectional bundled edge has; the head is the next cell out.
const fanIn = 'B <--> A\nC <--> A\nD <--> A'
const fanOut = 'A <--> B\nA <--> C\nA <--> D'

describe('bundled bidirectional start heads (#1457)', () => {
  it('TD fan-in: heads below the sources, border is the plain exit tee', () => {
    const l = renderMermaidASCII(`graph TD\n${fanIn}`).split('\n')
    expect(l[4]).toBe('└─┬─┘     └─┬─┘     └─┬─┘')
    expect(l[5]).toBe('  ▲         ▲         ▲  ')
  })

  it('BT fan-in: heads above the sources', () => {
    const l = renderMermaidASCII(`graph BT\n${fanIn}`).split('\n')
    expect(l[9]).toBe('  ▼         ▼         ▼  ')
    expect(l[10]).toBe('┌─┴─┐     ┌─┴─┐     ┌─┴─┐')
  })

  it('TD/BT fan-out: shared source border stays plain', () => {
    expect(renderMermaidASCII(`graph TD\n${fanOut}`).split('\n')[4]).toBe(
      '          └───┘          ',
    )
    expect(renderMermaidASCII(`graph BT\n${fanOut}`).split('\n')[10]).toBe(
      '          ┌───┐          ',
    )
  })

  it('LR/RL fan-in and fan-out: heads outside the source border', () => {
    const lr = renderMermaidASCII(`graph LR\n${fanIn}`)
    expect(lr).toContain('│ B │◄─┐')
    expect(lr).toContain('│ C │◄─┼─►│ A │')
    const rl = renderMermaidASCII(`graph RL\n${fanOut}`)
    expect(rl).toContain('│ C │◄──────┤')
    expect(rl).toContain('│ B │◄───►│ A │')
  })
})
