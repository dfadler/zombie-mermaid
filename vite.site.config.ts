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
import { prerender } from './packages/site/ssr/prerender.ts'

const abs = (p: string) => fileURLToPath(new URL(p, import.meta.url))

/** name -> [entry, minify]; names are what entry-server.ts reads from `clients`. */
const CLIENTS: Record<string, [string, boolean]> = {
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
        // Whitespace-only minify: nav's inlined `initMobileMenu` script is
        // `Function.prototype.toString()` output, which the old tsx/esbuild
        // pipeline emitted compact; this keeps it (nearly) byte-identical
        // instead of +512B/page. No mangling, so names and behavior stay.
        output: {
          minify: { mangle: false, compress: false, codegen: { removeWhitespace: true } },
        },
      },
    },
  },
}
for (const [name, [entry, minify]] of Object.entries(CLIENTS)) {
  environments[envName(name)] = {
    consumer: 'client',
    build: {
      write: false,
      minify,
      target: 'esnext',
      rolldownOptions: {
        input: abs(entry),
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
      await prerender(SSR_OUT, clients, process.env.SITE_OUT_DIR ?? 'site')
    },
  },
})
