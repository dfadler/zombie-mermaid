---
---

No release: adds a "More examples" section to each `diagrams/<type>.html`
demo page, showing the samples-data.ts curated `gallery: true` set for
that type in a fixed-aspect-frame card grid (#714/#715). Fixes the
card-sizing bug #708 hit — a rendered SVG letterboxes into a fixed
`aspect-ratio: 4/3` frame instead of stretching the card to the diagram's
natural size. Demo-site UI only; nothing here touches the published
`zombie-mermaid` package.
