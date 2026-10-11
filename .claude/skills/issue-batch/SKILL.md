---
name: issue-batch
description: |
  Plan a parallel batch of GitHub issues worked by worktree subagents. Use when
  asked to sweep, batch, or work several issues at once. Partitions the list into
  waves by file surface so two issues never share a module or baseline in the
  same wave, and gives each subagent its isolation and pre-PR checklist.
---

# issue-batch

Why: 311 of 798 commits in 09-24..10-10 were merges, and the hot files
(`draw-arrows.ts`, `grid.ts`, `edge-routing.ts`, `sequence.ts`, `pathfinder.ts`,
`draw.ts`, `types.ts`, `samples-data.ts`, `pnpm-lock.yaml`) are the ones parallel
issues collide on. See #1581 / #1502.

## Steps

1. **Input**: a list of issue numbers. Read each (`gh issue view N --json title,body,labels`).
2. **Surface**: for each issue, grep the likely files/modules (names in the body,
   `area:*` labels if present, `rg` for the symbols it mentions). Also note
   shared baselines it will regenerate (visual/ASCII snapshots, `samples-data.ts`,
   lockfile).
3. **Partition (advisory)**: do not put two issues with an overlapping module or
   baseline in the same wave. Chain overlapping issues serially (next wave, after
   the earlier PR merges) or on one branch/PR. Say which overlap forced it.
4. **Cap**: at most **8** in flight across distinct modules by default. The
   maintainer's earlier cap of 20 is only for waves verified disjoint; confirm
   before exceeding 8.
5. **Print the plan** (waves, issue, files, reason for any chaining) before spawning.

## Brief every subagent with

- `EnterWorktree` first; never commit in the main checkout.
- Own dev-server port: `PORT=<unique> pnpm run dev` (default 3456 is shared).
- Run `pnpm run verify` (if the script exists; otherwise `pnpm test` plus the
  relevant checks) before opening the PR.
- Scratch files go in the worktree or a uniquely named scratchpad subdir.
- No version bumps or CHANGELOG edits; PRs touching `.github/workflows/` need a human merge.
- Open the PR with `Closes #N`, using Write + `--body-file`.
