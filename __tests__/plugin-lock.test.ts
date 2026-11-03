import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { pluginLockProblems } from '../scripts/lib/plugin-lock'

const pkg = (v?: string) => ({ dependencies: v ? { 'zombie-mermaid': v } : {} })
const lock = (root?: string, locked?: string) => ({
  packages: {
    '': pkg(root),
    ...(locked ? { 'node_modules/zombie-mermaid': { version: locked } } : {}),
  },
})

describe('plugins/claude pin (#2503)', () => {
  it('committed package.json and shrinkwrap agree', () => {
    const read = (f: string) =>
      JSON.parse(readFileSync(`plugins/claude/${f}`, 'utf8'))
    expect(
      pluginLockProblems(read('package.json'), read('npm-shrinkwrap.json')),
    ).toEqual([])
  })
  it('accepts a matching pin', () => {
    expect(pluginLockProblems(pkg('1.0.0'), lock('1.0.0', '1.0.0'))).toEqual([])
  })
  it('flags a root or locked-version mismatch', () => {
    expect(
      pluginLockProblems(pkg('2.0.0'), lock('1.0.0', '1.0.0')),
    ).toHaveLength(2)
    expect(
      pluginLockProblems(pkg('1.0.0'), lock('1.0.0', '0.9.0')),
    ).toHaveLength(1)
  })
  it('flags missing entries', () => {
    expect(pluginLockProblems(pkg(), lock())).toEqual([
      'package.json has no zombie-mermaid dependency',
    ])
    expect(pluginLockProblems(pkg('1.0.0'), {})).toHaveLength(2)
  })
})
