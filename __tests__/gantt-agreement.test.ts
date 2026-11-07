import { describe, expect, it } from 'vitest'
import {
  ganttMismatches,
  ourGantt,
  parseOfficialGantt,
} from '../scripts/lib/gantt-agreement.ts'

const SRC = `gantt
    title T
    dateFormat YYYY-MM-DD
    todayMarker off
    section S
    A :a, 2024-01-01, 10d
    B :b, 2024-01-03, 3d`

// Trimmed from mermaid 12.3.0's render of SRC at width 1264.
const OFFICIAL = `<svg id="g_0" viewBox="0 0 1264 148"><style>x</style><g></g><g></g><g class="grid" transform="translate(75, 98)" fill="none"><path class="domain"></path><g class="tick" opacity="1" transform="translate(21.5,0)"><line y2="-13"></line><text fill="#000"> 2024-01-02</text></g><g class="tick" opacity="1" transform="translate(559.5,0)"><line></line><text>2024-01-06</text></g></g><g><rect x="0" y="48" width="1226.5" height="24" class="section section0"></rect></g><g><rect id="g_0-a" x="75" y="50" width="1114" height="20" class="task task0"></rect><rect id="g_0-b" x="75" y="74" width="10" height="20" class="task task0"></rect><text id="g_0-a-text" x="632" y="63.5" class="taskText taskText0  width-12">A</text></g><g><text dy="0em" x="10" y="98" class="sectionTitle sectionTitle0"><tspan x="10">S</tspan></text></g><text x="632" y="25" class="titleText">  T</text></svg>`

describe('gantt figure agreement', () => {
  const official = parseOfficialGantt(OFFICIAL, 'g_0')

  it('reads rows, bars, ticks, texts and the title back out of the SVG', () => {
    expect(official.viewBox).toBe('0 0 1264 148')
    expect(official.rows).toHaveLength(1)
    expect(official.bars.map((b) => b.key)).toEqual(['a', 'b'])
    expect(official.ticks).toEqual([
      { axisY: 98, x: 21.5, label: ' 2024-01-02' },
      { axisY: 98, x: 559.5, label: '2024-01-06' },
    ])
    expect(official.taskTexts[0]).toMatchObject({
      key: 'a',
      cls: 'taskText taskText0',
    })
    expect(official.sectionLabels[0]).toMatchObject({ y: 98, text: 'S' })
    expect(official.title?.text).toBe('T')
  })

  it('flattens our layout the same way', () => {
    const ours = ourGantt(SRC, 1264)
    expect(ours.bars).toHaveLength(2)
    expect(ours.title?.text).toBe('T')
    expect(ours.ticks.length).toBeGreaterThan(0)
  })

  it('reports mismatches, and notes a label placed differently', () => {
    const ours = ourGantt(SRC, 1264)
    const same = ganttMismatches(ours, ours)
    expect(same).toEqual({ mismatches: [], notes: [] })
    const moved = structuredClone(ours)
    moved.bars[0]!.width += 1
    moved.viewBox = 'x'
    moved.ticks[0]!.label = 'zz'
    moved.title = undefined
    moved.excludes.push({
      key: 'e',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      cls: 'exclude-range',
    })
    moved.sectionLabels[0]!.y += 1
    moved.taskTexts[0]!.y += 1
    moved.taskTexts.pop()
    const out = ganttMismatches(ours, moved).mismatches.join('\n')
    for (const s of [
      'viewBox',
      'bars[0]',
      'tick[0]',
      'title',
      'excludes',
      'section[0]',
      'text[0]',
      'task texts',
    ]) {
      expect(out).toContain(s)
    }
    const shifted = structuredClone(ours)
    shifted.taskTexts[0]!.x += 50
    shifted.taskTexts[1]!.cls = shifted.taskTexts[1]!.cls.replace(
      'taskText ',
      'taskTextOutsideRight ',
    )
    expect(ganttMismatches(ours, shifted)).toMatchObject({ mismatches: [] })
    expect(ganttMismatches(ours, shifted).notes).toHaveLength(2)
    const short = structuredClone(ours)
    short.ticks.pop()
    short.sectionLabels.pop()
    expect(ganttMismatches(ours, short).mismatches.join()).toContain('ticks:')
  })
})
