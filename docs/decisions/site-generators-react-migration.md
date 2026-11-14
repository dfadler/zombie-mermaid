# Remaining #423 scope (client-side interactivity) stays vanilla TS, not React

Status: superseded (hydrated React clients now exist, e.g. `demo/nav-client.tsx`)

## Decision

- Recommendation: not worth it right now; do not port the remaining client scripts to hydrated React to close out #423.
- Part 1 (React page generators) is done; Part 2's target `demo/client.ts` is gone, split by the #590/#598 redesign.
- The remaining scripts do narrow DOM patching against server-rendered markup; hydration would add a mismatch bug class in the pixel-diff visual suite.
- Now superseded: hydrated React clients exist (e.g. `demo/nav-client.tsx`).

Full write-up: https://github.com/dfadler/zombie-mermaid/issues/423#issuecomment-6884738028
