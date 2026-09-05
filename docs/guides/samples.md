# Browsing and using the samples

The fastest way to write a diagram is to start from one that already looks
close to what you want. This walks through finding a sample, reading it, and
adapting it.

## Where the samples live

The [live demo](https://dfadler.github.io/zombie-mermaid/) renders every
browsable sample in the library — 90 of them, each shown three ways at once:

- the **Mermaid source** you can copy,
- the **rendered SVG**, and
- the **ASCII/Unicode** rendering of the same diagram.

Seeing all three together is the point. It is how you tell, before writing
anything, whether a diagram that reads well as SVG will still read well in a
terminal — some do not, and it is cheaper to find that out now.

The samples are grouped by diagram type:

| Category      | Samples | Good for                                           |
| ------------- | ------- | -------------------------------------------------- |
| Flowchart     | 24      | processes, decisions, pipelines, architecture      |
| Sequence      | 18      | request/response, protocols, anything time-ordered |
| Class         | 16      | type hierarchies, domain models                    |
| ER            | 14      | database schemas, entity relationships             |
| XY Chart      | 10      | bar and line charts                                |
| Interactivity | 4       | links, tooltips, curve styles, animated edges      |
| State         | 4       | state machines, lifecycles                         |

(The banner diagram at the top of the demo is a further sample, but it is
not part of the browsable gallery — hence 90 here rather than the 91 the
page renders in total.)

The **Interactivity** samples are worth opening even if you do not need
links or animation. They are the clearest demonstration of what the three-way
view is for. Both diagrams still render in ASCII — it is the browser-only
behaviour that drops away: a `click` node loses its link and tooltip, and an
animated edge is drawn as an ordinary solid line, with nothing to signal that
motion was requested. If you are deciding whether to target a browser, a static
image, or a terminal, that pair answers it directly.

## Finding one

Open the sidebar (the ☰ button on narrow screens) and pick a category. Only
one category renders at a time — with 90 samples each rendered twice, showing
all of them at once would make the page slow to load and slower to scan.

Inside a category, sample titles say what the diagram _is for_ rather than
what it uses: "CI/CD Pipeline", "Decision Tree", "Git Branching Workflow". Scan
for the shape of your problem, not for syntax.

## Adapting one

1. **Copy the source block** under the sample.
2. **Change the labels first, not the structure.** Most samples are already
   the right shape; renaming the nodes gets you most of the way.
3. **Re-render and check both outputs.** If you only care about SVG you can
   ignore the ASCII column — but if the diagram will ever go in a README, a
   terminal, or a code comment, check it now.

```typescript
import { renderMermaidSVG, renderMermaidASCII } from 'zombie-mermaid'

const source = `flowchart TD
  A[Start] --> B{Ready?}
  B -->|Yes| C[Ship]
  B -->|No| D[Fix]
  D --> B`

const svg = renderMermaidSVG(source)
const ascii = renderMermaidASCII(source)
```

Or from the terminal, without writing any code:

```bash
zombie-mermaid render diagram.mmd --ascii
```

## When a sample renders badly in ASCII

Dense diagrams — wide fan-outs, deeply nested subgraphs, long labels — have
much less room in a character grid than in an SVG. If the ASCII rendering is
cramped:

- **Shorten labels.** Every character is a grid column.
- **Split one diagram into two.** Usually clearer in both formats anyway.
- **Match the direction to the diagram's shape.** Switching direction swaps
  the output's aspect ratio, so the right choice depends on what the diagram
  looks like, not on a general preference:

  | Shape                               | `TD`      | `LR`      | Prefer |
  | ----------------------------------- | --------- | --------- | ------ |
  | Chain — `A --> B --> C --> D --> E` | 5w × 45h  | 45w × 5h  | `LR`   |
  | Fan-out — one node to four          | 35w × 15h | 15w × 35h | `TD`   |

  A long chain runs off the bottom of a terminal in `TD` and fits comfortably
  in `LR`. A wide fan-out does the opposite. (Those figures come from a test
  that fails if this stops being true.)

## Editing a sample in place

Each sample card has an **Edit** link that opens it in the live editor, where
you can change the source and watch both renderings update. That is the
quickest way to test a change before pasting it into your own project.

## Next

- [Choosing and customizing a theme](theming.md) — make the output match your
  site or terminal
- [Supported Diagrams](../diagrams.md) — the full syntax reference for
  whichever type you picked
