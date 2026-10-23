/**
 * fork-fixes.html — a before/after showcase of bugs this fork fixed (ported from
 * the former packages/site/fork-fixes.ts).
 *
 * Every "before" is rendered by the project's actual renderer as it existed
 * immediately before the fix landed (fork-fixes-before.ts, started by the
 * build config concurrently with everything else); every "after" is the live
 * tree. Nothing is hand-drawn. The build FAILS if any pair renders
 * identically: a before/after where both halves look the same silently claims a
 * fix the page does not demonstrate (#189).
 *
 * Markup comes from demo/components/fork-fixes-page.tsx; this file keeps what
 * needs I/O or a renderer, and the component only decides what element each
 * result becomes.
 */
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createElement } from 'react'
import { forkFixes, type ForkFix } from '../../../demo/fork-fixes-data.ts'
import { formatProse } from '../../../demo/format.ts'
import { renderHtmlDocument } from '../../../demo/render-html.ts'
import { sharedPageCss } from '../../../demo/components/shared-page-css.tsx'
import {
  ForkFixesPage,
  type FixSectionProps,
  type PanelContent,
} from '../../../demo/components/fork-fixes-page.tsx'
import * as current from '../../../src/index.ts'
import { asciiToHtml } from '../ascii-html.ts'
import { renderWith, type BeforeResult } from './fork-fixes-before.ts'
import type { Clients, Routes } from './shared.ts'

/**
 * Real-terminal screenshots for `render: 'ascii'` entries, captured by
 * scripts/capture-fork-fixes-terminal.ts (asciinema + agg against a genuine
 * PTY, not ascii-html.ts's browser approximation) and committed here.
 */
const SCREENSHOTS_DIR = new URL(
  '../../../public/fork-fixes-screenshots/',
  import.meta.url,
).pathname

interface RenderPair {
  fix: ForkFix
  before: string
  after: string
  /** Set when a render threw: itself a legitimate "before" for crash fixes. */
  beforeError?: string
  afterError?: string
}

/**
 * Decide what one side of a pair shows: a real-terminal screenshot, the
 * diagram, an excerpt of its markup, the error it threw, or an explicit note
 * that it produced nothing. Returns data; `<FixPanel>` turns it into markup.
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

  // Some "before" states produced no output at all (the parser dropped the
  // whole diagram). Say so: a blank panel is indistinguishable from a broken page.
  if (output.trim() === '') return { kind: 'empty' }

  if (excerpt) {
    // Literal indexOf bounds rather than a constructed regex: every excerpt is
    // a fixed tag. Drop the per-render id scope (`zm<hash>-`, #1397) so an
    // excerpt can name `<marker id="arrowhead-start"` for both renders.
    const text = output.replace(/zm[0-9a-z]+-/g, '')
    const start = text.indexOf(excerpt.from)
    const end =
      start === -1 ? -1 : text.indexOf(excerpt.to, start + excerpt.from.length)
    if (start === -1 || end === -1) {
      // Without the slice the entry would render an empty panel, silently
      // claiming a fix it no longer shows. Fail instead.
      throw new Error(
        `excerpt "${excerpt.from}" … "${excerpt.to}" was not found in the output`,
      )
    }
    return {
      kind: 'excerpt',
      text: text.slice(start, end + excerpt.to.length).trim(),
    }
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

function fixSectionProps(pair: RenderPair): FixSectionProps {
  const { fix } = pair
  const panel = (side: 'before' | 'after') =>
    panelContent(
      fix.id,
      side,
      pair[side],
      pair[`${side}Error`],
      fix.render,
      fix.excerpt,
    )
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
    before: panel('before'),
    after: panel('after'),
  }
}

export async function forkFixesRoutes(
  c: Clients,
  out: Routes,
  befores: Map<string, BeforeResult>,
): Promise<void> {
  const pairs: RenderPair[] = forkFixes.map((fix) => {
    const pair: RenderPair = { fix, before: '', after: '' }
    const before = befores.get(fix.id)
    if (!before) throw new Error(`no "before" render for ${fix.id}`)
    if ('error' in before) pair.beforeError = before.error
    else pair.before = before.output
    try {
      pair.after = renderWith(current, fix.source, fix.render)
    } catch (err) {
      pair.afterError = err instanceof Error ? err.message : String(err)
    }
    return pair
  })

  const identical = pairs.filter(
    (p) => !p.beforeError && !p.afterError && p.before === p.after,
  )
  if (identical.length > 0) {
    throw new Error(
      `These fixes render identically before and after, so they prove nothing:\n` +
        identical.map((p) => `  - ${p.fix.id} (${p.fix.fixCommit})`).join('\n') +
        `\n\nEither the sample no longer reproduces the bug, or the commit is wrong.`,
    )
  }

  // The #608 redesign moved this page onto the shared design system (#591);
  // see demo/fork-fixes.css's header for what its own CSS file still holds.
  const pageCss = await readFile(
    new URL('../../../demo/fork-fixes.css', import.meta.url),
    'utf8',
  )
  out.set(
    'fork-fixes.html',
    renderHtmlDocument(
      createElement(ForkFixesPage, {
        css: sharedPageCss(pageCss),
        fixes: pairs.map(fixSectionProps),
        // #802: hydrates ForkFixesApp + NavIsland.
        clientScript: c['fork-fixes-client']!,
      }),
    ),
  )
}
