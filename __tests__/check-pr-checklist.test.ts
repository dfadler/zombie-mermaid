import { describe, expect, it } from 'vitest'
// @ts-expect-error plain .mjs script, no type declarations
import { uncheckedItems } from '../scripts/check-pr-checklist.mjs'

describe('check-pr-checklist', () => {
  it('lists unchecked items only', () => {
    const body = '- [x] done\n- [ ] open one\n* [ ] open two\n- [X] done too'
    expect(uncheckedItems(body)).toEqual(['open one', 'open two'])
  })

  it('passes when everything is checked, or there are no boxes', () => {
    expect(uncheckedItems('- [x] a\n- [X] b')).toEqual([])
    expect(uncheckedItems('')).toEqual([])
    expect(uncheckedItems(null)).toEqual([])
  })

  it('ignores boxes in HTML comments and code fences', () => {
    const body = [
      '<!-- - [ ] template hint -->',
      '<!--',
      '- [ ] multi-line comment',
      '-->',
      '```md',
      '- [ ] example in a fence',
      '```',
      '- [ ] real one',
    ].join('\n')
    expect(uncheckedItems(body)).toEqual(['real one'])
  })

  it('does not let nested comment markers hide a box GitHub shows', () => {
    expect(uncheckedItems('<!<!-- a -->--\n- [ ] still visible\n-->')).toEqual([
      'still visible',
    ])
  })

  it('handles indented (nested) items and ignores plain brackets', () => {
    expect(
      uncheckedItems('  - [ ] nested\n- [] not a box\n- [ ]no space'),
    ).toEqual(['nested'])
  })
})
