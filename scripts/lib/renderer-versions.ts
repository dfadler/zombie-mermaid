/**
 * Which mermaid do GitHub and mermaid.live render right now? (#2830)
 *
 * Both bundles pass their version as a string literal to `renderer.draw(...)`,
 * so it can be read with plain `fetch`, no browser. Compared with the versions
 * recorded in `SURFACE_VERSIONS` (scripts/lib/mermaid-pin-freshness.ts) and
 * the pin. Exits 1 when a surface moved or the literal can no longer be found
 * (fail loudly, never report "unknown"); exits 0 offline.
 *
 *   tsx scripts/lib/renderer-versions.ts
 */

import {
  pinnedMermaidVersion,
  SURFACE_VERSIONS,
} from './mermaid-pin-freshness.ts'

const GITHUB_IFRAME =
  'https://viewscreen.githubusercontent.com/markdown/mermaid?docs_host=https%3A%2F%2Fdocs.github.com&color_mode=light'
const LIVE = 'https://mermaid.live/'

const DRAW = /renderer\.draw\([^,()]+,[^,()]+,\s*[`"'](\d+\.\d+\.\d+)[`"']/

/** The version literal passed to `renderer.draw(...)`, or undefined. */
export function drawVersion(js: string): string | undefined {
  return DRAW.exec(js)?.[1]
}

/** `/static/assets/mermaidMarkdown-<hash>.js` from the GitHub iframe HTML. */
export function githubBundlePath(html: string): string | undefined {
  return /\/static\/assets\/mermaidMarkdown-[a-f0-9]+\.js/.exec(html)?.[0]
}

/** Same-origin `/_app/immutable/**.js` chunks listed in the mermaid.live HTML. */
export function liveChunkPaths(html: string): string[] {
  return [...new Set(html.match(/\/_app\/immutable\/[^"'\s)]+\.js/g) ?? [])]
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>

const text = async (get: Fetcher, url: string): Promise<string> => {
  const r = await get(url, { signal: AbortSignal.timeout(30_000) })
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`)
  return r.text()
}

export async function githubVersion(
  get: Fetcher = fetch,
): Promise<{ version: string; bundle: string }> {
  const path = githubBundlePath(await text(get, GITHUB_IFRAME))
  if (!path)
    throw new Error('GitHub: no mermaidMarkdown-*.js in the iframe HTML')
  const version = drawVersion(
    await text(get, new URL(path, GITHUB_IFRAME).href),
  )
  if (!version)
    throw new Error(`GitHub: no renderer.draw version literal in ${path}`)
  return { version, bundle: path }
}

export async function liveVersion(get: Fetcher = fetch): Promise<string> {
  const chunks = liveChunkPaths(await text(get, LIVE))
  const found = await Promise.all(
    chunks.map((p) =>
      text(get, new URL(p, LIVE).href).then(drawVersion, () => undefined),
    ),
  )
  const v = found.find((x) => x !== undefined)
  if (!v)
    throw new Error(
      `mermaid.live: no renderer.draw literal in ${chunks.length} chunks`,
    )
  return v
}

/** Compare the live versions with `recorded`; `code` is 1 when moved or unreadable. */
export async function run(
  get: Fetcher = fetch,
  recorded: Record<string, string> = {
    GitHub: SURFACE_VERSIONS['GitHub ```mermaid blocks'].split(' ')[0]!,
    'mermaid.live': SURFACE_VERSIONS['mermaid.live'].split(' ')[0]!,
  },
  pin: string = pinnedMermaidVersion(),
): Promise<{ lines: string[]; code: number }> {
  try {
    const [gh, live] = await Promise.all([githubVersion(get), liveVersion(get)])
    const rows: [string, string, string][] = [
      ['GitHub', gh.version, gh.bundle],
      ['mermaid.live', live, ''],
    ]
    const lines: string[] = []
    let moved = false
    for (const [name, now, extra] of rows) {
      const was = recorded[name]
      const same = now === was
      moved ||= !same
      lines.push(
        `${same ? 'ok   ' : 'MOVED'} ${name} ${now}${same ? '' : ` (recorded ${was})`} ${extra}`.trimEnd(),
      )
    }
    lines.push(`pin   ${pin}`)
    if (moved)
      lines.push(
        'A surface moved: update SURFACE_VERSIONS and the table in docs/known-differences.md, then re-verify parity claims that name the old version (docs/known-differences.md, "Re-verifying").',
      )
    return { lines, code: moved ? 1 : 0 }
  } catch (e) {
    if (e instanceof TypeError)
      return { lines: [`renderer versions: offline? (${e.message})`], code: 0 }
    return { lines: [`renderer versions: ${(e as Error).message}`], code: 1 }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { lines, code } = await run()
  console.log(lines.join('\n'))
  process.exit(code)
}
