/**
 * Unit tests for the shared `click`-directive helpers (src/click-directive.ts).
 *
 * The flowchart/state and class-diagram integration suites
 * (interactivity-config.test.ts, class-click-interactions.test.ts) already
 * exercise these through the full parse→render pipeline for the common
 * forms. This file targets the edge cases that pipeline doesn't happen to
 * reach directly — a `click` line that starts right but doesn't fully
 * parse, a click with no quoted url/tooltip at all, and a schemeless href
 * that isn't a `/`, `.`, `#`, or `?` reference either — so
 * `applyClickStatement()`/`safeHref()` have direct coverage of their own as
 * a shared module, not just incidentally through callers.
 */
import { describe, it, expect } from 'vitest'
import type { NodeInteraction } from '../types.ts'
import { applyClickStatement, safeHref } from '../click-directive.ts'

describe('applyClickStatement', () => {
  it('is a no-op for a line that starts with "click " but has no target', () => {
    const interactions = new Map<string, NodeInteraction>()
    applyClickStatement('click A', interactions)
    expect(interactions.size).toBe(0)
  })

  it('is a no-op for a line with no id at all', () => {
    const interactions = new Map<string, NodeInteraction>()
    applyClickStatement('click', interactions)
    expect(interactions.size).toBe(0)
  })

  it('records only the target when there is no quoted url or tooltip', () => {
    const interactions = new Map<string, NodeInteraction>()
    applyClickStatement('click A _blank', interactions)
    // Neither href nor tooltip is set, so nothing is recorded — matches
    // "leaves nodes without a click statement untouched" for a click
    // statement that names no actual link.
    expect(interactions.has('A')).toBe(false)
  })

  it('does not overwrite an already-recorded interaction when the new statement sets nothing', () => {
    const interactions = new Map<string, NodeInteraction>([
      ['A', { href: 'https://example.com' }],
    ])
    applyClickStatement('click A _blank', interactions)
    // The target token alone still merges onto the existing interaction.
    expect(interactions.get('A')).toEqual({
      href: 'https://example.com',
      target: '_blank',
    })
  })
})

describe('safeHref', () => {
  it('keeps a schemeless, non-relative-looking reference (e.g. a bare domain)', () => {
    // Not caught by the leading ./#? check, and the scheme regex finds no
    // `word:` prefix — falls through to the "no scheme at all" branch.
    expect(safeHref('example.com')).toBe('example.com')
  })

  it('keeps a bare word with no colon and no leading ./#?', () => {
    expect(safeHref('example')).toBe('example')
  })
})
