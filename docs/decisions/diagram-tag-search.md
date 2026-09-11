# Diagram tag search: static for single tags and real combinations, dynamic beyond that

## Context

The diagrams-pages redesign canvas
(<https://claude.ai/code/artifact/5f6f7f34-15a9-45c1-8ede-ecde2d214367>)
gave each new specific-diagram detail page a row of feature tags — e.g. the
CI/CD Pipeline example shows "Subgraph", "Decision diamond", "Dashed
feedback edge", "Stadium", "Circle" — naming the Mermaid constructs that
example demonstrates. They were drafted as static, non-interactive labels.
The question that came up while reviewing the canvas: what if they were
clickable, turning the diagram directory into something searchable by
construct rather than only browsable by type?

This sits on top of the redesign's other decision to expand each
`diagrams/<type>.html` page from a curated subset into a directory of every
real sample for that type — see
[`diagram-gallery-scope.md`](./diagram-gallery-scope.md), which this
redesign already revisits (more indexable real-content pages beats one
dense, curated page, for long-tail SEO). Tag search is the same argument
applied one level deeper: a page scoped to "every Flowchart example that
uses a subgraph" targets a more specific search intent than either the
hub or a single type page can.

One wrong turn worth heading off explicitly: this is **not** blocked by
[`no-script-interactivity.md`](./no-script-interactivity.md). That ADR
scopes the `zombie-mermaid` _library's_ rendered diagram output — zero
`<script>` in emitted SVG/ASCII, permanently — not the demo site's own UI.
The site already ships client-side JS for its own chrome (the theme
picker, the mobile nav toggle), so a client-side filter for the site's
tag search is a different, already-precedented category of interactivity.

## Decision

Feature tags become real links into a tag-scoped directory, split by how
each result set is served:

- **Every single tag gets a real static page**
  (e.g. `/diagrams/tag/<slug>.html`), generated at build time from the
  same sample data the detail pages already draw from. This is always
  indexable, and it's where essentially all of the SEO value lives — a
  visitor searching one specific Mermaid construct lands directly on a
  page of real matching examples across every diagram type.
- **Multi-tag combinations get a static page only if the combination
  actually occurs** in the real sample set — computed at build time as
  "every combination two or more samples actually share," never the full
  permutation/power set of all tags. Generating a page for every
  mathematically possible combination produces mostly thin, near-empty
  pages (zero or one result), which is a worse outcome than not having
  the page at all.
- **Beyond that, tag selection is a client-side dynamic filter**, with
  selected tags reflected in the URL query string so a result set stays
  shareable and bookmarkable even when it wasn't pre-rendered. This tier
  is not relied on for search-engine indexing: most crawlers (including
  most AI/LLM crawlers hitting the site) don't execute JavaScript at all,
  and even Google's delayed JS-rendering pass isn't something to design
  the SEO strategy around.
- **Which additional multi-tag combinations are worth promoting from
  dynamic-only to statically pre-rendered is a question for real usage
  data, not a build-time guess.** Basic analytics on tag/search usage is
  future work whose purpose is specifically to answer that question —
  not decided here beyond "instrument it before guessing further."

## Consequences

- A real construct/tag taxonomy has to be designed across all six diagram
  types before this can be implemented — some constructs are type-specific
  (the stadium shape only exists in flowcharts), others cross-cut several
  types (a dashed edge appears in flowchart, state, and sequence samples).
  The five tags drafted on the canvas for one flowchart example are
  illustrative, not a taxonomy.
- This depends on the redesign's "directory of all examples" direction
  landing first (still unimplemented as of this doc), and specifically on
  giving the near-duplicate "batch" shape samples more distinct content —
  flagged separately on the same canvas — so tag pages built from them
  don't inherit that thin-content problem one layer down.
- Nothing here is implemented and no issue tracks it yet; opening one,
  scoped to at least the single-tag static pages (the highest-value,
  lowest-risk piece), is the next step.
- The analytics mechanism itself — what tool, what's tracked, retention,
  privacy stance — is explicitly out of scope for this doc and left to
  whoever picks up the tracking issue.
