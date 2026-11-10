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

  describe('fences follow the CommonMark closing rules', () => {
    it('a fence with trailing text does not close the block', () => {
      const body = ['```', '```js', '- [ ] example', '```', '- [ ] real'].join(
        '\n',
      )
      // "```js" is content; the bare ``` on line 4 closes, so only the last box counts.
      expect(uncheckedItems(body)).toEqual(['real'])
    })

    it('a different fence character does not close the block', () => {
      const body = ['```', '~~~', '- [ ] example', '```', '- [ ] real'].join(
        '\n',
      )
      expect(uncheckedItems(body)).toEqual(['real'])
    })

    it('a shorter closing run does not close the block', () => {
      const body = ['````', '```', '- [ ] example', '````', '- [ ] real'].join(
        '\n',
      )
      expect(uncheckedItems(body)).toEqual(['real'])
    })

    it('a longer closing run does close it', () => {
      const body = ['```', '- [ ] example', '`````', '- [ ] real'].join('\n')
      expect(uncheckedItems(body)).toEqual(['real'])
    })

    it('an unclosed fence does not hide boxes after it', () => {
      expect(uncheckedItems('```\n- [ ] after a stray fence')).toEqual([
        'after a stray fence',
      ])
    })

    it('a backtick fence with a backtick in its info string is not a fence', () => {
      expect(uncheckedItems('``` `x`\n- [ ] visible')).toEqual(['visible'])
    })
  })

  describe('comments and fences do not hide each other', () => {
    it('a comment opener inside a fence cannot swallow a box after the fence', () => {
      const body = ['```', '<!--', '```', '- [ ] visible', '-->'].join('\n')
      expect(uncheckedItems(body)).toEqual(['visible'])
    })

    it('a fence inside a comment does not start a block', () => {
      const body = ['<!--', '```', '-->', '- [ ] visible'].join('\n')
      expect(uncheckedItems(body)).toEqual(['visible'])
    })

    it('an unterminated comment stays visible', () => {
      expect(uncheckedItems('<!-- never closed\n- [ ] visible')).toEqual([
        'visible',
      ])
    })

    it('a box between two comments still counts', () => {
      expect(uncheckedItems('<!-- one -->\n- [ ] a\n<!-- two -->')).toEqual([
        'a',
      ])
    })
  })

  it('handles CRLF line endings', () => {
    expect(
      uncheckedItems('- [x] a\r\n- [ ] b\r\n```\r\n- [ ] c\r\n```'),
    ).toEqual(['b'])
  })

  it('handles indented (nested) items and ignores plain brackets', () => {
    expect(
      uncheckedItems('  - [ ] nested\n- [] not a box\n- [ ]no space'),
    ).toEqual(['nested'])
  })
})
