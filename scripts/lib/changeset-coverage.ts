/**
 * A PR that changes `packages/<pkg>/src/**` must have a changeset naming that
 * package, otherwise the package's own CHANGELOG omits the change (#2593).
 * Pure logic; scripts/check-changeset-coverage.ts supplies git and the filesystem.
 */

/** Package names listed in a changeset's frontmatter (empty for `---\n---`). */
export function changesetPackages(text: string): string[] {
  const m = /^---\r?\n([\s\S]*?)\r?\n?---/.exec(text)
  return [...(m?.[1] ?? '').matchAll(/^\s*['"]?([^'":\s]+)['"]?\s*:/gm)].map(
    (b) => b[1]!,
  )
}

/**
 * Names of published packages whose source changed but that no changeset in
 * the PR names. `pkgNames` maps a `packages/` directory to its package name
 * (private packages omitted: they are never versioned).
 */
export function missingPackages(
  changedFiles: string[],
  changesetTexts: string[],
  pkgNames: Record<string, string>,
): string[] {
  const named = new Set(changesetTexts.flatMap(changesetPackages))
  const touched = new Set(
    changedFiles.flatMap((f) => {
      const m = /^packages\/([^/]+)\/src\/(?!(?:.*\/)?__tests__\/)/.exec(f)
      return m && pkgNames[m[1]!] ? [pkgNames[m[1]!]!] : []
    }),
  )
  return [...touched].filter((n) => !named.has(n)).sort()
}

/** Error lines for a PR; `read` returns a file's text, or undefined if absent. */
export function coverageErrors(
  changedFiles: string[],
  pkgDirs: string[],
  read: (path: string) => string | undefined,
): string[] {
  const pkgNames: Record<string, string> = {}
  for (const dir of pkgDirs) {
    const raw = read(`packages/${dir}/package.json`)
    if (raw === undefined) continue // e.g. packages/site is not a package
    const pkg = JSON.parse(raw) as { name: string; private?: boolean }
    if (!pkg.private) pkgNames[dir] = pkg.name
  }
  const texts = changedFiles
    .filter((f) => /^\.changeset\/(?!README).*\.md$/.test(f))
    .map((f) => read(f) ?? '') // a deleted changeset reads as empty
  return missingPackages(changedFiles, texts, pkgNames).map(
    (n) =>
      `${n} source changed but no changeset in this PR names it (its CHANGELOG would omit the change). Add \`'${n}': patch\` to a changeset.`,
  )
}
