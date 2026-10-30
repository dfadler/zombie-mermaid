// ============================================================================
// Worker-thread entry for MCP renders (#1856). Built as its own file
// (dist/render-worker.js); render-worker-client.ts spawns it. A runaway
// render is killed by terminating this thread, not the stdio server.
// ============================================================================

import { parentPort } from 'node:worker_threads'
import ELK from 'elkjs/lib/elk.bundled.js'
import { registerElk } from '@zombie-mermaid/svg-renderer'
import {
  renderMermaidASCII,
  AsciiWidthError,
} from '@zombie-mermaid/ascii-renderer'
import { renderMermaidSVG } from '../../../../src/index.ts'
import type { RenderRequest, RenderReply } from './render-worker-client.ts'

// A worker has its own module state: the server's registerElk() does not reach it.
registerElk(ELK)

parentPort?.on('message', (req: RenderRequest) => {
  let reply: RenderReply
  try {
    const text =
      req.kind === 'svg'
        ? renderMermaidSVG(req.diagram, req.options)
        : renderMermaidASCII(req.diagram, req.options)
    reply = { ok: true, text }
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err))
    reply = {
      ok: false,
      name: e.name,
      message: e.message,
      line: 'line' in e && typeof e.line === 'number' ? e.line : undefined,
      width:
        e instanceof AsciiWidthError
          ? [e.actualWidth, e.maxWidth, e.compactApplied]
          : undefined,
    }
  }
  parentPort?.postMessage(reply)
})
