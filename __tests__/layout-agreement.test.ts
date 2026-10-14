import { describe, it, expect } from 'vitest'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  finishScorecard,
  recordsAllTypes,
  DEFAULT_FLOOR,
  DEFAULT_TOLERANCE,
  SCORECARD_SCHEMA,
  agreement,
  breaches,
  floorFor,
  sampleStatus,
  scorecardJson,
  formatRow,
  isOfType,
  officialNodeName,
  parseOracleArgs,
  worst,
  hasGroups,
  historyLines,
  jsonPayload,
  scorecardMarkdown,
  wantsSample,
  summarize,
  type Box,
  type LayoutBoxes,
} from '../scripts/lib/layout-agreement.ts'

/** A 100x40 box whose centre is at (cx, cy). */
const at = (cx: number, cy: number): Box => ({
  x: cx - 50,
  y: cy - 20,
  w: 100,
  h: 40,
})

const layout = (
  nodes: Record<string, Box>,
  groups: Record<string, Box> = {},
): LayoutBoxes => ({ nodes, groups })

describe('agreement: node pairs', () => {
  const official = layout({ A: at(100, 100), B: at(100, 300), C: at(400, 300) })

  it('is 1 on both axes for the same arrangement, whatever the scale', () => {
    // Twice the size and shifted: only the arrangement matters.
    const ours = layout({ A: at(210, 220), B: at(210, 620), C: at(810, 620) })
    expect(agreement(official, ours)).toEqual({
      vertical: 1,
      horizontal: 1,
      containment: null,
      nodes: 3,
    })
  })

  it('scores each axis on its own', () => {
    // B and C swapped sideways: vertical relations are unchanged.
    const ours = layout({ A: at(100, 100), B: at(400, 300), C: at(100, 300) })
    const a = agreement(official, ours)
    expect(a.vertical).toBe(1)
    // A-B (level to right of), A-C (left of to level) and B-C (left of to
    // right of) all change relation.
    expect(a.horizontal).toBe(0)
  })

  it('counts a flipped order as a disagreement', () => {
    // A below B instead of above it.
    const ours = layout({ A: at(100, 500), B: at(100, 300), C: at(400, 300) })
    const a = agreement(official, ours)
    // A-B and A-C flip; B-C (same row) agrees.
    expect(a.vertical).toBeCloseTo(1 / 3, 5)
    expect(a.horizontal).toBe(1)
  })

  it('treats centres within the tolerance as level, and just past it as not', () => {
    const o = layout({ A: at(100, 100), B: at(300, 100) })
    const within = layout({
      A: at(100, 100),
      B: at(300, 100 + DEFAULT_TOLERANCE),
    })
    const past = layout({
      A: at(100, 100),
      B: at(300, 100 + DEFAULT_TOLERANCE + 1),
    })
    expect(agreement(o, within).vertical).toBe(1)
    expect(agreement(o, past).vertical).toBe(0)
  })

  it('takes the tolerance as an argument', () => {
    const o = layout({ A: at(100, 100), B: at(300, 100) })
    const ours = layout({ A: at(100, 100), B: at(300, 150) })
    expect(agreement(o, ours, 20).vertical).toBe(0)
    expect(agreement(o, ours, 60).vertical).toBe(1)
  })

  it('ignores ids that only one layout has', () => {
    const ours = layout({ A: at(100, 100), B: at(100, 300), Z: at(0, 0) })
    expect(agreement(official, ours).nodes).toBe(2)
  })

  it('has nothing to compare with fewer than two shared nodes', () => {
    const a = agreement(layout({ A: at(0, 0) }), layout({ A: at(0, 0) }))
    expect(a).toEqual({
      vertical: null,
      horizontal: null,
      containment: null,
      nodes: 1,
    })
    expect(agreement(layout({}), layout({})).nodes).toBe(0)
  })
})

describe('agreement: containment', () => {
  const group: Box = { x: 0, y: 0, w: 300, h: 300 }
  const nodes = { A: at(100, 100), B: at(600, 100) }

  it('is 1 when both layouts agree on what is inside', () => {
    const both = layout(nodes, { g: group })
    expect(agreement(both, both).containment).toBe(1)
  })

  it('is lowered by a node that is inside in one layout and outside in the other', () => {
    const official = layout(nodes, { g: group })
    // B is inside the subgraph's box in ours (a non-member swallowed by it).
    const ours = layout({ A: at(100, 100), B: at(200, 100) }, { g: group })
    expect(agreement(official, ours).containment).toBe(0.5)
  })

  it.each([
    ['left', at(-200, 100)],
    ['right', at(700, 100)],
    ['above', at(100, -200)],
    ['below', at(100, 700)],
  ])('treats a node placed %s of the box as outside it', (_side, outside) => {
    const official = layout({ A: at(100, 100) }, { g: group })
    const ours = layout({ A: outside }, { g: group })
    expect(agreement(official, ours).containment).toBe(0)
  })

  it('only counts subgraphs both layouts have', () => {
    const official = layout(nodes, { g: group })
    expect(agreement(official, layout(nodes)).containment).toBeNull()
  })
})

describe('worst', () => {
  it('is the lowest figure that exists', () => {
    expect(
      worst({ vertical: 0.9, horizontal: 0.5, containment: 1, nodes: 4 }),
    ).toBe(0.5)
    expect(
      worst({ vertical: 0.9, horizontal: 0.8, containment: null, nodes: 4 }),
    ).toBe(0.8)
  })

  it('is null when there is nothing to score', () => {
    expect(
      worst({ vertical: null, horizontal: null, containment: null, nodes: 1 }),
    ).toBeNull()
  })
})

describe('parseOracleArgs', () => {
  it('has defaults', () => {
    expect(parseOracleArgs([])).toEqual({
      tolerance: DEFAULT_TOLERANCE,
      type: 'flowchart',
      layout: 'elk',
      thresholds: false,
      help: false,
    })
  })

  it('reads --layout and rejects an unknown engine', () => {
    expect(parseOracleArgs(['--layout=simple']).layout).toBe('simple')
    expect(() => parseOracleArgs(['--layout=dagre'])).toThrow(/elk or simple/)
    expect(() => parseOracleArgs(['--layout=simple', '--type=state'])).toThrow(
      /only lays out flowcharts/,
    )
  })

  it('refuses --layout=simple with --history or --scorecard', () => {
    for (const flag of ['--history=h.jsonl', '--scorecard=s.md']) {
      expect(() => parseOracleArgs(['--layout=simple', flag])).toThrow(
        /record the elk layout only/,
      )
    }
    expect(parseOracleArgs(['--layout=elk', '--history=h.jsonl']).layout).toBe(
      'elk',
    )
  })

  it('wantsSample matches type and a case-insensitive title filter', () => {
    const s = { title: 'State: Notes', source: 'stateDiagram-v2\n  A --> B' }
    expect(wantsSample(s, 'state')).toBe(true)
    expect(wantsSample(s, 'class')).toBe(false)
    expect(wantsSample(s, 'state', 'notes')).toBe(true)
    expect(wantsSample(s, 'state', 'xyz')).toBe(false)
  })

  it('reads each option', () => {
    expect(
      parseOracleArgs([
        '--filter=ci',
        '--json=out.json',
        '--fail-below=75',
        '--tolerance=30',
      ]),
    ).toEqual({
      filter: 'ci',
      json: 'out.json',
      failBelow: 75,
      tolerance: 30,
      type: 'flowchart',
      layout: 'elk',
      thresholds: false,
      help: false,
    })
  })

  it('reads help in either form', () => {
    expect(parseOracleArgs(['-h']).help).toBe(true)
    expect(parseOracleArgs(['--help']).help).toBe(true)
  })

  it('ignores the bare -- that `pnpm run script -- --flag` forwards', () => {
    expect(parseOracleArgs(['--', '--filter=ci']).filter).toBe('ci')
  })

  it('keeps an = inside a value', () => {
    expect(parseOracleArgs(['--filter=a=b']).filter).toBe('a=b')
  })

  it.each([
    [['--nope=1'], 'Unknown argument'],
    [['positional'], 'Unknown argument'],
    [['--fail-below='], 'non-negative number'],
    [['--fail-below=abc'], 'non-negative number'],
    [['--fail-below=-5'], 'non-negative number'],
    [['--fail-below=101'], 'percentage'],
    [['--tolerance=-1'], 'non-negative number'],
    [['--scorecard-json='], 'needs a file path'],
  ])('rejects %j', (argv, message) => {
    expect(() => parseOracleArgs(argv)).toThrow(message)
  })

  it('accepts the bounds of --fail-below', () => {
    expect(parseOracleArgs(['--fail-below=0']).failBelow).toBe(0)
    expect(parseOracleArgs(['--fail-below=100']).failBelow).toBe(100)
  })
})

describe('formatRow', () => {
  it('shows percentages, a dash for a missing figure, and the subgraph marker', () => {
    const row = formatRow(
      'CI/CD Pipeline',
      { vertical: 0.476, horizontal: 0.524, containment: null, nodes: 7 },
      true,
    )
    expect(row).toContain(' 48%')
    expect(row).toContain(' 52%')
    expect(row).toContain('  - ')
    expect(row).toContain(' sg ')
    expect(row.endsWith('CI/CD Pipeline')).toBe(true)
  })

  it('omits the marker without subgraphs', () => {
    const row = formatRow(
      'Simple',
      { vertical: 1, horizontal: 1, containment: null, nodes: 3 },
      false,
    )
    expect(row).not.toContain('sg')
  })
})

describe('summarize / scorecardMarkdown (#1572)', () => {
  const r = (v: number | null, h: number | null, c: number | null) => ({
    vertical: v,
    horizontal: h,
    containment: c,
    nodes: 3,
    subgraphs: false,
  })
  const meta = {
    date: '2026-10-10',
    commit: 'abcdef123',
    tolerance: 20,
    type: 'flowchart' as const,
    mermaid: '12.1.0',
  }

  it('means ignore null figures', () => {
    const e = summarize({ a: r(1, null, null), b: r(0.5, null, null) }, meta)
    expect(e).toMatchObject({ samples: 2, vertical: 0.75, horizontal: null })
  })

  it('scorecard lists lowest sample first and escapes pipes', () => {
    const results = { 'hi|gh': r(1, 1, 1), low: r(0.2, 1, 1) }
    const entry = summarize(results, meta)
    const md = scorecardMarkdown([{ entry, results }], [entry])
    expect(md.indexOf('| low |')).toBeLessThan(md.indexOf('hi\\|gh'))
  })

  it('scorecard names samples the oracle errored on', () => {
    const results = { ok: r(1, 1, 1) }
    const entry = summarize(results, meta)
    const sampled = ['ok', 'broken']
    expect(scorecardMarkdown([{ entry, results, sampled }], [entry])).toContain(
      'Not scored (the oracle errored): broken.',
    )
    expect(scorecardMarkdown([{ entry, results }], [entry])).not.toContain(
      'Not scored',
    )
  })

  it('scorecard treats untyped, unversioned entries as 11.17.2 flowcharts and sorts no-figure samples last (#1905)', () => {
    const results = {
      none: r(null, null, null),
      high: r(1, 1, 1),
      none2: r(null, null, null),
      low: r(0.5, 1, null),
    }
    const { type: _t, mermaid: _m, ...legacy } = summarize(results, meta)
    const md = scorecardMarkdown([{ entry: legacy, results }], [legacy])
    expect(md).toContain('Reference: mermaid 11.17.2.')
    expect(md).toContain('| Flowchart | 4 |')
    expect(md).toContain('### Flowchart (lowest first)')
    const at = (s: string) => md.indexOf(`| ${s} |`)
    expect(at('low')).toBeLessThan(at('high'))
    expect(at('high')).toBeLessThan(at('none'))
  })

  it('helpers: group detection, json payload, history lines (#1905)', () => {
    expect(hasGroups('flowchart', 'graph TD\n subgraph S\n a\n end')).toBe(true)
    expect(hasGroups('state', 'stateDiagram-v2\n state X {\n a\n }')).toBe(true)
    expect(hasGroups('class', 'classDiagram\n namespace N {\n }')).toBe(true)
    expect(hasGroups('er', 'erDiagram\n subgraph')).toBe(false)
    expect(hasGroups('flowchart', 'graph TD\n a-->b')).toBe(false)
    const results = { a: r(1, 1, 1) }
    const entry = summarize(results, meta)
    expect(JSON.parse(jsonPayload([{ entry, results }]))).toEqual(results)
    const er = summarize(results, { ...meta, type: 'er' })
    expect(
      JSON.parse(
        jsonPayload([
          { entry, results },
          { entry: er, results },
        ]),
      ),
    ).toEqual({ flowchart: results, er: results })
    expect(historyLines([entry, er]).split('\n')).toHaveLength(3)
    expect(historyLines([entry]).endsWith('\n')).toBe(true)
  })

  it('scorecard names the reference version and lists every type (#1905)', () => {
    const results = { a: r(1, 1, null) }
    const er = summarize(results, { ...meta, type: 'er' })
    const legacy = { ...summarize(results, meta) } as Partial<typeof er>
    delete legacy.mermaid
    delete legacy.type
    const md = scorecardMarkdown(
      [
        { entry: summarize(results, meta), results },
        { entry: er, results },
      ],
      [legacy as typeof er, er],
    )
    expect(md).toContain('Reference: mermaid 12.1.0')
    expect(md).toContain('| Flowchart | 1 |')
    expect(md).toContain('| ER | 1 |')
    expect(md).toContain('### ER (lowest first)')
    // A pre-#1905 history line has no version or type: it was 11.17.2 flowcharts.
    expect(md).toContain('| 11.17.2 | Flowchart | 1 |')
  })
})

describe('oracle diagram types (#1707)', () => {
  it('picks state and flowchart sources apart', () => {
    expect(isOfType('stateDiagram-v2\n  [*] --> A', 'state')).toBe(true)
    expect(isOfType('stateDiagram\n  [*] --> A', 'state')).toBe(true)
    expect(isOfType('graph TD\n  A-->B', 'state')).toBe(false)
    expect(isOfType('flowchart LR\n  A-->B', 'flowchart')).toBe(true)
    expect(isOfType('classDiagram\n  class A', 'class')).toBe(true)
    expect(isOfType('classDiagram-v2\n  class A', 'class')).toBe(true)
    expect(isOfType('erDiagram\n  A ||--o{ B : x', 'er')).toBe(true)
    expect(isOfType('erDiagram\n  A ||--o{ B : x', 'class')).toBe(false)
    expect(isOfType('stateDiagram-v2\n  [*] --> A', 'flowchart')).toBe(false)
  })

  it('maps mermaid state element ids (fixture from mermaid output) to ours', () => {
    const ids = [
      'p1-state-root_start-0',
      'p1-state-Idle-6',
      'p1-state-Processing-5',
      'p1-state-root_end-7',
      'p1-state-my-state-3',
    ]
    expect(ids.map((i) => officialNodeName(i, 'p1', 'state'))).toEqual([
      '_start',
      'Idle',
      'Processing',
      '_end',
      'my-state',
    ])
  })

  it('keeps the flowchart mapping', () => {
    expect(officialNodeName('p1-flowchart-A-0', 'p1', 'flowchart')).toBe('A')
    expect(officialNodeName('flowchart-a-b-12', 'p1', 'flowchart')).toBe('a-b')
    expect(officialNodeName('p1-classId-Animal-0', 'p1', 'class')).toBe(
      'Animal',
    )
    expect(officialNodeName('p1-entity-LOG_ENTRY-1', 'p1', 'er')).toBe(
      'LOG_ENTRY',
    )
    expect(officialNodeName('classId-a-b-3', 'p1', 'class')).toBe('a-b')
    // A flowchart-prefixed id is not a class node id.
    expect(officialNodeName('p1-flowchart-A-0', 'p1', 'class')).toBe(
      'p1-flowchart-A',
    )
  })

  it('parses --type and rejects other values', () => {
    expect(parseOracleArgs([]).type).toBe('flowchart')
    expect(parseOracleArgs(['--type=state']).type).toBe('state')
    expect(parseOracleArgs(['--type=class']).type).toBe('class')
    expect(parseOracleArgs(['--type=er']).type).toBe('er')
    expect(() => parseOracleArgs(['--type=pie'])).toThrow(/--type/)
  })
})

describe('thresholds and machine-readable scorecard', () => {
  const ag = (v: number | null, h: number | null, c: number | null = null) => ({
    vertical: v,
    horizontal: h,
    containment: c,
    nodes: 3,
  })
  const run = (
    results: Record<string, ReturnType<typeof ag> & { subgraphs: boolean }>,
    sampled: string[] = Object.keys(results),
  ) => ({
    results,
    sampled,
    entry: summarize(results, {
      date: '2026-10-14',
      commit: 'abc1234567',
      tolerance: 20,
      type: 'class' as const,
      mermaid: '12.1.0',
    }),
  })

  it('applies the default floor, per-sample overrides, and the boundary', () => {
    expect(floorFor('Anything new')).toBe(DEFAULT_FLOOR)
    expect(floorFor('Class: MVC Architecture')).toBe(0.65)
    expect(sampleStatus('x', ag(1, DEFAULT_FLOOR))).toBe('pass')
    expect(sampleStatus('x', ag(1, DEFAULT_FLOOR - 0.01))).toBe('fail')
    expect(sampleStatus('Class: MVC Architecture', ag(1, 0.67))).toBe('pass')
    expect(sampleStatus('x', ag(null, null))).toBe('n/a')
    // 0.9 as a float sum must still meet a floor of 0.9.
    expect(sampleStatus('x', ag(1, 0.1 + 0.8), 0.9)).toBe('pass')
  })

  it('lists breaches and unexpected errors, not expected ones or n/a', () => {
    const r = run(
      {
        ok: { ...ag(1, 1), subgraphs: false },
        low: { ...ag(1, 0.5), subgraphs: false },
        single: { ...ag(null, null), subgraphs: false },
      },
      ['ok', 'low', 'single', 'zombie-mermaid', 'broke'],
    )
    expect(breaches([r])).toEqual(['low (50% < 85%)', 'broke (error)'])
    expect(breaches([run({ ok: { ...ag(1, 1), subgraphs: false } })])).toEqual(
      [],
    )
  })

  it('writes a stable, sorted, rounded JSON scorecard', () => {
    const r = run({
      b: { ...ag(1, 2 / 3), subgraphs: true },
      a: { ...ag(1, 1), subgraphs: false },
    })
    const json = JSON.parse(scorecardJson([r]))
    expect(json.schema).toBe(SCORECARD_SCHEMA)
    expect(json.mermaid).toBe('12.1.0')
    expect(Object.keys(json.excluded)).toContain('sequence')
    const titles = json.types.class.samples.map(
      (s: { title: string }) => s.title,
    )
    expect(titles).toEqual(['a', 'b'])
    expect(json.types.class.samples[1]).toMatchObject({
      horizontal: 0.6667,
      floor: DEFAULT_FLOOR,
      status: 'fail',
    })
    expect(json.types.class.passing).toBe(1)
    expect(json.types.class.failing).toBe(1)
    expect(scorecardJson([r])).toBe(scorecardJson([r]))
  })

  it('finishScorecard writes the JSON and returns breaches only under --thresholds', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'oracle-'))
    const file = join(dir, 'sc.json')
    const r = run({ low: { ...ag(1, 0.5), subgraphs: false } })
    const none = parseOracleArgs([])
    expect(recordsAllTypes(none)).toBe(false)
    expect(await finishScorecard(none, [r])).toEqual([])
    const asked = parseOracleArgs(['--thresholds', `--scorecard-json=${file}`])
    expect(recordsAllTypes(asked)).toBe(true)
    expect(await finishScorecard(asked, [r])).toEqual(['low (50% < 85%)'])
    expect(JSON.parse(readFileSync(file, 'utf8')).schema).toBe(SCORECARD_SCHEMA)
  })

  it('parses --thresholds and --scorecard-json, refusing the simple layout', () => {
    const a = parseOracleArgs(['--thresholds', '--scorecard-json=x.json'])
    expect(a.thresholds).toBe(true)
    expect(a.scorecardJson).toBe('x.json')
    expect(() => parseOracleArgs(['--thresholds', '--layout=simple'])).toThrow(
      /elk layout only/,
    )
  })

  it('the markdown shows each floor and status and the excluded types', () => {
    const md = scorecardMarkdown(
      [run({ 'Class: MVC Architecture': { ...ag(1, 0.5), subgraphs: false } })],
      [],
    )
    expect(md).toContain('| 50% | - | 3 | 65% | fail |')
    expect(md).toContain('## Diagram types not scored')
    expect(md).toContain('**sequence**')
  })
})
