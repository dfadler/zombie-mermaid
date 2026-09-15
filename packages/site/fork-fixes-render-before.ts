/**
 * Renders one "before" pair member in its own tsx process, invoked by
 * fork-fixes.ts's `renderBefore()` with `--tsconfig <archived-dir>/
 * tsconfig.json`.
 *
 * This has to be a *separate process*, not an in-process `import()` like the
 * "after" render: tsx resolves every `@zombie-mermaid/*` bare specifier
 * through the nearest tsconfig.json's `compilerOptions.paths` — which is
 * fixed for the lifetime of one tsx process (see the root tsconfig.json's
 * "Live-source overrides" comment) — *before* it ever consults a package's
 * own package.json or node_modules. Since fork-fixes.ts's own process
 * already locked onto the repo root's tsconfig.json (whose paths point at
 * the live `packages/<name>/src`), no amount of rewriting an archived
 * package's package.json or shadowing node_modules changes what an in-process
 * `import()` resolves those bare specifiers to. A fresh `tsx --tsconfig
 * <archived>/tsconfig.json` process, on the other hand, locks onto *that*
 * tsconfig instead — whose `paths` (archived unchanged from the historical
 * commit) point at `./packages/<name>/src/index.ts` relative to itself, i.e.
 * the archived pre-fix package. Confirmed empirically against issue #1087's
 * fix (entirely inside `packages/mermaid-parser`): an in-process import of
 * the archived tree rendered the *current* (already-fixed) package every
 * time, and only routing through a subprocess pinned to the archived
 * tsconfig actually reproduced the pre-fix output.
 *
 * Usage: tsx --tsconfig <dir>/tsconfig.json fork-fixes-render-before.ts <dir> <source> <mode>
 * Prints one JSON line to stdout: {ok: true, output} or {ok: false, error}.
 */

interface RendererModule {
  renderMermaidSVG?: (source: string, options?: unknown) => string
  renderMermaidSync?: (source: string, options?: unknown) => string
  renderMermaidASCII?: (source: string, options?: unknown) => string
  renderMermaidAscii?: (source: string, options?: unknown) => string
}

const [dir, source, mode] = process.argv.slice(2) as [
  string,
  string,
  'svg' | 'ascii',
]

const mod = (await import(`${dir}/src/index.ts`)) as RendererModule

try {
  let output: string
  if (mode === 'svg') {
    const fn = mod.renderMermaidSVG ?? mod.renderMermaidSync
    if (!fn) throw new Error('no SVG renderer export found')
    output = fn(source, { bg: '#ffffff', fg: '#1a1a1a' })
  } else {
    const fn = mod.renderMermaidASCII ?? mod.renderMermaidAscii
    if (!fn) throw new Error('no ASCII renderer export found')
    output = fn(source, { colorMode: 'none' })
  }
  process.stdout.write(JSON.stringify({ ok: true, output }))
} catch (err) {
  process.stdout.write(
    JSON.stringify({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }),
  )
}
