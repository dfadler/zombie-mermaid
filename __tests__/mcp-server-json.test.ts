import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  buildServerJson,
  validateServerJson,
} from '../scripts/lib/mcp-server-json.ts'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
type Loose = any // eslint-disable-line @typescript-eslint/no-explicit-any

describe('mcp server.json', () => {
  it('builds a valid server.json from the real package.json, version-pinned', () => {
    const s: Loose = buildServerJson(pkg)
    expect(s.version).toBe(pkg.version)
    expect(s.packages[0].version).toBe(pkg.version)
    expect(s.name).toBe(pkg.mcpName)
    expect(validateServerJson(s, pkg)).toEqual([])
  })

  it('launches the stdio server via the mcp subcommand and strips .git from the repo url', () => {
    const s: Loose = buildServerJson({
      ...pkg,
      repository: { url: 'https://github.com/o/r.git' },
    })
    expect(s.packages[0].packageArguments).toEqual([
      { type: 'positional', value: 'mcp' },
    ])
    expect(s.repository.url).toBe('https://github.com/o/r')
  })

  it('rejects a package.json missing mcpName', () => {
    expect(() => buildServerJson({ ...pkg, mcpName: undefined })).toThrow(
      /mcpName/,
    )
  })

  it('reports schema errors (a positional argument with neither value nor valueHint)', () => {
    const s: Loose = buildServerJson(pkg)
    s.packages[0].packageArguments = [{ type: 'positional' }]
    expect(validateServerJson(s, pkg).length).toBeGreaterThan(0)
  })

  it('reports a root-path schema error and name/version/identifier drift', () => {
    const s: Loose = buildServerJson(pkg)
    delete s.description
    expect(validateServerJson(s, pkg).join()).toMatch(/description/)
    const drifted = {
      ...s,
      description: 'x',
      name: 'a/b',
      version: '0.0.0',
      packages: [{ ...s.packages[0], identifier: 'other', version: '0.0.1' }],
    }
    expect(validateServerJson(drifted, pkg).join('\n')).toMatch(
      /name a\/b[\s\S]*version 0\.0\.0[\s\S]*identifier other[\s\S]*packages\[0\]\.version 0\.0\.1/,
    )
    expect(validateServerJson(null, pkg).length).toBeGreaterThan(0)
  })

  it('flags a missing packages entry', () => {
    const s: Loose = buildServerJson(pkg)
    s.packages = []
    expect(validateServerJson(s, pkg).join()).toMatch(/identifier undefined/)
  })
})
