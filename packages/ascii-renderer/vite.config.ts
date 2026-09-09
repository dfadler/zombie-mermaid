// Library build for @zombie-mermaid/ascii-renderer — see
// ../../vite.config.package.ts for the shared factory and its rationale
// (issue #769). Depends on @zombie-mermaid/core and
// @zombie-mermaid/mermaid-parser (already built first — see the root
// `build` script's order), and bundles one file outside its own `src/`:
// `packages/ascii-renderer/src/flowchart.ts` imports `parseMermaid` from
// the umbrella's `../../../src/parser.ts` (flowchart/state parsing stayed
// at the umbrella root rather than moving into `mermaid-parser` — a
// pre-existing, deliberate boundary call, not something this build changes
// or should paper over). That file gets compiled straight into this
// package's own dist, same as it's already compiled straight into the
// umbrella's own dist/index.js — see vite.config.package.ts's header for
// why bundleTypes (rather than plain per-file tsc emit) is what makes that
// safe for the `.d.ts` half too.
import { resolve } from 'node:path'
import { definePackageBuild } from '../../vite.config.package.ts'

export default definePackageBuild({
  root: import.meta.dirname,
  entry: resolve(import.meta.dirname, 'src/index.ts'),
})
