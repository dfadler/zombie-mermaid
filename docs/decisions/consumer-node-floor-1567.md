# Consumer Node floor is the oldest LTS line (22), dev toolchain stays on 24

## Context

4.0.0 ([#1291](https://github.com/dfadler/zombie-mermaid/issues/1291)) raised `engines.node` from `>=22` to `>=24` for everyone, without checking whether the library needs 24 at runtime or only the dev toolchain does ([#1567](https://github.com/dfadler/zombie-mermaid/issues/1567)). The five `@zombie-mermaid/*` sub-packages declared no `engines` at all ([#1545](https://github.com/dfadler/zombie-mermaid/issues/1545)).

## Decision

The consumer floor is the oldest Node release line still in LTS (active or maintenance), as of 2026-10-11 per the [Node.js release schedule](https://github.com/nodejs/Release/blob/main/schedule.json):

| Line | End of life | Status 2026-10-11                             |
| ---- | ----------- | --------------------------------------------- |
| 20   | 2026-04-30  | EOL                                           |
| 22   | 2027-04-30  | maintenance (since 2025-10-21)                |
| 24   | 2028-04-30  | active LTS until 2026-10-20, then maintenance |

So the floor is 22. It is written `>=22.3.0`, not `>=22`, because the elkjs auto-load in `packages/svg-renderer/src/elk-instance.ts` calls `process.getBuiltinModule`, added in Node v22.3.0 ([docs](https://nodejs.org/docs/latest-v22.x/api/process.html#processgetbuiltinmoduleid)). Nothing else in the published source needs 24: the only Node built-ins used are `fs`, `path`, `url`, `os`, `http`, `child_process` and `module`, all available on 22.

- Root `package.json` and all five `packages/*/package.json`: `engines.node` is `>=22.3.0`.
- Root `package.json` gains `devEngines.runtime` (`node >=24`, `onFail: error`). pnpm enforces it for contributors, so the dev toolchain, `.nvmrc`, CI and `scripts/doctor.sh` stay on 24. `.npmrc` `engine-strict=true` ([#1638](https://github.com/dfadler/zombie-mermaid/pull/1638)) still applies to `engines`, so a consumer installing under pnpm/npm with engine-strict on Node 20 is still refused.
- The floor moves with the schedule: when 22 reaches EOL (2027-04-30) the next floor is 24, which is a breaking change under the [versioning policy](versioning-and-deprecation-policy-1568.md).

## Consequences

- Lowering the floor is non-breaking for consumers (patch release).
- Node 20 is rejected by `engines` and does not work: `getBuiltinModule` is not available (it was only backported to 20.16), and 20 is EOL.
- Node 22.0 to 22.2 satisfy neither `engines` nor the auto-load; that is why the minor is pinned.
- The matrix only exercises 24 in CI. Suggested (not applied here, workflow files need a human merge): add a Node 22.22 job running `pnpm run smoke:packed`-style consumer install, or the library test suite via `node-version: 22` with `pnpm install --config.engine-strict=false`. Consumer coverage on 22 is otherwise manual.
- Verified by hand on 22.9.0 and 22.22.1 (packed tarballs installed into a clean project, SVG/ER/ASCII render) and 24.21.0. Not verified: 22.3.0 itself, bun, the CLI/MCP bin on 22, and the full test suite on 22 (the pnpm 11 toolchain needs >=22.13, so tests cannot run there under `devEngines`).
