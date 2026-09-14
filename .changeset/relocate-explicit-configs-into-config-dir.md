---
---

No release: internal chore for #997. Moves `tsconfig.build.json`,
`vitest.config.ts`, `vitest.setup.ts`, and `vite.config.lib.ts` into
`config/`, updating every explicit-path reference (`package.json` scripts,
`vite.config.package.ts`, `eslint.config.js`, `.changeset/config.json`).
These four were only ever resolved by explicit path string, never by tool
auto-discovery, so the move changes nothing about what gets built or
published — verified by a full `pnpm run build`/`build:packages`/`test`
pass before opening the PR.
