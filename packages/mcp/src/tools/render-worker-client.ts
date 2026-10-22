// ============================================================================
// Runs MCP renders in one lazily started, long-lived worker thread (#1856).
// ELK and the ASCII A* are synchronous, so only terminating the thread can
// bound render time. Calls run one at a time (stdio is serial anyway); the
// worker is respawned after a timeout, OOM, or crash.
// ============================================================================

import { Worker } from 'node:worker_threads'
import { MermaidParseError } from '@zombie-mermaid/core'
import type { RenderOptions } from '../../../../src/index.ts'
import type { AsciiRenderOptions } from '@zombie-mermaid/ascii-renderer'
import { RENDER_MAX_OLD_GENERATION_MB, RENDER_TIMEOUT_MS } from './limits.ts'

export type RenderRequest =
  | { kind: 'svg'; diagram: string; options: RenderOptions }
  | { kind: 'ascii'; diagram: string; options: AsciiRenderOptions }

export type RenderReply =
  | { ok: true; text: string }
  | { ok: false; name: string; message: string; line: number | undefined }

export interface WorkerRendererOptions {
  workerUrl?: URL
  timeoutMs?: number
  maxOldGenerationSizeMb?: number
}

export function createWorkerRenderer(opts: WorkerRendererOptions = {}) {
  const {
    // Sits next to the bundled index.js/index.cjs (the CJS build shims import.meta.url).
    workerUrl = new URL('./render-worker.js', import.meta.url),
    timeoutMs = RENDER_TIMEOUT_MS,
    maxOldGenerationSizeMb = RENDER_MAX_OLD_GENERATION_MB,
  } = opts
  let worker: Worker | undefined
  let queue: Promise<unknown> = Promise.resolve()

  function run(req: RenderRequest): Promise<string> {
    return new Promise((resolve, reject) => {
      const w = (worker ??= new Worker(workerUrl, {
        resourceLimits: { maxOldGenerationSizeMb },
      }))
      // Keep the process alive while a render is pending, not while idle.
      w.ref()
      const finish = (err: Error | undefined, text = '', healthy = false) => {
        clearTimeout(timer)
        w.off('message', onMessage)
        w.off('error', onError)
        w.off('exit', onExit)
        if (healthy) w.unref()
        else {
          worker = undefined // Calls are serialised, so w is the current worker
          void w.terminate()
        }
        if (err) reject(err)
        else resolve(text)
      }
      const onMessage = (r: RenderReply) => {
        if (r.ok) return finish(undefined, r.text, true)
        // Rebuild just enough of the error for renderErrorResult's output to match in-thread.
        const err =
          r.name === 'MermaidParseError'
            ? new MermaidParseError(r.message, { line: r.line })
            : Object.assign(new Error(r.message), { name: r.name })
        finish(err, '', true)
      }
      const onError = (e: Error & { code?: string }) =>
        finish(
          e.code === 'ERR_WORKER_OUT_OF_MEMORY'
            ? new Error(
                `render ran out of memory (limit ${maxOldGenerationSizeMb} MB); simplify the diagram`,
              )
            : e,
        )
      const onExit = (code: number) =>
        finish(new Error(`render worker exited unexpectedly (code ${code})`))
      const timer = setTimeout(
        () =>
          finish(
            new Error(
              `render timed out after ${timeoutMs / 1000} s; simplify the diagram`,
            ),
          ),
        timeoutMs,
      )
      w.on('message', onMessage)
      w.on('error', onError)
      w.on('exit', onExit)
      w.postMessage(req)
    })
  }

  return {
    /** Render in the worker. Calls run one at a time so the timeout never counts queue wait. */
    render(req: RenderRequest): Promise<string> {
      const p = queue.then(() => run(req))
      queue = p.catch(() => undefined)
      return p
    },
    /** Terminate the worker (it respawns on the next render). */
    async dispose(): Promise<void> {
      const w = worker
      worker = undefined
      await w?.terminate()
    },
  }
}

export const renderInWorker = createWorkerRenderer().render
