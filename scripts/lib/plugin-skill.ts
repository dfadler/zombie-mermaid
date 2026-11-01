import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

// Plugin copy of skills/zombie-mermaid/SKILL.md (#2206): `npx -y zombie-mermaid`
// would bypass the plugin's pinned dependency + shrinkwrap, so invocations are
// rewritten to the installed CLI. A real file (not a symlink) so it also works
// with core.symlinks=false on Windows.
export const PLUGIN_CLI =
  'node "${CLAUDE_PLUGIN_ROOT}/node_modules/zombie-mermaid/dist/cli.js"'

const MCP_BLOCK =
  /## Rendering over MCP\n\n[^\n]*\n[^\n]*\n\n```json\n[\s\S]*?```\n/
const PREREQ =
  /Node\.js 24 or newer\. No install step:[\s\S]*?drop the `npx -y` prefix\./

export function toPluginSkill(input: string): string {
  let src = input
  const swap = (re: RegExp, to: string, what: string) => {
    if (!re.test(src))
      throw new Error(`plugin-skill: source no longer has ${what}`)
    src = src.replace(re, () => to)
  }
  swap(
    PREREQ,
    'Node.js 24 or newer on PATH. No install step when installed from the marketplace: Claude Code installs the pinned `zombie-mermaid` package itself. A plugin loaded from a local checkout is not installed for you; run `npm ci` in `plugins/claude` first.',
    'the Prerequisites paragraph',
  )
  swap(
    MCP_BLOCK,
    '## Rendering over MCP\n\nThis plugin already registers the zombie-mermaid MCP server (`.mcp.json`); no setup needed. Its tools:\n',
    'the MCP config block',
  )
  src = src.replaceAll('npx -y zombie-mermaid', PLUGIN_CLI)
  if (src.includes('npx'))
    throw new Error('plugin-skill: leftover npx reference')
  return src
}

/** Sync (or `--check`) the plugin copy of the skill. Returns a process exit code. */
export function syncPluginSkill(
  src: string,
  dest: string,
  check: boolean,
): number {
  const want = toPluginSkill(readFileSync(src, 'utf8'))
  if (check) {
    let have = ''
    try {
      have = readFileSync(dest, 'utf8')
    } catch {}
    if (have === want) return 0
    console.error(
      `error: ${dest} is out of date; run: pnpm run sync:plugin-skill`,
    )
    return 1
  }
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, want)
  return 0
}
