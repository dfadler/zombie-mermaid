// Guards .oxlintrc.json (#2193): a seeded fixture with one violation per
// configured rule must make oxlint report every rule, so a rule silently
// dropped or renamed by an oxlint upgrade fails here instead of going dark.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '..')
const CONFIG = join(ROOT, '.oxlintrc.json')
const OXLINT = join(ROOT, 'node_modules/.bin/oxlint')
const FLAG = '--report-unused-disable-directives-severity=error'

const FIXTURE = `/// <reference path="./x.d.ts" />
var a = 1
let b = 2
export function f(p: number, _q: number, ...r: number[]) {
  p = 3
  return [a, b, p, r, arguments, Math.max.apply(Math, r)]
}
export function g(o: { x: number }) {
  o.x = 4 // no-param-reassign props:false: allowed
}
export const arr = Array(1, 2)
export const unusedExpr = () => {
  1 + 1
}
export const c: any = 1
// @ts-ignore
export const d = c
export const e = require('fs')
export const w: String = 'x'
export const fn: Function = () => 1
export const emptyObj: {} = {}
export const nn = (o?: { x: number }) => o?.x!
export const nn2 = (o: { x: number }) => o!!.x
export const lit = 'a' as 'a'
export enum E { A = 1, B = 1 }
export class K { m() { const self = this; return self } }
export interface K { z: number }
export interface Ctor { new (): Ctor }
export function id<T extends unknown>(t: T) { return t }
namespace N { export const n = 1 }
module M { export const m = 1 }
`

// Hard-coded on purpose: deleting a rule from the config must fail this test.
const EXPECTED_RULES = [
  'no-var',
  'prefer-const',
  'prefer-rest-params',
  'prefer-spread',
  'no-param-reassign',
  'no-unused-vars',
  'no-unused-expressions',
  'no-array-constructor',
  'typescript/ban-ts-comment',
  'typescript/no-duplicate-enum-values',
  'typescript/no-empty-object-type',
  'typescript/no-explicit-any',
  'typescript/no-extra-non-null-assertion',
  'typescript/no-misused-new',
  'typescript/no-namespace',
  'typescript/no-non-null-asserted-optional-chain',
  'typescript/no-require-imports',
  'typescript/no-this-alias',
  'typescript/no-unnecessary-type-constraint',
  'typescript/no-unsafe-declaration-merging',
  'typescript/no-unsafe-function-type',
  'typescript/no-wrapper-object-types',
  'typescript/prefer-as-const',
  'typescript/prefer-namespace-keyword',
  'typescript/triple-slash-reference',
]

const tmps: string[] = []
afterEach(() => {
  while (tmps.length) rmSync(tmps.pop()!, { recursive: true, force: true })
})

function oxlint(files: Record<string, string>, extra: string[] = []) {
  const dir = mkdtempSync(join(tmpdir(), 'oxlint-cfg-'))
  tmps.push(dir)
  for (const [n, body] of Object.entries(files))
    writeFileSync(join(dir, n), body)
  const r = spawnSync(
    OXLINT,
    ['-c', CONFIG, '-f', 'json', FLAG, ...extra, ...Object.keys(files)],
    { cwd: dir, encoding: 'utf8' },
  )
  const diagnostics: { code: string; message: string; severity: string }[] =
    JSON.parse(r.stdout).diagnostics
  const rules = diagnostics.map((d) =>
    (d.code ?? '')
      .replace(/^eslint\((.*)\)$/, '$1')
      .replace(/^typescript\((.*)\)$/, 'typescript/$1'),
  )
  return { status: r.status, diagnostics, rules }
}

describe('.oxlintrc.json', () => {
  it('reports every configured rule on the seeded fixture', () => {
    const cfg = JSON.parse(readFileSync(CONFIG, 'utf8'))
    const configured: string[] = Object.keys(cfg.overrides[0].rules)
    const { status, rules } = oxlint({ 'fixture.ts': FIXTURE })
    expect(status).not.toBe(0)
    expect(configured.sort()).toEqual([...EXPECTED_RULES].sort())
    expect(EXPECTED_RULES.filter((r) => !rules.includes(r))).toEqual([])
  })

  it('allows prop writes on a parameter but flags rebinding it (props: false)', () => {
    const { diagnostics } = oxlint({ 'fixture.ts': FIXTURE })
    const reassign = diagnostics.filter((d) =>
      d.code.includes('no-param-reassign'),
    )
    expect(reassign.map((d) => d.message)).toEqual([
      "Assignment to function parameter 'p'.",
    ])
  })

  it('honours eslint-disable with a -- reason, and errors on a stale one', () => {
    const ok = oxlint({
      'ok.ts':
        '// eslint-disable-next-line @typescript-eslint/no-explicit-any -- reason\nexport const x: any = 1\n',
    })
    expect(ok.status).toBe(0)
    const stale = oxlint({
      'stale.ts':
        '// eslint-disable-next-line no-var -- reason\nexport const x = 1\n',
    })
    expect(stale.status).not.toBe(0)
    expect(stale.diagnostics[0].severity).toBe('error')
  })

  it('ignores underscore-prefixed unused names', () => {
    const { status } = oxlint({
      'u.ts':
        'export function f(_a: number) {\n  try { f(1) } catch (_e) { /* x */ }\n  const _v = 1\n}\n',
    })
    expect(status).toBe(0)
  })
})
