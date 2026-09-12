---
---

No release: pure refactor for #995. Moves the 10 site-generator
implementation files (`index.ts`, `editor.ts`, `fork-fixes.ts`, `pages.ts`,
`blog.ts`, `dashboard.ts`, `ascii-html.ts`, `samples-data.ts`,
`xychart-samples-data.ts`, `xychart-test.ts`) from the repo root into
`site-src/`, per `docs/decisions/cli-and-demo-stay-apps.md`. Path change
only — every generator's output is byte-identical before and after the
move. Nothing here touches the published `zombie-mermaid` package.
