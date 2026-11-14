# `cli` and `demo` stay apps, not workspace packages

Status: implemented

## Decision

- **`cli` and `demo` stay apps for the first monorepo pass**: same package as today, sibling source imported by relative path, no `package.json` of their own, no entry in `pnpm-workspace.yaml`'s `packages:` list, no dependency boundary.
- Reason: nothing outside the repo consumes either, no in-repo source imports the CLI except tests, and packaging `cli` would force `ascii-renderer` to widen its public API for an in-repo app.
- Update: the CLI part is superseded. `cli` was later packaged as `packages/cli` (`@zombie-mermaid/cli`); the reasoning above is the first-pass call, kept for history.
- Same precedent as the editor ([`editor-in-repo-module.md`](editor-in-repo-module.md)): directory isolation, not a dependency boundary. A "not yet," not a permanent stance.
- Revisit if something outside the repo wants to reuse `demo/components/` or the CLI's parsing/viewer pieces, or if #627's test-layout decision needs per-package test ownership.

Full write-up: https://github.com/dfadler/zombie-mermaid/issues/626#issuecomment-6884747107
