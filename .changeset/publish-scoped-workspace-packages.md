---
'zombie-mermaid': patch
---

Publish-prep only, per #769: the five internal `@zombie-mermaid/*` workspace
packages (`core`, `mermaid-parser`, `svg-renderer`, `ascii-renderer`, `mcp`)
now have genuinely publishable `package.json` shapes — real `exports`/
`main`/`module`/`types` pointing at their own `dist/`, `publishConfig:
{ access: "public", provenance: true }`, `"private"` removed — and each gets
its own independent Vite build (`packages/*/vite.config.ts`, via the shared
`vite.config.package.ts` factory), runnable standalone via the new
`build:packages` script.

**This is prep only. It does not change what `npm install zombie-mermaid`
resolves to.** The umbrella's own build (`vite.config.lib.ts`) still bundles
all five packages' source directly into `dist/index.js`/`dist/ascii.js`/
`dist/mcp.js`/`dist/cli.js`, exactly as before — none of the five packages
are wired in as external runtime dependencies, and none are published to
npm. Actually flipping that (declaring them as real `dependencies`,
externalizing them in the umbrella build, and locking all six packages to
one version via `.changeset/config.json`'s `fixed` group) is deferred to a
future PR, gated on completing npm's one-time trusted-publishing (OIDC)
setup for each of the five new package names — see RELEASING.md.

Two real, independent bugs surfaced while giving each package its own
build are fixed here regardless of the externalization question:
`packages/svg-renderer/src/elk-instance.ts` now restates `LayoutCache`'s
concrete shape locally (its `@internal` fields are trimmed from
`@zombie-mermaid/core`'s own published `.d.ts`), `packages/mcp/package.json`
gained its real transitive `@zombie-mermaid/svg-renderer`/`entities`
dependencies, and `packages/core/package.json` moved `elkjs` from
`devDependencies` to `dependencies` (it's part of `core`'s public types).
