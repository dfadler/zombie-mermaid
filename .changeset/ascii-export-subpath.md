---
'zombie-mermaid': minor
---

Add a `zombie-mermaid/ascii` export subpath so consumers who only need `renderMermaidASCII` can import it without bundling elkjs, the layout engine used only by the SVG renderer (previously 93% of the bundled size for an ASCII-only consumer). The root `zombie-mermaid` entry point is unchanged.
