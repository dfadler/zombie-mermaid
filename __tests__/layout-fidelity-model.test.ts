import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  latestPerType,
  parseHistory,
  parseScorecard,
} from '../demo/layout-fidelity-model.ts'

describe('parseHistory', () => {
  it('splits per-type and label lines, defaults legacy lines to flowchart', () => {
    const { runs, labels } = parseHistory(
      [
        '{"date":"2026-10-01","commit":"abcdef123","mermaid":"11.17.2","samples":5,"vertical":0.9,"horizontal":1,"containment":null}',
        '{"date":"2026-10-02","commit":"abcdef123","mermaid":"12.2.0","type":"er","samples":2,"vertical":1,"horizontal":1,"containment":null}',
        '{"kind":"label","date":"2026-10-02","commit":"abcdef123","mermaid":"12.2.0","cases":4,"officialAlong":0.5,"asciiAlong":0.525,"meanAbsDelta":0.058}',
        'not json',
        '',
      ].join('\n'),
    )
    expect(runs.map((r) => r.type)).toEqual(['flowchart', 'er'])
    expect(runs[0]!.commit).toBe('abcdef1')
    expect(runs[0]!.containment).toBeNull()
    expect(labels).toHaveLength(1)
    expect(labels[0]!.asciiAlong).toBe(0.525)
  })

  it('reads the committed history without dropping a line', () => {
    const text = readFileSync('layout-fidelity-history.jsonl', 'utf8')
    const lines = text.split('\n').filter(Boolean)
    // Sequence figures (#1686) reach the page through the scorecard's Markdown section.
    const sequence = lines.filter((l) =>
      /"kind":"(sequence|pie|c4|xychart|architecture)"/.test(l),
    ).length
    const { runs, labels } = parseHistory(text)
    expect(runs.length + labels.length + sequence).toBe(lines.length)
    expect(latestPerType(runs).map((r) => r.type)).toContain('flowchart')
  })
})

describe('parseScorecard', () => {
  it('reads headings, joined paragraphs and tables', () => {
    const s = parseScorecard(
      '<!-- x -->\n\n# T\n\nline one\nline two\n\n## A\n\n| a | b |\n| - | - |\n| 1 | 2 |\n',
    )
    expect(s[0]).toMatchObject({
      title: 'T',
      paragraphs: ['line one line two'],
    })
    expect(s[1]!.tables).toEqual([{ header: ['a', 'b'], rows: [['1', '2']] }])
  })

  it('keeps escaped pipes inside one cell', () => {
    const s = parseScorecard(
      '# T\n\n## A\n\n| name | v |\n| - | - |\n| ER (\\|\\|--\\|\\|) | 1 |\n',
    )
    expect(s[1]!.tables[0]!.rows).toEqual([['ER (||--||)', '1']])
  })

  it('finds the committed scorecard sections', () => {
    const titles = parseScorecard(
      readFileSync('docs/layout-fidelity-scorecard.md', 'utf8'),
    ).map((s) => s.title)
    expect(titles).toContain('Edge labels (ASCII)')
    expect(titles).toContain('Per sample')
  })
})
