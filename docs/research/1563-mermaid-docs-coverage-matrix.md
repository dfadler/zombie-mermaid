# Mermaid documentation coverage matrix (audit against v11.17.0)

Issue: [#1563](https://github.com/dfadler/zombie-mermaid/issues/1563), sub-issue of
[#1502](https://github.com/dfadler/zombie-mermaid/issues/1502). Descriptive only:
the project objective ([#1564](https://github.com/dfadler/zombie-mermaid/issues/1564))
is not decided, so this records what Mermaid documents and what this repo does with
it, and does not say which gaps matter.

## Method and sources

- **Mermaid version audited: 11.17.0**, the `mermaid-audited-version` marker that PR
  [#1633](https://github.com/dfadler/zombie-mermaid/pull/1633) reads from
  `docs/diagrams.md`. The docs source at that tag was read from
  `https://github.com/mermaid-js/mermaid/tree/mermaid%4011.17.0/packages/mermaid/src/docs`
  (`syntax/*.md` and `config/*.md`; the tag resolves, commit `5a88c2d3`).
- The published docs at `https://mermaid.ai/open-source/intro/syntax-reference.html`
  list the same diagram pages but currently show **Mermaid 12.1.0**, plus a
  "Use Case" page (`https://mermaid.ai/open-source/syntax/usecase.html`) that is
  absent from the 11.17.0 tag. Published-site URLs below are the human-readable
  equivalents; the tag is the authority for 11.17.0 claims. Use Case was not probed.
- Fetched pages are treated as data. Nothing in them was executed.
- **Repo side:** `HEAD 992cb194` (packages at 5.0.x). Each row marked "probe" was run
  by feeding a small sample through `renderMermaidSVGAsync` (with `elkjs`
  registered) and `renderMermaidASCII`, and reading the output. The sample set is
  about 330 snippets; the script is not committed. Probe results are one sample per
  feature, default theme and options.
- "Honored" means a marker string from the sample showed up in the SVG text or
  attributes. For items without a marker, "accepted" means no error was raised and the
  output was not shown to differ; it does not prove the feature is applied.

Status vocabulary (evidence, not judgment):

| Status             | Meaning                                                               |
| ------------------ | --------------------------------------------------------------------- |
| supported          | sample parsed and the documented effect appears in the output         |
| accepted           | sample parsed, no visible effect found, or effect not checked         |
| dropped silently   | sample parsed, the documented content is absent from the output       |
| mis-parsed         | sample parsed, but the output shows the syntax as stray text/nodes    |
| error              | renderer threw                                                        |
| documented in repo | `docs/diagrams.md` already states the behavior (cited, not re-judged) |

No row is labeled "intentionally out of scope" here: that label needs the objective
document. Where `docs/diagrams.md` already calls something out of scope, the row says
"documented in repo".

## 1. Diagram types

Dispatch is in `packages/core/src/diagram-type.ts`: `DIAGRAM_TYPES` is
`flowchart, sequence, class, er, xychart, architecture, c4, pie`; state diagrams ride
the flowchart parser. Any other header falls through to the flowchart parser and
throws `Invalid mermaid header: "<header>". Supported headers: ...` (SVG and ASCII
alike).

| Mermaid page (11.17.0 source)                                                                               | Header probed                         | Result in this repo                  |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------ |
| [flowchart](https://mermaid.ai/open-source/syntax/flowchart.html)                                           | `flowchart`, `graph`                  | supported (section 2)                |
| [stateDiagram](https://mermaid.ai/open-source/syntax/stateDiagram.html)                                     | `stateDiagram`, `-v2`                 | supported with gaps (section 3)      |
| [sequenceDiagram](https://mermaid.ai/open-source/syntax/sequenceDiagram.html)                               | `sequenceDiagram`                     | supported with gaps (section 4)      |
| [classDiagram](https://mermaid.ai/open-source/syntax/classDiagram.html)                                     | `classDiagram`                        | supported with gaps (section 5)      |
| [entityRelationshipDiagram](https://mermaid.ai/open-source/syntax/entityRelationshipDiagram.html)           | `erDiagram`                           | supported with gaps (section 6)      |
| [xyChart](https://mermaid.ai/open-source/syntax/xyChart.html)                                               | `xychart(-beta)`                      | supported with gaps (section 7)      |
| [c4](https://mermaid.ai/open-source/syntax/c4.html)                                                         | `C4*` (5 headers)                     | supported with gaps (section 8)      |
| [architecture](https://mermaid.ai/open-source/syntax/architecture.html)                                     | `architecture(-beta)`                 | supported with gaps (section 9)      |
| [pie](https://mermaid.ai/open-source/syntax/pie.html)                                                       | `pie`                                 | supported with gaps (section 10)     |
| [gantt](https://mermaid.ai/open-source/syntax/gantt.html)                                                   | `gantt`                               | error (unrecognized header)          |
| [timeline](https://mermaid.ai/open-source/syntax/timeline.html)                                             | `timeline`                            | error                                |
| [mindmap](https://mermaid.ai/open-source/syntax/mindmap.html)                                               | `mindmap`                             | error                                |
| [gitgraph](https://mermaid.ai/open-source/syntax/gitgraph.html)                                             | `gitGraph`                            | error                                |
| [userJourney](https://mermaid.ai/open-source/syntax/userJourney.html)                                       | `journey`                             | error                                |
| [quadrantChart](https://mermaid.ai/open-source/syntax/quadrantChart.html)                                   | `quadrantChart`                       | error                                |
| [sankey](https://mermaid.ai/open-source/syntax/sankey.html)                                                 | `sankey`, `sankey-beta`               | error                                |
| [block](https://mermaid.ai/open-source/syntax/block.html)                                                   | `block`, `block-beta`                 | error                                |
| [packet](https://mermaid.ai/open-source/syntax/packet.html)                                                 | `packet`, `packet-beta`               | error                                |
| [kanban](https://mermaid.ai/open-source/syntax/kanban.html)                                                 | `kanban`                              | error                                |
| [requirementDiagram](https://mermaid.ai/open-source/syntax/requirementDiagram.html)                         | `requirementDiagram`                  | error                                |
| [zenuml](https://mermaid.ai/open-source/syntax/zenuml.html)                                                 | `zenuml`                              | error                                |
| [radar](https://mermaid.ai/open-source/syntax/radar.html)                                                   | `radar-beta`                          | error                                |
| [treemap](https://mermaid.ai/open-source/syntax/treemap.html)                                               | `treemap-beta`                        | error                                |
| [venn](https://mermaid.ai/open-source/syntax/venn.html)                                                     | `venn-beta`                           | error                                |
| [ishikawa](https://mermaid.ai/open-source/syntax/ishikawa.html)                                             | `ishikawa-beta`                       | error                                |
| [wardley](https://mermaid.ai/open-source/syntax/wardley.html)                                               | `wardley-beta`                        | error                                |
| [cynefin](https://mermaid.ai/open-source/syntax/cynefin.html)                                               | `cynefin-beta`                        | error                                |
| [treeView](https://mermaid.ai/open-source/syntax/treeView.html)                                             | `treeView-beta`                       | error                                |
| [eventmodeling](https://mermaid.ai/open-source/syntax/eventmodeling.html)                                   | `eventmodeling`                       | error                                |
| [swimlanes](https://mermaid.ai/open-source/syntax/swimlanes.html)                                           | `swimlane-beta LR`                    | error                                |
| [railroad](https://mermaid.ai/open-source/syntax/railroad.html)                                             | `railroad-ebnf-beta`, `railroad-beta` | error (ABNF/PEG variants not probed) |
| [usecase](https://mermaid.ai/open-source/syntax/usecase.html) (published site only, not in the 11.17.0 tag) | not probed                            | not probed                           |

The issue text lists "ZenUML" and "sankey" etc. as non-supported examples; all 22
Mermaid types above beyond the nine supported ones behave identically (error, no
partial render). Headers that are not in Mermaid's 11.17.0 docs but were probed:
`classDiagram-v2` errors (`Did you mean "classDiagram"?`).

## 2. Flowchart

Docs: [flowchart.md](https://github.com/mermaid-js/mermaid/blob/mermaid%4011.17.0/packages/mermaid/src/docs/syntax/flowchart.md)
([published](https://mermaid.ai/open-source/syntax/flowchart.html)). The repo's own
claims are in `docs/diagrams.md` (Flowcharts, Known limitations).

| Documented feature                                                                 | Status                               | Evidence                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Direction `TD/TB/LR/RL/BT`, `graph` alias                                          | supported                            | probe                                                                                                                                                                                                      |
| Classic bracket node shapes (14)                                                   | supported                            | `docs/diagrams.md` table                                                                                                                                                                                   |
| Expanded `@{ shape: ... }` names (v11.3.0+)                                        | supported                            | probe: 14 names parsed (hourglass, bang, cloud, odd, curv-trap, sm-circ, fr-circ, lean-l, hex, bow-rect, cyl, lin-cyl, h-cyl, das-cyl, ...); unknown names fall back to a rectangle per `docs/diagrams.md` |
| `icon:` / `img:` metadata, `fa:` icon text                                         | documented in repo                   | `docs/diagrams.md` "Known limitations"; probe: `fa:fa-camera Cam` renders as literal text                                                                                                                  |
| Edge types, lengths, `o`/`x` terminators, invisible `~~~`                          | supported (length hint not applied)  | `docs/diagrams.md` "Edge types"                                                                                                                                                                            |
| Edge labels (pipe and inline form)                                                 | supported                            | probe                                                                                                                                                                                                      |
| Edge IDs and `animate` / `animation` (`e1@-->`)                                    | supported                            | `docs/diagrams.md` "Edge IDs and animation"; probe accepted                                                                                                                                                |
| Per-edge `curve` in edge metadata                                                  | accepted                             | probe: no error; effect not compared                                                                                                                                                                       |
| Subgraphs, nested, edges to subgraph, `direction` inside                           | accepted                             | probe: parse, `Title` label present; inner `direction` effect not compared                                                                                                                                 |
| Subgraph collapse (11.17.0+)                                                       | documented in repo                   | `docs/diagrams.md` "Known limitations"; probe `collapse S` accepted without error                                                                                                                          |
| `&` chaining                                                                       | accepted                             | probe                                                                                                                                                                                                      |
| `style`, `classDef`, `class`, `:::`, `default` class                               | supported (SVG); ASCII has no colors | probe: colors present in SVG, absent in ASCII                                                                                                                                                              |
| `style` on a subgraph id                                                           | dropped silently                     | probe: `style S fill:#ddd` leaves no `#ddd` in output                                                                                                                                                      |
| `linkStyle N` / `linkStyle default`                                                | supported (SVG)                      | probe                                                                                                                                                                                                      |
| `click href`, tooltip, `_blank`                                                    | supported (SVG)                      | `docs/diagrams.md` "Interactions"; probe                                                                                                                                                                   |
| `click ... call cb()`                                                              | accepted, no output effect           | probe (no script by design per `docs/diagrams.md`)                                                                                                                                                         |
| Markdown strings (``"`**bold**`"``)                                                | supported (SVG bold; ASCII plain)    | probe                                                                                                                                                                                                      |
| `<br/>` in labels, quoted special characters, unicode/emoji                        | supported                            | probe                                                                                                                                                                                                      |
| Entity codes (`#9829;`)                                                            | accepted                             | probe: not compared to expected glyph                                                                                                                                                                      |
| Math (`$$...$$`, [math.md](https://mermaid.ai/open-source/config/math.html))       | dropped silently (shown literal)     | probe: node text is the literal `$$x^2$$`                                                                                                                                                                  |
| `accTitle` / `accDescr`                                                            | mis-parsed                           | probe: renders `accTitle` and `accDescr` as nodes (see section 11)                                                                                                                                         |
| `flowchart.curve`: `linear, basis, natural, step*`                                 | supported                            | `docs/diagrams.md` "Edge curves"                                                                                                                                                                           |
| `flowchart.curve`: other d3 curves (`catmullRom, cardinal, monotoneX, bumpX`, ...) | accepted                             | probe: no error; effect not compared (repo documents 7 values)                                                                                                                                             |
| `flowchart.wrappingWidth, nodeSpacing, rankSpacing, useMaxWidth, htmlLabels`       | accepted                             | probe: no error; `htmlLabels` documented as ignored in repo                                                                                                                                                |
| `defaultRenderer`, `layout: elk` via init                                          | accepted                             | `docs/diagrams.md` (ELK is the only engine)                                                                                                                                                                |

## 3. State diagram

Docs: [stateDiagram.md](https://github.com/mermaid-js/mermaid/blob/mermaid%4011.17.0/packages/mermaid/src/docs/syntax/stateDiagram.md).
Repo prose is a code sample only (`docs/diagrams.md` "State Diagrams"); there is no
state section listing support.

| Documented feature                                                                       | Status           | Evidence                                                                                       |
| ---------------------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------- |
| States, `[*]`, transitions with labels                                                   | supported        | probe                                                                                          |
| Descriptions (`s1 : text`), `state "Long" as id`                                         | supported        | probe                                                                                          |
| Composite states (nested, cross-edges)                                                   | accepted         | probe                                                                                          |
| `<<choice>>`, `<<fork>>`, `<<join>>`                                                     | accepted         | probe (choice labels present)                                                                  |
| Concurrency `--`                                                                         | accepted         | probe                                                                                          |
| `direction`, inside composites                                                           | accepted         | probe                                                                                          |
| `classDef`, `class`, `:::`, `style`                                                      | supported (SVG)  | probe                                                                                          |
| `note right of` / `note left of`, one-line and block                                     | dropped silently | probe: note text absent from SVG and ASCII; a diagram containing only a note renders a 0x0 SVG |
| `click`                                                                                  | accepted         | probe: no link in output                                                                       |
| `accTitle` / `accDescr`                                                                  | mis-parsed       | probe: the title text appears as a state                                                       |
| `hide empty description`, `scale N width` (Mermaid grammar; not in the 11.17.0 doc page) | accepted         | probe                                                                                          |
| Frontmatter `title`                                                                      | error            | see section 11                                                                                 |

## 4. Sequence diagram

Docs: [sequenceDiagram.md](https://github.com/mermaid-js/mermaid/blob/mermaid%4011.17.0/packages/mermaid/src/docs/syntax/sequenceDiagram.md).
Repo claims: `docs/diagrams.md` "Sequence Diagrams".

| Documented feature                                                                                              | Status               | Evidence                                                                                                              |
| --------------------------------------------------------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `participant`, `actor`, `as` aliases                                                                            | supported            | probe                                                                                                                 |
| Participant types `@{ "type": "boundary"/"control"/"entity"/"database"/"collections"/"queue" }` (and `"actor"`) | error                | probe: `Sequence diagram: unclosed "par" block` on line 2 of every variant (line 2 is the `participant X@{...}` line) |
| Arrow types (`->`, `-->`, `->>`, `-->>`, `-x`, `--x`, `-)`, `--)`)                                              | supported            | probe                                                                                                                 |
| Bidirectional `<<->>`, `<<-->>` (v11.x)                                                                         | accepted             | probe                                                                                                                 |
| Central connections `()` (v11.12.3+)                                                                            | accepted             | probe                                                                                                                 |
| `activate`/`deactivate`, `+`/`-` shorthand                                                                      | supported            | `docs/diagrams.md` "Activations"                                                                                      |
| `create` / `destroy` participant                                                                                | supported            | `docs/diagrams.md`                                                                                                    |
| `box ... end` with color                                                                                        | supported            | `docs/diagrams.md`; probe label present                                                                               |
| Notes right/left/over                                                                                           | supported            | probe                                                                                                                 |
| `loop`, `alt/else`, `opt`, `par/and`, `break`                                                                   | supported            | probe                                                                                                                 |
| `critical`                                                                                                      | supported            | probe, minimal form                                                                                                   |
| `critical` with `option` branches                                                                               | error                | probe: `unclosed "critical" block` when an `option` line is present                                                   |
| `rect rgb(...)` background highlight                                                                            | mis-parsed           | probe: drawn as a labeled frame `rect [rgb(191, 223, 255)]`, not a background                                         |
| `autonumber`, with start and step (v11.15.0+)                                                                   | supported            | probe: numbers 10, 15                                                                                                 |
| `<br/>` in messages, entity codes                                                                               | supported / accepted | probe                                                                                                                 |
| `link` / `links` actor menus                                                                                    | dropped silently     | probe: no menu or link in output                                                                                      |
| `wrap:` message prefix, `sequence.wrap`, `%%{wrap}%%`                                                           | accepted             | probe: no error; wrapping not compared                                                                                |
| `sequence.*` config (`mirrorActors, actorMargin, width, showSequenceNumbers`)                                   | partial              | probe: `showSequenceNumbers` honored; others not compared                                                             |
| `accTitle` / `accDescr`                                                                                         | dropped silently     | probe                                                                                                                 |
| Math in messages                                                                                                | dropped silently     | probe: literal `$$x^2$$`                                                                                              |

## 5. Class diagram

Docs: [classDiagram.md](https://github.com/mermaid-js/mermaid/blob/mermaid%4011.17.0/packages/mermaid/src/docs/syntax/classDiagram.md).
Repo claims: `docs/diagrams.md` "Class Diagrams" ("Known limitations: None currently").

| Documented feature                                                                                                   | Status           | Evidence                                                                                         |
| -------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------ |
| Members, visibility, static `$`, abstract `*`, params/returns                                                        | supported        | probe                                                                                            |
| Generics `~T~`                                                                                                       | supported        | probe                                                                                            |
| Relationship arrows (inheritance, composition, aggregation, association, link, dependency, realization, dashed link) | supported        | probe                                                                                            |
| Cardinality and relation labels                                                                                      | supported        | probe                                                                                            |
| Two-way relations (`<-->`, `<\|--\|>`)                                                                               | error            | probe: `Malformed class-diagram relationship`                                                    |
| Lollipop interfaces (`bar ()-- foo`, `--()`)                                                                         | error            | probe: same error                                                                                |
| Namespaces, labels and nesting (v11.15.0+)                                                                           | supported        | probe: label `Display` present                                                                   |
| `direction`                                                                                                          | accepted         | probe                                                                                            |
| Annotations inside the body (`<<interface>>`)                                                                        | supported        | probe                                                                                            |
| Annotation as a standalone line (`<<interface>> Shape`)                                                              | dropped silently | probe: no annotation text in output                                                              |
| Class label `class A["My Label"]`                                                                                    | dropped silently | probe: label replaced by the id; with no members and no other statement the SVG is 0x0           |
| Backtick ids (`` class `Animal Class!` ``)                                                                           | dropped silently | probe: SVG is 0x0, text absent                                                                   |
| `Name:::cls { ... }` shorthand with body                                                                             | mis-parsed       | probe: output text is `CAR` and `::someclass {`                                                  |
| `class A:::c`, `style`, `classDef`, `cssClass`                                                                       | supported (SVG)  | probe                                                                                            |
| `note` / `note for`                                                                                                  | supported        | `docs/diagrams.md`; probe                                                                        |
| `click` / `link` / `callback`                                                                                        | accepted         | `docs/diagrams.md` "Interactions"; probe output shows no link for `click A href` on a bare class |
| `class.hideEmptyMembersBox` config                                                                                   | accepted         | probe                                                                                            |
| `accTitle` / `accDescr`                                                                                              | mis-parsed       | probe: `accTitle` shown as class text                                                            |

## 6. ER diagram

Docs: [entityRelationshipDiagram.md](https://github.com/mermaid-js/mermaid/blob/mermaid%4011.17.0/packages/mermaid/src/docs/syntax/entityRelationshipDiagram.md).

| Documented feature                                        | Status             | Evidence                                                                        |
| --------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------- |
| Relationships, all cardinality symbols, identifying/non   | supported          | probe                                                                           |
| Word-form cardinalities (`one or more to zero or one`)    | accepted           | probe                                                                           |
| Attributes with types, `PK`/`FK`/`UK`, comments, `PK, FK` | supported          | probe                                                                           |
| Entity aliases `p[Person]`, quoted names                  | supported          | probe                                                                           |
| `direction`                                               | accepted           | probe                                                                           |
| `subgraph` (v11.17.0+)                                    | accepted           | probe: no error; grouping not compared                                          |
| `style`                                                   | dropped silently   | probe: no color in SVG                                                          |
| `classDef`, `:::`, `classDef default`                     | mis-parsed         | probe: entity rendered with the literal name `A:::c`; default class not applied |
| `click` (not in Mermaid's ER grammar)                     | documented in repo | `docs/diagrams.md` "ER Diagrams"                                                |
| `accTitle` / `accDescr`                                   | dropped silently   | probe                                                                           |
| Frontmatter `config.layout: elk`, `title`                 | error              | section 11                                                                      |

## 7. XY chart

Docs: [xyChart.md](https://github.com/mermaid-js/mermaid/blob/mermaid%4011.17.0/packages/mermaid/src/docs/syntax/xyChart.md).
Repo claims: `docs/diagrams.md` "XY Charts", `docs/xychart-design.md`.

| Documented feature                                                                                                               | Status           | Evidence                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------- |
| `xychart` / `xychart-beta`, `horizontal`, title, axes (categorical and numeric range), negative values, multiple bar/line series | supported        | probe                                                                                             |
| `bar "Name" [..]` / `line "Name" [..]` named series and automatic legend (v11.17.0+)                                             | error            | probe: `Malformed xychart-beta "bar" directive`; same for `line`                                  |
| Legend directives (`legend`, `legend bottom`, probed as guesses)                                                                 | error            | probe; the 11.17.0 page documents only the automatic legend, not a directive                      |
| Per-point line labels `line [25 "Launch", 45]` (v11.16.0+)                                                                       | dropped silently | probe: parses, `Launch` absent from SVG and ASCII                                                 |
| `showDataLabel` (v11.14.0+)                                                                                                      | accepted         | probe: no error; labels not compared                                                              |
| `xyChart` config width/height, axis `showLabel` etc.                                                                             | accepted         | probe                                                                                             |
| `themeVariables.xyChart.plotColorPalette`                                                                                        | dropped silently | probe: `#ff0000` absent (repo uses its own render options, `docs/diagrams.md` "XY Chart Styling") |
| `accTitle` / `accDescr`                                                                                                          | dropped silently | probe                                                                                             |

## 8. C4

Docs: [c4.md](https://github.com/mermaid-js/mermaid/blob/mermaid%4011.17.0/packages/mermaid/src/docs/syntax/c4.md).
Repo claims: `docs/diagrams.md` "C4 Diagrams" (known limitations listed there).

| Documented feature                                                                                       | Status             | Evidence                                                                  |
| -------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------- |
| `C4Context/Container/Component/Dynamic/Deployment` headers                                               | supported          | probe                                                                     |
| Person/System/Container/Component, `Db`/`Queue`/`_Ext` variants                                          | supported          | probe                                                                     |
| Boundaries with `{}` bodies, `Deployment_Node`, `Node_L/R`                                               | supported          | probe                                                                     |
| `Rel`, `BiRel`, `Rel_*`, `RelIndex`                                                                      | supported          | probe                                                                     |
| `$sprite`, `$tags`, `$link` parameters                                                                   | accepted           | probe                                                                     |
| `UpdateElementStyle`, `UpdateRelStyle`, `UpdateLayoutConfig`, `AddElementTag`/`AddRelTag`, `SHOW_LEGEND` | documented in repo | `docs/diagrams.md` ("accepted and ignored"); probe confirms colors absent |
| `c4.*` init config                                                                                       | accepted           | probe                                                                     |
| Element text wrapping                                                                                    | accepted           | probe parses a long description; wrapping not compared                    |

## 9. Architecture

Docs: [architecture.md](https://github.com/mermaid-js/mermaid/blob/mermaid%4011.17.0/packages/mermaid/src/docs/syntax/architecture.md).
Repo claims: `docs/diagrams.md` "Architecture Diagrams".

| Documented feature                                                                                                 | Status             | Evidence                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------ |
| `group`, `service`, `junction`, `in <group>`, nested groups                                                        | supported          | probe                                                                                                        |
| Edges with port sides, `--`, `-->`, `<--`, `<-->`, `{group}`                                                       | supported          | probe                                                                                                        |
| Built-in icons (`cloud, database, disk, internet, server`)                                                         | documented in repo | `docs/diagrams.md`: not drawn; mapped to shapes                                                              |
| Iconify / custom icon packs (`logos:aws-lambda`)                                                                   | documented in repo | `docs/diagrams.md`: any other icon gives a rectangle; probe accepted                                         |
| `align row` / `align column` (v11.16.0+), space-separated ids                                                      | documented in repo | `docs/diagrams.md`: accepted and ignored; probe confirms; comma-separated ids error                          |
| Config `randomize`, `iconSize`, `nodeSeparation`, `idealEdgeLengthMultiplier`, `edgeElasticity`, `numIter`, `seed` | accepted           | probe: init directive with `randomize`/`iconSize` accepted; effect not compared; the repo does not use fcose |
| `accTitle` / `accDescr`                                                                                            | error              | probe: `unrecognized statement - "accTitle: ArT"`                                                            |

## 10. Pie

Docs: [pie.md](https://github.com/mermaid-js/mermaid/blob/mermaid%4011.17.0/packages/mermaid/src/docs/syntax/pie.md).
Repo claims: `docs/diagrams.md` "Pie Charts".

| Documented feature                                  | Status           | Evidence                                                                                      |
| --------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------- |
| `pie`, `showData`, `title`, quoted labels, decimals | supported        | probe                                                                                         |
| `textPosition`                                      | accepted         | probe                                                                                         |
| `donutHole` (v11.16.0+, config key)                 | accepted         | probe: no error; SVG size identical to default, hole not verified                             |
| `legendPosition` (v11.16.0+, config key)            | accepted         | probe: SVG viewBox identical to the default `right` layout, so no effect observed             |
| `highlightSlice` (v11.16.0+, config key)            | accepted         | probe: no error; effect not verified                                                          |
| `themeVariables.pie1..pie12`                        | dropped silently | probe: `#ff0000` absent                                                                       |
| `accTitle` / `accDescr`                             | supported        | `docs/diagrams.md` "Accessibility"; probe                                                     |
| Unquoted slice labels                               | error            | probe: `slice labels must be quoted` (Mermaid's grammar also requires quotes; not re-checked) |

## 11. Cross-cutting config, directives, theming, accessibility

Docs: [configuration.md](https://github.com/mermaid-js/mermaid/blob/mermaid%4011.17.0/packages/mermaid/src/docs/config/configuration.md),
[directives.md](https://github.com/mermaid-js/mermaid/blob/mermaid%4011.17.0/packages/mermaid/src/docs/config/directives.md),
[theming.md](https://github.com/mermaid-js/mermaid/blob/mermaid%4011.17.0/packages/mermaid/src/docs/config/theming.md),
[accessibility.md](https://github.com/mermaid-js/mermaid/blob/mermaid%4011.17.0/packages/mermaid/src/docs/config/accessibility.md),
[layouts.md](https://github.com/mermaid-js/mermaid/blob/mermaid%4011.17.0/packages/mermaid/src/docs/config/layouts.md),
[icons.md](https://github.com/mermaid-js/mermaid/blob/mermaid%4011.17.0/packages/mermaid/src/docs/config/icons.md),
[math.md](https://github.com/mermaid-js/mermaid/blob/mermaid%4011.17.0/packages/mermaid/src/docs/config/math.md).

| Documented feature                                                                           | Status                                | Evidence                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| YAML frontmatter (`---` block with `title:` and `config:`)                                   | error                                 | probe: every diagram type with a leading `---` fails with `Invalid mermaid header: "---"`. No source file, doc, or open issue mentions frontmatter (`grep` of `packages/*/src`, `docs/`; issue search)                                                                                         |
| `%%{init: {...}}%%` directive                                                                | supported                             | `docs/diagrams.md` "Configuration directives"                                                                                                                                                                                                                                                  |
| `%%{config: ...}%%`, multiple directives, `%%{wrap}%%`                                       | accepted                              | probe                                                                                                                                                                                                                                                                                          |
| `theme`: `dark`                                                                              | supported                             | probe: output changes                                                                                                                                                                                                                                                                          |
| `theme`: `default`, `base`, `forest`, `neutral`                                              | accepted                              | probe: no error; output not compared                                                                                                                                                                                                                                                           |
| `themeVariables` (e.g. `primaryColor`)                                                       | dropped silently                      | probe: `#ff0000` absent from SVG                                                                                                                                                                                                                                                               |
| `themeCSS`                                                                                   | dropped silently                      | probe: injected rule absent                                                                                                                                                                                                                                                                    |
| `fontFamily`                                                                                 | documented in repo                    | `docs/diagrams.md` (use the `font` option); probe: absent from SVG                                                                                                                                                                                                                             |
| `fontSize` theme variable                                                                    | supported (SVG)                       | probe: value present in SVG, not in ASCII                                                                                                                                                                                                                                                      |
| `securityLevel`, `htmlLabels`, `maxTextSize`, `defaultRenderer`                              | documented in repo                    | `docs/diagrams.md` table of keys parsed but not acted on                                                                                                                                                                                                                                       |
| `look: classic / neo / handDrawn` (frontmatter or init)                                      | error (frontmatter) / accepted (init) | probe: init `look` accepted; no visible change checked                                                                                                                                                                                                                                         |
| `layout: dagre / elk / tidy-tree / cose-bilkent`                                             | error (frontmatter) / accepted (init) | probe; `docs/diagrams.md` says ELK is the only engine                                                                                                                                                                                                                                          |
| `deterministicIds`, `darkMode`, `arrowMarkerAbsolute`, `maxEdges`, `logLevel`, `startOnLoad` | accepted                              | probe: no error; `maxEdges: 1` with 2 edges did not raise                                                                                                                                                                                                                                      |
| Math/KaTeX (`$$...$$`) in flowchart and sequence                                             | dropped silently                      | probe: literal text                                                                                                                                                                                                                                                                            |
| Icon pack registration (`registerIconPacks`) and iconify names in flowchart `icon:`          | documented in repo                    | `docs/diagrams.md` "Icons and images"                                                                                                                                                                                                                                                          |
| Accessibility: `role`, `aria-roledescription`, `accTitle`/`accDescr`                         | partial                               | `docs/diagrams.md` "Accessibility": root gets `role="img"`; `accTitle`/`accDescr` honored only in pie; probe found no `aria-roledescription` on a flowchart. Elsewhere `accTitle` is dropped (sequence, ER, XY), mis-parsed into content (flowchart, state, class), or an error (architecture) |
| Diagram-specific theme blocks (gitGraph, timeline, journey, packet, radar, ...)              | n/a                                   | belong to unsupported types in section 1                                                                                                                                                                                                                                                       |

## 12. Gap register (facts only, unordered)

Each row is a statement the evidence above supports; no priority is implied.

1. 22 documented Mermaid diagram types are rejected outright (section 1).
2. Frontmatter (`---` ... `---`, `title`, `config`) is rejected for every diagram type (section 11).
3. Sequence participant types (`@{ "type": ... }`) fail with a misleading `unclosed "par" block` error (section 4).
4. Sequence `critical` with `option` fails to parse (section 4).
5. Sequence `rect rgb(...)` is drawn as a labeled frame instead of a background highlight (section 4).
6. State diagram `note` is dropped silently (section 3).
7. Class diagram: two-way relations and lollipop interfaces fail; standalone annotation lines, `class A["label"]` and backtick ids are dropped; `Name:::cls { }` is mis-parsed (section 5).
8. `accTitle`/`accDescr` leak into the drawing for flowchart, state and class, and are dropped or fatal elsewhere (section 11).
9. ER `style`, `classDef`, `:::` are not applied; `A:::c` becomes an entity name (section 6).
10. XY chart named series (the 11.17.0 legend) fails; per-point labels (11.16.0) are dropped (section 7).
11. Pie `themeVariables` colors are ignored; the three 11.16.0 config keys (`donutHole`, `legendPosition`, `highlightSlice`) are accepted with no observed effect (section 10).
12. Math (`$$`) renders as literal text in flowchart and sequence (sections 2, 4).
13. `themeVariables` and `themeCSS` are ignored in the types probed: flowchart, pie, XY (section 11).
14. Sequence actor menus (`link`/`links`) are dropped silently (section 4).
15. Flowchart `style` on a subgraph id is dropped (section 2).

## Not verified

- Visual correctness of any "supported"/"accepted" row beyond text/attribute presence; no screenshots were taken.
- Whether "accepted" config keys change layout (only a few were compared by `viewBox`).
- The `usecase` type, the `railroad-abnf-beta`/`railroad-peg-beta` variants, and most of the per-type theming sections in the Mermaid docs (git graph, timeline, journey, packet, radar, ...), because those types do not render at all.
- Mermaid 12.x behavior: the published site is 12.1.0; this audit pins the 11.17.0 tag source.
- Whether a given Mermaid feature behaves the way its doc page says in Mermaid itself; only the docs' syntax was used as the spec.
- `docs/diagrams.md` was not edited: the version marker and the per-diagram record that the issue asks for are left to the work that decides the objective (#1564) and to #1633 for the marker.
