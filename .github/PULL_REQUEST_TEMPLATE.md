> **Base repository check:** this PR should target `dfadler/zombie-mermaid` (not the upstream `lukilabs/beautiful-mermaid`). If the base repository shown above isn't `dfadler/zombie-mermaid`, change it before submitting.

## Summary

<!-- What does this PR change, and why? -->

## Related upstream work

<!-- If this ports or cherry-picks an upstream fix, link the upstream PR/commit here. Otherwise delete this section. -->

## Tests

<!-- What tests were added or updated? If no tests were added, explain why. -->

## Checklist

- [ ] `pnpm run lint` passes
- [ ] `pnpm run format:check` passes
- [ ] `pnpm exec tsc --noEmit` passes
- [ ] `pnpm test` passes
- [ ] `CHANGELOG.md` updated under `[Unreleased]` (if applicable)
- [ ] If this fixes a bug with a visible rendering change (SVG or ASCII), added a `demo/fork-fixes-data.ts` entry (see CONTRIBUTING.md's "Adding a fork-fixes entry") — otherwise N/A
- [ ] Linked issue (if any): Closes #

See [CONTRIBUTING.md](../CONTRIBUTING.md) for setup and the full list of checks CI runs.
