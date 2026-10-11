import { describe, expect, it } from 'vitest'
import { parseFrontmatter } from '../packages/site/frontmatter.ts'

const parse = (line: string) =>
  parseFrontmatter(`---\ntitle: ${line}\n---\nbody`, 'p.md').fields.title

describe('parseFrontmatter', () => {
  it('splits fields from the trimmed body', () => {
    const { fields, body } = parseFrontmatter(
      '---\ntitle: Hi\ndate: 2026-01-02\n---\n\nText\n',
      'p.md',
    )
    expect(fields).toEqual({ title: 'Hi', date: '2026-01-02' })
    expect(body).toBe('Text')
  })

  it('keeps an unquoted value as-is', () => {
    expect(parse('Plain title')).toBe('Plain title')
  })

  it('strips one pair of double quotes', () => {
    expect(parse('"Quoted: with colon"')).toBe('Quoted: with colon')
  })

  it('strips one pair of single quotes', () => {
    expect(parse("'Quoted'")).toBe('Quoted')
  })

  it('leaves mismatched quotes alone', () => {
    expect(parse(`"half'`)).toBe(`"half'`)
    expect(parse(`'half"`)).toBe(`'half"`)
  })

  it('leaves a single leading or trailing quote alone', () => {
    expect(parse('"open')).toBe('"open')
    expect(parse('close"')).toBe('close"')
    expect(parse('"')).toBe('"')
  })

  it('turns an empty quoted pair into an empty string', () => {
    expect(parse('""')).toBe('')
    expect(parse("''")).toBe('')
  })

  it('leaves an empty value empty', () => {
    expect(parse('')).toBe('')
  })

  it('keeps internal quotes and strips only the outer pair', () => {
    expect(parse('"say "hi" now"')).toBe('say "hi" now')
    expect(parse(`"it's"`)).toBe("it's")
    expect(parse('say "hi"')).toBe('say "hi"')
  })

  it('does not strip twice', () => {
    expect(parse('""x""')).toBe('"x"')
  })

  it('rejects a missing frontmatter block', () => {
    expect(() => parseFrontmatter('no fm', 'p.md')).toThrow(
      'p.md: missing frontmatter block',
    )
  })

  it('rejects a line with no colon', () => {
    expect(() => parseFrontmatter('---\nbad line\n---\nx', 'p.md')).toThrow(
      'malformed frontmatter line: "bad line"',
    )
  })
})
