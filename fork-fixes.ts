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
 */

import { execFile } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'
import { forkFixes, type ForkFix } from './demo/fork-fixes-data.ts'

const exec = promisify(execFile)

/** Where pre-fix source trees are extracted. Inside the repo so that Node's
 *  module resolution still finds the shared node_modules. */
const CACHE_DIR = new URL('./.fork-fixes-cache/', import.meta.url).pathname

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

/** Render `source` with whichever export the module provides for `mode`. */
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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Render a prose field: escape it, then turn backtick spans into `<code>`.
 *
 * Escaping first means the data file can contain `<`, `>`, or `&` — several
 * symptoms quote Mermaid arrow tokens and regex fragments — without either
 * breaking the page or being interpolated as live markup.
 */
function formatProse(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}

/**
 * Render one side of a pair: the diagram, an excerpt of its markup, the error
 * it threw, or an explicit note that it produced nothing.
 */
function renderPanel(
  output: string,
  error: string | undefined,
  mode: 'svg' | 'ascii',
  excerpt?: { from: string; to: string },
): string {
  if (error) {
    return `<div class="fix-error"><strong>Threw:</strong> ${escapeHtml(error)}</div>`
  }

  /*
   * Some "before" states produced no output at all — the parser dropped the
   * whole diagram. Say so explicitly: a blank panel is indistinguishable from
   * a broken page, and "it rendered nothing" is the actual result.
   */
  if (output.trim() === '') {
    return `<div class="fix-empty">Rendered nothing — the diagram was dropped entirely.</div>`
  }

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
    return `<pre class="fix-ascii">${escapeHtml(slice.trim())}</pre>`
  }

  if (mode === 'ascii') {
    return `<pre class="fix-ascii">${escapeHtml(output.replace(/[ \t]+$/gm, ''))}</pre>`
  }
  return `<div class="fix-svg">${output}</div>`
}

function renderFixSection(pair: RenderPair): string {
  const { fix } = pair
  const prUrl = `https://github.com/dfadler/zombie-mermaid/pull/${fix.pr}`
  return `
      <section class="fix" id="${fix.id}">
        <h2><a class="fix-anchor" href="#${fix.id}">${escapeHtml(fix.title)}</a></h2>
        <p class="fix-symptom">${formatProse(fix.symptom)}</p>
        <p class="fix-meta">
          <a href="${prUrl}">PR #${fix.pr}</a>
          <span class="fix-commit">fixed in <code>${escapeHtml(fix.fixCommit)}</code></span>
          <span class="fix-mode">${fix.render === 'svg' ? 'SVG' : 'ASCII'} output</span>
        </p>
        <pre class="fix-source">${escapeHtml(fix.source)}</pre>
        <div class="fix-pair">
          <div class="fix-side">
            <h3 class="fix-side-title fix-side-before">Before</h3>
            ${renderPanel(pair.before, pair.beforeError, fix.render, fix.excerpt)}
          </div>
          <div class="fix-side">
            <h3 class="fix-side-title fix-side-after">After</h3>
            ${renderPanel(pair.after, pair.afterError, fix.render, fix.excerpt)}
          </div>
        </div>
        <p class="fix-lookfor">${formatProse(fix.lookFor)}</p>
      </section>`
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

  const styles = await readFile(
    new URL('./demo/styles.css', import.meta.url),
    'utf8',
  )
  const extra = await readFile(
    new URL('./demo/fork-fixes.css', import.meta.url),
    'utf8',
  )

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>What this fork fixes — zombie-mermaid</title>
  <meta name="description" content="Before/after renders of bugs zombie-mermaid fixes over upstream beautiful-mermaid." />
  <link rel="icon" href="favicon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
${styles}
${extra}
  </style>
</head>
<body>
  <div class="content-wrapper">
    <header class="fix-header">
      <p class="fix-breadcrumb"><a href="index.html">← Back to the gallery</a></p>
      <h1>What this fork fixes</h1>
      <p class="fix-intro">
        Every pair below is rendered by this project's own renderer. The
        <strong>before</strong> side runs the code as it existed immediately
        before the fix landed — the tree at that commit's parent — so nothing
        here is hand-drawn or reconstructed. The generator fails the build if
        any pair renders identically, because a before/after that looks the
        same would claim a fix it does not demonstrate.
      </p>
      <p class="fix-intro">
        ${forkFixes.length} fixes shown. Many more ship in the
        <a href="https://github.com/dfadler/zombie-mermaid/blob/main/CHANGELOG.md">changelog</a>.
      </p>
    </header>
${pairs.map(renderFixSection).join('\n')}
    <footer class="fix-footer">
      <p>
        <a href="https://github.com/dfadler/zombie-mermaid">zombie-mermaid</a>
        — a fork of
        <a href="https://github.com/lukilabs/beautiful-mermaid">beautiful-mermaid</a>.
      </p>
    </footer>
  </div>
</body>
</html>`
}

console.log(`Rendering ${forkFixes.length} before/after pairs…`)
const html = await generate()
const outPath = new URL('./fork-fixes.html', import.meta.url).pathname
await writeFile(outPath, html, 'utf8')
console.log(`Written to ${outPath} (${(html.length / 1024).toFixed(1)} KB)`)

// The extracted trees are a build artifact; leave no clutter behind.
await rm(CACHE_DIR, { recursive: true, force: true })
