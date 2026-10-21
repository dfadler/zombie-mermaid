/**
 * The "before" half of fork-fixes.html (#1844): renders each fix's source with
 * the renderer as it was at `fixCommit^`.
 *
 * Each commit's tree is `git archive`d, then ALL trees are bundled by one Vite
 * (rolldown) SSR build and imported in this process. That replaces the old
 * design (one `tsx --tsconfig <tree>/tsconfig.json` subprocess per fix, ~0.5 s
 * of tsx startup each, 53 of them). The subprocess existed because tsx fixes
 * the tsconfig `paths` for its whole process, so an in-process import of an
 * archived tree resolved `@zombie-mermaid/*` to the LIVE packages. Bundling
 * resolves those specifiers explicitly, per archived tree (`archivedPackages`
 * below), so trees stay isolated: each bundle owns its module state (id
 * counters etc.). Only node_modules deps (elkjs) are shared, as before.
 *
 * Plain Node module (no `import.meta.url` pinning): vite.site.config.ts runs it
 * at config level, concurrently with the SSR and client builds.
 */
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { build, type Plugin } from 'vite'

const exec = promisify(execFile)

export interface BeforeFix {
  id: string
  fixCommit: string
  source: string
  render: 'svg' | 'ascii'
}
export type BeforeResult = { output: string } | { error: string }

/** A renderer module, however that commit happened to spell its exports. */
export interface RendererModule {
  renderMermaidSVG?: (source: string, options?: unknown) => string
  renderMermaidSync?: (source: string, options?: unknown) => string
  renderMermaidASCII?: (source: string, options?: unknown) => string
  renderMermaidAscii?: (source: string, options?: unknown) => string
}

/**
 * Render `source` with whichever export the module provides for `mode`.
 *
 * The 'svg' options `{ bg: '#ffffff', fg: '#1a1a1a' }` are fixed, not driven by
 * the global theme picker (#687): a deliberate #689 exception, this page is a
 * precise before/after comparison. See
 * `docs/decisions/theme-selector-shared-state.md`'s "#689" amendment.
 */
export function renderWith(
  mod: RendererModule,
  source: string,
  mode: 'svg' | 'ascii',
): string {
  if (mode === 'svg') {
    const fn = mod.renderMermaidSVG ?? mod.renderMermaidSync
    if (!fn) throw new Error('no SVG renderer export found')
    return fn(source, { bg: '#ffffff', fg: '#1a1a1a' })
  }
  const fn = mod.renderMermaidASCII ?? mod.renderMermaidAscii
  if (!fn) throw new Error('no ASCII renderer export found')
  return fn(source, { colorMode: 'none' })
}

/**
 * Check that `commit`'s first parent is present. The page can only be built
 * from a repository with full history; a shallow clone makes `git archive`
 * fail with a bare "not a valid object name". Both workflows that build the
 * site set `fetch-depth: 0`; this turns the failure into an instruction.
 *
 * Verifies `commit^1`, NOT `commit`: `^{commit}` is a peel operator returning
 * the object itself, so checking `commit^{commit}` proves nothing about the
 * parent, and the parent is what gets archived.
 */
async function requireCommit(commit: string): Promise<void> {
  try {
    await exec('git', ['rev-parse', '--verify', `${commit}^1^{commit}`])
  } catch {
    const shallow = await exec('git', ['rev-parse', '--is-shallow-repository'])
      .then((r) => r.stdout.trim() === 'true')
      .catch(() => false)
    throw new Error(
      `Commit ${commit} or its parent is not in this repository.\n` +
        (shallow
          ? 'This is a shallow clone. The fork-fixes page renders each "before" from a ' +
            'historical commit, so it needs full history: run ' +
            '`git fetch --unshallow`, or set `fetch-depth: 0` on the checkout step.'
          : 'Check the fixCommit value in demo/fork-fixes-data.ts.'),
    )
  }
}

/**
 * Extract the tree at `commit^` into `dir`: `src/`, plus `packages/` and
 * `tsconfig.json` when the commit postdates the monorepo split (#620) (a fix
 * inside a `@zombie-mermaid/*` package needs its own archived tree).
 */
async function archiveCommitBefore(commit: string, dir: string) {
  await requireCommit(commit)
  await mkdir(dir, { recursive: true })
  const hasPackages = await exec('git', [
    'cat-file',
    '-e',
    `${commit}^:packages`,
  ])
    .then(() => true)
    .catch(() => false)
  const paths = hasPackages ? 'src packages tsconfig.json' : 'src'
  // `git archive` writes a clean tree with no working-copy interference.
  await exec(
    'sh',
    ['-c', `git archive ${commit}^ ${paths} | tar -x -C ${JSON.stringify(dir)}`],
    { maxBuffer: 64 * 1024 * 1024 },
  )
}

/** Run `fn` over `items`, at most `limit` at a time. */
async function pool<T>(items: T[], limit: number, fn: (t: T) => Promise<void>) {
  const queue = [...items]
  await Promise.all(
    Array.from({ length: limit }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) await fn(item)
    }),
  )
}

/**
 * Resolve `@zombie-mermaid/<pkg>` imported from inside an archived tree to
 * THAT tree's `packages/<pkg>/src/index.ts` (what its tsconfig `paths` did).
 * Trees from before the split have no such imports.
 */
function archivedPackages(root: string): Plugin {
  return {
    name: 'fork-fixes:archived-packages',
    resolveId(source, importer) {
      if (!source.startsWith('@zombie-mermaid/') || !importer?.startsWith(root))
        return null
      const tree = importer.slice(root.length + 1).split('/')[0]!
      const file = join(
        root,
        tree,
        'packages',
        source.slice('@zombie-mermaid/'.length),
        'src/index.ts',
      )
      return existsSync(file) ? file : null
    },
  }
}

/**
 * Render every fix's "before". `workDir` must live inside the repo so the
 * bundles' bare imports (elkjs) resolve through the shared node_modules; it
 * is removed afterwards.
 */
export async function renderBeforeAll(
  fixes: BeforeFix[],
  workDir: string,
): Promise<Map<string, BeforeResult>> {
  const trees = join(workDir, 'trees')
  const out = join(workDir, 'out')
  try {
    await rm(workDir, { recursive: true, force: true })
    const commits = [...new Set(fixes.map((f) => f.fixCommit))]
    await pool(commits, 8, (c) => archiveCommitBefore(c, join(trees, c)))

    await build({
      configFile: false,
      logLevel: 'warn',
      root: process.cwd(),
      plugins: [archivedPackages(trees)],
      build: {
        ssr: true,
        outDir: out,
        emptyOutDir: true,
        copyPublicDir: false,
        minify: false,
        target: 'esnext',
        rolldownOptions: {
          input: Object.fromEntries(
            commits.map((c) => [c, join(trees, c, 'src/index.ts')]),
          ),
          output: { format: 'es', entryFileNames: '[name].mjs' },
        },
      },
    })

    const results = new Map<string, BeforeResult>()
    for (const fix of fixes) {
      const mod = (await import(
        pathToFileURL(join(out, `${fix.fixCommit}.mjs`)).href
      )) as RendererModule
      try {
        results.set(fix.id, { output: renderWith(mod, fix.source, fix.render) })
      } catch (err) {
        // A crash IS the before state for the crash fixes in this list.
        results.set(fix.id, {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
    return results
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}
