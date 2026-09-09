/**
 * Generates fork-fixes.html — a before/after showcase of bugs this fork fixed.
 *
 * Usage: tsx fork-fixes.ts
 *
 * Every "before" is rendered by the project's *actual* renderer as it existed
 * immediately before the fix landed: the tree at `<fixCommit>^` is extracted
 * to a cache directory and imported. Nothing is hand-drawn or described from
 * memory.
 *
 * The generator FAILS if any pair renders identically. A before/after where
 * both halves look the same is worse than no showcase at all — it silently
 * claims a fix that the page does not actually demonstrate. See #189 and this
 * repo's visual-verification convention.
 *
 * The markup comes from React components
 * (demo/components/fork-fixes-page.tsx) rendered with react-dom/server's
 * `renderToStaticMarkup` — part of #589, which moved every site generator
 * off template-literal HTML. This file keeps everything that needs I/O or a
 * renderer; the component only decides what element each result becomes.
 *
 * As of zombie-mermaid#802, this page also hydrates: `demo/fork-fixes-
 * client.tsx` (bundled below by `bundleForkFixesClient()`, mirroring
 * dashboard.ts's `bundleDashboardClient()`) hydrates `ForkFixesApp` (the
 * hero + fixes list) and `<NavIsland>` in one bundle.
 */

import { execFile } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'
import { createElement } from 'react'
import { forkFixes, type ForkFix } from './demo/fork-fixes-data.ts'
import { asciiToHtml } from './ascii-html.ts'
import { formatProse } from './demo/format.ts'
import { renderHtmlDocument } from './demo/render-html.ts'
import { sharedPageCss } from './demo/components/shared-page-css.tsx'
import { themePickerCss } from './demo/components/theme-picker.tsx'
import { bundleThemeBarClient } from './demo/build-theme-bar-client.ts'
import {
  ForkFixesPage,
  type FixSectionProps,
  type PanelContent,
} from './demo/components/fork-fixes-page.tsx'
import { bundleForBrowser } from './scripts/vite-bundle.ts'
import { siteOutDir } from './scripts/site-out-dir.ts'

const exec = promisify(execFile)

/** Where pre-fix source trees are extracted. Inside the repo so that Node's
 *  module resolution still finds the shared node_modules. */
const CACHE_DIR = new URL('./.fork-fixes-cache/', import.meta.url).pathname

/**
 * Real-terminal screenshots for `render: 'ascii'` entries, captured by
 * scripts/capture-fork-fixes-terminal.ts (asciinema + agg against a genuine
 * PTY, not ascii-html.ts's browser approximation) and committed here.
 */
const SCREENSHOTS_DIR = new URL(
  './public/fork-fixes-screenshots/',
  import.meta.url,
).pathname

interface RenderPair {
  fix: ForkFix
  before: string
  after: string
  /** Set when a render threw — itself a legitimate "before" for crash fixes. */
  beforeError?: string
  afterError?: string
}

/** A renderer module, however that commit happened to spell its exports. */
interface RendererModule {
  renderMermaidSVG?: (source: string, options?: unknown) => string
  renderMermaidSync?: (source: string, options?: unknown) => string
  renderMermaidASCII?: (source: string, options?: unknown) => string
  renderMermaidAscii?: (source: string, options?: unknown) => string
}

/**
 * Extract the source tree at `commit^` and return its renderer module.
 *
 * Export names have changed over the fork's life (`renderMermaidSync` predates
 * `renderMermaidSVG`), so the caller picks whichever the commit provides
 * rather than assuming today's names existed then.
 */
async function loadRendererBefore(commit: string): Promise<RendererModule> {
  const dir = `${CACHE_DIR}${commit}`
  if (!existsSync(dir)) {
    await requireCommit(commit)
    await mkdir(dir, { recursive: true })
    // `git archive` writes a clean tree with no working-copy interference.
    const { stdout } = await exec(
      'sh',
      ['-c', `git archive ${commit}^ src | tar -x -C ${JSON.stringify(dir)}`],
      { maxBuffer: 64 * 1024 * 1024 },
    )
    if (stdout.trim()) console.log(stdout.trim())
  }
  return (await import(`${dir}/src/index.ts`)) as RendererModule
}

/**
 * Check that the archived object — `commit`'s first parent — is present.
 *
 * This page can only be built from a repository with full history. A shallow
 * clone (what `actions/checkout` produces by default) has none of these
 * commits, and `git archive` then fails with a bare "not a valid object name"
 * that gives no hint why. Both workflows that build the site therefore set
 * `fetch-depth: 0`; this turns the failure into an instruction for anyone who
 * hits it elsewhere.
 *
 * Verifies `commit^1`, NOT `commit`. `^{commit}` is a peel operator returning
 * the object itself, so checking `commit^{commit}` proves nothing about the
 * parent — and the parent is what gets archived. A shallow clone whose
 * boundary is exactly a fix commit would pass that check and still fail in
 * `git archive`, defeating the point of the guard.
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
          ? 'This is a shallow clone. fork-fixes.ts renders each "before" from a ' +
            'historical commit, so it needs full history — run ' +
            '`git fetch --unshallow`, or set `fetch-depth: 0` on the checkout step.'
          : 'Check the fixCommit value in demo/fork-fixes-data.ts.'),
    )
  }
}

/**
 * Render `source` with whichever export the module provides for `mode`.
 *
 * The 'svg' branch's `{ bg: '#ffffff', fg: '#1a1a1a' }` is fixed, not
 * driven by the global theme picker `demo/components/theme-picker-
 * section.tsx` adds to this page (#687) — a deliberate #689 exception,
 * not an oversight: `mod` here can be the renderer as it existed at an
 * arbitrary historical commit (see `loadRendererBefore()` above), which
 * isn't guaranteed to support the same CSS custom-property contract
 * `themeCssVariables()` defines today, and this page's whole purpose is a
 * precise, stable before/after comparison, not a live showcase. See
 * `docs/decisions/theme-selector-shared-state.md`'s "#689" amendment.
 */
function renderWith(
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

/** Render one fix both ways, capturing a throw as the result rather than failing. */
async function renderFix(fix: ForkFix): Promise<RenderPair> {
  const current = (await import('./src/index.ts')) as RendererModule
  const previous = await loadRendererBefore(fix.fixCommit)

  const pair: RenderPair = { fix, before: '', after: '' }

  try {
    pair.before = renderWith(previous, fix.source, fix.render)
  } catch (err) {
    // A crash IS the before state for the crash fixes in this list.
    pair.beforeError = err instanceof Error ? err.message : String(err)
  }

  try {
    pair.after = renderWith(current, fix.source, fix.render)
  } catch (err) {
    pair.afterError = err instanceof Error ? err.message : String(err)
  }

  return pair
}

/**
 * Decide what one side of a pair shows: a real-terminal screenshot, the
 * diagram, an excerpt of its markup, the error it threw, or an explicit
 * note that it produced nothing.
 *
 * Returns the choice as data; demo/components/fork-fixes-page.tsx's
 * `<FixPanel>` turns it into markup. The two halves are split that way
 * because only this one needs the filesystem (to see whether a committed
 * screenshot exists) and ascii-html.ts.
 */
function panelContent(
  fixId: string,
  side: 'before' | 'after',
  output: string,
  error: string | undefined,
  mode: 'svg' | 'ascii',
  excerpt?: { from: string; to: string },
): PanelContent {
  if (error) return { kind: 'error', message: error }

  /*
   * Some "before" states produced no output at all — the parser dropped the
   * whole diagram. Say so explicitly: a blank panel is indistinguishable from
   * a broken page, and "it rendered nothing" is the actual result.
   */
  if (output.trim() === '') return { kind: 'empty' }

  if (excerpt) {
    // Literal indexOf bounds rather than a constructed regex: every excerpt
    // is a fixed tag, so a pattern would add nothing but a ReDoS smell.
    const start = output.indexOf(excerpt.from)
    const end =
      start === -1
        ? -1
        : output.indexOf(excerpt.to, start + excerpt.from.length)
    if (start === -1 || end === -1) {
      // Without the slice the entry would render an empty panel, silently
      // claiming a fix it no longer shows. Fail instead.
      throw new Error(
        `excerpt "${excerpt.from}" … "${excerpt.to}" was not found in the output`,
      )
    }
    const slice = output.slice(start, end + excerpt.to.length)
    return { kind: 'excerpt', text: slice.trim() }
  }

  if (mode === 'ascii') {
    const screenshotFile = `${fixId}-${side}.png`
    if (existsSync(`${SCREENSHOTS_DIR}${screenshotFile}`)) {
      return { kind: 'screenshot', file: screenshotFile, side, fixId }
    }
    return {
      kind: 'ascii',
      html: asciiToHtml(output.replace(/[ \t]+$/gm, '')),
    }
  }
  return { kind: 'svg', html: output }
}

/** One rendered pair as the props `<FixSection>` needs. */
function fixSectionProps(pair: RenderPair): FixSectionProps {
  const { fix } = pair
  return {
    id: fix.id,
    title: fix.title,
    symptomHtml: formatProse(fix.symptom),
    lookForHtml: formatProse(fix.lookFor),
    pr: fix.pr,
    fixCommit: fix.fixCommit,
    render: fix.render,
    upstreamIssues: fix.upstreamIssues,
    source: fix.source,
    before: panelContent(
      fix.id,
      'before',
      pair.before,
      pair.beforeError,
      fix.render,
      fix.excerpt,
    ),
    after: panelContent(
      fix.id,
      'after',
      pair.after,
      pair.afterError,
      fix.render,
      fix.excerpt,
    ),
  }
}

/**
 * Bundle `demo/fork-fixes-client.tsx` (zombie-mermaid#802's hydration
 * entry) for the browser — mirrors dashboard.ts's `bundleDashboardClient()`
 * exactly (inlined into the page directly, `minify: true` since this is
 * the first bundle on this page to include `react`/`react-dom` — see that
 * function's doc comment for the measured minified-vs-unminified
 * difference, which applies unchanged here).
 */
async function bundleForkFixesClient(): Promise<string> {
  return bundleForBrowser(
    new URL('./demo/fork-fixes-client.tsx', import.meta.url).pathname,
    { minify: true },
  )
}

async function generate(): Promise<string> {
  const pairs: RenderPair[] = []
  for (const fix of forkFixes) {
    process.stdout.write(`  ${fix.id}… `)
    const pair = await renderFix(fix)
    pairs.push(pair)
    console.log(
      pair.beforeError ? 'before threw (expected for a crash fix)' : 'ok',
    )
  }

  /*
   * Fail loudly on any pair whose halves are identical. Such a pair claims a
   * fix the page does not demonstrate — precisely the false-negative this
   * showcase exists to avoid.
   */
  const identical = pairs.filter(
    (p) => !p.beforeError && !p.afterError && p.before === p.after,
  )
  if (identical.length > 0) {
    console.error(
      `\nThese fixes render identically before and after, so they prove nothing:\n` +
        identical
          .map((p) => `  - ${p.fix.id} (${p.fix.fixCommit})`)
          .join('\n') +
        `\n\nEither the sample no longer reproduces the bug, or the commit is wrong.`,
    )
    process.exit(1)
  }

  // The #608 redesign moved this page onto the shared design system
  // (#591), assembled by shared-page-css.tsx's `sharedPageCss()` — see
  // demo/fork-fixes.css's header for what's left in this page's own CSS
  // file and why. This page no longer loads demo/styles.css's `--t-*`
  // theme system at all.
  const pageCss = await readFile(
    new URL('./demo/fork-fixes.css', import.meta.url),
    'utf8',
  )
  const styles = sharedPageCss([themePickerCss(), pageCss].join('\n\n'))

  // #687: this page's live theme picker needs no other client JS of its
  // own, so it gets the same shared bundle Home/the Diagrams hub/Blog/
  // Dashboard use. #802: clientScript hydrates ForkFixesApp + NavIsland.
  const [themeBarScript, clientScript] = await Promise.all([
    bundleThemeBarClient(),
    bundleForkFixesClient(),
  ])

  return renderHtmlDocument(
    createElement(ForkFixesPage, {
      css: styles,
      fixes: pairs.map(fixSectionProps),
      themeBarScript,
      clientScript,
    }),
  )
}

console.log(`Rendering ${forkFixes.length} before/after pairs…`)
const html = await generate()
const outPath = new URL('./fork-fixes.html', siteOutDir(import.meta.url))
  .pathname
await writeFile(outPath, html, 'utf8')
console.log(`Written to ${outPath} (${(html.length / 1024).toFixed(1)} KB)`)

// The extracted trees are a build artifact; leave no clutter behind.
await rm(CACHE_DIR, { recursive: true, force: true })
