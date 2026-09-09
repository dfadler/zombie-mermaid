---
'zombie-mermaid': patch
---

Add `fix_mermaid_sequence_activations`, an MCP tool that complements `check_mermaid_sequence_activations` by auto-fixing a dangling `activate X` (appending a matching `deactivate X`) where it's mechanically safe to do so; an unmatched `deactivate X` is reported but left for manual resolution. Closes the remaining "optionally proposes a fix" scope of #539.
