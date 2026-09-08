---
---

No release: `zombie-mermaid` itself ships no code change. `pnpm-workspace.yaml`'s `packages:` list now includes `.` (the repo root) alongside `packages/*`, fixing changesets' ability to resolve a changeset naming `zombie-mermaid` at all — `@manypkg/get-packages` always splits the pnpm workspace root out as `rootPackage`, separate from `packages`, so once `packages:` went non-empty (#625) any changeset targeting the root failed with "not in the workspace." Confirmed against the changeset already sitting on `main` (`fix-reverse-direction-parallel-edges.md`), which now resolves.
