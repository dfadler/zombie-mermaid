// Fails when the live demo site's JSON-LD softwareVersion lags npm `latest`
// for more than a day (#1574; the Pages deploy once sat stuck for four days
// unnoticed, #1525). Zero deps so the workflow needs no install.
// Also compares the live build-sha meta stamp (scripts/build-stamp.ts, #1613)
// with the HEAD of main when REPO is set.
// Env: SITE_URL, PACKAGE, GRACE_HOURS (default 24), LAST_PAGES_SUCCESS (info only),
// REPO (owner/name; enables the SHA check), GH_TOKEN, SHA_GRACE_HOURS (default 2).
import { pathToFileURL } from 'node:url'

export function siteVersion(html) {
  for (const m of html.matchAll(
    /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g,
  )) {
    try {
      const v = JSON.parse(m[1]).softwareVersion
      if (v) return String(v)
    } catch {}
  }
  return null
}

export function siteStamp(html) {
  return {
    sha: html.match(/<meta name="build-sha" content="([^"]*)"/)?.[1] ?? null,
    version:
      html.match(/<meta name="build-version" content="([^"]*)"/)?.[1] ?? null,
  }
}

// Mirrors pages.yml `paths-ignore`: a push touching only these does not
// deploy, so the live site legitimately stays on the older sha.
const IGNORED = [
  /^__tests__\//,
  /^\.changeset\//,
  /^badges\//,
  /^docker\//,
  /^skills\//,
  /^bench-history\.jsonl$/,
  /^(CHANGELOG|CONTRIBUTING|SECURITY)\.md$/,
  /^LICENSE$/,
  /^\.github\/workflows\/(?!pages\.yml$)/,
]
export const deploysSite = (file) => !IGNORED.some((re) => re.test(file))

/**
 * Compares the live sha with main (`compare` = GitHub compare API body for
 * live...main, `mainDate` = main HEAD's commit date). Stale means: main
 * contains deploy-triggering changes the live site lacks AND main HEAD has
 * been out for longer than the grace period. Any deploy after HEAD would have
 * stamped HEAD, so HEAD's age is the time the site should already have caught
 * up. Returns an error string or null.
 */
export function shaError({ liveSha, compare, mainDate, now, graceHours = 2 }) {
  if (!liveSha || liveSha === 'unknown')
    return 'live site has no usable build-sha stamp'
  if (!compare) return `live build-sha ${liveSha} is not a commit of the repo`
  if (compare.status === 'identical') return null
  if (compare.status === 'behind')
    return `live build-sha ${liveSha} is ahead of main`
  const files = compare.files
  if (files && !files.some((f) => deploysSite(f.filename))) return null
  const ageH = (now - Date.parse(mainDate)) / 36e5
  return ageH > graceHours
    ? `site is built from ${liveSha.slice(0, 8)} but main HEAD (${compare.commits?.at(-1)?.sha?.slice(0, 8) ?? '?'}) is ${ageH.toFixed(1)}h old and not deployed`
    : null
}

/** Returns an error string when stale, else null. */
export function driftError({
  site,
  latest,
  publishedAt,
  now,
  graceHours = 24,
}) {
  if (!site) return 'no softwareVersion found in live site JSON-LD'
  if (site === latest) return null
  const ageH = (now - Date.parse(publishedAt)) / 36e5
  return ageH > graceHours
    ? `site serves ${site} but npm latest ${latest} was published ${ageH.toFixed(1)}h ago`
    : null
}

/**
 * Ids of pages.yml runs that are still unfinished `maxMinutes` after creation
 * (#1525: a deploy stuck in `waiting` on the github-pages environment held the
 * concurrency group for 4 days; job timeout-minutes never applies there).
 * `runs` = `gh run list --json databaseId,status,createdAt` output. A normal
 * run takes 2-4 min and both jobs have a 10 min timeout, so 30 is generous.
 */
export function stuckRuns(runs, now, maxMinutes = 30) {
  return runs
    .filter(
      (r) =>
        r.status !== 'completed' &&
        (now - Date.parse(r.createdAt)) / 6e4 > maxMinutes,
    )
    .map((r) => r.databaseId)
}

/** Fetches npm + the live site; returns { line, err } (err null when fresh). */
export async function run(env, fetchFn = fetch, now = Date.now()) {
  const { SITE_URL, PACKAGE, GRACE_HOURS, LAST_PAGES_SUCCESS, REPO } = env
  const get = async (u, init) => {
    const r = await (init ? fetchFn(u, init) : fetchFn(u))
    if (!r.ok) throw new Error(`${u}: HTTP ${r.status}`)
    return r
  }
  const reg = await (await get(`https://registry.npmjs.org/${PACKAGE}`)).json()
  const latest = reg['dist-tags'].latest
  const page = await (await get(SITE_URL)).text()
  const site = siteVersion(page)
  const stamp = siteStamp(page)
  let shaErr = null
  if (REPO) {
    const headers = {
      accept: 'application/vnd.github+json',
      ...(env.GH_TOKEN ? { authorization: `Bearer ${env.GH_TOKEN}` } : {}),
    }
    const api = `https://api.github.com/repos/${REPO}`
    const main = await (await get(`${api}/commits/main`, { headers })).json()
    let compare = null
    if (stamp.sha && stamp.sha !== 'unknown') {
      const r = await fetchFn(`${api}/compare/${stamp.sha}...main`, { headers })
      if (r.ok) compare = await r.json()
      else if (r.status !== 404) throw new Error(`compare: HTTP ${r.status}`)
    }
    shaErr = shaError({
      liveSha: stamp.sha,
      compare,
      mainDate: main.commit.committer.date,
      now,
      graceHours: Number(env.SHA_GRACE_HOURS || 2),
    })
  }
  const verErr = driftError({
    site,
    latest,
    publishedAt: reg.time[latest],
    now,
    graceHours: Number(GRACE_HOURS || 24),
  })
  const err = [verErr, shaErr].filter(Boolean).join('; ') || null
  const line = `site=${site} npm=${latest} last pages.yml success=${LAST_PAGES_SUCCESS || 'unknown'}${REPO ? ` build-sha=${stamp.sha ?? 'none'} build-version=${stamp.version ?? 'none'}` : ''}`
  return { line, err }
}

/** CLI entry: prints the status line, annotates drift; returns the exit code. */
export async function main(env, fetchFn = fetch) {
  const { line, err } = await run(env, fetchFn)
  console.log(line)
  if (err) console.error(`::error::${err}`)
  return err ? 1 : 0
}

// `node check-site-drift.mjs --stuck [minutes]`: reads run JSON on stdin,
// prints stuck run ids one per line.
if (process.argv[2] === '--stuck') {
  let json = ''
  for await (const c of process.stdin) json += c
  const ids = stuckRuns(
    JSON.parse(json),
    Date.now(),
    Number(process.argv[3] || 30),
  )
  if (ids.length) console.log(ids.join('\n'))
} else if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.env)
}
