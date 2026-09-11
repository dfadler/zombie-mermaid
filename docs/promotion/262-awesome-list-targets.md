# Awesome-list and GitHub-topic targets (issue #262)

Draft only — **no external PRs have been opened**, and the `mermaid-alternative` topic
has not been added to the repo. Everything below is exact proposed content for the
repo owner to review and submit (or apply) themselves.

## 1. `awesome-diagramming`

**Target confirmed:** [`shubhamgrg04/awesome-diagramming`](https://github.com/shubhamgrg04/awesome-diagramming)
(3,280 stars, MIT/CC0-style "awesome" list, actively the top match for this exact name —
checked via `gh search repos "awesome-diagramming"`; other repos matching the search
term are unrelated or far smaller, e.g. a 0-star personal list).

The README (fetched via `gh api repos/shubhamgrg04/awesome-diagramming/readme`) is
organized by diagram-type section, each entry formatted as:

```
* [Name](url) (License, Open/Closed Source, Diagram-as-code or Hand-drawn, Ease of use - X, Visual Appearance - Y).
Examples - [Link](url)
```

The **"General Purpose (flexible for all kinds of diagrams)"** section already lists
plain Mermaid — zombie-mermaid belongs there as a related but distinct entry (a
renderer/library, not a hosted tool, so a couple of the descriptor fields don't map
perfectly; noted below).

### Proposed entry (add after the existing Mermaid line in that section)

```markdown
- [zombie-mermaid](https://github.com/dfadler/zombie-mermaid) (Free, Open Source, Diagram as code, Ease of use - Easy, Visual Appearance - Modern).  
  Examples - [Link](https://dfadler.github.io/zombie-mermaid/)
```

Judgment call: this list's format assumes a hosted tool/app more than a library, so
"Ease of use" and "Visual Appearance" are educated guesses matching the existing Mermaid
entry's ratings rather than measured against this list's own rubric. The repo owner may
want to adjust wording to make clear it's a renderer/library (usable via CLI, npm
package, or MCP server) rather than a standalone app, since every other entry in that
section is a hosted product.

## 2. `awesome-diagrams`

**Target confirmed:** [`robbie-cao/awesome-diagrams`](https://github.com/robbie-cao/awesome-diagrams)
("Awesome Diagram Tools" — a curated list of diagram _tools_ for programmers, CC0
licensed). This is the better match for issue #262's literal `awesome-diagrams` name and
intent (submitting a tool), not the other repo also named `awesome-diagrams`
([`terrastruct/awesome-diagrams`](https://github.com/terrastruct/awesome-diagrams)),
which is a curated gallery of diagram _images_ (screenshots of real companies'
architecture diagrams) — not a place to list a rendering tool at all. Confirmed by
reading both READMEs via `gh api`.

The README's `Misc` section already lists plain Mermaid:

```markdown
## Misc

- [D3.js](https://d3js.org)
- [Mermaid](https://github.com/knsv/mermaid)
```

### Proposed entry (add to the `Misc` section, after the Mermaid line)

```markdown
- [zombie-mermaid](https://github.com/dfadler/zombie-mermaid) - Maintained fork of beautiful-mermaid; renders Mermaid diagrams as SVG or ASCII with zero DOM dependencies
```

This list's entries are terse (bare link, or link plus a short dash-description for a
few), so the format above matches the two entries in `Misc` that do carry a description
(e.g. the Azimutt entry under "Program Modeling").

Note this repo's `contributing.md` should be checked at submission time for any specific
PR process it asks for (a template, alphabetical ordering requirement, etc.) — this
draft only covers content, not that repo's own contribution mechanics.

## 3. The `mermaid-alternative` GitHub topic

**Mechanism confirmed:** GitHub repository topics are not a submission or PR against
another repo — they're metadata on zombie-mermaid's own repo, editable directly by the
repo owner via either:

- the GitHub web UI ("manage topics" gear icon next to the About section on the repo
  homepage), or
- the API: `gh api -X PUT repos/dfadler/zombie-mermaid/topics -H "Accept: application/vnd.github+json" -f names[]=ai-agent -f names[]=ascii ... -f names[]=mermaid-alternative`
  (the endpoint replaces the full topic list in one call, so **all existing topics must
  be included alongside the new one**, not just the addition — see the current list
  below).

**Confirmed this is a real, actively-used topic**, not a speculative name: `gh api
search/repositories -f q="topic:mermaid-alternative"` returns 20 repositories currently
tagged with it (e.g. `tt-a1i/archify`, `coldteadotai/pr-lens`,
`bybit-exchange/svg-diagram`), so it has real discoverability value and isn't a topic
zombie-mermaid would be inventing from scratch.

**Confirmed zombie-mermaid does not have it yet.** Current topics (`gh api
repos/dfadler/zombie-mermaid/topics`):

```
ai-agent, ascii, class-diagram, claude-code, diagram, er-diagram, flowchart,
llm-tools, mcp, mermaid, model-context-protocol, sequence-diagram, state-diagram,
svg, theming, visualization, xychart
```

### Proposed action

Add `mermaid-alternative` to that list (18 topics total; GitHub's limit is 20, so there's
headroom). Exact command, preserving every existing topic:

```bash
gh api -X PUT repos/dfadler/zombie-mermaid/topics \
  -H "Accept: application/vnd.github+json" \
  -f names[]=ai-agent -f names[]=ascii -f names[]=class-diagram -f names[]=claude-code \
  -f names[]=diagram -f names[]=er-diagram -f names[]=flowchart -f names[]=llm-tools \
  -f names[]=mcp -f names[]=mermaid -f names[]=model-context-protocol \
  -f names[]=sequence-diagram -f names[]=state-diagram -f names[]=svg -f names[]=theming \
  -f names[]=visualization -f names[]=xychart -f names[]=mermaid-alternative
```

This wasn't run as part of this drafting pass — it's a one-line settings change on the
repo the owner can apply directly, distinct from the two awesome-list PRs above (which
need review of external-repo conventions and go through someone else's PR queue). Note
issue #254 ("Add GitHub topics for discoverability") is the umbrella's own tracking issue
for repo-topic changes in general — this specific addition may belong there instead of
as a side effect of #262, since #262's own text says the topic goes in "via repo
topics — see the GitHub-topics issue."
