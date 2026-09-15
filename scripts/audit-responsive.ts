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
 * A third false-positive class was found the same way (zombie-mermaid#1055):
 * the standard "visually hidden but still exposed to assistive tech"
 * technique (`demo/styles.css`'s `.visually-hidden`, and the inline
 * equivalent in `demo/components/slot-number.tsx`) clips an element to a
 * `position: absolute`, 1×1px box via `overflow: hidden` + `clip: rect(0, 0,
 * 0, 0)` while its full text content still determines `scrollWidth` — by
 * design, the same way it does for any sr-only utility class (Bootstrap's
 * `sr-only`, Tailwind's `sr-only`, the WAI-ARIA "invisible" techniques this
 * pattern comes from). That mismatch is *never* visible: the element is
 * removed from normal flow (`position: absolute`/`fixed`, so it can't push
 * or spill onto anything) and its content is clipped to nothing, so there is
 * no pixel on screen for the excess `scrollWidth` to occupy. The check below
 * skips an element whose own clipped box is at most `tolerancePx` on a side
 * once it's confirmed out of flow — the two properties that together
 * guarantee the "overflow" can never actually render.
 *
 * A fourth false-positive class (zombie-mermaid#1057): `demo/components/
 * nav-css.ts`'s `.mobile-watermark` wraps a rotated, off-edge decorative
 * mark in its own `position: absolute; inset: 0; overflow: hidden;
 * pointer-events: none` box specifically so *it* — not `.mobile-nav-panel`
 * — absorbs the mark's pre-clip `scrollWidth` (see the large comment above
 * that rule for the full history). Plain `overflow: hidden` is deliberately
 * *not* treated as handled the way `auto`/`scroll` are: unlike a scroll
 * container, a `hidden` ancestor could just as easily be genuinely cutting
 * off meaningful content (a too-narrow real container clipping real text or
 * an image), which is exactly the kind of bug this audit exists to catch —
 * so blanket-trusting every `overflow: hidden` ancestor would suppress real
 * findings, not just this one. The ancestor walk below instead recognizes
 * only the narrow, `.mobile-watermark`-shaped combination that together
 * guarantees nothing is actually being cut off: `overflow-x: hidden` *and*
 * `pointer-events: none` (nothing interactive/informational lives here —
 * it's decorative) *and* pinned exactly to its containing block on every
 * side (`position: absolute`/`fixed` with `inset: 0`, i.e. computed
 * `top`/`right`/`bottom`/`left` all `0px` — so this box's own size can never
 * be "too narrow"; it's always exactly its container's size, a full-bleed
 * overlay layer rather than a sized content box). An `overflow: hidden`
 * container missing any one of those signals still falls through to being
 * flagged, same as before.
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
 *                            375,414,480,768,1024,1440 — mobile, two
 *                            intermediate mobile/phablet widths, tablet,
 *                            landscape tablet, and desktop — see #1033).
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
 *   --themes=<a,b,c>         Comma-separated built-in theme keys (see
 *                            packages/core/src/theme.ts's THEMES) to
 *                            spot-check on top of the default-theme audit
 *                            above (default: dracula,github-light — one
 *                            dark, one light, per #1033). Applied only to
 *                            --theme-pages, not the full --pages matrix.
 *   --theme-pages=<a,b,c>    Comma-separated route paths to run the theme
 *                            spot-check against (default: /,/editor — the
 *                            only templates that currently wire into
 *                            demo/theme-state.ts's shared `mermaid-theme`
 *                            localStorage preference, confirmed against a
 *                            running dev server while building this: the
 *                            diagram-type/dashboard/fork-fixes/blog
 *                            templates render no theme picker today despite
 *                            older code comments suggesting they once did).
 *   --theme-widths=<a,b,c>   Comma-separated viewport widths for the theme
 *                            spot-check (default: 375,414,480 — #1033 asks
 *                            specifically whether theme choice affects
 *                            layout "at narrow widths", so this stays a
 *                            narrower matrix than --widths by default).
 *   --skip-theme-check       Skip the theme spot-check entirely (default:
 *                            runs it as part of every audit).
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
import type { Browser, BrowserContext, Page } from '@playwright/test'

// 375 (mobile), 414 (large phone, e.g. iPhone Plus/Max widths), 480
// (phablet), 768 (tablet portrait), 1024 (tablet landscape), 1440
// (desktop) — broadened from the original 375/768/1440 per #1033, which
// found the original three-width matrix skipped every intermediate width a
// real device actually ships.
export const DEFAULT_WIDTHS = [375, 414, 480, 768, 1024, 1440]

/**
 * Built-in theme keys (see `packages/core/src/theme.ts`'s `THEMES`)
 * spot-checked by default: one dark, one light — matches #1033's own
 * example pair rather than looping all 15, since the point is a spot-check
 * for theme-driven *layout* differences (colors changing is expected and
 * not what this audit looks for), not exhaustive per-theme coverage.
 */
export const DEFAULT_THEMES = ['dracula', 'github-light']

/**
 * Route paths the theme spot-check runs against by default. Kept separate
 * from `DEFAULT_PAGES` (and deliberately not just "every page in
 * `DEFAULT_PAGES`"): verified against a running `pnpm run dev` instance
 * while building this feature that `/` (the homepage's theme showcase) and
 * `/editor` are the only templates that currently read/write
 * `demo/theme-state.ts`'s shared `mermaid-theme` localStorage preference —
 * `/diagrams`, `/fork-fixes.html`, `/dashboard.html`, `/blog`, and
 * individual diagram-type pages (e.g. `/diagrams/flowchart.html`) render no
 * theme picker today, despite older code comments (see e.g.
 * `demo/components/dashboard-app.tsx`, `demo/components/theme-picker.tsx`)
 * describing a "Pick a look" `ThemePickerSection` that once appeared on
 * every page. Pass `--theme-pages` to override if that changes.
 */
export const DEFAULT_THEME_PAGES = ['/', '/editor']

/**
 * Viewport widths the theme spot-check runs at by default — narrower than
 * `DEFAULT_WIDTHS` on purpose, since #1033 asks specifically whether theme
 * choice affects layout "at narrow widths" (a picker/dropdown control is
 * the most likely place for a theme's swatch/label content to overflow a
 * cramped mobile width), not a full re-run of the whole width matrix.
 */
export const DEFAULT_THEME_WIDTHS = [375, 414, 480]

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
  themes: string[]
  themePages: string[]
  themeWidths: number[]
  skipThemeCheck: boolean
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
  --themes=<a,b,c>         Theme keys to spot-check (default: ${DEFAULT_THEMES.join(',')})
  --theme-pages=<a,b,c>    Pages to run the theme spot-check on (default: ${DEFAULT_THEME_PAGES.join(',')})
  --theme-widths=<a,b,c>   Widths to run the theme spot-check at (default: ${DEFAULT_THEME_WIDTHS.join(',')})
  --skip-theme-check       Skip the theme spot-check entirely
  -h, --help               Show this help
`

function flagValue(args: string[], name: string): string | undefined {
  const prefix = `--${name}=`
  const match = args.find((a) => a.startsWith(prefix))
  return match ? match.slice(prefix.length) : undefined
}

/** Parses a `--flag=a,b,c` string list, trimming whitespace and dropping empty entries. */
function parseStringList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Parses a `--flag=1,2,3` numeric list, dropping non-finite/non-positive entries. */
function parseWidthList(raw: string): number[] {
  return raw
    .split(',')
    .map((w) => Number(w.trim()))
    .filter((w) => Number.isFinite(w) && w > 0)
}

/** Pure argv parser — kept separate from `main()` so it's directly testable. */
export function parseArgs(argv: string[]): AuditOptions {
  const pagesRaw = flagValue(argv, 'pages')
  const pages = pagesRaw ? parseStringList(pagesRaw) : DEFAULT_PAGES

  const widthsRaw = flagValue(argv, 'widths')
  const widths = widthsRaw ? parseWidthList(widthsRaw) : DEFAULT_WIDTHS

  const themesRaw = flagValue(argv, 'themes')
  const themes = themesRaw ? parseStringList(themesRaw) : DEFAULT_THEMES

  const themePagesRaw = flagValue(argv, 'theme-pages')
  const themePages = themePagesRaw
    ? parseStringList(themePagesRaw)
    : DEFAULT_THEME_PAGES

  const themeWidthsRaw = flagValue(argv, 'theme-widths')
  const themeWidths = themeWidthsRaw
    ? parseWidthList(themeWidthsRaw)
    : DEFAULT_THEME_WIDTHS

  return {
    baseUrl: flagValue(argv, 'base-url') ?? DEFAULT_BASE_URL,
    pages,
    widths,
    height: Number(flagValue(argv, 'height') ?? DEFAULT_HEIGHT),
    tolerancePx: Number(flagValue(argv, 'tolerance') ?? DEFAULT_TOLERANCE_PX),
    screenshotDir: flagValue(argv, 'screenshot-dir') ?? null,
    outPath: flagValue(argv, 'out') ?? null,
    exitZero: argv.includes('--exit-zero'),
    themes,
    themePages,
    themeWidths,
    skipThemeCheck: argv.includes('--skip-theme-check'),
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
 * horizontal-scroll panel has this property on itself by design) — *and*
 * the element isn't a visually-hidden-but-accessible node clipped to a
 * near-zero, out-of-flow box (see the header comment's `#1055` paragraph).
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
      const ancestorStyle = window.getComputedStyle(ancestor)
      if (
        ancestorStyle.overflowX === 'auto' ||
        ancestorStyle.overflowX === 'scroll'
      ) {
        handled = true
        break
      }
      // Decorative full-bleed overlay exception (#1057) — see this
      // function's header comment for the full reasoning. Only this exact
      // signal combination counts; a bare `overflow: hidden` still falls
      // through and gets flagged.
      if (
        ancestorStyle.overflowX === 'hidden' &&
        ancestorStyle.pointerEvents === 'none' &&
        (ancestorStyle.position === 'absolute' ||
          ancestorStyle.position === 'fixed') &&
        ancestorStyle.top === '0px' &&
        ancestorStyle.right === '0px' &&
        ancestorStyle.bottom === '0px' &&
        ancestorStyle.left === '0px'
      ) {
        handled = true
        break
      }
      ancestor = ancestor.parentElement
    }
    if (handled) continue

    // Standard sr-only technique: `position: absolute` takes the element
    // out of flow (so it can't push a sibling or spill onto the page) and
    // the box itself is clipped to at most `tolerancePx` on a side — so
    // whatever `scrollWidth` its full text content implies is never a
    // rendered pixel. `clientHeight` is checked too, not just width: the
    // defining trait of this pattern is a near-zero *box*, not a narrow one.
    const style = window.getComputedStyle(el)
    const isOutOfFlow =
      style.position === 'absolute' || style.position === 'fixed'
    const isClippedToNothing =
      el.clientWidth <= tolerancePx && el.clientHeight <= tolerancePx
    if (isOutOfFlow && isClippedToNothing) continue

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
  /** Set only for a theme spot-check run — the non-default theme key that was active (see `--themes`/`--theme-pages`). Omitted for the default-theme audit. */
  theme?: string
}

function slugify(pagePath: string): string {
  const slug = pagePath
    .replace(/^\/+/, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return slug || 'root'
}

/**
 * Runs the overflow audit for one page/width/theme combination.
 *
 * When `theme` is given, opens a dedicated `BrowserContext` with an
 * `addInitScript` that sets `demo/theme-state.ts`'s `mermaid-theme`
 * localStorage key *before* the page's own scripts run (Playwright
 * guarantees init scripts execute ahead of any script already on the
 * page) — the same mechanism `ThemeShowcasePicker`/the editor's own picker
 * read on mount, so the page comes up already themed without needing a
 * live UI interaction to select it. The default-theme case (`theme`
 * undefined) skips the extra context entirely and reuses `browser`'s
 * default one, matching this function's pre-#1033 behavior exactly.
 */
async function auditPageAtWidth(
  browser: Browser,
  options: AuditOptions,
  pagePath: string,
  width: number,
  theme?: string,
): Promise<PageWidthResult> {
  const context: BrowserContext | null = theme
    ? await browser.newContext()
    : null
  if (context && theme) {
    await context.addInitScript((themeKey: string) => {
      try {
        window.localStorage.setItem('mermaid-theme', themeKey)
      } catch {
        // Storage unavailable (private mode, disabled, quota) — the page
        // will just render its default theme; not this audit's concern.
      }
    }, theme)
  }
  const page: Page = context ? await context.newPage() : await browser.newPage()
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
    if (theme) result.theme = theme
    if (findings.length > 0 && options.screenshotDir) {
      await mkdir(options.screenshotDir, { recursive: true })
      const screenshotPath = join(
        options.screenshotDir,
        `${slugify(pagePath)}-${width}${theme ? `-${theme}` : ''}.png`,
      )
      await page.screenshot({ path: screenshotPath, fullPage: true })
      result.screenshotPath = screenshotPath
    }
    return result
  } finally {
    await page.close()
    if (context) await context.close()
  }
}

/**
 * Drives `browser` across every page/width combination in `options.pages` x
 * `options.widths`, then — unless `options.skipThemeCheck` — appends a
 * second pass spot-checking `options.themes` on `options.themePages` at
 * `options.themeWidths` (see #1033: does a non-default theme change layout,
 * not just colors, at a narrow width). The two passes are independent: the
 * theme spot-check runs on its own page/width matrix regardless of what
 * `--pages`/`--widths` were set to.
 */
export async function runAudit(
  options: AuditOptions,
  browser: Browser,
): Promise<PageWidthResult[]> {
  const results: PageWidthResult[] = []

  for (const pagePath of options.pages) {
    for (const width of options.widths) {
      results.push(await auditPageAtWidth(browser, options, pagePath, width))
    }
  }

  if (!options.skipThemeCheck) {
    for (const pagePath of options.themePages) {
      for (const width of options.themeWidths) {
        for (const theme of options.themes) {
          results.push(
            await auditPageAtWidth(browser, options, pagePath, width, theme),
          )
        }
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
    const themeSuffix = result.theme ? ` (theme: ${result.theme})` : ''
    lines.push(
      `${result.page.padEnd(20)} @ ${String(result.width).padStart(5)}px${themeSuffix}  ${status}`,
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
