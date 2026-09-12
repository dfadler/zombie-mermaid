/**
 * Responsive-overflow audit: navigates a set of page templates at a set of
 * viewport widths and flags elements whose `scrollWidth` exceeds their
 * `clientWidth` without an ancestor already handling horizontal overflow
 * (`overflow-x: auto`/`scroll`).
 *
 * This is a real-tool version of a throwaway CDP script from a one-off
 * responsive-design audit session (zombie-mermaid#1032): the original lived
 * entirely in a scratchpad directory, caught one real bug (the editor.html
 * layout), and after refinement correctly ruled out two false positives (a
 * decorative watermark bleed, and a working horizontal-scroll code panel).
 * That refinement is the point of this script: checking an element's own
 * `scrollWidth > clientWidth` in isolation isn't enough — a scroll
 * container is *supposed* to have that property on itself, and isn't a
 * bug — so the flagging rule below walks the element's own ancestor chain
 * (itself included) for a computed `overflow-x: auto`/`scroll` before
 * treating it as a genuine, unhandled overflow.
 *
 * Uses Playwright (`@playwright/test`, already a devDependency for
 * `pnpm run test:visual`) to drive headless Chromium, rather than
 * reimplementing the original script's raw `WebSocket`-driven CDP client —
 * the raw approach made sense for a zero-dependency scratchpad one-off, not
 * for a script this repo is going to maintain.
 *
 * Usage:
 *   PORT=3462 pnpm run dev                                 # in one terminal
 *   pnpm run audit:responsive -- --base-url=http://localhost:3462
 *
 * Flags (all optional):
 *   --base-url=<url>        Base URL to audit against (default: http://localhost:3456,
 *                            matching vite.config.ts's own default port).
 *   --pages=<a,b,c>          Comma-separated route paths to audit (default:
 *                            every page template this repo's dev server
 *                            serves — see DEFAULT_PAGES below). Not a glob:
 *                            these are server routes, not files on disk.
 *   --widths=<a,b,c>         Comma-separated viewport widths in px (default:
 *                            375,768,1440 — mobile/tablet/desktop).
 *   --height=<n>             Viewport height in px (default: 900).
 *   --tolerance=<n>          Overflow tolerance in px before flagging, to
 *                            absorb sub-pixel layout jitter (default: 1).
 *   --screenshot-dir=<path>  Save a full-page PNG for each flagged
 *                            page/width combination only (not every page) —
 *                            for triaging real bugs vs. remaining false
 *                            positives.
 *   --out=<path>             Write the full JSON report to this path.
 *   --exit-zero              Exit 0 even when findings are present (default:
 *                            exit 1 on any finding, so this can later be
 *                            wired up as a CI gate without changing this
 *                            script — see #1032's "doesn't need to be a CI
 *                            gate on day one").
 *
 * This deliberately does not start the dev server itself: point --base-url
 * at whatever's already serving the pages (a `pnpm run dev` instance on any
 * port, or a plain static server over `pnpm run samples`/`build:site`
 * output) — see this repo's CLAUDE.md on why a headless capture against a
 * *live* dev server needs care (below).
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Browser } from '@playwright/test'

export const DEFAULT_WIDTHS = [375, 768, 1440]

// Every page template this repo's dev server (vite.config.ts) serves. Each
// diagram type (/diagrams/<slug>) and each blog post (/blog/<slug>) shares
// one React template with the hub page listed here, so auditing the hub is
// enough to cover that template's chrome; only the hub URLs are templates
// in their own right.
export const DEFAULT_PAGES = [
  '/',
  '/editor',
  '/diagrams',
  '/fork-fixes.html',
  '/dashboard.html',
  '/blog',
]

export const DEFAULT_HEIGHT = 900
export const DEFAULT_TOLERANCE_PX = 1
export const DEFAULT_BASE_URL = 'http://localhost:3456'

export interface AuditOptions {
  baseUrl: string
  pages: string[]
  widths: number[]
  height: number
  tolerancePx: number
  screenshotDir: string | null
  outPath: string | null
  exitZero: boolean
}

const USAGE = `Usage: pnpm run audit:responsive -- [options]

Options:
  --base-url=<url>        Base URL to audit (default: ${DEFAULT_BASE_URL})
  --pages=<a,b,c>          Comma-separated route paths (default: ${DEFAULT_PAGES.join(',')})
  --widths=<a,b,c>         Comma-separated viewport widths in px (default: ${DEFAULT_WIDTHS.join(',')})
  --height=<n>             Viewport height in px (default: ${DEFAULT_HEIGHT})
  --tolerance=<n>          Overflow tolerance in px (default: ${DEFAULT_TOLERANCE_PX})
  --screenshot-dir=<path>  Save a PNG for each flagged page/width only
  --out=<path>             Write the full JSON report to this path
  --exit-zero              Exit 0 even if findings are present
  -h, --help               Show this help
`

function flagValue(args: string[], name: string): string | undefined {
  const prefix = `--${name}=`
  const match = args.find((a) => a.startsWith(prefix))
  return match ? match.slice(prefix.length) : undefined
}

/** Pure argv parser — kept separate from `main()` so it's directly testable. */
export function parseArgs(argv: string[]): AuditOptions {
  const pagesRaw = flagValue(argv, 'pages')
  const pages = pagesRaw
    ? pagesRaw
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
    : DEFAULT_PAGES

  const widthsRaw = flagValue(argv, 'widths')
  const widths = widthsRaw
    ? widthsRaw
        .split(',')
        .map((w) => Number(w.trim()))
        .filter((w) => Number.isFinite(w) && w > 0)
    : DEFAULT_WIDTHS

  return {
    baseUrl: flagValue(argv, 'base-url') ?? DEFAULT_BASE_URL,
    pages,
    widths,
    height: Number(flagValue(argv, 'height') ?? DEFAULT_HEIGHT),
    tolerancePx: Number(flagValue(argv, 'tolerance') ?? DEFAULT_TOLERANCE_PX),
    screenshotDir: flagValue(argv, 'screenshot-dir') ?? null,
    outPath: flagValue(argv, 'out') ?? null,
    exitZero: argv.includes('--exit-zero'),
  }
}

export interface OverflowFinding {
  /** Best-effort CSS-selector-ish description of the element, for triage. */
  selector: string
  tag: string
  scrollWidth: number
  clientWidth: number
  overflowPx: number
}

/**
 * Flags elements with genuine, unhandled horizontal overflow.
 *
 * Runs both inside a real page (via Playwright's `page.evaluate`, which
 * serializes this function — and only this function's own source text, via
 * `Function.prototype.toString` — and evaluates it in the page) and,
 * unit-tested, directly under jsdom. It only touches ambient `document`/
 * `window` globals, no outer closures, so the exact same function backs
 * both.
 *
 * The selector-building logic below is a single, directly-invoked anonymous
 * function expression rather than a named helper (a nested `function
 * describeElement(...)`, or even a `const describeElement = (...) => ...`)
 * on purpose: tsx/esbuild's name-preservation transform wraps *any* named
 * function binding in a call to a module-scope `__name(...)` helper, and
 * `page.evaluate` only ships this function's own source text — not that
 * helper — so a named nested function fails in the browser with
 * `ReferenceError: __name is not defined` (caught by exercising this
 * against a real dev server before opening the PR; confirmed by inspecting
 * `findOverflowingElements.toString()` directly). An anonymous, immediately-
 * invoked function expression has no name for that transform to preserve,
 * so it isn't wrapped.
 *
 * An element is flagged only when its own `scrollWidth - clientWidth`
 * exceeds `tolerancePx` *and* nothing in its ancestor chain (itself
 * included) has a computed `overflow-x` of `auto`/`scroll` already — see
 * this file's header comment for why the ancestor check matters (a working
 * horizontal-scroll panel has this property on itself by design).
 */
export function findOverflowingElements(
  tolerancePx: number = DEFAULT_TOLERANCE_PX,
): OverflowFinding[] {
  const findings: OverflowFinding[] = []
  const elements = document.querySelectorAll('*')

  for (const el of elements) {
    const overflowPx = el.scrollWidth - el.clientWidth
    if (overflowPx <= tolerancePx) continue

    let handled = false
    let ancestor: Element | null = el
    while (ancestor) {
      const overflowX = window.getComputedStyle(ancestor).overflowX
      if (overflowX === 'auto' || overflowX === 'scroll') {
        handled = true
        break
      }
      ancestor = ancestor.parentElement
    }
    if (handled) continue

    // Builds a short, human-readable path to `el` for triage output.
    // Prefers an id, then a tag.class description, then falls back to a
    // `>`-joined nth-of-type path up to the nearest ancestor with an id (or
    // `<body>`). `el.className` is checked for `typeof === 'string'` rather
    // than used directly: on an SVG element it's an `SVGAnimatedString`,
    // not a string — relevant here since every diagram template renders
    // inline SVG — so this falls through to the path-based description for
    // those instead of throwing or stringifying `[object SVGAnimatedString]`.
    const selector = (function (target: Element): string {
      if (target.id) return `#${target.id}`

      const tag = target.tagName.toLowerCase()
      const classes =
        typeof target.className === 'string'
          ? target.className.trim().split(/\s+/).filter(Boolean)
          : []
      if (classes.length > 0) return `${tag}.${classes.join('.')}`

      const path: string[] = []
      let node: Element | null = target
      while (node && node !== document.body) {
        if (node.id) {
          path.unshift(`#${node.id}`)
          break
        }
        const parent: Element | null = node.parentElement
        const siblingsOfSameTag = parent
          ? Array.from(parent.children).filter(
              (c) => c.tagName === node!.tagName,
            )
          : []
        const index = siblingsOfSameTag.indexOf(node) + 1
        const nodeTag = node.tagName.toLowerCase()
        path.unshift(
          siblingsOfSameTag.length > 1
            ? `${nodeTag}:nth-of-type(${index})`
            : nodeTag,
        )
        node = parent
      }
      return path.length > 0 ? path.join(' > ') : tag
    })(el)

    findings.push({
      selector,
      tag: el.tagName.toLowerCase(),
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      overflowPx,
    })
  }

  return findings
}

export interface PageWidthResult {
  page: string
  width: number
  findings: OverflowFinding[]
  screenshotPath?: string
}

function slugify(pagePath: string): string {
  const slug = pagePath
    .replace(/^\/+/, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return slug || 'root'
}

/** Drives `browser` across every page/width combination in `options`. */
export async function runAudit(
  options: AuditOptions,
  browser: Browser,
): Promise<PageWidthResult[]> {
  const results: PageWidthResult[] = []

  for (const pagePath of options.pages) {
    for (const width of options.widths) {
      const page = await browser.newPage()
      try {
        await page.setViewportSize({ width, height: options.height })
        const url = new URL(pagePath, options.baseUrl).toString()
        // 'load', not 'networkidle': this repo's dev server (vite.config.ts)
        // holds its HMR websocket open for as long as a tab is connected, so
        // a live dev-server page never goes network-idle — see this repo's
        // CLAUDE.md ("Live reload keeps the connection open"). The generated
        // pages are self-contained bundled HTML, so 'load' is already enough
        // signal that the DOM this audit walks has settled.
        await page.goto(url, { waitUntil: 'load' })
        const findings = await page.evaluate(
          findOverflowingElements,
          options.tolerancePx,
        )

        const result: PageWidthResult = { page: pagePath, width, findings }
        if (findings.length > 0 && options.screenshotDir) {
          await mkdir(options.screenshotDir, { recursive: true })
          const screenshotPath = join(
            options.screenshotDir,
            `${slugify(pagePath)}-${width}.png`,
          )
          await page.screenshot({ path: screenshotPath, fullPage: true })
          result.screenshotPath = screenshotPath
        }
        results.push(result)
      } finally {
        await page.close()
      }
    }
  }

  return results
}

/** Pure formatter for the console report — kept separate so it's testable without a browser. */
export function formatReport(results: PageWidthResult[]): string {
  const lines: string[] = []
  let totalFindings = 0

  for (const result of results) {
    const status =
      result.findings.length === 0
        ? 'ok'
        : `${result.findings.length} finding(s)`
    lines.push(
      `${result.page.padEnd(20)} @ ${String(result.width).padStart(5)}px  ${status}`,
    )
    for (const finding of result.findings) {
      totalFindings += 1
      lines.push(
        `    ${finding.selector}  scrollWidth=${finding.scrollWidth} clientWidth=${finding.clientWidth} (+${finding.overflowPx}px)`,
      )
    }
    if (result.screenshotPath) {
      lines.push(`    screenshot: ${result.screenshotPath}`)
    }
  }

  lines.push('')
  lines.push(
    totalFindings === 0
      ? 'OK: no unhandled horizontal overflow found.'
      : `FAIL: ${totalFindings} unhandled overflow finding(s) across ${results.length} page/width combination(s).`,
  )
  return lines.join('\n')
}

export async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE)
    return
  }

  const options = parseArgs(argv)
  const { chromium } = await import('@playwright/test')
  const browser = await chromium.launch()
  try {
    const results = await runAudit(options, browser)
    console.log(formatReport(results))

    if (options.outPath) {
      await writeFile(options.outPath, JSON.stringify(results, null, 2))
      console.log(`\nWrote JSON report to ${options.outPath}`)
    }

    const totalFindings = results.reduce((n, r) => n + r.findings.length, 0)
    if (totalFindings > 0 && !options.exitZero) {
      process.exitCode = 1
    }
  } finally {
    await browser.close()
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main()
}
