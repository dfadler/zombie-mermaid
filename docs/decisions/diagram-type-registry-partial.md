# Diagram-type registry: partial adoption, not a single shared `layout` step

Status: superseded (`diagramRegistry` in `packages/svg-renderer/src/registry.ts` is now `Record<DiagramType, ...>`, so every type is covered)

## Decision

- Adopted the registry for `xychart` and `er` first, with an SVG-only `layoutForSvg` rather than a shared `layout` step.
- The SVG and ASCII tables stay two separate modules (an import cycle would otherwise block the monorepo split).
- Addenda: `sequence` and `class` were added later with no behaviour change; the SVG half moved to `packages/svg-renderer/src/registry.ts` (#1111).
- Now superseded: `diagramRegistry` is `Record<DiagramType, ...>`, so every type is covered.

Full write-up: https://github.com/dfadler/zombie-mermaid/issues/533#issuecomment-6884737478
