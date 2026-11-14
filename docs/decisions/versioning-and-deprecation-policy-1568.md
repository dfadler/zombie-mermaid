# Versioning and deprecation policy

Status: accepted (one choice still open, section 3)

## Decision

Decision (sections numbered as in the full write-up):

1. What counts as breaking: anything that can make a previously working consumer fail or behave differently on the published surface, including the `engines.node` floor, required or newly needed peer dependencies, removed or renamed exports, flags, MCP tools or `exports` paths, changed option semantics, and changed documented output contracts.
2. Unaffected packages: the goal is no bump, but the single `fixed` group does not support it today; lockstep stays and changeset summaries name the packages with real changes.
3. Batching majors (proposed, the maintainer has not settled the gap length): ship at most one major per 30 days, bundling whatever is queued; security fixes and upstream breakage are exempt.
4. Support: only the latest major is supported; deprecate 3.x and 4.x with `npm deprecate` and an upgrade-guide link (manual maintainer step, not yet run).
5. Release notes: each major's changeset starts with `**BREAKING:**` and links the upgrade guide; only two fork tags lack GitHub Releases.

Full write-up: https://github.com/dfadler/zombie-mermaid/issues/1568#issuecomment-6884745989
