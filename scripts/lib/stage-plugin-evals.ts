// `claude plugin eval .claude` walks the whole directory, including stale agent
// worktrees under `.claude/worktrees/`, and fails every case at $0 on their
// dangling `zombie-mermaid` symlinks (#3170). Stage a copy without them.
import { cpSync } from 'node:fs'
import { sep } from 'node:path'

const SKIP = ['worktrees', 'node_modules', '.git']

/** Copy `src` (the `.claude` plugin dir) to `dest`, leaving out worktrees and
 * past eval results, and resolving the symlinks that are inside `src`. */
export function stagePluginEvals(src: string, dest: string): void {
  cpSync(src, dest, {
    recursive: true,
    dereference: true,
    filter: (from) => {
      const rel = from.slice(src.length + 1)
      const parts = rel.split(sep)
      return (
        !parts.some((p) => SKIP.includes(p)) && rel !== `evals${sep}results`
      )
    },
  })
}
