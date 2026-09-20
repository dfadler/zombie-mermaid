---
'zombie-mermaid': patch
---

Fixes the npm publish failure introduced by the #622 externalization: the five internal `@zombie-mermaid/*` packages (`core`, `mermaid-parser`, `svg-renderer`, `ascii-renderer`, `mcp`) were missing a `repository` field in their `package.json`, which made npm's provenance verification reject the publish (`Error verifying sigstore provenance bundle: ... "repository.url" is "", expected to match "https://github.com/dfadler/zombie-mermaid" from provenance`). All five now declare `repository.url`/`repository.directory`, matching the root package.

The previous release attempt (2.2.5) never actually published to npm — this changeset supersedes it rather than retrying a version that was never live on the registry.
