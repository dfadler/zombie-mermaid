# Monorepo test layout (#627): per-package trees, one shared config

Status: implemented

## Decision

- Move tests into each package as `<package>/src/__tests__/`; no shared library test tree.
- Keep the `__tests__/` directory convention (no colocated `*.test.ts`); the `src/` level stays so each package's tsconfig `include` still covers them.
- One shared Vitest config (now `config/vitest.config.ts`) with widened `include` globs; no per-package Vitest configs.
- Coverage stays one run, one merged `lcov.info`, one repo-wide threshold set.
- Top-level `__tests__/` stays for repo tooling and cross-package tests; each extraction issue (#623, #624, #625) moves its own tests in the same commit as its source.

Full write-up: https://github.com/dfadler/zombie-mermaid/issues/627#issuecomment-6884738403
