// ============================================================================
// Unit coverage for src/package-info.ts's getPackageVersion(). The happy
// path (reading the real package.json) is already exercised indirectly by
// cli-entrypoint.test.ts's `--version` test; this file mocks node:module's
// createRequire so every shape getPackageVersion() defends against —
// missing field, non-object, null, non-string version — can be driven
// directly and deterministically, without depending on the repo's actual
// package.json staying malformed-free (it never should be) to exercise the
// fallback.
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRequire = vi.fn()

vi.mock('node:module', () => ({
  createRequire: () => mockRequire,
}))

import { getPackageVersion } from '../package-info.ts'

describe('getPackageVersion', () => {
  beforeEach(() => {
    mockRequire.mockReset()
  })

  it('returns the version string when package.json has a valid version field', () => {
    mockRequire.mockReturnValue({ version: '9.9.9' })
    expect(getPackageVersion()).toBe('9.9.9')
  })

  it('returns "unknown" when package.json has no version field', () => {
    mockRequire.mockReturnValue({ name: 'no-version-here' })
    expect(getPackageVersion()).toBe('unknown')
  })

  it('returns "unknown" when the required value is not an object', () => {
    mockRequire.mockReturnValue('not-an-object')
    expect(getPackageVersion()).toBe('unknown')
  })

  it('returns "unknown" when the required value is null', () => {
    mockRequire.mockReturnValue(null)
    expect(getPackageVersion()).toBe('unknown')
  })

  it('returns "unknown" when version is present but not a string', () => {
    mockRequire.mockReturnValue({ version: 123 })
    expect(getPackageVersion()).toBe('unknown')
  })
})
