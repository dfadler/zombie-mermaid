---
'zombie-mermaid': minor
---

**Experimental — shipped to gauge interest, not a finished or best-effort implementation; feedback welcome.** Add a `check_mermaid_sequence_activations` MCP tool: a mechanical, deterministic check (no LLM judgment involved) for activation/deactivation balance in a Mermaid sequence diagram — every `activate X` (or `+` arrow shorthand) must be closed by a matching `deactivate X` (`-` shorthand). Returns a JSON report (`{ ok, issues }` with `DANGLING_ACTIVATION`/`UNMATCHED_DEACTIVATION` codes) rather than rendering anything, and errors on a non-sequence diagram. Targets a specific gap found in research behind #536: LLM-generated sequence diagrams fail mostly on activation handling, not basic syntax, which existing validators already cover well.
