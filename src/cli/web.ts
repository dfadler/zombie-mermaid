// ============================================================================
// zombie-mermaid CLI — `web` subcommand
//
// Minimal local HTTP server for interactively rendering Mermaid diagrams in
// a browser: a single page with a textarea + render button, POSTing to a
// `/render` endpoint that calls the library's own renderMermaidASCII /
// renderMermaidSVG functions and returns the result for display.
//
// Uses only node:http — no express or other dependency, consistent with
// parse-args.ts's "zero dependencies, hand-rolled" CLI philosophy.
// ============================================================================

import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { renderMermaidASCII } from '../ascii/index.ts'
import { renderMermaidSVG } from '../index.ts'
import type { WebArgs } from './parse-args.ts'

// ============================================================================
// Request body parsing
// ============================================================================

const MAX_BODY_BYTES = 1_000_000

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    req.on('error', reject)
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

interface RenderRequestBody {
  source: string
  format: 'ascii' | 'svg'
}

function parseRenderRequestBody(raw: string): RenderRequestBody {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('Invalid JSON in request body')
  }

  if (!isRecord(data)) {
    throw new Error('Request body must be a JSON object')
  }

  const source = data.source
  if (typeof source !== 'string' || source.trim().length === 0) {
    throw new Error('Provide Mermaid source as a non-empty "source" string')
  }

  const format = data.format === 'svg' ? 'svg' : 'ascii'
  return { source, format }
}

// ============================================================================
// HTTP responses
// ============================================================================

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

async function handleRenderRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const raw = await readRequestBody(req)
    const { source, format } = parseRenderRequestBody(raw)
    const output =
      format === 'svg' ? renderMermaidSVG(source) : renderMermaidASCII(source)
    sendJson(res, 200, { output, format })
  } catch (err) {
    sendJson(res, 400, {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

// ============================================================================
// Page
// ============================================================================

const PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>zombie-mermaid</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; max-width: 900px; }
  h1 { font-size: 1.25rem; }
  textarea { width: 100%; height: 200px; font-family: monospace; font-size: 14px; box-sizing: border-box; }
  pre { white-space: pre; overflow: auto; background: #111; color: #eee; padding: 1rem; border-radius: 4px; }
  .row { display: flex; gap: 1rem; align-items: center; margin: 0.75rem 0; }
  #error { color: #c00; white-space: pre-wrap; }
  #output svg { max-width: 100%; }
</style>
</head>
<body>
<h1>zombie-mermaid</h1>
<textarea id="source" placeholder="graph LR
  A --> B">graph LR
  A --> B --> C</textarea>
<div class="row">
  <label><input type="radio" name="format" value="ascii" checked /> ASCII</label>
  <label><input type="radio" name="format" value="svg" /> SVG</label>
  <button id="render" type="button">Render</button>
</div>
<div id="error"></div>
<div id="output"></div>
<script>
  const sourceEl = document.getElementById('source')
  const outputEl = document.getElementById('output')
  const errorEl = document.getElementById('error')

  async function render() {
    errorEl.textContent = ''
    outputEl.innerHTML = ''
    const formatInput = document.querySelector('input[name="format"]:checked')
    const format = formatInput ? formatInput.value : 'ascii'
    try {
      const res = await fetch('/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: sourceEl.value, format }),
      })
      const data = await res.json()
      if (!res.ok) {
        errorEl.textContent = data.error || 'Render failed'
        return
      }
      if (format === 'svg') {
        outputEl.innerHTML = data.output
      } else {
        const pre = document.createElement('pre')
        pre.textContent = data.output
        outputEl.appendChild(pre)
      }
    } catch (err) {
      errorEl.textContent = String(err)
    }
  }

  document.getElementById('render').addEventListener('click', render)
</script>
</body>
</html>
`

// ============================================================================
// Server
// ============================================================================

export function createWebServer(): Server {
  return createServer((req, res) => {
    const url = req.url ?? '/'
    const path = url.split('?')[0]

    if (req.method === 'GET' && (path === '/' || path === '')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(PAGE_HTML)
      return
    }

    if (req.method === 'POST' && path === '/render') {
      void handleRenderRequest(req, res)
      return
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not found')
  })
}

/** Start the web server and resolve once it's listening. */
export function startWebServer(port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createWebServer()
    server.once('error', reject)
    server.listen(port, () => {
      server.removeListener('error', reject)
      resolve(server)
    })
  })
}

/**
 * Execute the `web` command: start the server and report where it's
 * listening. Returns the running server so callers (tests, mainly) can
 * close it; the CLI entry point just awaits this and lets the process stay
 * alive for as long as the server is listening.
 */
export async function runWeb(
  args: WebArgs,
  log: (s: string) => void = console.log,
): Promise<Server> {
  const server = await startWebServer(args.port)
  const address = server.address()
  const port =
    isRecord(address) && typeof address.port === 'number'
      ? address.port
      : args.port
  log(`zombie-mermaid web running at http://localhost:${port}`)
  return server
}
