# `cli` and `demo` stay apps, not workspace packages

## Context

[#416](https://github.com/dfadler/zombie-mermaid/issues/416) proposed converting
this repo into a pnpm workspace and listed `cli` and `demo` among the candidate
packages ("likely `cli`/`demo`").
[`monorepo-conversion-scoping.md`](monorepo-conversion-scoping.md) recommended
deferring both, and the execution plan ([#620](https://github.com/dfadler/zombie-mermaid/issues/620))
tracks that as its own sub-issue, [#626](https://github.com/dfadler/zombie-mermaid/issues/626),
so the recommendation lands as a settled record rather than an unwritten
assumption.

Re-verified against the tree on 2026-09-07, before the first extraction
([#623](https://github.com/dfadler/zombie-mermaid/issues/623)) has landed —
nothing found argues for reconsidering:

1. **No external consumer of either.** `demo/` is absent from `package.json`'s
   `files` (`src/`, `dist/`, `LICENSE`, `README.md`), so it has never shipped at
   all. The CLI ships as a `bin` (`zombie-mermaid` → `dist/cli.js`) — an
   executable, not an importable entry point; `exports` still lists only `.`,
   `./ascii`, `./mcp`.
2. **No in-repo source imports the CLI.** The only importers of `src/cli.ts` /
   `src/cli/**` are five test files under `src/__tests__/`
   (`cli-entrypoint`, `cli-mcp-dispatch`, `cli-png`, `cli-web-dispatch`), all via
   relative `import()`.
3. **`demo/`'s importers are all in-repo site generators and tooling** —
   `index.ts`, `pages.ts`, `blog.ts`, `dashboard.ts`, `editor.ts`,
   `fork-fixes.ts`, `theme-picker.ts`, `ascii-html.ts`, `scripts/visual-diff.ts`,
   `scripts/form-diff.ts`, plus tests. `demo/format.ts`'s `escapeHtml` alone has
   nine importers. Packaging `demo` would add a dependency edge from nearly every
   root-level generator into it, or force `format.ts` back out into a shared
   package anyway.
4. **The #623 packages don't reach into either.** Neither `src/ascii/**`
   (→ `ascii-renderer`) nor `src/mcp/` (→ `mcp`) imports `src/cli*` or `demo/**` —
   grep returns zero hits. The dependency direction runs the other way and stays
   acyclic: `src/cli/*` imports `../ascii/index.ts`, `../mcp/index.ts`,
   `../index.ts`.
5. **That direction is itself an argument against packaging `cli` now.**
   `src/cli/render.ts` imports `displayWidth` from `../ascii/display-width.ts`
   and `stripOsc8` from `../ascii/hyperlinks.ts`; `src/ascii/index.ts` exports
   neither (its public surface is `renderMermaidASCII`, the theme helpers, and
   types). A dependency-based `cli` package would force `ascii-renderer` to widen
   its published API by two internal helpers, or expose deep subpath exports —
   API surface grown to satisfy an in-repo app, not a consumer.
6. **`demo/` isn't self-contained today either.** It reaches outward, e.g.
   `demo/diagram-pages-data.ts` imports `../samples-data.ts` at the repo root.

## Decision

**`cli` and `demo` stay apps for the first monorepo pass**: same package as
today, sibling source imported by relative path, no `package.json` of their own,
no entry in `pnpm-workspace.yaml`'s `packages:` list, no dependency boundary.

This follows the precedent [#398](https://github.com/dfadler/zombie-mermaid/issues/398)
set for the editor ([`editor-in-repo-module.md`](editor-in-repo-module.md)):
a bounded module that nothing outside the repo consumes gets directory
isolation, not a dependency boundary. As there, this is a "not yet," not a
permanent architectural stance.

## Consequences

- `src/cli/render.ts` reaching into `../ascii/display-width.ts` and
  `../ascii/hyperlinks.ts`, and the root generators importing `demo/format.ts`,
  are the accepted pattern under #620 — not gaps to close before the conversion
  can be called done.
- `ascii-renderer`'s public API in #623 gets scoped to what external consumers
  need, without having to accommodate the CLI's internal reach.
- The umbrella `zombie-mermaid` package keeps its `bin` entry unchanged, and
  `vite.config.lib.ts`'s `cli` build environment stays with the umbrella rather
  than becoming a package's own build config the way the other environments do
  (recommendation 4 of the scoping doc).
- The editor's page component lives at `demo/components/editor-page.tsx` since
  the [#423](https://github.com/dfadler/zombie-mermaid/issues/423) React pilot,
  so packaging `demo` would drag the editor's boundary question in with it.
  `editor-in-repo-module.md` anticipated the editor becoming "a workspace package
  like any other" at conversion time; this decision narrows that to a later pass,
  on the same no-external-consumer reasoning that deferred it originally.
- Revisit when either becomes true: something outside this repo wants to reuse
  `demo/components/` or the CLI's argument-parsing / HTML-viewer pieces
  independently, or [#627](https://github.com/dfadler/zombie-mermaid/issues/627)'s
  test-layout decision lands on per-package test ownership in a way that needs
  these two to own tests as packages. Anyone re-proposing the split before then
  should read this page first — the verification above is why, not an oversight.
