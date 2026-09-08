---
---

No release: fixes `check-diff-coverage.ts`'s `isTrackedTsFile()` to narrow `packages/` tracking to `packages/*/src/**` — matching `vitest.config.ts`'s actual `coverage.include` pattern — instead of accepting any `.ts` file under `packages/`. Without this, a package-root file outside `<package>/src/` could be tracked here while Vitest's own coverage run never counts it, silently disagreeing on what "covered" means. Internal tooling only; no published behavior change.
