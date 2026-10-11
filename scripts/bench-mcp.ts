/**
 * Benchmarks the zombie-mermaid MCP server's own request/response overhead
 * — not render time (`bench.ts` already covers that end to end), but the
 * latency the Model Context Protocol layer itself adds on top: Zod input
 * validation, tool dispatch, and message passing over an MCP transport.
 *
 * Connects a real `Client` from the MCP SDK to `createMcpServer()`'s
 * `McpServer` over `InMemoryTransport` — the same no-process-spawn, no-stdio
 * setup `src/__tests__/mcp-server.test.ts` already uses for correctness
 * coverage — and times repeated `tools/list` and `tools/call` round trips
 * against every registered tool with a small, fixed, representative
 * diagram. `InMemoryTransport` still serializes each message to JSON
 * (see the MCP SDK's `inMemory.ts`), so this measures real protocol
 * overhead, just without a stdio pipe or a second process in the loop.
 *
 * Usage: tsx scripts/bench-mcp.ts [--json=<path>] [--iterations=<n>] [--warmup=<n>]
 *   --json        Also write a machine-readable summary to this path.
 *                 Shaped like bench.ts's own `--json=` summary
 *                 (generatedAt/sampleCount/categories) so it can plug into
 *                 the same CI artifact/history pattern the other benchmark
 *                 sub-issues use (see scripts/bench-compare.ts,
 *                 scripts/bench-history-append.ts, scripts/bench-trend.ts)
 *                 if this benchmark is wired into that pipeline later.
 *                 `categories` here is keyed by MCP request name (a tool
 *                 name, or "tools/list") rather than by diagram category,
 *                 and reports latency stats (mean/median/p95) rather than
 *                 svg/ascii ms, since that's what's actually being
 *                 measured — see `McpRequestStats` below.
 *   --iterations  Timed calls per request. Defaults to 50.
 *   --warmup      Untimed calls per request before timing starts (JIT
 *                 warm-up, same rationale as bench.ts's own warm-up pass —
 *                 without it, the first call or two pays one-time
 *                 module-init/JIT costs that would otherwise skew a small
 *                 sample).  Defaults to 5.
 */

import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createMcpServer } from '../packages/mcp/src/server.ts'

// ============================================================================
// Fixtures
// ============================================================================

// Small, fixed diagrams — this benchmark is about protocol overhead, not
// render complexity (bench.ts already sweeps the full sample corpus for
// that), so the same modest input is reused across every request.
const FLOWCHART_DIAGRAM =
  'graph LR\n  A[Start] --> B{Decide}\n  B -->|Yes| C[Do thing]\n  B -->|No| D[Skip]\n  C --> E[End]\n  D --> E'
const SEQUENCE_DIAGRAM_WITH_DANGLING_ACTIVATION =
  'sequenceDiagram\n  activate A\n  A->>B: hello\n  B-->>A: hi'

// ============================================================================
// Types
// ============================================================================

export interface McpRequestStats {
  callCount: number
  totalMs: number
  meanMs: number
  medianMs: number
  p95Ms: number
  minMs: number
  maxMs: number
}

// ============================================================================
// Pure helpers (exported for tests)
// ============================================================================

/**
 * Linear-interpolation-free "nearest rank" percentile over an already-sorted
 * ascending array — good enough for a benchmark report, not a statistics
 * library. Returns 0 for an empty input.
 */
export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0
  const rank = Math.ceil((p / 100) * sortedAsc.length) - 1
  const idx = Math.min(Math.max(rank, 0), sortedAsc.length - 1)
  return sortedAsc[idx]!
}

/** Reduces a list of per-call latencies (ms) into the summary stats above. */
export function computeStats(timesMs: number[]): McpRequestStats {
  if (timesMs.length === 0) {
    return {
      callCount: 0,
      totalMs: 0,
      meanMs: 0,
      medianMs: 0,
      p95Ms: 0,
      minMs: 0,
      maxMs: 0,
    }
  }
  const sorted = [...timesMs].sort((a, b) => a - b)
  const totalMs = sorted.reduce((a, b) => a + b, 0)
  return {
    callCount: sorted.length,
    totalMs,
    meanMs: totalMs / sorted.length,
    medianMs: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    minMs: sorted[0]!,
    maxMs: sorted[sorted.length - 1]!,
  }
}

function fmtMs(ms: number): string {
  return ms.toFixed(3)
}

/** Pad/truncate a string to exactly `width` characters. */
function col(
  value: string,
  width: number,
  align: 'left' | 'right' = 'left',
): string {
  const truncated =
    value.length > width ? value.slice(0, width - 1) + '…' : value
  return align === 'right' ? truncated.padStart(width) : truncated.padEnd(width)
}

// ============================================================================
// Requests under test
// ============================================================================

interface BenchRequest {
  name: string
  run: (client: Client) => Promise<unknown>
}

function requests(): BenchRequest[] {
  return [
    { name: 'tools/list', run: (client) => client.listTools() },
    {
      name: 'render_mermaid_svg',
      run: (client) =>
        client.callTool({
          name: 'render_mermaid_svg',
          arguments: { diagram: FLOWCHART_DIAGRAM },
        }),
    },
    {
      name: 'render_mermaid_ascii',
      run: (client) =>
        client.callTool({
          name: 'render_mermaid_ascii',
          arguments: { diagram: FLOWCHART_DIAGRAM },
        }),
    },
    {
      name: 'check_mermaid_sequence_activations',
      run: (client) =>
        client.callTool({
          name: 'check_mermaid_sequence_activations',
          arguments: { diagram: SEQUENCE_DIAGRAM_WITH_DANGLING_ACTIVATION },
        }),
    },
    {
      name: 'fix_mermaid_sequence_activations',
      run: (client) =>
        client.callTool({
          name: 'fix_mermaid_sequence_activations',
          arguments: { diagram: SEQUENCE_DIAGRAM_WITH_DANGLING_ACTIVATION },
        }),
    },
  ]
}

/** Throws if a `tools/call` response reports an error — a fixture bug, not noise to average over. */
function assertNoToolError(name: string, result: unknown): void {
  if (
    typeof result === 'object' &&
    result !== null &&
    'isError' in result &&
    (result as { isError?: unknown }).isError
  ) {
    throw new Error(
      `Benchmark request "${name}" returned isError — fix the fixture before timing it: ${JSON.stringify(result)}`,
    )
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const scriptArgs = process.argv.slice(2).filter((a) => a !== '--')

  function argValue(flag: string): string | null {
    const arg = scriptArgs.find((a) => a.startsWith(flag))
    return arg ? arg.slice(flag.length) : null
  }

  const jsonArg = argValue('--json=')
  const iterations = Number(argValue('--iterations=') ?? '50')
  const warmup = Number(argValue('--warmup=') ?? '5')

  let server: McpServer | undefined
  let client: Client | undefined

  try {
    server = createMcpServer()
    client = new Client({ name: 'bench-mcp', version: '0.0.0' })
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair()
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ])

    console.log(
      `\nzombie-mermaid — MCP server latency benchmark (${iterations} iterations, ${warmup} warm-up)`,
    )
    console.log('═'.repeat(78))
    console.log(
      `${col('Request', 36)}  ${col('Mean', 8, 'right')}  ${col('Median', 8, 'right')}  ${col('p95', 8, 'right')}  ${col('Min', 8, 'right')}  ${col('Max', 8, 'right')}`,
    )
    console.log('─'.repeat(78))

    const categories: Record<string, McpRequestStats> = {}

    for (const request of requests()) {
      for (let i = 0; i < warmup; i++) {
        const result = await request.run(client)
        assertNoToolError(request.name, result)
      }

      const timesMs: number[] = []
      for (let i = 0; i < iterations; i++) {
        const t0 = performance.now()
        const result = await request.run(client)
        timesMs.push(performance.now() - t0)
        assertNoToolError(request.name, result)
      }

      const stats = computeStats(timesMs)
      categories[request.name] = stats

      console.log(
        `${col(request.name, 36)}  ${col(fmtMs(stats.meanMs), 8, 'right')}  ${col(fmtMs(stats.medianMs), 8, 'right')}  ${col(fmtMs(stats.p95Ms), 8, 'right')}  ${col(fmtMs(stats.minMs), 8, 'right')}  ${col(fmtMs(stats.maxMs), 8, 'right')}`,
      )
    }

    console.log('═'.repeat(78))
    console.log('(all times in milliseconds, one MCP round trip per call)\n')

    if (jsonArg) {
      const sampleCount = Object.values(categories).reduce(
        (a, c) => a + c.callCount,
        0,
      )
      const totalMs = Object.values(categories).reduce(
        (a, c) => a + c.totalMs,
        0,
      )
      const summary = {
        generatedAt: new Date().toISOString(),
        sampleCount,
        totalMs,
        categories,
      }
      await writeFile(jsonArg, JSON.stringify(summary, null, 2) + '\n', 'utf-8')
      console.log(`JSON summary written to ${jsonArg}`)
    }
  } finally {
    await client?.close()
    await server?.close()
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main()
}
