/**
 * Captures real-terminal screenshots of each `render: 'ascii'` fork-fix's
 * before/after CLI output, for embedding on fork-fixes.html.
 *
 * fork-fixes.ts's own ASCII panels go through ascii-html.ts — an HTML/CSS
 * approximation of a terminal (same one the live demo and the Playwright
 * visual-regression suite use). This script instead produces a screenshot
 * of what a user actually sees running `zombie-mermaid render --ascii` in
 * their own terminal, per the verify-ascii-terminal skill's core point:
 * the HTML mockup and a real terminal can drift (see the
 * ascii-terminal-overflow-scroll fix).
 *
 * Pipeline:
 *   1. asciinema records the command in a genuine PTY. The captured
 *      invocation is the CLI's actual default — `zombie-mermaid render
 *      <file> --ascii` with no `--theme` flag — which src/cli/render.ts
 *      resolves to `colorMode: 'none'` ("respects terminal colors on any
 *      background"), so the screenshot shows plain text taking on the
 *      terminal theme's own foreground color, exactly as a real user
 *      running the default command would see it.
 *   2. agg renders the recording to a GIF using its own terminal-cell
 *      algorithm (real monospace grid + wcwidth-accurate wide-char
 *      handling) — not a browser CSS approximation.
 *   3. ffmpeg extracts the final frame as a still PNG.
 *
 * Usage: tsx scripts/capture-fork-fixes-terminal.ts [fix-id...]
 * With no arguments, captures every `render: 'ascii'` entry.
 *
 * Requires `asciinema`, `agg`, and `ffmpeg` on PATH (`brew install
 * asciinema agg ffmpeg`). Output PNGs are committed to the repo under
 * public/fork-fixes-screenshots/ — alongside favicon.svg etc., so
 * `pnpm run build:site`'s `cp -r public/* site/` ships them automatically.
 * Re-run this script and commit the result whenever an ascii-mode entry's
 * source or fixCommit changes in demo/fork-fixes-data.ts.
 */

import { execFile } from 'node:child_process'
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'
import { forkFixes } from '../demo/fork-fixes-data.ts'
import { displayWidth } from '../src/ascii/display-width.ts'

const exec = promisify(execFile)

const REPO_ROOT = new URL('../', import.meta.url).pathname
const CACHE_DIR = new URL('../.fork-fixes-cache/', import.meta.url).pathname
const SCRATCH_DIR = new URL(
  '../.fork-fixes-screenshots-scratch/',
  import.meta.url,
).pathname
const OUT_DIR = new URL('../public/fork-fixes-screenshots/', import.meta.url)
  .pathname
const TSX_BIN = `${REPO_ROOT}node_modules/.bin/tsx`

interface RendererModule {
  renderMermaidASCII?: (source: string, options?: unknown) => string
  renderMermaidAscii?: (source: string, options?: unknown) => string
}

/** Mirrors fork-fixes.ts's own guard — see there for the full rationale. */
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
          ? 'This is a shallow clone — run `git fetch --unshallow`.'
          : `Check the fixCommit value in demo/fork-fixes-data.ts.`),
    )
  }
}

/** Extract `commit^`'s src/ tree and return its index.ts path. */
async function extractBefore(commit: string): Promise<string> {
  const dir = `${CACHE_DIR}${commit}`
  if (!existsSync(dir)) {
    await requireCommit(commit)
    await mkdir(dir, { recursive: true })
    await exec(
      'sh',
      ['-c', `git archive ${commit}^ src | tar -x -C ${JSON.stringify(dir)}`],
      { maxBuffer: 64 * 1024 * 1024 },
    )
  }
  return `${dir}/src/index.ts`
}

function maxLineWidth(text: string): number {
  return Math.max(...text.split('\n').map((line) => displayWidth(line)))
}

async function renderPlain(indexPath: string, source: string): Promise<string> {
  const mod = (await import(indexPath)) as RendererModule
  const fn = mod.renderMermaidASCII ?? mod.renderMermaidAscii
  if (!fn) throw new Error(`no ASCII renderer export found in ${indexPath}`)
  return fn(source, { colorMode: 'none' })
}

/**
 * Record, render, and extract one before/after side as a PNG screenshot.
 *
 * The PTY is sized to the content (prompt line + blank line + output +
 * one trailing row for the cursor) rather than a fixed geometry, so the
 * screenshot has no dead space regardless of how large a given diagram is.
 */
async function captureSide(
  id: string,
  side: 'before' | 'after',
  indexPath: string,
  source: string,
): Promise<void> {
  const plain = await renderPlain(indexPath, source)
  const trimmedPlain = plain.replace(/[ \t]+$/gm, '')
  const promptLine = `$ zombie-mermaid render ${id}.mmd --ascii`
  const contentLines = trimmedPlain.split('\n')
  // Sized from the *untrimmed* render: the runner below prints the canvas
  // as-is, and every row is padded to the canvas width — a few cells past
  // the visible content. Sizing from the trimmed width made any diagram
  // wider than its own prompt line wrap in the PTY and scroll its top rows
  // off the screenshot.
  const cols = Math.max(displayWidth(promptLine), maxLineWidth(plain)) + 2
  const rows = 1 + 1 + contentLines.length + 1

  await mkdir(SCRATCH_DIR, { recursive: true })
  const runnerPath = `${SCRATCH_DIR}${id}-${side}-runner.mjs`
  const runnerSrc = `import { pathToFileURL } from 'node:url'
const mod = await import(pathToFileURL(${JSON.stringify(indexPath)}).href)
const render = mod.renderMermaidASCII ?? mod.renderMermaidAscii
console.log(${JSON.stringify(promptLine)})
console.log()
process.stdout.write(render(${JSON.stringify(source)}, { colorMode: 'none' }) + '\\n')
`
  await writeFile(runnerPath, runnerSrc, 'utf8')

  const castPath = `${SCRATCH_DIR}${id}-${side}.cast`
  const gifPath = `${SCRATCH_DIR}${id}-${side}.gif`
  const framesDir = `${SCRATCH_DIR}${id}-${side}-frames`

  await exec(
    'asciinema',
    [
      'rec',
      '--command',
      `${TSX_BIN} ${runnerPath}`,
      '--window-size',
      `${cols}x${rows}`,
      '--overwrite',
      '-q',
      castPath,
    ],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
    },
  )

  await exec('agg', [
    '--cols',
    String(cols),
    '--rows',
    String(rows),
    '--theme',
    'dracula',
    castPath,
    gifPath,
  ])

  // Extract every frame, then keep the last one — the recording has no real
  // animation (the process prints and exits), so "last" is simply "fully
  // rendered", and this avoids guessing a frame index or total count.
  await mkdir(framesDir, { recursive: true })
  await exec('ffmpeg', [
    '-y',
    '-i',
    gifPath,
    '-vsync',
    '0',
    `${framesDir}/frame_%03d.png`,
    '-loglevel',
    'error',
  ])
  const frames = (await readdir(framesDir))
    .filter((f) => f.endsWith('.png'))
    .sort()
  if (frames.length === 0) {
    throw new Error(`ffmpeg produced no frames for ${id}-${side}`)
  }

  await mkdir(OUT_DIR, { recursive: true })
  const outPath = `${OUT_DIR}${id}-${side}.png`
  await rename(`${framesDir}/${frames.at(-1)}`, outPath)
  await rm(framesDir, { recursive: true, force: true })
}

async function main() {
  const requestedIds = new Set(process.argv.slice(2))
  const fixes = forkFixes.filter(
    (f) =>
      f.render === 'ascii' &&
      (requestedIds.size === 0 || requestedIds.has(f.id)),
  )
  if (fixes.length === 0) {
    console.error('No matching render: "ascii" entries found.')
    process.exit(1)
  }

  let written = 0
  for (const fix of fixes) {
    process.stdout.write(`  ${fix.id}… `)
    const afterIndexPath = `${REPO_ROOT}src/index.ts`
    const beforeIndexPath = await extractBefore(fix.fixCommit)

    // A render can throw (a crash IS the "before" state for some fixes) or
    // produce empty output (the diagram was dropped entirely) — fork-fixes.ts
    // shows a text explanation for both cases instead of a panel, so a
    // screenshot here would just be orphaned: never linked from the HTML.
    const sides: Array<{ side: 'before' | 'after'; indexPath: string }> = [
      { side: 'before', indexPath: beforeIndexPath },
      { side: 'after', indexPath: afterIndexPath },
    ]
    const plainBySide = new Map<'before' | 'after', string>()
    for (const { side, indexPath } of sides) {
      try {
        plainBySide.set(side, await renderPlain(indexPath, fix.source))
      } catch (err) {
        console.log(
          `\n  ${side} threw (${err instanceof Error ? err.message : String(err)}) — skipping screenshot`,
        )
      }
    }
    if (
      plainBySide.get('before') !== undefined &&
      plainBySide.get('before') === plainBySide.get('after')
    ) {
      console.log(
        '\n  WARNING: before/after render identically — screenshot pair will not show a difference.',
      )
    }

    for (const { side, indexPath } of sides) {
      const plain = plainBySide.get(side)
      if (plain === undefined || plain.trim() === '') continue
      await captureSide(fix.id, side, indexPath, fix.source)
      written++
    }
    console.log('ok')
  }

  await rm(CACHE_DIR, { recursive: true, force: true })
  await rm(SCRATCH_DIR, { recursive: true, force: true })
  console.log(`\nWrote ${written} screenshots to ${OUT_DIR}`)
}

await main()
