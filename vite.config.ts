/**
 * Development server for the site (zombie-mermaid#307, #1844).
 *
 * The site is built by ONE pipeline, `vite build --app -c vite.site.config.ts`
 * (the same command as `pnpm run build:site`, which CI and GitHub Pages use):
 * an SSR route table in packages/site/ssr/ prerendered to static HTML. This
 * config's job is only to re-run that build on a relevant file change and
 * serve its output, with Vite providing the HTTP server, file watching, and
 * HMR websocket (a `full-reload` after each rebuild).
 *
 * Design choice: a full rebuild per change (~6 s) into `.site-dev/`, served
 * as plain files, rather than `ssrLoadModule` + per-route rendering. A spawned
 * child is required anyway (the prerender step `import()`s the built SSR
 * bundle, which Node would cache across in-process rebuilds), and serving
 * files keeps dev byte-identical to what ships. Revisit if rebuild latency
 * hurts; the route table is already a pure function of the clients map.
 *
 * Usage: `pnpm run dev` (`vite`). Port defaults to 3456; override with the
 * PORT env var, e.g. `PORT=3457 pnpm run dev` -- handy for running more than
 * one instance at once (a worktree alongside the main checkout, say).
 *
 * Routes are whatever the build wrote (`/` -> index.html, `/editor` ->
 * editor.html, `/diagrams/`, `/blog/`, `/fork-fixes.html`, `/dashboard.html`,
 * detail pages, feeds, `public/` assets), plus a 301 from a bare `/diagrams`
 * or `/blog` to the trailing-slash form, as GitHub Pages does.
 */

import { existsSync, statSync } from 'node:fs'
import { readFile, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { defaultPort } from './scripts/dev-port.ts'
import {
  defineConfig,
  normalizePath,
  type Plugin,
  type ViteDevServer,
} from 'vite'

const ROOT = dirname(fileURLToPath(import.meta.url))
/** Where dev rebuilds write (gitignored); `build:site` writes `site/`. */
const OUT = join(ROOT, '.site-dev')

// Resolve the local vite CLI so rebuilds don't depend on PATH/.bin symlinks.
const viteCli = join(
  dirname(fileURLToPath(import.meta.resolve('vite/package.json'))),
  'bin/vite.js',
)

function runSiteBuild(): Promise<number | null> {
  return new Promise((done) => {
    spawn(
      process.execPath,
      [viteCli, 'build', '--app', '-c', 'vite.site.config.ts'],
      {
        cwd: ROOT,
        stdio: 'inherit',
        env: { ...process.env, SITE_OUT_DIR: OUT },
      },
    ).on('exit', done)
  })
}

// Only these top-level paths are watched (explicitly added below) and feed
// the rebuild -- everything else (.git/, node_modules/, .claude/worktrees/,
// test-results/, the .site-dev/ output itself) is deliberately never added
// to the watcher at all, rather than added-then-filtered.
const WATCHED_PREFIXES = [
  'src/',
  'demo/',
  'editor/',
  'public/',
  'blog-posts/',
  'packages/site/',
  'packages/core/src/',
  'packages/mermaid-parser/src/',
  'packages/svg-renderer/src/',
  'packages/ascii-renderer/src/',
  'packages/mcp/src/',
  'vite.site.config.ts',
]

function isWatchedPath(relPath: string): boolean {
  return WATCHED_PREFIXES.some((prefix) => relPath.startsWith(prefix))
}

let building = false
// Set when a change arrives while a rebuild is already running, so it isn't
// dropped on the floor -- rebuild() runs once more right after the current
// one finishes.
let rebuildQueued = false
async function rebuild(server: ViteDevServer): Promise<void> {
  if (building) {
    rebuildQueued = true
    return
  }
  building = true
  console.log('\x1b[36m[dev]\x1b[0m Rebuilding site...')
  const t0 = performance.now()
  await rm(OUT, { recursive: true, force: true })
  const exit = await runSiteBuild()
  building = false
  const ms = (performance.now() - t0).toFixed(0)
  if (exit === 0) {
    console.log(`\x1b[32m[dev]\x1b[0m Rebuilt in ${ms}ms`)
    server.ws.send({ type: 'full-reload' })
  } else {
    console.error(`\x1b[31m[dev]\x1b[0m Build failed (exit ${exit})`)
  }

  if (rebuildQueued) {
    rebuildQueued = false
    void rebuild(server)
  }
}

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css',
  '.xml': 'application/xml',
  '.js': 'text/javascript',
}

function siteRebuildPlugin(): Plugin {
  let debounce: NodeJS.Timeout | null = null

  return {
    name: 'zombie-mermaid-site-rebuild',
    async configureServer(server) {
      // Initial build before the server starts accepting requests.
      await rebuild(server)

      // Vite's watcher only watches paths pulled into its module graph by
      // default, and the pages are served straight from disk below (bypassing
      // that graph), so nothing would otherwise tell chokidar these paths exist.
      server.watcher.add(WATCHED_PREFIXES.map((prefix) => join(ROOT, prefix)))

      server.watcher.on('all', (_event, file) => {
        // normalize to forward slashes (matching WATCHED_PREFIXES) so this
        // doesn't silently stop matching on Windows.
        const relPath = normalizePath(relative(ROOT, file))
        if (!isWatchedPath(relPath)) return
        if (debounce) clearTimeout(debounce)
        debounce = setTimeout(() => {
          console.log(`\x1b[90m[dev]\x1b[0m Change detected: ${relPath}`)
          void rebuild(server)
        }, 150)
      })

      // Serve the built files directly with just the Vite HMR client script
      // spliced into HTML. Deliberately *not* routed through
      // server.transformIndexHtml(): the pages are already-bundled,
      // self-contained output (the same files `build:site` ships), and Vite's
      // HTML pipeline once errored out on a page's large inlined stylesheet.
      server.middlewares.use(async (req, res, next) => {
        const url = decodeURIComponent((req.url ?? '/').split('?')[0]!)

        // The pages link CSS relatively (`assets/blog.css`), which a bare
        // directory URL resolves one level too high (zombie-mermaid#1058).
        // GitHub Pages 301-redirects to the trailing slash; mirror that.
        if (url === '/diagrams' || url === '/blog') {
          res.statusCode = 301
          res.setHeader('Location', `${url}/`)
          res.end()
          return
        }
        if (url.startsWith('/@') || url.startsWith('/node_modules/')) {
          next()
          return
        }

        let rel = url.replace(/^\/+/, '')
        if (rel === '' || rel.endsWith('/')) rel += 'index.html'
        else if (!extname(rel)) rel += '.html' // `/editor` -> editor.html
        // Traversal guard: the URL feeds straight into a path join.
        const path = resolve(OUT, rel)
        if (
          !path.startsWith(OUT + sep) ||
          !existsSync(path) ||
          !statSync(path).isFile()
        ) {
          next()
          return
        }

        if (!path.endsWith('.html')) {
          const type = CONTENT_TYPES[extname(path)]
          if (!type) {
            next() // images etc.: Vite's own public/ handling serves them
            return
          }
          res.setHeader('Content-Type', type)
          res.end(await readFile(path))
          return
        }

        const raw = await readFile(path, 'utf-8')
        const viteClientTag = `  <script type="module" src="/@vite/client"></script>\n</head>`
        res.setHeader('Content-Type', 'text/html')
        res.end(
          raw.includes('</head>') ? raw.replace('</head>', viteClientTag) : raw,
        )
      })
    },
  }
}

export default defineConfig({
  root: ROOT,
  server: {
    port: defaultPort(ROOT),
    // Build outputs/intermediates must never feed Vite's own watcher (its
    // tsconfig-change handling would force reloads mid-build). `site/` is
    // anchored to the repo root: an unanchored `**/site/**` would also match
    // `packages/site/`, whose edits must trigger a rebuild.
    watch: {
      ignored: [
        '**/.site-ssr/**',
        '**/.site-dev/**',
        `${normalizePath(join(ROOT, 'site'))}/**`,
      ],
    },
  },
  plugins: [siteRebuildPlugin()],
})
