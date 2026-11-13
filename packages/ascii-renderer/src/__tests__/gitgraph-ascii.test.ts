/**
 * GitGraph ASCII/Unicode rendering: lanes, commit symbols, joins, labels and
 * charsets. Mermaid has no text mode for gitGraph, so these goldens assert
 * "unchanged", not "matches mermaid". Whole-output goldens live in
 * testdata/*\/gitgraph_*.txt.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (text: string, useAscii = false) =>
  renderMermaidASCII(text, { colorMode: 'none', useAscii })

const FORK =
  'gitGraph\n commit id: "a"\n branch dev\n commit id: "b"\n checkout main\n commit id: "c"\n merge dev id: "m" tag: "v1"'

describe('gitGraph ASCII', () => {
  it('draws a column per branch and a row per commit, oldest first', () => {
    expect(render(FORK).split('\n')).toEqual([
      'main  dev',
      '●     ┆   a',
      '├─────●   b',
      '●     │   c',
      '◎─────╯   m  [v1]',
    ])
  })

  it('uses plain characters in ASCII mode', () => {
    expect(render(FORK, true).split('\n')).toEqual([
      'main  dev',
      '*     :   a',
      '+-----*   b',
      '*     |   c',
      '@-----+   m  [v1]',
    ])
  })

  it('reads upward for BT, with the names under the columns', () => {
    expect(
      render(FORK.replace('gitGraph', 'gitGraph BT:')).split('\n'),
    ).toEqual([
      '◎─────╮   m  [v1]',
      '●     │   c',
      '├─────●   b',
      '●     ┆   a',
      'main  dev',
    ])
  })

  it('renders LR and TB the same way', () => {
    expect(render(FORK.replace('gitGraph', 'gitGraph LR:'))).toBe(render(FORK))
    expect(render(FORK.replace('gitGraph', 'gitGraph TB:'))).toBe(render(FORK))
  })

  it('shows a symbol for each commit type', () => {
    const out = render(
      'gitGraph\n commit id: "n"\n commit id: "r" type: REVERSE\n commit id: "h" type: HIGHLIGHT\n branch d\n commit id: "x"\n checkout main\n merge d id: "m"\n cherry-pick id: "x"',
    )
    expect(out).toContain('✕')
    expect(out).toContain('◆')
    expect(out).toContain('◎')
    expect(out).toContain('○')
  })

  it('labels a merge only when it has an id, and never a cherry-pick id', () => {
    const lines = render(
      'gitGraph\n commit id: "a"\n branch d\n commit id: "b"\n checkout main\n merge d\n cherry-pick id: "b"',
    ).split('\n')
    expect(lines[3]).toBe('◎─────╯')
    expect(lines.at(-1)).toContain('[cherry-pick:b]')
    expect(lines.at(-1)).not.toMatch(/\d-[0-9a-f]{7}/)
  })

  it('crosses lanes it passes with a junction', () => {
    const out = render(
      'gitGraph\n commit id: "s"\n branch a\n commit id: "x"\n checkout main\n branch b\n commit id: "y"\n checkout main\n merge b id: "m"',
    )
    expect(out.split('\n').at(-1)).toBe('◎─────┼──╯   m')
  })

  it('orders columns by order:, and names the main branch from config', () => {
    const out = render(
      '%%{init: {"gitGraph": {"mainBranchName": "trunk"}}}%%\ngitGraph\n commit id: "a"\n branch late order: 5\n branch early order: 1',
    )
    expect(out.split('\n')[0]).toBe('trunk  early  late')
  })

  it('drops the names and the dotted lines with showBranches: false', () => {
    const out = render(
      '%%{init: {"gitGraph": {"showBranches": false}}}%%\ngitGraph\n commit id: "a"\n branch d\n commit id: "b"',
    )
    expect(out).not.toContain('main')
    expect(out).not.toContain('┆')
  })

  it('drops commit ids with showCommitLabel: false but keeps tags', () => {
    const out = render(
      '%%{init: {"gitGraph": {"showCommitLabel": false}}}%%\ngitGraph\n commit id: "secret" tag: "v1"',
    )
    expect(out).not.toContain('secret')
    expect(out).toContain('[v1]')
  })

  it('centres a title over the graph and draws a bare gitGraph', () => {
    const out = render('gitGraph\n title T\n commit id: "a"').split('\n')
    expect(out[0]!.trim()).toBe('T')
    expect(out[1]).toBe('')
    expect(render('gitGraph')).toBe('main')
  })

  it('paints lanes in colour modes', () => {
    expect(renderMermaidASCII(FORK, { colorMode: 'truecolor' })).toContain(
      '\u001b[',
    )
  })

  describe('parallelCommits', () => {
    const FORKS =
      'gitGraph\n commit id: "A"\n branch develop\n branch feature\n branch hotfix\n checkout develop\n commit id: "C"\n checkout feature\n commit id: "D" tag: "t"\n checkout hotfix\n commit id: "H"\n checkout main\n commit id: "B"\n merge develop id: "M"'
    const init = '%%{init: {"gitGraph": {"parallelCommits": true}}}%%\n'

    it('puts sibling forks of one depth on one row', () => {
      const rows = render(init + FORKS).split('\n')
      expect(rows).toEqual([
        'main  develop  feature  hotfix',
        '●     ┆        ┆        ┆   A',
        '├─────●────────●────────●   C, D  [t], H',
        '●     │        ┆        ┆   B',
        '◎─────╯        ┆        ┆   M',
      ])
    })

    it('keeps one row per commit without it, and when spans overlap', () => {
      expect(render(FORKS).split('\n')).toHaveLength(7)
      // B and C overlap lane main..develop, so B stays on its own row.
      const par = render(init + FORKS).split('\n')
      expect(par.some((r) => r.endsWith('  B'))).toBe(true)
    })

    it('draws ASCII glyphs and is unchanged with one commit per depth', () => {
      expect(render(init + FORKS, true)).toContain('+-----*--------*--------*')
      const chain = 'gitGraph\n commit id: "a"\n commit id: "b"'
      expect(render(init + chain)).toBe(render(chain))
    })
  })
})
