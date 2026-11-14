# Core-plus-bindings split (#540): not adopted

Status: not adopted

## Decision

- **Do not adopt a core-plus-bindings split.** Keep the core in TypeScript for both the browser and the Node/CLI consumer.
- The prototype (flowchart-only Go ASCII renderer over a subprocess, PR #580) worked at toy scale but showed ~91 ms/call spawn overhead and no measured benefit.
- The browser target is closed by #443's and #495's WASM bundle-size and synchronous-rendering findings; a real port was estimated at 6-10 person-weeks for flowchart only.
- #540 and #536 are closed out. A narrower, differently-motivated proposal (e.g. a native batch-rendering tool) is not ruled out but needs its own motivation.

Full write-up: https://github.com/dfadler/zombie-mermaid/issues/540#issuecomment-6884747315
