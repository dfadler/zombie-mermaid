# Consumer Node floor stays at the current LTS (24)

## Context

4.0.0 ([#1291](https://github.com/dfadler/zombie-mermaid/issues/1291)) raised `engines.node` from `>=22` to `>=24`. [#1567](https://github.com/dfadler/zombie-mermaid/issues/1567) asked whether the library needs 24 at runtime or only the dev toolchain does. The sub-package gap from [#1545](https://github.com/dfadler/zombie-mermaid/issues/1545) is already closed: all five `@zombie-mermaid/*` manifests declare `engines.node >=24`.

## Decision

Keep the consumer floor at `>=24` and keep it declared identically on the umbrella and all five sub-packages. No `devEngines` split: the dev toolchain and the consumer floor are the same number.

Rationale: 24 is the current LTS line. Per the [Node.js release schedule](https://github.com/nodejs/Release/blob/main/schedule.json) (checked 2026-10-11) it is active LTS until 2026-10-20, then maintenance until 2028-04-30. Tracking the current LTS keeps the support matrix to one Node version across CI, `.nvmrc`, the Docker image and consumers.

This is a policy choice, not a runtime requirement. Evidence from #1567:

- Nothing in the published source needs 24. The only feature above Node 22.0 is `process.getBuiltinModule` (elkjs auto-load in `packages/svg-renderer/src/elk-instance.ts`), added in Node v22.3.0 ([docs](https://nodejs.org/docs/latest-v22.x/api/process.html#processgetbuiltinmoduleid)). The other built-ins used (`fs`, `path`, `url`, `os`, `http`, `child_process`, `module`) exist on 22.
- Packed tarballs installed into a clean project rendered flowchart, ER and ASCII output on Node 22.9.0, 22.22.1 and 24.21.0. Node 20.11 fails (no `getBuiltinModule`; Node 20 reached EOL 2026-04-30).
- 4.0.0 raised the floor with no runtime reason; its PR ran typecheck and tests on 22.22.1.

## Consequences

- Node 22 consumers are refused by `engines` under engine-strict even though the library works on them. They can install with engine checks off.
- Revisit (lower to `>=22.3.0`, a non-breaking patch) if a consumer asks for Node 22 support, or when a toolchain move makes the two floors diverge anyway. Node 22 is supported upstream until 2027-04-30.
- Raising the floor again at 24's EOL is a breaking change under the [versioning policy](versioning-and-deprecation-policy-1568.md).
- Not verified: Node 22.3.0 itself, Bun, the CLI/MCP bins on 22. The suite cannot run on 22 (pnpm 11 needs >=22.13).
