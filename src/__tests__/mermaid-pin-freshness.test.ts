import { describe, it, expect } from 'vitest'
import {
  isBehind,
  pinFreshness,
} from '../../scripts/lib/mermaid-pin-freshness.ts'

describe('mermaid pin freshness', () => {
  it.each([
    ['11.17.2', '12.1.0', true],
    ['12.1.0', '12.2.0', true],
    ['12.1.0', '12.1.5', false],
    ['12.1.0', '12.1.0', false],
    ['12.1.0', '11.17.2', false],
  ])('isBehind(%s, %s) is %s', (pinned, latest, expected) => {
    expect(isBehind(pinned, latest)).toBe(expected)
  })

  it('warns, naming both versions, when the pin is behind', () => {
    const r = pinFreshness('12.1.0', '11.17.2')
    expect(r.stale).toBe(true)
    expect(r.message).toContain('11.17.2')
    expect(r.message).toContain('12.1.0')
  })

  it('is quiet when the pin is current', () => {
    expect(pinFreshness('12.1.0', '12.1.0').stale).toBe(false)
  })
})
