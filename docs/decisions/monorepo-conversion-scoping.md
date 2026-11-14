# Monorepo conversion scoping

Status: historical (describes the pre-#623 tree: about 50 `src/` paths and `files: ["src/"]` below predate the package split and are now wrong; kept unedited)

## Decision

Scoping for splitting the single package into workspace packages (#416, executed under #620):

- Use plain pnpm workspaces, with no Turborepo or Nx.
- Publish the packages version-locked through changesets `fixed`, under a single npm listing.
- Make `zombie-mermaid` an umbrella package that re-exports the split packages.
- Move `layout-engine/` and the shared theme and type code into `core`.
- The extraction order was corrected during execution: #625, then #624, then #623.

Full write-up, including the import-graph check, the corrections and the addenda for #623, #624, #625 and #767: [comment on #416](https://github.com/dfadler/zombie-mermaid/issues/416#issuecomment-6884590608).
