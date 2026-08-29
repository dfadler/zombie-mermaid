/**
 * Generates visual-diff.html — a human-reviewable before/after report over
 * the *entire* sample catalog (samples-data.ts + xychart-samples-data.ts),
 * comparing this working tree's renderer against a base git ref.
 *
 * Usage: tsx scripts/visual-diff.ts [--base=<ref>]
 *   --base   Git ref to compare against. Defaults to "main".
 *
 * Unlike fork-fixes.ts (a curated, hand-picked list of historical bugs,
 * extracted at two historical commits), this script sweeps *every* current
 * sample and compares the live working tree — including uncommitted changes
 * — against one base ref. It's the tool for "does my in-progress change
 * alter any rendered output, and where": run it before opening a PR that
 * touches rendering code.
 *
 * Only the renderer (`src/`) is extracted from the base ref; the sample
 * catalog itself always comes from the working tree, so a sample added in
 * this change still renders on both sides (the "before" side shows how the
 * old renderer handles new syntax, including a thrown error if it can't).
 *
 * Samples whose output is byte-identical on both sides are collapsed into a
 * summary list rather than rendered — the point of this report is to
 * surface what changed, not to reprint everything that didn't.
 */

import { execFile, spawn } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { samples } from '../samples-data.ts'
import { xychartSamples } from '../xychart-samples-data.ts'
import { escapeHtml } from '../demo/format.ts'
import { asciiToHtml } from '../ascii-html.ts'

const exec = promisify(execFile)

const CACHE_DIR = new URL('../.visual-diff-cache/', import.meta.url).pathname

const baseArg = process.argv.find((a) => a.startsWith('--base='))
const BASE_REF = baseArg ? baseArg.slice('--base='.length) : 'main'

interface RendererModule {
  renderMermaidSVG?: (source: string, options?: unknown) => string
  renderMermaidAscii?: (source: string, options?: unknown) => string
  renderMermaidASCII?: (source: string, options?: unknown) => string
}

/** Verify `ref` exists in this repo and return the commit SHA it resolves to. */
async function resolveRef(ref: string): Promise<string> {
  try {
    const { stdout } = await exec('git', [
      'rev-parse',
      '--verify',
      `${ref}^{commit}`,
    ])
    return stdout.trim()
  } catch {
    const shallow = await exec('git', ['rev-parse', '--is-shallow-repository'])
      .then((r) => r.stdout.trim() === 'true')
      .catch(() => false)
    throw new Error(
      `Base ref "${ref}" is not in this repository.\n` +
        (shallow
          ? 'This is a shallow clone — run `git fetch --unshallow`, or fetch the ref you want to compare against.'
          : `Check that "${ref}" is a valid branch, tag, or commit.`),
    )
  }
}

/**
 * Extract `src/` at `ref`'s resolved commit SHA into a scratch directory and
 * import its renderer.
 *
 * Keyed by the resolved SHA (not the raw ref) and always re-extracted rather
 * than cached across runs: a moving ref like `main` would otherwise reuse a
 * stale extraction under the same directory name, and a directory left
 * behind by a prior run that crashed mid-extraction would otherwise look
 * "already populated" and get reused incomplete.
 */
async function loadRendererAt(ref: string): Promise<RendererModule> {
  const sha = await resolveRef(ref)
  const dir = `${CACHE_DIR}${sha}`
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })

  // Piped directly (no shell) so `ref`/`sha` is never interpolated into a
  // command string — both come from `git rev-parse`'s own output, but this
  // also just means a ref containing whitespace or shell metacharacters
  // can't break the extraction.
  await new Promise<void>((resolve, reject) => {
    const archive = spawn('git', ['archive', sha, 'src'])
    const untar = spawn('tar', ['-x', '-C', dir])
    let archiveStderr = ''
    archive.stderr.on('data', (chunk: Buffer) => {
      archiveStderr += chunk.toString()
    })
    archive.on('error', reject)
    untar.on('error', reject)
    archive.stdout.pipe(untar.stdin)
    archive.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`git archive exited with ${code}: ${archiveStderr}`))
      }
    })
    untar.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`tar exited with ${code}`))
    })
  })

  return (await import(`${dir}/src/index.ts`)) as RendererModule
}

function renderSvgWith(
  mod: RendererModule,
  source: string,
  options?: unknown,
): string {
  const fn = mod.renderMermaidSVG
  if (!fn) throw new Error('no SVG renderer export found')
  return fn(source, options)
}

function renderAsciiWith(mod: RendererModule, source: string): string {
  const fn = mod.renderMermaidASCII ?? mod.renderMermaidAscii
  if (!fn) throw new Error('no ASCII renderer export found')
  // 'none': renderPanel below passes this through asciiToHtml, which
  // escapes every grapheme for safe HTML embedding — 'html'-mode output
  // (already-escaped `<span>` markup) would itself get escaped a second
  // time and show up as literal tag text instead of colored spans. Matches
  // fork-fixes.ts's ASCII rendering for the same reason.
  return fn(source, { colorMode: 'none' })
}

interface Pair {
  id: string
  title: string
  category: string
  mode: 'svg' | 'ascii'
  before: string
  after: string
  beforeError?: string
  afterError?: string
}

function changed(pair: Pair): boolean {
  return Boolean(
    pair.beforeError || pair.afterError || pair.before !== pair.after,
  )
}

async function renderPair(
  id: string,
  sample: {
    title: string
    category?: string
    source: string
    options?: unknown
  },
  mode: 'svg' | 'ascii',
  before: RendererModule,
  after: RendererModule,
): Promise<Pair> {
  const pair: Pair = {
    id,
    title: sample.title,
    category: sample.category ?? 'uncategorized',
    mode,
    before: '',
    after: '',
  }
  try {
    pair.before =
      mode === 'svg'
        ? renderSvgWith(before, sample.source, sample.options)
        : renderAsciiWith(before, sample.source)
  } catch (err) {
    pair.beforeError = err instanceof Error ? err.message : String(err)
  }
  try {
    pair.after =
      mode === 'svg'
        ? renderSvgWith(after, sample.source, sample.options)
        : renderAsciiWith(after, sample.source)
  } catch (err) {
    pair.afterError = err instanceof Error ? err.message : String(err)
  }
  return pair
}

function renderPanel(
  output: string,
  error: string | undefined,
  mode: 'svg' | 'ascii',
): string {
  if (error) {
    return `<div class="fix-error"><strong>Threw:</strong> ${escapeHtml(error)}</div>`
  }
  if (output.trim() === '') {
    return `<div class="fix-empty">Rendered nothing.</div>`
  }
  if (mode === 'ascii') {
    return `<pre class="fix-ascii">${asciiToHtml(output.replace(/[ \t]+$/gm, ''))}</pre>`
  }
  return `<div class="fix-svg">${output}</div>`
}

function renderPairSection(pair: Pair): string {
  return `
      <section class="fix" id="${pair.id}">
        <h2><a class="fix-anchor" href="#${pair.id}">${escapeHtml(pair.category)} / ${escapeHtml(pair.title)}</a></h2>
        <p class="fix-meta">
          <span class="fix-mode">${pair.mode === 'svg' ? 'SVG' : 'ASCII'} output</span>
        </p>
        <div class="fix-pair">
          <div class="fix-side">
            <h3 class="fix-side-title fix-side-before">Before (${escapeHtml(BASE_REF)})</h3>
            ${renderPanel(pair.before, pair.beforeError, pair.mode)}
          </div>
          <div class="fix-side">
            <h3 class="fix-side-title fix-side-after">After (working tree)</h3>
            ${renderPanel(pair.after, pair.afterError, pair.mode)}
          </div>
        </div>
      </section>`
}

async function generate(): Promise<string> {
  console.log(`Loading renderer at "${BASE_REF}"…`)
  const before = await loadRendererAt(BASE_REF)
  const after = (await import('../src/index.ts')) as RendererModule

  const pairs: Pair[] = []

  console.log(`Rendering ${samples.length} gallery samples (SVG)…`)
  for (const [i, sample] of samples.entries()) {
    pairs.push(
      await renderPair(`svg-general-${i}`, sample, 'svg', before, after),
    )
  }

  console.log(
    `Rendering ${samples.filter((s) => s.category !== 'Hero').length} gallery samples (ASCII)…`,
  )
  for (const [i, sample] of samples.entries()) {
    if (sample.category === 'Hero') continue
    pairs.push(
      await renderPair(`ascii-general-${i}`, sample, 'ascii', before, after),
    )
  }

  console.log(`Rendering ${xychartSamples.length} xychart samples (SVG)…`)
  for (const [i, sample] of xychartSamples.entries()) {
    pairs.push(
      await renderPair(`svg-xychart-${i}`, sample, 'svg', before, after),
    )
  }

  const changedPairs = pairs.filter(changed)
  const unchangedPairs = pairs.filter((p) => !changed(p))

  console.log(
    `${changedPairs.length} changed, ${unchangedPairs.length} unchanged (${pairs.length} total)`,
  )

  const styles = await readFile(
    new URL('../demo/styles.css', import.meta.url),
    'utf8',
  )
  const extra = await readFile(
    new URL('../demo/fork-fixes.css', import.meta.url),
    'utf8',
  )

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Visual diff — zombie-mermaid</title>
  <meta name="description" content="Before/after renders of every sample, comparing the working tree against ${escapeHtml(BASE_REF)}." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
${styles}
${extra}
    .diff-unchanged {
      padding: 1.5rem 0;
      border-top: 1px solid color-mix(in srgb, var(--t-fg) 12%, var(--t-bg));
      font-size: 0.8125rem;
      color: color-mix(in srgb, var(--t-fg) 55%, var(--t-bg));
    }
    .diff-unchanged summary {
      cursor: pointer;
      font-weight: 600;
    }
    .diff-unchanged ul {
      margin-top: 0.75rem;
      padding-left: 1.25rem;
      line-height: 1.7;
    }
  </style>
</head>
<body>
  <div class="content-wrapper">
    <header class="fix-header">
      <h1>Visual diff</h1>
      <p class="fix-intro">
        Every sample in the gallery, rendered by this working tree's renderer
        against the renderer at <code>${escapeHtml(BASE_REF)}</code>. Only
        samples whose output actually differs are shown in full below;
        identical ones are listed in the collapsed section at the bottom.
      </p>
      <p class="fix-intro">
        <strong>${changedPairs.length}</strong> changed,
        <strong>${unchangedPairs.length}</strong> unchanged out of
        ${pairs.length} rendered.
      </p>
    </header>
${changedPairs.map(renderPairSection).join('\n')}
    <details class="diff-unchanged">
      <summary>${unchangedPairs.length} unchanged samples</summary>
      <ul>
${unchangedPairs.map((p) => `        <li>${escapeHtml(p.category)} / ${escapeHtml(p.title)} (${p.mode})</li>`).join('\n')}
      </ul>
    </details>
  </div>
</body>
</html>`
}

const html = await generate()
const outPath = new URL('../visual-diff.html', import.meta.url).pathname
await writeFile(outPath, html, 'utf8')
console.log(`Written to ${outPath} (${(html.length / 1024).toFixed(1)} KB)`)

await rm(CACHE_DIR, { recursive: true, force: true })
