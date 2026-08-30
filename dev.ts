/**
 * Development server with live reload for mermaid samples.
 *
 * Usage: tsx dev.ts
 * Port defaults to 3456; override with the PORT env var, e.g.
 * `PORT=3457 tsx dev.ts` — handy for running more than one instance at once
 * (a worktree alongside the main checkout, say).
 *
 * - Runs `index.ts` to generate index.html on startup
 * - Runs `editor.ts` to generate editor.html on startup
 * - Watches src/, demo/, editor/, index.ts, samples-data.ts, editor.ts,
 *   and fork-fixes.ts for file changes
 * - On change, rebuilds index.html and notifies browsers via SSE
 * - Serves index.html with an injected live-reload script
 *
 * Routes:
 *   /         → index.html (samples showcase, as before)
 *   /editor   → editor.html (live diagram editor)
 *
 * This avoids manually re-running the build and refreshing the browser —
 * just save a file and the page updates automatically.
 */

import { watch, existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createServer, type ServerResponse } from 'node:http'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const PORT = Number(process.env.PORT) || 3456
const ROOT = dirname(fileURLToPath(import.meta.url))

// Resolve the local tsx CLI so rebuilds don't depend on PATH/.bin symlinks.
const tsxCli = fileURLToPath(import.meta.resolve('tsx/cli'))

function runTsx(file: string): Promise<{ exitCode: number | null }> {
  return new Promise((resolve) => {
    const proc = spawn(process.execPath, [tsxCli, file], {
      cwd: ROOT,
      stdio: 'inherit',
    })
    proc.on('exit', (exitCode) => resolve({ exitCode }))
  })
}

// ============================================================================
// Build management
// ============================================================================

let building = false
const sseClients = new Set<ServerResponse>()

async function rebuild(): Promise<void> {
  if (building) return
  building = true
  console.log('\x1b[36m[dev]\x1b[0m Rebuilding samples...')
  const t0 = performance.now()

  const [samplesResult, editorResult] = await Promise.all([
    runTsx(join(ROOT, 'index.ts')),
    runTsx(join(ROOT, 'editor.ts')),
  ])

  const ms = (performance.now() - t0).toFixed(0)
  if (samplesResult.exitCode === 0 && editorResult.exitCode === 0) {
    console.log(`\x1b[32m[dev]\x1b[0m Rebuilt in ${ms}ms`)
    // Notify all connected browsers to reload
    for (const client of sseClients) {
      try {
        client.write('data: reload\n\n')
      } catch {
        sseClients.delete(client)
      }
    }
  } else {
    console.error(
      `\x1b[31m[dev]\x1b[0m Build failed (samples exit ${samplesResult.exitCode}, editor exit ${editorResult.exitCode})`,
    )
  }
  building = false
}

// ============================================================================
// File watching — debounced to coalesce rapid saves
// ============================================================================

// Only these top-level paths feed the rebuild — everything else (.git/,
// node_modules/, .claude/worktrees/, test-results/, etc.) is noise that
// fs.watch's recursive mode would otherwise surface as spurious rebuilds.
const WATCHED_PREFIXES = [
  'src/',
  'demo/',
  'editor/',
  'index.ts',
  'samples-data.ts',
  'editor.ts',
  'fork-fixes.ts',
]

function isWatchedPath(filename: string): boolean {
  return WATCHED_PREFIXES.some(
    (prefix) => filename === prefix || filename.startsWith(prefix),
  )
}

let debounce: NodeJS.Timeout | null = null
function onFileChange(_event: string, filename: string | null): void {
  // Ignore generated outputs
  if (filename === 'index.html' || filename === 'editor.html') return
  if (!filename || !isWatchedPath(filename)) return
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(() => {
    console.log(
      `\x1b[90m[dev]\x1b[0m Change detected${filename ? `: ${filename}` : ''}`,
    )
    rebuild()
  }, 150)
}

// Watch the entire mermaid package for changes (excludes *.html outputs);
// onFileChange filters to the paths the rebuild actually reads.
watch(ROOT, { recursive: true }, onFileChange)

// ============================================================================
// HTTP server
// ============================================================================

// Initial build before starting the server
await rebuild()

console.log(
  `\x1b[36m[dev]\x1b[0m Server running at \x1b[1mhttp://localhost:${PORT}\x1b[0m`,
)
console.log(`\x1b[36m[dev]\x1b[0m   /         → samples showcase`)
console.log(`\x1b[36m[dev]\x1b[0m   /editor   → live diagram editor\n`)

const liveReloadScript = `  <script>
    // Live reload — SSE connection to dev server.
    // When the server signals a rebuild, the page reloads automatically.
    // If the connection drops (server restarting), it reconnects with backoff.
    ;(function() {
      function connect() {
        var es = new EventSource('/__dev_events');
        es.onmessage = function(e) {
          if (e.data === 'reload') location.reload();
        };
        es.onerror = function() {
          es.close();
          setTimeout(connect, 500);
        };
      }
      connect();
    })();
  </script>
</body>`

function injectLiveReload(html: string): string {
  return html.replace('</body>', liveReloadScript)
}

async function serveHtml(filename: string, res: ServerResponse): Promise<void> {
  const path = join(ROOT, filename)
  if (!existsSync(path)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end(`${filename} not found — build may have failed`)
    return
  }
  const html = await readFile(path, 'utf-8')
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end(injectLiveReload(html))
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)

  // SSE endpoint — browsers connect here to receive reload signals
  if (url.pathname === '/__dev_events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    res.write('\n')
    sseClients.add(res)
    req.on('close', () => {
      sseClients.delete(res)
    })
    return
  }

  // Live editor
  if (url.pathname === '/editor' || url.pathname === '/editor.html') {
    void serveHtml('editor.html', res)
    return
  }

  // Samples showcase (default, as before)
  void serveHtml('index.html', res)
})

server.listen(PORT)
