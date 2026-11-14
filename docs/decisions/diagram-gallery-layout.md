# Diagram gallery layout: inline capped grid with expand, not a new page

Status: implemented

## Decision

Direction A: an inline capped grid with expand on the existing `diagrams/<type>.html` page, not a new page.

- Height is bounded by a fixed card cap (6 on desktop, 4 on mobile; 3 columns, 1 on mobile), not a page-height budget.
- No new route, nav or breadcrumb wiring; a visitor stays on the page they are evaluating.
- A fixed-aspect-ratio thumbnail frame fixes #708's card-sizing bug.
- Direction B is a reasonable follow-up if the curated set outgrows this; C is not recommended because it re-litigates #712/#713's scope.
- #715 implements it; the expand interaction is demo-site chrome, never inside the library's SVG output.

Full write-up: https://github.com/dfadler/zombie-mermaid/issues/714#issuecomment-6884747066
