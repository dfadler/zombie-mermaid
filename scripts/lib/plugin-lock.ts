// plugins/claude pins `zombie-mermaid` in package.json and in
// npm-shrinkwrap.json (#2503); a hand-edited or half-bumped pin ships the wrong CLI.
interface Manifest {
  dependencies?: Record<string, string>
}
interface Shrinkwrap {
  packages?: Record<string, Manifest & { version?: string }>
}

/** Problems with the zombie-mermaid pin across package.json and the shrinkwrap (empty = ok). */
export function pluginLockProblems(pkg: Manifest, lock: Shrinkwrap): string[] {
  const pin = pkg.dependencies?.['zombie-mermaid']
  if (!pin) return ['package.json has no zombie-mermaid dependency']
  const out: string[] = []
  const rootPin = lock.packages?.['']?.dependencies?.['zombie-mermaid']
  if (rootPin !== pin)
    out.push(
      `shrinkwrap root pins ${rootPin ?? 'nothing'}, package.json ${pin}`,
    )
  const locked = lock.packages?.['node_modules/zombie-mermaid']?.version
  if (locked !== pin)
    out.push(`shrinkwrap locks ${locked ?? 'nothing'}, package.json ${pin}`)
  return out
}
