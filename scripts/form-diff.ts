/**
 * Generates form-diff.html — a human-reviewable report pairing REAL
 * mermaid.js output (the actual upstream library — the same rendering
 * behavior as the mermaid Live Editor or GitHub's own mermaid preview)
 * against this repo's ASCII output, side by side, for every sample in
 * samples-data.ts.
 *
 * Usage: tsx scripts/form-diff.ts [--category=Sequence]
 *   --category   Only render samples whose category matches exactly
 *                (e.g. "Sequence", "Class", "ER"). Omit to render all.
 *
 * Ground truth here is deliberately NOT this repo's own renderMermaidSVG:
 * despite the name, this repo ("zombie-mermaid", a maintained fork of
 * beautiful-mermaid) does not use the upstream mermaid.js library at all —
 * it's an independent, from-scratch reimplementation of mermaid's SVG
 * output, with zero DOM dependencies. That reimplementation could itself
 * diverge from real mermaid semantics, so it can't be trusted as the
 * reference an ASCII-fidelity check is measured against. This script
 * instead renders through the actual `mermaid` npm package (a devDependency
 * added for this purpose) headlessly via Playwright — the same engine that
 * powers the mermaid Live Editor and GitHub's mermaid code-block preview —
 * so the "ground truth" panel is genuine upstream behavior, not this
 * repo's own opinion of it.
 *
 * Unlike scripts/visual-diff.ts (which compares the *same* renderer across
 * two git refs, before vs. after a change), this script compares *two
 * different implementations* — real mermaid.js and this repo's ASCII
 * renderer — for the same moment in time. The ASCII side still goes
 * through this repo's parser (`splitStatements` + `parse*` in
 * src/ascii/index.ts's dispatch), so a structural difference between the
 * two panels below is a genuine rendering-fidelity gap, not a parsing
 * difference on either side.
 *
 * No screenshot step: real mermaid SVG and asciiToHtml's ASCII markup are
 * both just HTML, so they embed directly side by side in one static report
 * the same way visual-diff.ts's renderPanel already does for its panels.
 * Each sample gets a unique mermaid render id, so mermaid's own scoped
 * `#<id> .class{...}` stylesheet (injected per-render) never bleeds across
 * samples embedded together on this one page.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { renderMermaidASCII } from '../src/index.ts'
import { samples, type Sample } from '../samples-data.ts'
import { escapeHtml } from '../demo/format.ts'
import { asciiToHtml } from '../ascii-html.ts'
import { startRealMermaid, renderRealMermaidSvg } from './lib/real-mermaid.ts'

const categoryArg = process.argv.find((a) => a.startsWith('--category='))
const CATEGORY_FILTER = categoryArg
  ? categoryArg.slice('--category='.length)
  : undefined

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function renderAsciiPanel(sample: Sample): string {
  try {
    const ascii = renderMermaidASCII(sample.source, { colorMode: 'none' })
    if (ascii.trim() === '')
      return '<div class="fix-empty">Rendered nothing.</div>'
    return `<pre class="fix-ascii">${asciiToHtml(ascii.replace(/[ \t]+$/gm, ''))}</pre>`
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return `<div class="fix-error"><strong>Threw:</strong> ${escapeHtml(message)}</div>`
  }
}

function renderSampleSection(
  id: string,
  sample: Sample,
  mermaidSvgPanel: string,
): string {
  return `
      <section class="fix" id="${id}">
        <h2><a class="fix-anchor" href="#${id}">${escapeHtml(sample.category ?? 'uncategorized')} / ${escapeHtml(sample.title)}</a></h2>
        <div class="fix-pair">
          <div class="fix-side">
            <h3 class="fix-side-title fix-side-before">Real mermaid.js (ground truth)</h3>
            ${mermaidSvgPanel}
          </div>
          <div class="fix-side">
            <h3 class="fix-side-title fix-side-after">This repo's ASCII output</h3>
            ${renderAsciiPanel(sample)}
          </div>
        </div>
      </section>`
}

async function generate(): Promise<string> {
  const indexed = samples
    .map((sample, i) => ({ sample, i }))
    .filter(({ sample }) => {
      if (sample.category === 'Hero') return false // no ASCII panel for Hero samples
      if (CATEGORY_FILTER && sample.category !== CATEGORY_FILTER) return false
      return true
    })

  console.log(
    `Rendering ${indexed.length} sample(s) through real mermaid.js${CATEGORY_FILTER ? ` (category: ${CATEGORY_FILTER})` : ''}…`,
  )

  const session = await startRealMermaid()

  const sections: string[] = []
  try {
    for (const { sample, i } of indexed) {
      const id = `form-${i}-${slug(sample.category ?? 'uncategorized')}-${slug(sample.title)}`
      let mermaidPanel: string
      try {
        const svg = await renderRealMermaidSvg(
          session,
          id.replace(/-/g, '_'),
          sample.source,
        )
        mermaidPanel =
          svg.trim() === ''
            ? '<div class="fix-empty">Rendered nothing.</div>'
            : `<div class="fix-svg">${svg}</div>`
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        mermaidPanel = `<div class="fix-error"><strong>Threw:</strong> ${escapeHtml(message)}</div>`
      }
      sections.push(renderSampleSection(id, sample, mermaidPanel))
    }
  } finally {
    await session.close()
  }

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
  <title>Form diff — zombie-mermaid</title>
  <meta name="description" content="Real mermaid.js output paired against this repo's ASCII output, side by side, for every sample." />
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
      <h1>Form diff</h1>
      <p class="fix-intro">
        Real, upstream mermaid.js output (ground truth — the same rendering
        engine behind the mermaid Live Editor and GitHub's own mermaid
        preview, not this repo's own SVG reimplementation) paired against
        this repo's ASCII output for the same source, for every
        sample${CATEGORY_FILTER ? ` in category "${escapeHtml(CATEGORY_FILTER)}"` : ''}.
        The ASCII side renders through the current working tree — this is
        not a before/after diff (see <code>pnpm run visual-diff</code> for
        that), it's a same-moment cross-check against the actual upstream
        library.
      </p>
      <p class="fix-intro">
        <strong>${sections.length}</strong> sample(s) rendered.
      </p>
    </header>
${sections.join('\n')}
  </div>
</body>
</html>`
}

const html = await generate()
const outPath = fileURLToPath(new URL('../form-diff.html', import.meta.url))
await writeFile(outPath, html, 'utf8')
console.log(`Written to ${outPath} (${(html.length / 1024).toFixed(1)} KB)`)
