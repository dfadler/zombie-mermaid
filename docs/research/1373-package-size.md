# Package size research (#1373)

Status: **measurement, as of v2.x (2026-10-08, pre-5.0). Sizes are a point-in-time snapshot (e.g. 7.44 MB before #1446, 5.93 MB after); re-run the reproduce steps for current numbers.**

Measured 2026-10-08 on `main` (79009cb6), Node 24, `pnpm run build`.

## Reproduce

```sh
pnpm run build
pnpm exec tsx scripts/check-bundle-size.ts   # gzip -9 per budgeted file
cd packages/<name> && npm pack --dry-run --json   # tarball + unpacked size, file list
```

## Baseline (dist JS, bytes)

| Package                          | ESM raw | ESM gz | CJS raw | CJS gz |
| -------------------------------- | ------: | -----: | ------: | -----: |
| `@zombie-mermaid/core`           |  25,759 |  9,378 |  20,478 |  8,594 |
| `@zombie-mermaid/mermaid-parser` |  59,620 | 18,643 |  47,695 | 17,079 |
| `@zombie-mermaid/svg-renderer`   | 178,992 | 53,537 | 144,871 | 49,035 |
| `@zombie-mermaid/ascii-renderer` | 214,054 | 57,217 | 153,256 | 50,377 |
| `@zombie-mermaid/mcp`            |  19,150 |  5,947 |  19,879 |  6,063 |
| `zombie-mermaid` (`index`)       |     717 |    288 |   1,501 |    342 |
| `zombie-mermaid` (`cli.js`)      |  36,490 | 12,051 |       - |      - |

Published tarballs before this PR (`npm pack`): root 254,564 B (121 files),
ascii-renderer 1,199,743 B (350 files), svg-renderer 682,972 B,
mermaid-parser 280,266 B, core 198,625 B, mcp 36,631 B.

## Findings (ranked by savings / effort)

1. **Tests ship in every tarball (done in this PR).** `files` contains
   `src/`, which includes `src/**/__tests__`. The root package shipped ~1 MB of
   test files (254 KB -> 46 KB tarball, 121 -> 30 files). Fixed with a
   `!src/**/__tests__` negation in all six manifests. Result:
   ascii-renderer 1,199,743 -> 970,389 B tarball (350 -> 51 files), svg-renderer
   682,972 -> 649,512, mermaid-parser 280,266 -> 264,056, core 198,625 ->
   186,695, mcp 36,631 -> 31,036.
2. **Source maps with `sourcesContent` plus `src/` (follow-up).** Maps are the
   largest published artifact (ascii-renderer 2.27 MB, svg-renderer 1.41 MB
   unpacked) and each embeds the full source, which is also shipped under
   `src/`. Dropping `src/` from `files` (maps are self-contained) would remove
   a further 0.18-1.8 MB unpacked per package. Not done here: it changes what
   consumers can open in `node_modules`, so it deserves its own decision.
3. **Size budget was stale (done).** The old budgets (112 KB for `index`,
   66 KB for `ascii`) predate the monorepo split; root `dist/index.js` is now
   0.3 KB gz, so the gate could never fail. Budgets now cover each package's
   `dist` and the root entries at about 12-17% headroom over the baseline.
4. **Unused dependency declarations (follow-up).** `@zombie-mermaid/mcp`
   declares `entities` but nothing in `packages/mcp/src` imports it; root
   `zombie-mermaid` declares `elkjs` and `entities` but its own `src/` imports
   neither (they are reached via the workspace packages). `core` lists `elkjs`
   only for a type import (`ElkNode` in `types.ts`, exposed in its `.d.ts`), so
   it could be a peer/optional dependency. Interacts with #1370 (lazy-load
   elkjs), so coordinate there.
5. **Bundler settings already reasonable.** Output is minified, target es2022,
   `sideEffects: false` on every package, per-entry builds with externalised
   dependencies. No further tree-shaking defect was observed; the two large
   renderers are dominated by their diagram code (`class-diagram.ts`,
   `grid.ts`, `er-diagram.ts` in ascii; `renderer.ts` in svg), not data. The
   generated mono-font subset is only 10.7 KB.
6. **Duplication between CJS and ESM (not actionable).** Shipping both formats
   doubles dist JS per package; dropping CJS is a breaking change and out of
   scope.

## Follow-ups

See the issues linked from the PR.
