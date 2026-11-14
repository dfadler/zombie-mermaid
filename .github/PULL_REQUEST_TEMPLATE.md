> **Base repository check:** this PR should target `dfadler/zombie-mermaid` (not the upstream `lukilabs/beautiful-mermaid`). If the base repository shown above isn't `dfadler/zombie-mermaid`, change it before submitting.

## Summary

<!-- What does this PR change, and why? -->

## Tests

<!-- What tests were added or updated? If no tests were added, explain why. -->

## Visual verification

<!-- Required if this PR could change any rendered result (parser, layout, theme, SVG, ASCII, CLI, demo/). Not required for docs/CI/tooling/test-only PRs: delete this section and tick the checklist line below as "N/A: <reason>". Run the `pr-visual-verification` skill (.claude/skills/pr-visual-verification/) to fill it. Keep this order:
1. The exact Mermaid source in a fenced mermaid block right under this heading (GitHub renders it: the reference).
2. SVG before/after table, if SVG output can change.
3. ASCII before/after table, if ASCII output can change (real-terminal capture; see verify-ascii-terminal).
Two columns (Before main@sha | After), tight crops. Delete a half that cannot change and say why in one line. -->

## Checklist

<!-- The `PR checklist` CI check fails while any box is unchecked (it blocks merge once it is a required check in branch protection). Check a box only after doing the task; if it does not apply, check it and write "N/A: <reason>". -->

- [ ] `pnpm run lint` passes
- [ ] `pnpm run format:check` passes
- [ ] `pnpm run typecheck` passes (also covers `demo/` and `editor/`)
- [ ] `pnpm test` passes
- [ ] Changeset added with `pnpm changeset` if this touches published code (never hand-edit `CHANGELOG.md`; see CONTRIBUTING.md's "Changesets")
- [ ] If this fixes a bug with a visible rendering change (SVG or ASCII), added a `demo/fork-fixes-data.ts` entry (see CONTRIBUTING.md's "Adding a fork-fixes entry") — otherwise N/A
- [ ] Linked issue: Closes # (and the issue reporter is notified, if not you)
- [ ] Breaking change? yes / no (majors must be deliberate)
- [ ] Follow-ups are filed issues linked as #N, not prose (CI fails on an unlinked "follow-up" / "TODO later")
- [ ] No `TEMP:` commit subjects (CI fails on them)
- [ ] Upstream port/cherry-pick? Link the upstream PR/commit here, otherwise N/A:
- [ ] Visual verification: the section above is complete (Mermaid source block, SVG before/after if SVG can change, ASCII real-terminal before/after if ASCII can change), otherwise `N/A: <reason>` because nothing rendered can change
- [ ] ASCII output changed: real-terminal before/after image attached and the Mermaid source pasted inline (see CLAUDE.md), otherwise N/A
- [ ] Snapshot/golden cases cover both SVG and ASCII
- [ ] Linux visual baselines regenerated, not needed, or filed as #N

See [CONTRIBUTING.md](../CONTRIBUTING.md) for setup and the full list of checks CI runs.
