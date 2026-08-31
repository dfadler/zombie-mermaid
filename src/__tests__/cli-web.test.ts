import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Server } from 'node:http'
import { createWebServer, runWeb, startWebServer } from '../cli/web.ts'

// ============================================================================
// Server lifecycle helpers
// ============================================================================

let server: Server
let baseUrl: string

beforeAll(async () => {
  server = createWebServer()
  await new Promise<void>((resolve) => {
    server.listen(0, resolve)
  })
  const address = server.address()
  if (address === null || typeof address === 'string') {
    throw new Error('Expected server to bind to a port')
  }
  baseUrl = `http://127.0.0.1:${address.port}`
})

afterAll(() => {
  server.close()
})

// ============================================================================
// GET /
// ============================================================================

describe('web server – GET /', () => {
  it('serves the HTML page with a textarea and render button', async () => {
    const res = await fetch(baseUrl + '/')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')

    const html = await res.text()
    expect(html).toContain('<textarea')
    expect(html).toContain('Render')
  })
})

// ============================================================================
// POST /render — ASCII
// ============================================================================

describe('web server – POST /render (ascii)', () => {
  it('renders ASCII output for a valid diagram', async () => {
    const res = await fetch(baseUrl + '/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'graph LR\n  A --> B', format: 'ascii' }),
    })
    expect(res.status).toBe(200)

    const data: unknown = await res.json()
    if (
      typeof data !== 'object' ||
      data === null ||
      !('output' in data) ||
      typeof data.output !== 'string'
    ) {
      throw new Error('Expected { output: string } in response')
    }
    expect(data.output).toContain('A')
    expect(data.output).toContain('B')
  })

  it('defaults to ascii format when format is omitted', async () => {
    const res = await fetch(baseUrl + '/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'graph LR\n  A --> B' }),
    })
    expect(res.status).toBe(200)
    const data: unknown = await res.json()
    if (typeof data !== 'object' || data === null || !('format' in data)) {
      throw new Error('Expected { format } in response')
    }
    expect(data.format).toBe('ascii')
  })
})

// ============================================================================
// POST /render — SVG
// ============================================================================

describe('web server – POST /render (svg)', () => {
  it('renders SVG output for a valid diagram', async () => {
    const res = await fetch(baseUrl + '/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'graph LR\n  A --> B', format: 'svg' }),
    })
    expect(res.status).toBe(200)

    const data: unknown = await res.json()
    if (
      typeof data !== 'object' ||
      data === null ||
      !('output' in data) ||
      typeof data.output !== 'string'
    ) {
      throw new Error('Expected { output: string } in response')
    }
    expect(data.output).toContain('<svg')
  })
})

// ============================================================================
// POST /render — errors
// ============================================================================

describe('web server – POST /render errors', () => {
  it('returns 400 with an error message for invalid JSON', async () => {
    const res = await fetch(baseUrl + '/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    expect(res.status).toBe(400)
    const data: unknown = await res.json()
    if (typeof data !== 'object' || data === null || !('error' in data)) {
      throw new Error('Expected { error } in response')
    }
    expect(typeof data.error).toBe('string')
  })

  it('returns 400 when source is missing', async () => {
    const res = await fetch(baseUrl + '/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when the Mermaid source is invalid', async () => {
    const res = await fetch(baseUrl + '/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'this is not mermaid {{{',
        format: 'svg',
      }),
    })
    expect(res.status).toBe(400)
  })
})

// ============================================================================
// Unknown routes
// ============================================================================

describe('web server – unknown routes', () => {
  it('returns 404 for an unknown path', async () => {
    const res = await fetch(baseUrl + '/nope')
    expect(res.status).toBe(404)
  })
})

// ============================================================================
// startWebServer()
// ============================================================================

describe('startWebServer', () => {
  it('binds to the loopback interface, not all interfaces', async () => {
    const webServer = await startWebServer(0)
    try {
      const address = webServer.address()
      if (address === null || typeof address === 'string') {
        throw new Error('Expected server to bind to a port')
      }
      expect(address.address).toBe('127.0.0.1')
    } finally {
      webServer.close()
    }
  })
})

// ============================================================================
// runWeb()
// ============================================================================

describe('runWeb', () => {
  it('starts a server and logs the listening URL', async () => {
    const logs: string[] = []
    // Port 0 lets the OS assign a free port, keeping this test independent
    // of whatever else might be listening on the machine running it.
    const webServer = await runWeb({ command: 'web', port: 0 }, (s) =>
      logs.push(s),
    )
    try {
      expect(logs).toHaveLength(1)
      expect(logs[0]).toMatch(
        /^zombie-mermaid web running at http:\/\/localhost:\d+$/,
      )
    } finally {
      webServer.close()
    }
  })
})
