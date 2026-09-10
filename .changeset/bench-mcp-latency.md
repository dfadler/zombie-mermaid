---
---

No release: adds an MCP server request/response latency benchmark (#877,
split from #869 alongside #874/#875/#876). No benchmark previously covered
`packages/mcp` — `bench.ts` times raw SVG/ASCII render calls directly, never
through the Model Context Protocol layer itself. `scripts/bench-mcp.ts`
(`pnpm run bench:mcp`) connects a real MCP `Client` to `createMcpServer()`'s
`McpServer` over the SDK's `InMemoryTransport` (the same setup
`src/__tests__/mcp-server.test.ts` already uses for correctness coverage)
and times repeated `tools/list`/`tools/call` round trips against every
registered tool, reporting mean/median/p95/min/max per request. Its
`--json=<path>` output is shaped like `bench.ts`'s own summary
(generatedAt/sampleCount/categories) so it can plug into the same CI
artifact/history pattern the other benchmark sub-issues use if wired in
later, though this PR does not add CI wiring itself — scope stays limited
to the benchmark and its local `pnpm run bench:mcp` script, per #877's own
scope bullets. Only touches root `package.json` scripts, `scripts/`, and
`__tests__/` — nothing here touches the published `zombie-mermaid` package
or any `packages/*` package's own code.
