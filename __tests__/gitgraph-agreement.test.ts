import { describe, expect, it } from 'vitest'
import { renderMermaidSVG } from '../src/index.ts'
import {
  gitGraphAgreement,
  gitGraphBreaches,
  parseGitGraphSvg,
  worstGitGraph,
  type GitGraphLayout,
} from '../scripts/lib/gitgraph-agreement.ts'

// Trimmed from mermaid 12.3.0's render of `gitGraph\n commit id: "a"\n branch d\n commit id: "b" tag: "t"`.
const OFFICIAL = `<svg viewBox="-96 -36.7 200 120"><style>.x{fill:red}</style><g><line x1="0" y1="-2" x2="100" y2="-2" class="branch branch0"></line><rect class="branchLabelBkg label0" rx="4" ry="4" x="-69" y="0.5" width="53" height="23" transform="translate(-19, -14)"></rect><g class="branchLabel"><g class="label branch-label0" transform="translate(-79, -13.5)"><text><tspan xml:space="preserve" dy="1em" x="0" class="row">main</tspan></text></g></g></g><g class="commit-arrows"><path d="M 10 -2 L 60 -2" class="arrow arrow0"></path></g><g class="commit-bullets"><circle cx="10" cy="-2" r="10" class="commit a commit0"></circle></g><g class="commit-labels"><g transform="translate(-1, 2) rotate(-45, 10, -2)"><rect class="commit-label-bkg" x="1" y="11.5" width="14" height="15"></rect><text x="3" y="23" class="commit-label">a</text></g><polygon class="tag-label-bkg" points="1,2 3,4"></polygon><circle cy="4" cx="5" r="1.5" class="tag-hole"></circle><text y="6" class="tag-label" x="7">t</text></g><text x="52" y="-25" class="gitTitleText">T</text></svg>`

describe('parseGitGraphSvg', () => {
  const l = parseGitGraphSvg(OFFICIAL)

  it('reads branch lines, label boxes and names', () => {
    expect(l.branches).toEqual([
      { nums: [0, -2, 100, -2] },
      { nums: [-69, 0.5, 53, 23, -19, -14] },
      { nums: [-79, -13.5] },
      { nums: [], text: 'main' },
    ])
  })

  it('reads arrows, commit symbols, labels with their group transform, tags and the title', () => {
    expect(l.arrows).toEqual([{ nums: [10, -2, 60, -2] }])
    expect(l.commits).toEqual([{ nums: [10, -2, 10] }])
    expect(l.labels.map((x) => x.text ?? x.nums.length)).toEqual([
      5, // the rotated group's transform
      4, // the label rect
      'a',
      4, // the tag polygon's points
      3, // the tag hole
      't',
    ])
    expect(l.title).toEqual({ nums: [52, -25], text: 'T' })
    expect(l.size).toEqual({ width: 200, height: 120 })
  })

  it('reads our own markup', () => {
    const o = parseGitGraphSvg(
      renderMermaidSVG('gitGraph\n commit id: "a" tag: "t"\n branch d\n commit id: "b"'),
    )
    expect(o.arrows).toHaveLength(1)
    expect(o.commits).toHaveLength(2)
    expect(o.labels.some((x) => x.text === 't')).toBe(true)
  })
})

describe('gitGraphAgreement', () => {
  const base = (): GitGraphLayout => parseGitGraphSvg(OFFICIAL)

  it('is 1 for identical layouts, and ignores sub-half-pixel differences', () => {
    const a = gitGraphAgreement(base(), base())
    expect(a).toMatchObject({
      branches: 1,
      arrows: 1,
      commits: 1,
      labels: 1,
      frame: 1,
    })
    const b = base()
    b.commits[0]!.nums[0] = 10.4
    expect(gitGraphAgreement(base(), b).commits).toBe(1)
  })

  it('counts moved, missing and surplus items as disagreements', () => {
    const moved = base()
    moved.commits[0]!.nums[0] = 11
    expect(gitGraphAgreement(base(), moved).commits).toBe(0)
    const extra = base()
    extra.arrows.push({ nums: [1, 2, 3, 4] })
    expect(gitGraphAgreement(base(), extra).arrows).toBe(0.5)
    const text = base()
    text.labels.at(-1)!.text = 'u'
    expect(gitGraphAgreement(base(), text).labels).toBeCloseTo(5 / 6)
  })

  it('compares the size and the title', () => {
    const wide = base()
    wide.size = { width: 202, height: 120 }
    expect(gitGraphAgreement(base(), wide).frame).toBe(0)
    const titled = base()
    delete titled.title
    expect(gitGraphAgreement(base(), titled).frame).toBe(0)
    const moved = base()
    moved.title = { nums: [60, -25], text: 'T' }
    expect(gitGraphAgreement(base(), moved).frame).toBe(0)
  })

  it('has no figure for a kind neither side draws', () => {
    const empty: GitGraphLayout = {
      branches: [],
      arrows: [],
      commits: [],
      labels: [],
      size: { width: 1, height: 1 },
    }
    const a = gitGraphAgreement(empty, empty)
    expect(a.arrows).toBeNull()
    expect(a.items).toBe(0)
    expect(worstGitGraph(a)).toBe(1)
  })
})

describe('gitGraphBreaches', () => {
  it('lists samples under the floor and errored ones', () => {
    const ok = { branches: 1, arrows: 1, commits: 1, labels: 1, frame: 1, items: 4 }
    expect(gitGraphBreaches({ a: ok })).toEqual([])
    expect(gitGraphBreaches({ a: ok, b: { ...ok, arrows: 0.5 } }, ['c'])).toEqual([
      'c (error)',
      'b (50% < 100%)',
    ])
    expect(
      worstGitGraph({ branches: null, arrows: null, commits: null, labels: null, frame: null, items: 0 }),
    ).toBeNull()
  })
})
