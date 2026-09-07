# Research: direct niche rivals — agentic-mermaid and Pretty-mermaid-skills

Status: **research, not a decision.** Written for [#542](https://github.com/dfadler/zombie-mermaid/issues/542),
split from the broader competitive-landscape pass in [#536](https://github.com/dfadler/zombie-mermaid/issues/536).
Compiled directly from each project's live repo/docs/license files and
zombie-mermaid's own current source (`src/mcp/`, `README.md`, `package.json`)
as of 2026-09-06 — not copied from the issue body or #536's report.

The full feature/architecture comparison against agentic-mermaid, the
license-terms check across beautiful-mermaid/agentic-mermaid/
obsidian-beautiful-mermaid, and the skills.sh distribution-channel
cost/benefit analysis are recorded in
[this comment on #542](https://github.com/dfadler/zombie-mermaid/issues/542#issuecomment-5572645764)
rather than duplicated here — this file stays the short summary.

## TL;DR

- **agentic-mermaid is the closest rival that exists today**, and its `verify`
  /`describe`/`mutate` MCP tools are not merely adjacent to
  [#539](https://github.com/dfadler/zombie-mermaid/issues/539) — they are a
  shipped, public implementation of the exact same problem #539 proposes to
  prototype. #539 should evaluate agentic-mermaid's typed
  parse→mutate→verify→serialize loop before writing new code, not build blind.
- **License risk is a non-issue.** beautiful-mermaid, agentic-mermaid, and
  obsidian-beautiful-mermaid are all plain MIT with no copyleft/share-alike
  clause. Convergent independent implementation triggers zero obligation;
  zombie-mermaid's existing README Attribution section already discharges the
  only obligation MIT actually imposes (preserve the copyright/permission
  notice on code actually copied).
- **skills.sh: worth a thin, low-cost presence — not a parallel product.**
  Pretty-mermaid-skills' traction (1,186 stars, 3.8K skills.sh installs) is
  real signal that a skill-marketplace audience exists that zombie-mermaid
  currently doesn't reach at all, but it's a small slice even of that
  channel's own leaderboard. The cheap move is a thin `SKILL.md` wrapper
  around the already-published `zombie-mermaid` npm CLI/MCP server — not
  bundling a second copy of the renderer the way Pretty-mermaid-skills does.

## Sources

- https://github.com/adewale/agentic-mermaid (README, `docs/comparison.md`, `LICENSE` — fetched via `gh api`)
- https://github.com/lukilabs/beautiful-mermaid (`LICENSE`, repo metadata — fetched via `gh api`)
- https://github.com/timk75/obsidian-beautiful-mermaid (`LICENSE`, repo metadata — fetched via `gh api`)
- https://github.com/imxv/Pretty-mermaid-skills (README, repo metadata — fetched via `gh api`)
- https://www.skills.sh/imxv/pretty-mermaid-skills/pretty-mermaid (install count, security-audit badges)
- https://skills.sh (platform mechanics, leaderboard)
- `src/mcp/server.ts`, `src/mcp/tools/render-svg.ts`, `src/mcp/tools/render-ascii.ts`, `README.md`, `package.json` (this repo, read directly)
- https://github.com/dfadler/zombie-mermaid/issues/539
- https://github.com/dfadler/zombie-mermaid/issues/536
