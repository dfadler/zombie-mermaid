# Browsing and using the samples

The fastest way to write a diagram is to start from one that already looks
close to what you want. This walks through what's actually browsable on the
live site today, and how to adapt what you find.

## Where the samples live

There is no longer a single page that renders every sample in the library —
the [live site](https://dfadler.github.io/zombie-mermaid/)'s home page is a
static marketing landing page, not an interactive gallery. (An earlier
version of this page did render ~90 samples three ways at once — source,
SVG, and ASCII — but that gallery was retired by the site redesign; see
[docs/decisions/react-site-migration-plan.md](../decisions/react-site-migration-plan.md).)

What's there instead:

- **The [Diagrams hub](https://dfadler.github.io/zombie-mermaid/diagrams/)**
  lists the six diagram types zombie-mermaid supports — Flowchart, State,
  Sequence, Class, ER, and XY Chart. Each type has its own detail page
  (`/diagrams/<type>.html`) showing **one** worked example for that type:
  its Mermaid source (syntax-highlighted) next to the rendered SVG, plus a
  live picker across every built-in theme and an "Open in the live editor"
  link that carries the example into the editor pre-loaded.
- **The [live editor](https://dfadler.github.io/zombie-mermaid/editor.html)**
  is where you paste your own source and watch it re-render as you type,
  with the same live theme switching.

Both of these render **SVG only**. Neither shows an ASCII/Unicode preview —
that output only exists via the CLI or the library API today (see
"Adapting one" below). If you need to eyeball how a diagram will look in a
terminal before committing to it, that check now happens outside the
browser.

There is no "browse all the samples" experience anymore, in the browser or
otherwise. The fuller sample library this section used to describe —
roughly 90 diagrams covering every shape, edge type, and theme combination —
still exists in the repo as [`samples-data.ts`](../../samples-data.ts), but
it now only feeds the internal visual-test suite and
`scripts/visual-diff.ts`'s local before/after report (see
[CONTRIBUTING.md](../../CONTRIBUTING.md)); it isn't rendered anywhere on the
public site, and the dev server's `/` route serves the same marketing page
the live site does, not a sample browser. If you want to see more starting
points than the six type pages offer, reading `samples-data.ts` directly is
the closest thing to browsing it today.

## Finding one

Click **Diagrams** in the site nav (or "Browse every diagram type" on the
home page) to reach the hub, then **View examples** on the type that matches
your problem — a flowchart for a process or decision tree, a sequence
diagram for anything time-ordered, and so on. With one example per type
rather than dozens of labeled samples, "finding" one is mostly picking the
right diagram type rather than scanning a gallery.

## Adapting one

1. **Copy the source** from the type page's source panel, or open the
   example in the live editor and copy it from there.
2. **Change the labels first, not the structure.** The example is already
   close to the shape most diagrams of that type need; renaming the nodes
   gets you most of the way.
3. **Re-render and check both outputs.** The type page and the editor only
   show you the SVG. If the diagram will ever go in a README, a terminal, or
   a code comment, also render it as ASCII before committing to it:

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

## When a diagram renders badly in ASCII

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

## Testing a change against the live editor

Paste your source into the [live editor](https://dfadler.github.io/zombie-mermaid/editor.html)
and it re-renders as you type, with the same theme picker as the type pages.
That's the quickest way to iterate on a change before pasting the final
version into your own project — for the SVG output. There's no in-editor
ASCII preview, so still run the CLI or library call above before assuming an
edit is safe for a terminal.

## Next

- [Choosing and customizing a theme](theming.md) — make the output match your
  site or terminal
- [Supported Diagrams](../diagrams.md) — the full syntax reference for
  whichever type you picked
