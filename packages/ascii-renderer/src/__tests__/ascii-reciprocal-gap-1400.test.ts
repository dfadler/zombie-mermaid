/**
 * #1400: the down and up strokes of a reciprocal pair that share a node side
 * keep a clear gap instead of running one blank cell apart. Both CJK and Latin
 * names lay out the same. The SVG renderer does not use port offsets, so it
 * is unaffected.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const states = (names: string[], labels: string[]): string => {
  const [a, b, c, d] = names as [string, string, string, string]
  const [submit, ok, fail, retry] = labels
  return `stateDiagram-v2
  [*] --> ${a}
  ${a} --> ${b} : ${submit}
  ${b} --> ${c} : ${ok}
  ${b} --> ${d} : ${fail}
  ${d} --> ${a} : ${retry}
  ${c} --> [*]`
}

/** Columns of the `▼` into the last node and of the `┴` where the return leaves. */
function gap(out: string): number {
  const rows = out.split('\n').map((r) => [...r])
  const join = rows.findIndex((r) => r.includes('┴'))
  return rows[join - 1]!.lastIndexOf('▼') - rows[join]!.indexOf('┴')
}

describe('reciprocal pair stroke gap (#1400)', () => {
  it.each([
    [
      'CJK',
      states(
        ['空闲', '处理中', '完成', '错误'],
        ['提交', '成功', '失败', '重试'],
      ),
    ],
    [
      'Latin',
      states(
        ['Idle', 'Busy', 'Done', 'Err'],
        ['submit', 'ok', 'fail', 'retry'],
      ),
    ],
  ])('keeps the pair at least four cells apart (%s)', (_name, src) => {
    expect(
      gap(renderMermaidASCII(src, { colorMode: 'none' })),
    ).toBeGreaterThanOrEqual(4)
  })
})
