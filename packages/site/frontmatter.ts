/**
 * Splits a post file into its frontmatter block and Markdown body.
 *
 * Deliberately not a full YAML parser: frontmatter here is a flat list of
 * `key: value` lines, which is all title/date/description/slug need. A
 * real YAML dependency would be overkill for four scalar fields.
 */
export function parseFrontmatter(
  raw: string,
  sourceFile: string,
): { fields: Record<string, string>; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw)
  if (!match) {
    throw new Error(
      `${sourceFile}: missing frontmatter block (expected a leading "---" ... "---" section)`,
    )
  }
  const [, frontmatter, body] = match
  const fields: Record<string, string> = {}
  for (const line of frontmatter!.split('\n')) {
    if (!line.trim()) continue
    const separatorIndex = line.indexOf(':')
    if (separatorIndex === -1) {
      throw new Error(`${sourceFile}: malformed frontmatter line: "${line}"`)
    }
    const key = line.slice(0, separatorIndex).trim()
    let value = line.slice(separatorIndex + 1).trim()
    // Strip one pair of surrounding quotes (YAML-style quoted scalar).
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1)
    fields[key] = value
  }
  return { fields, body: body!.trim() }
}
