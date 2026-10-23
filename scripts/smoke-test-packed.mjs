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
import { mapProblems } from './check-pack-dist.mjs'

const root = resolve(import.meta.dirname, '..')
const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const dev = rootPkg.devDependencies
const tmp = mkdtempSync(join(tmpdir(), 'zm-smoke-'))
// SMOKE_TARBALL_DIR keeps the tarballs where `check:package-types` can reuse them.
const tarDir = process.env.SMOKE_TARBALL_DIR
  ? resolve(process.env.SMOKE_TARBALL_DIR)
  : join(tmp, 'tarballs')
mkdirSync(tarDir, { recursive: true })

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

await check('tarballs ship no .map and no dangling sourceMappingURL', () => {
  const bad = pkgDirs.flatMap((d) => mapProblems(d).map((p) => `${d}: ${p}`))
  if (bad.length) throw new Error(bad.join('\n'))
})

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

await check(
  'MCP render runs in the worker, byte-identical (ESM and CJS)',
  () => {
    // One real tool call per renderer from the packed tarball (#1856): exercises
    // dist/render-worker.js being shipped and found from index.js / index.cjs.
    const body = `
    const ELK = (await import('elkjs/lib/elk.bundled.js')).default
    zm.registerElk(ELK)
    const server = mcp.createMcpServer()
    const client = new Client({ name: 'smoke', version: '0' })
    const [ct, st] = InMemoryTransport.createLinkedPair()
    await Promise.all([server.connect(st), client.connect(ct)])
    const diagram = ${JSON.stringify(SVG_ELK.flowchart)}
    const want = {
      render_mermaid_svg: zm.renderMermaidSVG(diagram),
      render_mermaid_ascii: zm.renderMermaidASCII(diagram, { colorMode: 'none' }),
    }
    for (const [name, text] of Object.entries(want)) {
      const r = await client.callTool({ name, arguments: { diagram } })
      if (r.isError || r.content[0].text !== text) throw new Error('worker output differs for ' + name)
    }
    await client.close()
    await server.close()`
    const sdk = '@modelcontextprotocol/sdk'
    writeFileSync(
      join(app, 'mcp-render.mjs'),
      `import * as zm from 'zombie-mermaid'
import * as mcp from 'zombie-mermaid/mcp'
import { Client } from '${sdk}/client/index.js'
import { InMemoryTransport } from '${sdk}/inMemory.js'
${body}`,
    )
    writeFileSync(
      join(app, 'mcp-render.cjs'),
      `const zm = require('zombie-mermaid')
const mcp = require('zombie-mermaid/mcp')
const { Client } = require('${sdk}/client/index.js')
const { InMemoryTransport } = require('${sdk}/inMemory.js')
;(async () => {${body}})().catch((e) => { console.error(e); process.exit(1) })`,
    )
    run('node', ['mcp-render.mjs'], app, { timeout: 60000 })
    run('node', ['mcp-render.cjs'], app, { timeout: 60000 })
  },
)

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
  const tsc = join(app, 'node_modules/.bin/tsc')
  run(tsc, ['-p', '.'], app)
  // node16 is the one that rejects a .d.cts re-exporting an ESM .d.ts
  // (TS1479) — nodenext allows it, so it can't catch a missing
  // dist/shared/package.json (#2196). No `zombie-mermaid/mcp` import here: the
  // MCP SDK's own declarations don't pass node16 with skipLibCheck off.
  writeFileSync(
    join(app, 'types-node16.cts'),
    src
      .replace(/^import \{ createMcpServer.*\n/m, '')
      .replace(', createMcpServer', ''),
  )
  writeFileSync(
    join(app, 'tsconfig.node16.json'),
    JSON.stringify({
      extends: './tsconfig.json',
      compilerOptions: { module: 'node16', moduleResolution: 'node16' },
      files: ['types-node16.cts'],
    }),
  )
  run(tsc, ['-p', 'tsconfig.node16.json'], app)
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

await check('MCP server starts, answers initialize and renders', async () => {
  const child = spawn(join(app, 'node_modules/.bin/zombie-mermaid'), ['mcp'], {
    cwd: app,
  })
  try {
    // JSON-RPC replies by id; each is one stdout line.
    const waiting = new Map()
    let buf = ''
    child.stdout.on('data', (d) => {
      buf += d
      for (let nl; (nl = buf.indexOf('\n')) >= 0;) {
        const msg = JSON.parse(buf.slice(0, nl))
        buf = buf.slice(nl + 1)
        waiting.get(msg.id)?.(msg)
      }
    })
    const call = (id, method, params) =>
      new Promise((res, rej) => {
        waiting.set(id, res)
        child.on('exit', (c) => rej(new Error(`mcp exited early (${c})`)))
        setTimeout(() => rej(new Error(`mcp ${method} timed out`)), 30000)
        child.stdin.write(
          JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n',
        )
      })
    const init = await call(1, 'initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'smoke', version: '0' },
    })
    if (!init.result?.serverInfo) throw new Error('no serverInfo')
    child.stdin.write(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      }) + '\n',
    )
    const rendered = await call(2, 'tools/call', {
      name: 'render_mermaid_svg',
      arguments: { diagram: SVG_ELK.flowchart },
    })
    if (
      rendered.result?.isError ||
      !rendered.result?.content[0].text.includes('<svg')
    )
      throw new Error('no svg from the CLI MCP server')
  } finally {
    child.kill()
  }
})

// #1986: legacy `moduleResolution: node` has no `exports` support, so the
// subpaths resolve only through the root `typesVersions` map.
await check('types resolve under moduleResolution node10', () => {
  writeFileSync(
    join(app, 'node10.ts'),
    `import { renderMermaidASCII } from 'zombie-mermaid/ascii'
import { createMcpServer } from 'zombie-mermaid/mcp'
void [renderMermaidASCII, createMcpServer]
`,
  )
  writeFileSync(
    join(app, 'tsconfig.node10.json'),
    JSON.stringify({
      compilerOptions: {
        module: 'commonjs',
        moduleResolution: 'node10',
        ignoreDeprecations: '6.0',
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        types: ['node'],
      },
      files: ['node10.ts'],
    }),
  )
  run(join(app, 'node_modules/.bin/tsc'), ['-p', 'tsconfig.node10.json'], app)
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
