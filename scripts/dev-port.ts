/**
 * Dev-server port: `PORT` if set; else 3456 for the main checkout; else, inside
 * a `.claude/worktrees/` worktree, a stable port in 3500-3999 hashed from the
 * worktree path so parallel batches rarely collide (zombie-mermaid#1589).
 * ponytail: 500-slot hash, collisions possible with many worktrees; set PORT then.
 */
export function defaultPort(root: string, env = process.env.PORT): number {
  if (env) return Number(env) || 3456
  if (!root.includes('/.claude/worktrees/')) return 3456
  let h = 0
  for (const c of root) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return 3500 + (h % 500)
}
