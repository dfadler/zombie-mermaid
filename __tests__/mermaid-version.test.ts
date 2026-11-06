import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  mermaidVersion,
  pinnedMermaidVersion,
} from '../scripts/lib/mermaid-pin-freshness.ts'

describe('mermaidVersion', () => {
  it('is the pin when no dist is given', () => {
    expect(mermaidVersion()).toBe(pinnedMermaidVersion())
  })

  it('reads the version of a scratch install from the package beside its dist/', () => {
    const root = mkdtempSync(join(tmpdir(), 'mm-'))
    mkdirSync(join(root, 'dist'))
    writeFileSync(join(root, 'package.json'), '{"version":"99.1.2"}')
    expect(mermaidVersion(join(root, 'dist', 'mermaid.min.js'))).toBe('99.1.2')
  })
})
