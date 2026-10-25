/**
 * The site build (#1844): `vite build --app -c vite.site.config.ts`.
 * One `ssr` environment bundles packages/site/ssr/entry-server.ts (the route
 * table); one `client` environment per browser entry produces a self-contained
 * in-memory bundle (Rolldown refuses `codeSplitting: false` with several
 * inputs, hence one build per entry); then prerender.ts writes the files.
 * Output dir: `SITE_OUT_DIR` (default `site`).
 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import { defineConfig, type EnvironmentOptions } from 'vite'
import { mobileMenuScript } from './demo/components/mobile-menu-script-plugin.ts'
import { forkFixes } from './demo/fork-fixes-data.ts'
import { renderBeforeAll } from './packages/site/ssr/fork-fixes-before.ts'
import { prerender } from './packages/site/ssr/prerender.ts'

const abs = (p: string) => fileURLToPath(new URL(p, import.meta.url))

/**
 * Name -> [entry, minify, treeshake?]; names are what the routes read from
 * `clients`. `treeshake: false` is for a bundle that exists to run its modules'
 * top-level side effects (DOM lookups, listeners), not to export a value:
 * the package declares `"sideEffects": false`, which a concatenation-replacement
 * bundle like editor/js must not be subject to. A failing client build fails
 * the whole build (vite exits non-zero), as the retired editor generator did explicitly.
 */
const CLIENTS: Record<string, [string, boolean, boolean?]> = {
  'editor-browser': ['src/browser.ts', true],
  'editor-client': ['demo/editor-client.tsx', true],
  'editor-app': ['editor/js/index.ts', false, false],
  'fork-fixes-client': ['demo/fork-fixes-client.tsx', true],
  'dashboard-client': ['demo/dashboard-client.tsx', true],
  'index-client': ['demo/index-client.tsx', true],
  'index-page-client': ['demo/index-page-client.ts', false],
  'blog-post-client': ['demo/blog-post-client.tsx', true],
  'blog-index-client': ['demo/blog-index-client.tsx', true],
  'diagram-type-client': ['demo/diagram-type-client.tsx', true],
  'diagram-hub-client': ['demo/diagram-hub-client.tsx', true],
  'diagram-detail-client': ['demo/diagram-detail-client.tsx', true],
  'diagram-tag-client': ['demo/diagram-tag-client.tsx', true],
  'diagram-all-client': ['demo/diagram-all-client.tsx', true],
}
// Environment names must match [A-Za-z0-9_$].
const envName = (n: string) => `c_${n.replace(/-/g, '_')}`

const SSR_OUT = abs('.site-ssr/server')

const environments: Record<string, EnvironmentOptions> = {
  ssr: {
    consumer: 'server',
    build: {
      ssr: true,
      outDir: SSR_OUT,
      emptyOutDir: true,
      copyPublicDir: false,
      minify: false,
      target: 'esnext',
      rolldownOptions: {
        input: abs('packages/site/ssr/entry-server.ts'),
      },
    },
  },
}
for (const [name, [entry, minify, treeshake = true]] of Object.entries(
  CLIENTS,
)) {
  environments[envName(name)] = {
    consumer: 'client',
    build: {
      write: false,
      minify,
      target: 'esnext',
      rolldownOptions: {
        input: abs(entry),
        treeshake,
        preserveEntrySignatures: 'strict',
        output: {
          format: 'es',
          codeSplitting: false,
          entryFileNames: 'bundle.js',
        },
      },
    },
  }
}

const WORKSPACE = [
  'core',
  'mermaid-parser',
  'svg-renderer',
  'ascii-renderer',
  'mcp',
]

export default defineConfig({
  logLevel: 'warn',
  resolve: {
    alias: Object.fromEntries(
      WORKSPACE.map((n) => [
        `@zombie-mermaid/${n}`,
        abs(`packages/${n}/src/index.ts`),
      ]),
    ),
  },
  plugins: [
    mobileMenuScript(),
    {
      // Bundled SSR output loses source-relative `import.meta.url` reads
      // (generators' `new URL('../x', import.meta.url)`, primitives-css.tsx's
      // sibling .module.css): pin each to its source module's file URL.
      name: 'site:pin-import-meta-url',
      applyToEnvironment: (e) => e.name === 'ssr',
      transform(code, id) {
        if (!code.includes('import.meta.url')) return null
        return code.replaceAll(
          'import.meta.url',
          JSON.stringify(pathToFileURL(id).href),
        )
      },
    },
  ],
  environments,
  builder: {
    async buildApp(builder) {
      const clients: Record<string, string> = {}
      // The slow part (an archived tree per fix, see fork-fixes-before.ts) starts
      // first and overlaps the SSR and client builds.
      const befores = renderBeforeAll(forkFixes, abs('.site-ssr/fork-fixes'))
      befores.catch(() => {}) // Surfaced by the await below; no unhandled rejection meanwhile
      await Promise.all([
        builder.build(builder.environments.ssr!),
        ...Object.keys(CLIENTS).map(async (name) => {
          const res = await builder.build(builder.environments[envName(name)]!)
          const out = Array.isArray(res) ? res[0]! : res
          if (!('output' in out)) throw new Error(`no output for ${name}`)
          const chunk = out.output.find((o) => o.type === 'chunk')
          if (chunk?.type !== 'chunk') throw new Error(`no chunk for ${name}`)
          clients[name] = chunk.code
        }),
      ])
      await prerender(
        SSR_OUT,
        clients,
        await befores,
        process.env.SITE_OUT_DIR ?? 'site',
      )
    },
  },
})
