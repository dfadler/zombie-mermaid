// Smoke-tests the packed tarballs the way a consumer would (#1566).
//
// `pnpm pack`s the umbrella and every public @zombie-mermaid/* package (run
// `pnpm run build` first), installs the tarballs into clean temp projects
// with npm, and checks what unit tests against the workspace cannot:
// missing `files`, broken `exports`, bad types, an unrunnable bin, and the
// optional-peer elkjs contract (#1370). Run: `pnpm run smoke:packed`.
//
// Not covered: webpack / Next.js bundling (Vite only). Add when a consumer
// reports a bundler-specific break.

import { execFileSync, spawn } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const dev = rootPkg.devDependencies
const tmp = mkdtempSync(join(tmpdir(), 'zm-smoke-'))
const tarDir = join(tmp, 'tarballs')
mkdirSync(tarDir)

const run = (cmd, args, cwd, opts = {}) =>
  execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: 'pipe', ...opts })

let failures = 0
const check = (name, fn) =>
  Promise.resolve()
    .then(fn)
    .then(
      () => console.log(`ok   ${name}`),
      (e) => {
        failures++
        console.error(
          `FAIL ${name}\n${e.stdout ?? ''}${e.stderr ?? ''}${e.message}`,
        )
      },
    )

// --- pack -------------------------------------------------------------------
const pkgDirs = [
  root,
  ...readdirSync(join(root, 'packages')).map((d) => join(root, 'packages', d)),
]
  .filter((d) => existsSync(join(d, 'package.json')))
  .filter(
    (d) => !JSON.parse(readFileSync(join(d, 'package.json'), 'utf8')).private,
  )
const tarballs = {}
for (const d of pkgDirs) {
  const name = JSON.parse(readFileSync(join(d, 'package.json'), 'utf8')).name
  run('pnpm', ['pack', '--pack-destination', tarDir], d)
  tarballs[name] = join(
    tarDir,
    `${name.replace('@', '').replace('/', '-')}-${rootPkg.version}.tgz`,
  )
}
console.log(`packed: ${Object.keys(tarballs).join(', ')}`)

// Resolve every workspace package from its tarball (they are not on the
// registry at this version yet), but everything else from the registry.
const overrides = Object.fromEntries(
  Object.entries(tarballs)
    .filter(([n]) => n.startsWith('@'))
    .map(([n, t]) => [n, `file:${t}`]),
)

function project(name, deps) {
  const dir = join(tmp, name)
  mkdirSync(dir)
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({
      name,
      private: true,
      type: 'module',
      dependencies: deps,
      overrides,
    }),
  )
  run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], dir)
  return dir
}
const node = (dir, file) => run('node', [file], dir)

const SVG_ELK = {
  flowchart: 'graph TD\n  A --> B',
  state: 'stateDiagram-v2\n  [*] --> A',
  class: 'classDiagram\n  Animal <|-- Dog',
  er: 'erDiagram\n  A ||--o{ B : has',
  architecture:
    'architecture-beta\n  service a(server)[A]\n  service b(server)[B]\n  a:R -- L:b',
}
const SVG_FREE = {
  sequence: 'sequenceDiagram\n  A->>B: hi',
  pie: 'pie\n  "A" : 1\n  "B" : 2',
  xychart: 'xychart-beta\n  line [1, 2, 3]',
  c4: 'C4Context\n  Person(u, "User")\n  System(s, "System")\n  Rel(u, s, "uses")',
}
const ALL = { ...SVG_ELK, ...SVG_FREE }

// --- 1. umbrella consumer ---------------------------------------------------
const app = project('app', {
  'zombie-mermaid': `file:${tarballs['zombie-mermaid']}`,
  elkjs: dev.elkjs ?? rootPkg.dependencies.elkjs,
  typescript: dev.typescript,
  vite: dev.vite,
  '@types/node': dev['@types/node'] ?? '*',
})

const entries = ['zombie-mermaid', 'zombie-mermaid/ascii', 'zombie-mermaid/mcp']
const scoped = Object.keys(tarballs).filter((n) => n.startsWith('@'))

await check('ESM + CJS import of every entry point', () => {
  const specs = JSON.stringify([...entries, ...scoped])
  writeFileSync(
    join(app, 'imp.mjs'),
    `for (const s of ${specs}) { const m = await import(s); if (!Object.keys(m).length) throw new Error('empty ESM ' + s) }`,
  )
  writeFileSync(
    join(app, 'imp.cjs'),
    `for (const s of ${specs}) { const m = require(s); if (!Object.keys(m).length) throw new Error('empty CJS ' + s) }`,
  )
  node(app, 'imp.mjs')
  node(app, 'imp.cjs')
})

await check('svg + ascii render for every diagram type (ESM and CJS)', () => {
  const body = `
    const ELK = (await import('elkjs/lib/elk.bundled.js')).default
    zm.registerElk(ELK)
    for (const [k, src] of Object.entries(${JSON.stringify(ALL)})) {
      if (!zm.renderMermaidSVG(src).includes('<svg')) throw new Error('svg ' + k)
      if (!zm.renderMermaidASCII(src).trim()) throw new Error('ascii ' + k)
    }`
  writeFileSync(
    join(app, 'render.mjs'),
    `import * as zm from 'zombie-mermaid'\n${body}`,
  )
  writeFileSync(
    join(app, 'render.cjs'),
    `const zm = require('zombie-mermaid')\n;(async () => {${body}})().catch((e) => { console.error(e); process.exit(1) })`,
  )
  node(app, 'render.mjs')
  node(app, 'render.cjs')
})

await check('types resolve (tsc, ESM + CJS)', () => {
  const src = `import { renderMermaidSVG, registerElk } from 'zombie-mermaid'
import { renderMermaidASCII } from 'zombie-mermaid/ascii'
import { createMcpServer } from 'zombie-mermaid/mcp'
const s: string = renderMermaidSVG('graph TD\\n A-->B')
const a: string = renderMermaidASCII('graph TD\\n A-->B')
void [s, a, registerElk, createMcpServer]
`
  writeFileSync(join(app, 'types.mts'), src)
  writeFileSync(join(app, 'types.cts'), src)
  writeFileSync(
    join(app, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        module: 'nodenext',
        strict: true,
        noEmit: true,
        skipLibCheck: false,
        types: ['node'],
      },
      files: ['types.mts', 'types.cts'],
    }),
  )
  run(join(app, 'node_modules/.bin/tsc'), ['-p', '.'], app)
})

await check('CLI: --version and render (svg + ascii)', () => {
  const bin = join(app, 'node_modules/.bin/zombie-mermaid')
  if (!run(bin, ['--version'], app).includes(rootPkg.version))
    throw new Error('version mismatch')
  writeFileSync(join(app, 'in.mmd'), SVG_ELK.flowchart)
  run(bin, ['render', 'in.mmd', '--svg', '-o', 'out.svg'], app)
  if (!readFileSync(join(app, 'out.svg'), 'utf8').includes('<svg'))
    throw new Error('no svg')
  if (!run(bin, ['render', 'in.mmd', '--ascii'], app).trim())
    throw new Error('no ascii')
})

await check('MCP server starts and answers initialize', async () => {
  const child = spawn(join(app, 'node_modules/.bin/zombie-mermaid'), ['mcp'], {
    cwd: app,
  })
  try {
    const reply = new Promise((res, rej) => {
      let buf = ''
      child.stdout.on('data', (d) => {
        buf += d
        if (buf.includes('\n')) res(buf)
      })
      child.on('exit', (c) => rej(new Error(`mcp exited early (${c})`)))
      setTimeout(() => rej(new Error('mcp initialize timed out')), 15000)
    })
    child.stdin.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'smoke', version: '0' },
        },
      }) + '\n',
    )
    if (!JSON.parse(await reply).result?.serverInfo)
      throw new Error('no serverInfo')
  } finally {
    child.kill()
  }
})

await check('Vite bundles a consumer app', () => {
  writeFileSync(
    // nosemgrep: javascript.lang.security.audit.unknown-value-with-script-tag.unknown-value-with-script-tag -- static markup written to this script's own temp dir
    join(app, 'index.html'),
    '<script type="module" src="./main.js"></script>',
  )
  writeFileSync(
    join(app, 'main.js'),
    `import ELK from 'elkjs/lib/elk.bundled.js'
import { registerElk, renderMermaidSVG } from 'zombie-mermaid'
registerElk(ELK)
document.body.innerHTML = renderMermaidSVG('graph TD\\n A-->B')`,
  )
  run(
    join(app, 'node_modules/.bin/vite'),
    ['build', '--logLevel', 'error'],
    app,
  )
  if (!readdirSync(join(app, 'dist/assets')).some((f) => f.endsWith('.js')))
    throw new Error('no bundle')
})

// --- 2. optional-peer elkjs contract (svg-renderer alone, no elkjs) ---------
await check('registerElk: error without elkjs, works once installed', () => {
  const lib = project('lib', {
    '@zombie-mermaid/svg-renderer': `file:${tarballs['@zombie-mermaid/svg-renderer']}`,
  })
  const probe = `
    import * as zm from '@zombie-mermaid/svg-renderer'
    const mode = process.argv[2]
    if (mode === 'register') zm.registerElk((await import('elkjs/lib/elk.bundled.js')).default)
    let err
    try { zm.renderMermaidSVG('graph TD\\n A-->B') } catch (e) { err = e }
    if (mode === 'none') {
      if (!(err instanceof zm.ElkNotRegisteredError)) throw new Error('expected ElkNotRegisteredError, got ' + err)
      if (zm.renderMermaidSVG('sequenceDiagram\\n A->>B: hi').indexOf('<svg') < 0) throw new Error('seq needs elk?')
    } else if (err) throw err`
  writeFileSync(join(lib, 'probe.mjs'), probe)
  run('node', ['probe.mjs', 'none'], lib)
  run(
    'npm',
    [
      'install',
      '--no-audit',
      '--no-fund',
      '--loglevel=error',
      '--no-save',
      `elkjs@${dev.elkjs ?? rootPkg.dependencies.elkjs}`,
    ],
    lib,
  )
  run('node', ['probe.mjs', 'register'], lib) // explicit registerElk
  run('node', ['probe.mjs', 'autoload'], lib) // Node auto-load
})

console.log(
  failures
    ? `\n${failures} smoke check(s) failed (temp dir: ${tmp})`
    : '\nall smoke checks passed',
)
process.exit(failures ? 1 : 0)
