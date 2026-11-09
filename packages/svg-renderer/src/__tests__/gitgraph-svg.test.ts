/**
 * GitGraph layout and SVG. Expected numbers are measured from mermaid@12.3.0
 * rendering the same sources (commit ids are given, because Mermaid draws
 * random ones otherwise); the full comparison runs in scripts/gitgraph-oracle.ts.
 */
import { describe, it, expect } from 'vitest'
import { parseGitGraph } from '@zombie-mermaid/mermaid-parser'
import { renderMermaidSVG } from '../index.ts'
import { layoutGitGraph, lineHeight } from '../gitgraph/layout.ts'

const layout = (src: string) => layoutGitGraph(parseGitGraph(src))
const BASIC =
  'gitGraph\n commit id: "a"\n branch dev\n commit id: "b"\n checkout main\n merge dev id: "m"'

describe('layoutGitGraph – left to right', () => {
  it("matches mermaid's branch lines, commits and arrows", () => {
    const l = layout(BASIC)
    expect(l.branches.map((b) => b.line)).toEqual([
      { x1: 0, y1: -2, x2: 150, y2: -2 },
      { x1: 0, y1: 88, x2: 150, y2: 88 },
    ])
    const circles = l.commits.flatMap((c) =>
      c.shapes.flatMap((x) => (x.kind === 'circle' ? [[x.cx, x.cy, x.r]] : [])),
    )
    expect(circles).toEqual([
      [10, -2, 10],
      [60, 88, 10],
      [110, -2, 10],
      [110, -2, 6],
    ])
    expect(l.arrows.map((x) => x.d)).toEqual([
      'M 10 -2 L 10 68 A 20 20, 0, 0, 0, 30 88 L 60 88',
      'M 10 -2 L 110 -2',
      'M 60 88 L 90 88 A 20 20, 0, 0, 0, 110 68 L 110 -2',
    ])
    expect(l.viewBox.x).toBeCloseTo(-96, 1)
    expect(l.viewBox.y).toBeCloseTo(-21.5, 1)
    expect(l.viewBox.width).toBeCloseTo(254, 1)
    expect(l.viewBox.height).toBeCloseTo(145.86, 1)
  })

  it('shifts the origin to the padded bounding box', () => {
    const l = layout('gitGraph\n commit id: "a"')
    expect(l.viewBox.x).toBeLessThan(0)
    expect(l.viewBox.width).toBeGreaterThan(0)
  })

  it('rotates commit labels unless told not to, and drops them on request', () => {
    const rot = layout('gitGraph\n commit id: "a"').commits[0]!.label!
    expect(rot.groupTransform).toMatch(/^translate\(.*\) rotate\(-45, /)
    const flat = layout(
      '%%{init: {"gitGraph": {"rotateCommitLabel": false}}}%%\ngitGraph\n commit id: "a"',
    ).commits[0]!.label!
    expect(flat.groupTransform).toBeUndefined()
    const none = layout(
      '%%{init: {"gitGraph": {"showCommitLabel": false}}}%%\ngitGraph\n commit id: "a"',
    )
    expect(none.commits[0]!.label).toBeUndefined()
  })

  it('labels a merge only when it has an id, and never a cherry-pick', () => {
    const src =
      'gitGraph\n commit id: "a"\n branch d\n commit id: "b"\n checkout main\n merge d\n cherry-pick id: "b"'
    const l = layout(src)
    expect(l.commits.map((c) => c.label?.text)).toEqual([
      'a',
      'b',
      undefined,
      undefined,
    ])
    const m = layout(src.replace('merge d', 'merge d id: "M"'))
    expect(m.commits.map((c) => c.label?.text)).toEqual([
      'a',
      'b',
      'M',
      undefined,
    ])
  })

  it('stacks tags upward, the last written nearest the commit', () => {
    const t = layout('gitGraph\n commit id: "a" tag: "one" tag: "two"')
      .commits[0]!.tags
    expect(t.map((x) => x.text)).toEqual(['two', 'one'])
    expect(t[1]!.textPos.y).toBe(t[0]!.textPos.y - 20)
  })

  it('draws each commit type as Mermaid does', () => {
    const l = layout(
      'gitGraph\n commit id: "n"\n commit id: "r" type: REVERSE\n commit id: "h" type: HIGHLIGHT\n branch d\n commit id: "x"\n checkout main\n merge d id: "m"\n cherry-pick id: "x"',
    )
    expect(l.commits.map((c) => c.shapes.map((x) => x.kind))).toEqual([
      ['circle'], // Normal
      ['circle', 'path'], // Reverse: a cross over the circle
      ['rect', 'rect'], // Highlight: outer and inner square
      ['circle'],
      ['circle', 'circle'], // Merge: a ring
      ['circle', 'circle', 'circle', 'line', 'line'], // Cherry-pick
    ])
  })
})

describe('layoutGitGraph – orientations', () => {
  const src = (dir: string) =>
    `gitGraph${dir}\n commit id: "a"\n branch f\n commit id: "b"\n checkout main\n merge f id: "m"`

  it('runs time down for TB with branches as columns', () => {
    const l = layout(src(' TB:'))
    expect(l.branches[0]!.line.x1).toBe(0)
    expect(l.branches[0]!.line.y1).toBe(30)
    expect(l.branches[1]!.line.x1).toBeGreaterThan(90)
    expect(l.branches[0]!.bkg.tx).toBeUndefined()
  })

  it('runs time up for BT, with branch labels under the lines', () => {
    const l = layout(src(' BT:'))
    const b = l.branches[0]!
    expect(b.line.y1).toBeGreaterThan(b.line.y2)
    expect(b.bkg.y).toBe(b.line.y1)
  })

  it('places parallel commits one step after their closest parent', () => {
    const par = '%%{init: {"gitGraph": {"parallelCommits": true}}}%%\n'
    const l = layout(
      `${par}gitGraph\n commit id: "a"\n branch d\n commit id: "b"\n checkout main\n commit id: "c"`,
    )
    const cy = l.commits.map((c) => {
      const s = c.shapes[0]!
      return s.kind === 'circle' ? s.cx : NaN
    })
    expect(cy[1]).toBe(cy[2]) // B and c both follow a
    const bt = layout(
      `${par}gitGraph BT:\n commit id: "a"\n branch d\n commit id: "b"`,
    )
    expect(bt.commits).toHaveLength(2)
  })

  it('measures a line of 16px text as 19px and 10px text as 11px', () => {
    expect(lineHeight(16)).toBe(19)
    expect(lineHeight(10)).toBe(11)
    expect(lineHeight(18)).toBe(21)
  })
})

describe('renderMermaidSVG – gitGraph', () => {
  const svg = renderMermaidSVG(BASIC)

  it("uses Mermaid's structure and class names", () => {
    expect(svg).toContain('class="branch branch0"')
    expect(svg).toContain('class="branchLabelBkg label1"')
    expect(svg).toContain('<g class="commit-arrows">')
    expect(svg).toContain('class="arrow arrow1"')
    expect(svg).toContain('class="commit commit-merge m commit0"')
    expect(svg).toContain('class="commit-label"')
  })

  it('draws a cherry-pick as a circle with two dots and two strokes', () => {
    const out = renderMermaidSVG(
      'gitGraph\n commit id: "a"\n branch d\n commit id: "b"\n checkout main\n cherry-pick id: "b"',
    )
    expect(out.match(/<line [^>]*stroke="#fff"/g)).toHaveLength(2)
    expect(out.match(/<circle [^>]*fill="#fff"/g)).toHaveLength(2)
    expect(out).toContain('commit-cherry-pick')
  })

  it('escapes ids, tags and branch names', () => {
    const out = renderMermaidSVG(
      'gitGraph\n commit id: "<b>&" tag: "<i>"\n branch "a<br>b"',
    )
    expect(out).not.toContain('<b>&')
    expect(out).toContain('&lt;b&gt;&amp;')
    expect(out).toContain('&lt;i&gt;')
    expect(out).toContain('>a</tspan>')
  })

  it('draws the title above the graph', () => {
    const out = renderMermaidSVG(
      'gitGraph\n title Release flow\n commit id: "a"',
    )
    expect(out).toMatch(/<text [^>]*class="gitTitleText">Release flow<\/text>/)
  })

  it('omits branch lines and names with showBranches: false', () => {
    const out = renderMermaidSVG(
      '%%{init: {"gitGraph": {"showBranches": false}}}%%\ngitGraph\n commit id: "a"',
    )
    expect(out).not.toContain('<line ')
    expect(out).not.toContain('class="branchLabel"')
  })

  it('moves the viewBox origin to 0,0 and sizes the svg to it', () => {
    const m =
      /viewBox="0 0 ([\d.]+) ([\d.]+)" width="([\d.]+)" height="([\d.]+)"/.exec(
        svg,
      )!
    expect(m[1]).toBe(m[3])
    expect(m[2]).toBe(m[4])
  })

  it('themes through the accent: colours are custom properties', () => {
    expect(svg).toContain('--git-color-1')
    expect(svg).toMatch(/\.commit1 \{ stroke: var\(--git-color-1\)/)
  })

  it('renders a bare gitGraph and the three orientations', () => {
    expect(renderMermaidSVG('gitGraph')).toContain('branch-label0')
    for (const d of ['LR', 'TB', 'BT'])
      expect(
        renderMermaidSVG(`gitGraph ${d}:\n commit id: "a"\n commit id: "b"`),
      ).toContain('commit-bullets')
  })

  it("throws Mermaid's database errors for a bad graph", () => {
    expect(() => renderMermaidSVG('gitGraph\n branch main')).toThrow(
      /existing branch/,
    )
  })
})

// These graphs were scored 100% against mermaid@12.3.0 and 12.2.0 in every
// orientation, with and without parallelCommits and rotateCommitLabel (the
// sweep behind docs/known-differences.md#git-graphs); here they pin that the
// rerouted, merged and tagged arrows all lay out and draw.
describe('gitGraph sweep', () => {
  const bodies = [
    'commit id: "a"\nbranch b1\ncommit id: "b"\ncheckout main\ncommit id: "c"\ncommit id: "d"\nbranch b2\ncommit id: "e"\ncheckout b1\ncommit id: "f"\ncheckout main\nmerge b1 id: "m1"\ncheckout b2\ncommit id: "g"\nmerge main id: "m2"\ncherry-pick id: "f"',
    'commit id: "a"\nbranch x order: 3\nbranch y order: 1\ncheckout y\ncommit id: "y1" tag: "t1" tag: "t2"\ncheckout x\ncommit id: "x1" type: REVERSE\ncheckout main\nmerge x id: "mx" type: REVERSE\nmerge y id: "my" type: NORMAL',
    // The first commit of x skips two on main: its arrow is rerouted (main below x when ordered last).
    'commit id: "a"\nbranch x\ncheckout main\ncommit id: "c"\ncommit id: "d"\ncheckout x\ncommit id: "x1"\ncheckout main\nmerge x id: "m"',
    '%%{init: {"gitGraph": {"mainBranchOrder": 5}}}%%\ncommit id: "a"\nbranch x\ncheckout main\ncommit id: "c"\ncommit id: "d"\ncheckout x\ncommit id: "x1"\ncheckout main\nmerge x id: "m"',
  ]
  for (const dir of ['', ' LR:', ' TB:', ' BT:'])
    for (const par of [false, true])
      for (const rot of [true, false])
        it(`lays out and draws${dir || ' default'} parallel=${par} rotate=${rot}`, () => {
          for (const body of bodies) {
            const src = `%%{init: {"gitGraph": {"parallelCommits": ${par}, "rotateCommitLabel": ${rot}}}}%%\ngitGraph${dir}\n${body}`
            const l = layout(src)
            expect(Number.isFinite(l.viewBox.width)).toBe(true)
            expect(l.arrows.length).toBeGreaterThan(2)
            expect(renderMermaidSVG(src)).toContain('commit-arrows')
          }
        })
})
