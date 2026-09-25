// Library build for @zombie-mermaid/svg-renderer — see
// ../../vite.config.package.ts for the shared factory and its rationale
// (issue #769). Depends on @zombie-mermaid/core and
// @zombie-mermaid/mermaid-parser, which must already be built (see the
// root `build` script's order). Also bundles one file outside its own
// `src/` (issue #1111): `packages/svg-renderer/src/registry.ts` imports
// `parseMermaid` from the umbrella's `../../../src/parser.ts`
// (flowchart/state parsing stayed at the umbrella root rather than moving
// into `mermaid-parser` — a pre-existing, deliberate boundary call, not
// something this build changes or should paper over — see
// `packages/ascii-renderer/vite.config.ts`, which reaches across the same
// way for the same reason). That file gets compiled straight into this
// package's own dist, same as it's already compiled straight into
// `ascii-renderer`'s and the umbrella's own dist — see
// vite.config.package.ts's header for why bundleTypes (rather than plain
// per-file tsc emit) is what makes that safe for the `.d.ts` half too.
import { resolve } from 'node:path'
import { definePackageBuild } from '../../vite.config.package.ts'

export default definePackageBuild({
  root: import.meta.dirname,
  entry: resolve(import.meta.dirname, 'src/index.ts'),
})
