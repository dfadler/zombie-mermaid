# A built-in `layout: 'simple'` for flowcharts

Status: implemented

## Decision

- Diagram types: flowchart (`graph` / `flowchart`) only. State, class, ER and architecture ignore the option and still need `elkjs`; a state diagram with no `[*]` marker parses as a flowchart and gets the simple layout.
- Opt-in, not fallback: `layout: 'simple'` on `renderMermaidSVG` (and `layoutFlowchartSync`), typed `'elk' | 'simple'` as `LayoutEngine`. Unset or `'elk'` keeps existing output byte for byte; an unknown value throws.
- Quality gap: placement agreement with mermaid 12.1.0 on the 37 flowchart samples is within a point of ELK's (mean vertical 97% vs 98%, horizontal 96% vs 95%, containment 100% for both).
- Consequences: no automatic fallback; a second layout code path that the per-sample invariants test and `--layout=simple` in the oracle guard; edge routing is plainer than ELK's.

Full write-up: https://github.com/dfadler/zombie-mermaid/issues/1685#issuecomment-6884745991
