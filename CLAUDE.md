# Project instructions

Repo-specific mechanics for working in zombie-mermaid. General cross-project habits
(git worktree discipline, PR conventions, etc.) live in the global `CLAUDE.md`
instead — this file only holds what's specific to _this_ repo's tooling.

## Worktree cleanup

This repo's dev server (`vite.config.ts`, run via `pnpm run dev` / `vite`) has two
properties that make worktree cleanup easy to get wrong:

- **Port defaults to 3456, shared unless overridden.** `vite.config.ts` reads `PORT`
  from the environment (`PORT=3457 pnpm run dev`), falling back to 3456 — so give
  each simultaneously-running instance (a worktree alongside the main checkout,
  another worktree, etc.) its own port rather than letting two land on the default
  together. Two sessions that both fall back to 3456 will collide on bind (Vite picks
  the next free port and warns), or — worse — one will silently think it owns "the"
  dev server on that port when it's actually someone else's.
- **Live reload keeps the connection open.** Vite's HMR client holds a WebSocket open
  (`/@vite/client`) for as long as a tab is connected, so that tab never goes
  network-idle. A headless capture (`chrome --headless --screenshot`) against a
  _live_ dev-server page hangs waiting for network idle — build a static snapshot
  instead (`pnpm run samples`, serve the resulting `index.html` with a plain static
  server) for any headless screenshot, before/after comparison, or CI-style capture.
- **`preview_start` won't follow you into a worktree.** It resolves
  `.claude/launch.json` against the _original_ repo root regardless of where
  `EnterWorktree` switched the session's cwd (see the global `CLAUDE.md`'s worktree
  section). To preview a worktree's own dev server, run it manually from inside that
  worktree — `cd <worktree-path> && PORT=<port> pnpm run dev` (use the repo's
  declared `pnpm` scripts, not bare `npx`: this repo has no
  `worktree.symlinkDirectories` configured, so `node_modules` isn't shared between
  worktrees, and a worktree that `pnpm add`ed something new — Vite itself, say — has
  its own separate install that only `cd`ing in first and using `pnpm run` reliably
  resolves) — as a background `Bash` process, and track that PID yourself; nothing
  else will.

## ASCII rendering changes: verify in a real terminal, not just the browser mockup

Before attaching before/after screenshots to a PR/issue for any change touching
ASCII output (`src/ascii/**`, `ascii-html.ts`, `src/cli.ts`'s ASCII path,
`demo/client.ts`'s ASCII path, `index.ts`'s `.ascii-panel`,
`scripts/visual-diff.ts`, `__tests__/visual/helpers/terminal-panel.ts`, or
`__tests__/visual/ascii-samples.visual.test.ts`), invoke the
`verify-ascii-terminal` skill first. The Playwright visual-regression
suite and `scripts/visual-diff.ts` (the tool CONTRIBUTING.md points to for
before/after PR reports) both render ASCII output through `ascii-html.ts`'s HTML
approximation of a terminal, never a real one — this repo has already shipped a
bug (the `ascii-terminal-overflow-scroll` fix) in that approximation's chrome
while the underlying renderer was fine. The skill covers rendering the same
sample through a real PTY on both the base ref and the change, so a terminal-only
regression (or an HTML-mockup-only one) can't hide behind a screenshot that only
proves the mockup looks right.

Before removing a worktree in this repo (`ExitWorktree`, or by hand), stop only the
processes _you_ started for it — don't kill by port or by a generic name pattern
alone, since another worktree (or the main checkout) can easily share the same
default port or process name:

1. **Prefer killing by PID.** Capture it when you launch anything — the
   background-task PID the `Bash` tool returns, or `$!` right after backgrounding a
   plain shell command. This matters most for the dev server: its default port (3456)
   is shared unless you passed `PORT=` (see above), so two sessions can each think of
   "the" dev server as theirs without being the same process — killing by port risks
   taking down someone else's server, not just your own.
2. If you didn't capture a PID, verify before killing: `lsof -i:<port>` shows the
   owning command — confirm it's actually the server you started before killing that
   PID, rather than piping `lsof -ti` straight into `xargs kill`. Same for a
   throwaway static-file server you spun up for a headless capture
   (`python3 -m http.server <port>`, `npx http-server`).
3. For a headless Chrome instance launched for screenshots, match on the `--headless`
   flag itself (`ps aux | grep -- --headless`), not on the default profile directory
   name (`Chrome-headless`) — passing an explicit `--user-data-dir` (worth doing if
   you're running more than one capture at once, to avoid profile-lock collisions)
   changes that path but not the flag. Filter to processes you actually started;
   don't broadly `pkill` a generic "Chrome Helper" pattern, which can also match the
   user's real browser.
4. Generated build artifacts (`index.html`, `editor.html`, `fork-fixes.html`) are
   gitignored — safe to leave, no cleanup needed. `hero.svg` is **not** gitignored
   (it's the committed README asset, regenerated by `scripts/generate-hero.ts`) — if
   you regenerated it inside a worktree for comparison purposes only, don't let a
   throwaway copy leak back into the main checkout or another branch.
