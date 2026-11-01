export const MIN_NODE_MAJOR = 24

/** Returns an error message when `version` (e.g. "22.1.0") is below the minimum, else null. */
export function nodeVersionError(version: string): string | null {
  const major = Number.parseInt(version, 10)
  if (major >= MIN_NODE_MAJOR) return null
  return `zombie-mermaid requires Node ${MIN_NODE_MAJOR} or newer, but found Node ${version}. Upgrade Node and try again.`
}
