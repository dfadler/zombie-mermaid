> **Base repository check:** this PR should target `dfadler/zombie-mermaid` (not the upstream `lukilabs/beautiful-mermaid`). If the base repository shown above isn't `dfadler/zombie-mermaid`, change it before submitting.

## Summary

<!-- What does this PR change, and why? -->

## Tests

<!-- What tests were added or updated? If no tests were added, explain why. -->

## Checklist

- [ ] `pnpm run lint` passes
- [ ] `pnpm run format:check` passes
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm test` passes
- [ ] Changeset added with `pnpm changeset` if this touches published code (never hand-edit `CHANGELOG.md`; see CONTRIBUTING.md's "Changesets")
- [ ] If this fixes a bug with a visible rendering change (SVG or ASCII), added a `demo/fork-fixes-data.ts` entry (see CONTRIBUTING.md's "Adding a fork-fixes entry") — otherwise N/A
- [ ] Linked issue: Closes #  (and the issue reporter is notified, if not you)
- [ ] Breaking change? yes / no (majors must be deliberate)
- [ ] Follow-ups are filed issues linked as #N, not prose (CI fails on an unlinked "follow-up" / "TODO later")
- [ ] No `TEMP:` commit subjects (CI fails on them)
- [ ] Upstream port/cherry-pick? Link the upstream PR/commit here, otherwise N/A:
- [ ] ASCII output changed: real-terminal before/after image attached and the Mermaid source pasted inline (see CLAUDE.md), otherwise N/A
- [ ] Snapshot/golden cases cover both SVG and ASCII
- [ ] Linux visual baselines regenerated, not needed, or filed as #N

See [CONTRIBUTING.md](../CONTRIBUTING.md) for setup and the full list of checks CI runs.
