---
'zombie-mermaid': minor
---

Publish the CLI on its own as `@zombie-mermaid/cli`, so `npx @zombie-mermaid/cli render diagram.mmd --ascii` runs without installing the library's other entry points. It is the same CLI as the `zombie-mermaid` bin (one source, `src/cli.ts`), which is unchanged.
