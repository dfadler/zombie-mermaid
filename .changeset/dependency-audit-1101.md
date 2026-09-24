---
"zombie-mermaid": patch
---

Move `zod` from a runtime `dependency` to a `devDependency`. It was never imported by any published source under `src/` — only by `demo/dashboard-model.ts` (site-generation tooling, not part of the published package) — and `@zombie-mermaid/mcp` (the only workspace package that actually needs `zod` at runtime) already declares it as its own dependency, so this has no effect on the `./mcp` entry point or the `mcp` CLI subcommand.
