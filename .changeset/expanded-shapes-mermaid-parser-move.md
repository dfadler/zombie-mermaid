---
---

No release: `expanded-shapes.ts` moved from `src/` into
`packages/mermaid-parser/src/` (#768, flagged by #625's addendum and
`docs/decisions/monorepo-conversion.md`), closing the last root-level file
two workspace packages' doc comments pointed back at. `src/parser.ts` (the
flowchart parser, its only real importer) and its test now import it
through the `@zombie-mermaid/mermaid-parser` package export instead of a
relative path — `packages/core/src/types.ts` and
`packages/svg-renderer/src/renderer.ts` only ever referenced the file in a
doc comment, not an import, so those comments were updated to the new path
and nothing else in either package changed. Purely an internal move: the
published `zombie-mermaid` keeps the same `exports` map, its bundled
`.d.ts`/`.d.cts` are unchanged, and every rendered SVG/ASCII byte is
identical — so there is nothing here to describe in a release note.
