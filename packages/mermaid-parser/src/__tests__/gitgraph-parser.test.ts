import { describe, it, expect } from 'vitest'
import { MermaidParseError } from '@zombie-mermaid/core'
import { parseGitGraph } from '../gitgraph/parser.ts'

// The accept/reject cases were checked against mermaid@12.3.0's own parser
// (`mermaid.parse`); the messages are the ones its database throws.
describe('parseGitGraph header', () => {
  it('reads the direction, which needs its colon', () => {
    expect(parseGitGraph('gitGraph').direction).toBe('LR')
    expect(parseGitGraph('gitGraph:').direction).toBe('LR')
    expect(parseGitGraph('gitGraph LR:').direction).toBe('LR')
    expect(parseGitGraph('gitGraph TB:\n commit').direction).toBe('TB')
    expect(parseGitGraph('gitGraph  BT :\n commit').direction).toBe('BT')
    for (const bad of ['gitGraph LR', 'gitGraph BT\n commit', 'gitGraph TD:'])
      expect(() => parseGitGraph(bad)).toThrow(MermaidParseError)
  })

  it('accepts a statement on the header line, and rejects other text first', () => {
    expect(parseGitGraph('gitGraph commit').commits).toHaveLength(1)
    expect(parseGitGraph('gitGraph LR: commit').commits).toHaveLength(1)
    expect(() => parseGitGraph('commit')).toThrow(/gitGraph" header/)
    expect(() => parseGitGraph('gitgraph\n commit')).toThrow(MermaidParseError)
    expect(() => parseGitGraph('')).toThrow(/gitGraph" header/)
  })

  it('skips comments, blank lines and accessibility statements', () => {
    const g = parseGitGraph(
      '%% top\ngitGraph\n\n   %% c\n accTitle: t\n accDescr: d\n accDescr {\n x\n}\n commit %% trailing\n',
    )
    expect(g.commits).toHaveLength(1)
  })

  it('reads the last title, without a trailing comment', () => {
    expect(parseGitGraph('gitGraph\n title One\n title Two words %% c').title).toBe(
      'Two words',
    )
    expect(parseGitGraph('gitGraph\n title\n').title).toBeUndefined()
  })
})

describe('parseGitGraph commit', () => {
  it('gives each commit a sequence number, branch and parent', () => {
    const g = parseGitGraph('gitGraph\n commit id: "a"\n commit id: "b"')
    expect(g.commits.map((c) => [c.id, c.seq, c.branch, c.parents])).toEqual([
      ['a', 0, 'main', []],
      ['b', 1, 'main', ['a']],
    ])
  })

  it('reads id, msg (with or without its keyword), tags and type in any order', () => {
    const g = parseGitGraph(
      `gitGraph\n commit tag: "t1" msg: "m" type: HIGHLIGHT id: "x" tag: 't2'\n commit "bare"`,
    )
    expect(g.commits[0]).toMatchObject({
      id: 'x',
      message: 'm',
      type: 'HIGHLIGHT',
      tags: ['t1', 't2'],
    })
    expect(g.commits[1]!.message).toBe('bare')
  })

  it('lets the last id, msg and type win, and unescapes strings', () => {
    const g = parseGitGraph(
      'gitGraph\n commit id: "a" id: "b" "m1" msg: "m2\\"q" type: NORMAL type: REVERSE',
    )
    expect(g.commits[0]).toMatchObject({
      id: 'b',
      message: 'm2"q',
      type: 'REVERSE',
    })
  })

  it('generates stable `<seq>-<hex>` ids when none is given, or an empty one', () => {
    const a = parseGitGraph('gitGraph\n commit\n commit id: ""')
    const b = parseGitGraph('gitGraph\n commit\n commit id: ""')
    expect(a.commits[0]!.id).toMatch(/^0-[0-9a-f]{7}$/)
    expect(a.commits[1]!.id).toMatch(/^1-[0-9a-f]{7}$/)
    expect(a.commits.map((c) => c.id)).toEqual(b.commits.map((c) => c.id))
    expect(a.commits[0]!.id).not.toBe(a.commits[1]!.id.replace(/^1/, '0'))
  })

  it('keeps the later of two commits with the same id', () => {
    const g = parseGitGraph('gitGraph\n commit id: "s" "one"\n commit id: "s" "two"')
    expect(g.commits).toHaveLength(1)
    expect(g.commits[0]!.message).toBe('two')
  })

  it.each([
    ['a type Mermaid does not know', 'commit type: MERGE'],
    ['a lower-case type', 'commit type: highlight'],
    ['an unquoted id', 'commit id: a'],
    ['a space before the colon', 'commit id : "a"'],
    ['two commits on a line', 'commit commit'],
    ['a semicolon', 'commit; commit'],
    ['a stray word', 'frobnicate'],
    ['an unknown option', 'commit parent: "a"'],
    ['a missing value', 'commit id:'],
    ['a bad type value', 'commit type: 5'],
    ['a non-ASCII branch', 'branch é'],
  ])('rejects %s', (_what, line) => {
    expect(() => parseGitGraph(`gitGraph\n ${line}`)).toThrow(MermaidParseError)
  })

  it('reports the line of a failure', () => {
    try {
      parseGitGraph('gitGraph\n commit\n commit id: a')
      expect.unreachable()
    } catch (e) {
      expect((e as MermaidParseError).line).toBe(3)
    }
  })
})

describe('parseGitGraph branches', () => {
  it('forks from the current head and checks the branch out', () => {
    const g = parseGitGraph(
      'gitGraph\n commit id: "a"\n branch dev\n commit id: "b"\n checkout main\n commit id: "c"',
    )
    expect(g.commits.map((c) => [c.id, c.branch, c.parents])).toEqual([
      ['a', 'main', []],
      ['b', 'dev', ['a']],
      ['c', 'main', ['a']],
    ])
    expect(g.branches).toEqual(['main', 'dev'])
  })

  it('accepts slashes, dots, hyphens, quotes and `switch`', () => {
    const g = parseGitGraph(
      'gitGraph\n commit\n branch feature/x\n branch "a b"\n branch v1.2-rc\n switch main\n checkout "feature/x"',
    )
    expect(g.branches).toEqual(['main', 'feature/x', 'a b', 'v1.2-rc'])
  })

  it('sorts by order:, ties in creation order, honouring mainBranchOrder', () => {
    const g = parseGitGraph(
      'gitGraph\n commit\n branch a order: 2\n branch b\n branch c order: 1',
    )
    expect(g.branches).toEqual(['main', 'b', 'c', 'a'])
    const h = parseGitGraph(
      '%%{init: {"gitGraph": {"mainBranchOrder": 3}}}%%\ngitGraph\n branch a order: 1',
    )
    expect(h.branches).toEqual(['a', 'main'])
    expect(() => parseGitGraph('gitGraph\n branch a order: -1')).toThrow()
    expect(() => parseGitGraph('gitGraph\n branch a order: 1.5')).toThrow()
    expect(() => parseGitGraph('gitGraph\n branch 1')).toThrow()
  })

  it('reads mainBranchName and the other gitGraph config keys', () => {
    const g = parseGitGraph(
      `%%{init: {'gitGraph': {'mainBranchName': 'trunk', 'showCommitLabel': false, 'showBranches': false, 'rotateCommitLabel': false, 'parallelCommits': true}}}%%\ngitGraph\n commit\n branch x`,
    )
    expect(g.branches).toEqual(['trunk', 'x'])
    expect(g.commits[0]!.branch).toBe('trunk')
    expect(g.config).toMatchObject({
      mainBranchName: 'trunk',
      showCommitLabel: false,
      showBranches: false,
      rotateCommitLabel: false,
      parallelCommits: true,
    })
  })

  it('uses Mermaid\'s defaults without config', () => {
    expect(parseGitGraph('gitGraph').config).toEqual({
      mainBranchName: 'main',
      mainBranchOrder: 0,
      showCommitLabel: true,
      showBranches: true,
      rotateCommitLabel: true,
      parallelCommits: false,
    })
  })

  it('throws Mermaid\'s messages for a repeated or unknown branch', () => {
    expect(() => parseGitGraph('gitGraph\n branch main')).toThrow(
      /Trying to create an existing branch/,
    )
    expect(() => parseGitGraph('gitGraph\n checkout nope')).toThrow(
      /not yet created/,
    )
    expect(() => parseGitGraph('gitGraph\n checkout main extra')).toThrow(
      MermaidParseError,
    )
  })

  it('lets a commit on a branch with no commits start with no parent', () => {
    const g = parseGitGraph('gitGraph\n branch a\n commit id: "x"')
    expect(g.commits[0]!.parents).toEqual([])
    const h = parseGitGraph('gitGraph\n checkout main\n commit id: "x"')
    expect(h.commits[0]!.parents).toEqual([])
  })
})

describe('parseGitGraph merge', () => {
  const base =
    'gitGraph\n commit id: "a"\n branch dev\n commit id: "b"\n checkout main\n'

  it('makes a merge commit of both heads, labelled only when given an id', () => {
    const g = parseGitGraph(`${base} merge dev`)
    const m = g.commits[2]!
    expect(m).toMatchObject({
      type: 'MERGE',
      branch: 'main',
      parents: ['a', 'b'],
      message: 'merged branch dev into main',
      tags: [],
    })
    expect(m.customId).toBeUndefined()
    const n = parseGitGraph(
      `${base} merge dev id: "M" tag: "t1" tag: "t2" type: REVERSE`,
    ).commits[2]!
    expect(n).toMatchObject({
      id: 'M',
      customId: true,
      customType: 'REVERSE',
      tags: ['t1', 't2'],
    })
  })

  it.each([
    [
      'of the current branch',
      'gitGraph\n commit\n branch a\n merge a',
      /to itself/,
    ],
    [
      'a branch merged into itself',
      'gitGraph\n commit\n merge main',
      /into itself/,
    ],
    [
      'a current branch with no commits',
      'gitGraph\n branch a\n branch b\n checkout a\n merge b',
      /has no commits/,
    ],
    [
      'a missing branch',
      'gitGraph\n commit\n merge nope',
      /does not exist/,
    ],
    [
      'a branch with no commits',
      'gitGraph\n commit\n branch a\n checkout main\n branch b\n checkout main\n merge a',
      /same head|has no commits/,
    ],
    [
      'two branches on the same head',
      'gitGraph\n commit\n branch a\n checkout main\n merge a',
      /same head/,
    ],
    [
      'a reused id',
      'gitGraph\n commit id: "a"\n branch d\n commit id: "b"\n checkout main\n merge d id: "a"',
      /already exists/,
    ],
  ])('rejects a merge %s', (_what, src, message) => {
    expect(() => parseGitGraph(src)).toThrow(message)
  })

  it('needs a branch name and rejects unknown options', () => {
    expect(() => parseGitGraph('gitGraph\n commit\n merge')).toThrow(
      MermaidParseError,
    )
    expect(() => parseGitGraph(`${base} merge dev parent: "a"`)).toThrow(
      MermaidParseError,
    )
  })
})

describe('parseGitGraph cherry-pick', () => {
  const base =
    'gitGraph\n commit id: "s"\n branch a\n commit id: "z"\n checkout main\n'

  it('copies a commit onto the current branch and tags it', () => {
    const c = parseGitGraph(`${base} cherry-pick id: "z"`).commits[2]!
    expect(c).toMatchObject({
      type: 'CHERRY_PICK',
      branch: 'main',
      parents: ['s', 'z'],
      message: 'cherry-picked  into main',
      tags: ['cherry-pick:z'],
    })
  })

  it('takes given tags instead, dropping empty ones', () => {
    const c = parseGitGraph(`${base} cherry-pick id: "z" tag: "q" tag: ""`)
      .commits[2]!
    expect(c.tags).toEqual(['q'])
  })

  it('needs `parent:` for a merge commit and names it in the tag', () => {
    const src = `${base} merge a id: "M"\n branch b\n checkout b\n`
    expect(() => parseGitGraph(`${src} cherry-pick id: "M"`)).toThrow(
      /merge commit, an immediate parent/,
    )
    // M is on main; pick it onto b with its first parent.
    const c = parseGitGraph(`${src} cherry-pick id: "M" parent: "s"`).commits.at(
      -1,
    )!
    expect(c.tags).toEqual(['cherry-pick:M|parent:s'])
  })

  it.each([
    ['no id', 'cherry-pick tag: "x"', /Source commit id should exist/],
    ['an unknown id', 'cherry-pick id: "nope"', /Source commit id should exist/],
    [
      'a commit on the current branch',
      'cherry-pick id: "s"',
      /already on current branch/,
    ],
  ])('rejects %s', (_what, line, message) => {
    expect(() => parseGitGraph(`${base} ${line}`)).toThrow(message)
  })

  it('rejects a parent that is not a parent, and a branch without commits', () => {
    expect(() =>
      parseGitGraph(`${base} cherry-pick id: "z" parent: "nope"`),
    ).toThrow(/not an immediate parent/)
    expect(() =>
      parseGitGraph('gitGraph\n commit id: "s"\n branch a\n branch b\n cherry-pick id: "s"'),
    ).not.toThrow()
    expect(() =>
      parseGitGraph(
        'gitGraph\n branch a\n commit id: "x"\n checkout main\n cherry-pick id: "x"',
      ),
    ).toThrow(/has no commits/)
  })
})
