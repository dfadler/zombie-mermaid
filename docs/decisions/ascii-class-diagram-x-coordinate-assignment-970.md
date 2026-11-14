# ASCII class-diagram x-coordinate assignment (#970): a block-based priority method, not full Brandes-Köpf

Status: implemented

## Decision

Adopt a block-based priority method (a simplified, integer-cell predecessor of Brandes-Koepf), not the full algorithm:

- Keep level assignment and declaration order; only position changes, never order.
- Group classes with the exact same parent-id set into alignment blocks.
- A block with no strictly-shallower parent keeps its left-to-right position; otherwise its desired center is the mean of those parents' box centers, rounded.
- Compact blocks left to right in one pass, for all blocks, not just multi-parent ones. Staging: #971 (single parent plus compaction), #972 (multi-parent and overlap). SVG is out of scope.

Full write-up: https://github.com/dfadler/zombie-mermaid/issues/970#issuecomment-6884746228
