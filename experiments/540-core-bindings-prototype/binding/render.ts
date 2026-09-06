// Thin TypeScript binding over the Go "core" binary — the "bindings" half of
// the core-plus-bindings split this prototype is exploring for issue #540.
//
// Deliberately the simplest possible binding shape: spawn the pre-built Go
// binary, pipe the mermaid source in on stdin, read the ASCII string back on
// stdout. No FFI, no native Node addon (node-gyp/N-API), no WASM — a plain
// child process. The task's own framing (#540) calls this out as a lower-
// risk first step than either of those; see ../README.md for why.
//
// This is NOT how a real binding would ship (per-call process spawn has
// real overhead — see the README's "what a real port would take" section),
// it is the cheapest thing that proves the core/binding boundary works at
// all for this one diagram-type prototype.

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const CORE_BINARY = path.join(here, '..', 'core', 'core')

export interface CoreRenderResult {
  stdout: string
  stderr: string
  status: number | null
}

/**
 * Render mermaid flowchart source via the Go core binary. Throws if the
 * binary is missing (run `go build -o core main.go` in ../core first) or
 * exits non-zero.
 */
export function renderViaCore(mermaidSource: string): CoreRenderResult {
  const result = spawnSync(CORE_BINARY, [], {
    input: mermaidSource,
    encoding: 'utf8',
  })

  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `core binary not found at ${CORE_BINARY} — build it first: ` +
          `cd experiments/540-core-bindings-prototype/core && GO111MODULE=off go build -o core main.go`,
      )
    }
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`core binary exited ${result.status}: ${result.stderr}`)
  }

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
  }
}
