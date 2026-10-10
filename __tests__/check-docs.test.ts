import { describe, expect, it } from 'vitest'
import { checkDoc } from '../scripts/check-docs.ts'

const has = (set: string[]) => (p: string) => set.some((s) => p.endsWith(s))
const run = (md: string, existing: string[] = []) =>
  checkDoc('docs/a.md', md, '24', has(existing), () => '# Real heading\n')

describe('check-docs', () => {
  it('flags broken links, missing anchors, stale paths, counts, node', () => {
    const errs = run(
      '[x](./gone.md) [y](./b.md#nope) `src/old.ts` 3 diagram types Node.js 22',
      ['b.md'],
    )
    expect(errs).toHaveLength(5)
  })
  it('accepts good input and ignores code fences', () => {
    expect(
      run(
        '[y](./b.md#real-heading) `src/ok.ts` 8 diagram types Node 24\n```\n`src/x.ts`\n```',
        ['b.md', 'src/ok.ts'],
      ),
    ).toEqual([])
  })
})
