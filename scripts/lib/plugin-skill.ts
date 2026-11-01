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
    'Node.js 24 or newer on PATH. No install step: the plugin installs the pinned `zombie-mermaid` package itself.',
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
