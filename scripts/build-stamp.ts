/**
 * Build stamp for the generated site (#1613): the commit SHA and package
 * version, written as `<meta name="build-sha">` / `<meta name="build-version">`
 * into every generated HTML page so `scripts/check-site-drift.mjs` can compare
 * the live site with `main` and npm. Meta tags only: nothing visible, so no
 * layout or screenshot change.
 *
 * SHA: `$GITHUB_SHA`, else `git rev-parse HEAD`, else `unknown` (no git info
 * stays deterministic). Version: root package.json.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

export interface BuildStamp {
  sha: string
  version: string
}

const SHA_RE = /^[0-9a-f]{40}$/

export function resolveBuildStamp(
  env: NodeJS.ProcessEnv = process.env,
  gitSha: () => string = () =>
    execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }),
  version: string = (
    JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { version: string }
  ).version,
): BuildStamp {
  let sha = (env.GITHUB_SHA ?? '').trim()
  if (!SHA_RE.test(sha)) {
    try {
      sha = gitSha().trim()
    } catch {
      sha = ''
    }
  }
  return { sha: SHA_RE.test(sha) ? sha : 'unknown', version }
}

/** Inserts the stamp meta tags right after the first `<head>`; no `<head>` leaves the input untouched. */
export function stampHtml(html: string, { sha, version }: BuildStamp): string {
  const tags = `<meta name="build-sha" content="${sha}"/><meta name="build-version" content="${version}"/>`
  return html.replace('<head>', () => `<head>${tags}`)
}

/** generatePage's hook: stamps `.html` outputs, leaves other files untouched. */
export function stampFile(outPath: URL, content: string): string {
  return outPath.pathname.endsWith('.html')
    ? stampHtml(content, buildStamp())
    : content
}

let cached: BuildStamp | undefined
export function buildStamp(): BuildStamp {
  return (cached ??= resolveBuildStamp())
}
