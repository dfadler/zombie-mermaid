import { describe, expect, it } from 'vitest'
import { renderMermaidASCII } from '../index.ts'

// #1438: a bidirectional edge's start arrowhead sits in the first stroke
// cell, mirroring the end head, and leaves the source border intact.
describe('bidirectional start arrowhead (#1438)', () => {
  it('TD: head is below A, its border keeps a tee', () => {
    const lines = renderMermaidASCII('graph TD\nA <--> B').split('\n')
    expect(lines[4]).toBe('└─┬─┘')
    expect(lines[5]!.trim()).toBe('▲')
    expect(lines[9]!.trim()).toBe('▼')
  })

  it('BT: head is above A, its border keeps a tee', () => {
    const lines = renderMermaidASCII('graph BT\nA <--> B').split('\n')
    expect(lines[10]).toBe('┌─┴─┐')
    expect(lines[9]!.trim()).toBe('▼')
  })

  it('LR: head is right of A, its border keeps a tee', () => {
    const line = renderMermaidASCII('graph LR\nA <--> B').split('\n')[2]!
    expect(line).toContain('├◄')
    expect(line).toContain('►│')
  })

  it('RL: head is left of A, its border keeps a tee', () => {
    const line = renderMermaidASCII('graph RL\nA <--> B').split('\n')[2]!
    expect(line).toContain('►┤')
    expect(line).toContain('│◄')
  })

  it('LR with a label keeps both heads visible', () => {
    const line = renderMermaidASCII('graph LR\nA <-->|sync| B').split('\n')[2]!
    expect(line).toContain('├◄sync─►│')
  })
})
