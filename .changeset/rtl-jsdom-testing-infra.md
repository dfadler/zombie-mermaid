---
---

No release: adds React Testing Library + jsdom as this repo's pattern for
testing hydrated demo/editor components (`@testing-library/react`,
`@testing-library/user-event`, `@testing-library/jest-dom` as
devDependencies), infra for the #797 hydration epic (#798). Registers
jest-dom's matchers and per-test `cleanup()` via a new `vitest.setup.ts`.
`environmentMatchGlobs` (this config's prior jsdom-scoping mechanism) turned
out to be dead code under the installed vitest@4.1.11 — the option doesn't
exist in its source, and `editor/__tests__/**`'s tests never actually
depended on it since they construct their own `JSDOM` instance per test.
Replaced with a per-file `// @vitest-environment jsdom` docblock, used by
new tests under `__tests__/dom/` (see that directory's example test and
`vitest.config.ts`'s comment for the full reasoning). Nothing here touches
the published `zombie-mermaid` package.
