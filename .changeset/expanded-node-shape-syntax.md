---
'zombie-mermaid': minor
---

Support Mermaid's expanded node syntax, `A@{ shape: doc, label: "Report" }` (v11.3.0+, from the audit in #198).

The syntax did not parse at all before: `A@{ shape: doc }` fell through to the bare-id pattern, so a node called `A` was registered and the entire metadata block was stranded as unparsed text — losing both the shape and the label with no error.

All 124 documented Mermaid shape names and aliases now resolve, and 23 new geometries are drawn that the classic bracket syntax cannot express: document, stacked document/process, card, lined/divided/window-pane rectangles, triangles, filled and crossed circles, fork bar, notched pentagon, sloped rectangle, flag, bow-tie rectangle, delay, braces, lightning bolt, bare text, and anchor.

Block scanning is depth- and quote-aware, so a label containing `}` (`A@{ label: "a } b" }`) does not terminate the block early, and values may contain commas and colons. `icon:` and `img:` are parsed with `form:` selecting the outline; since this renderer draws neither FontAwesome glyphs nor remote images, an unlabelled icon/image node shows its reference as text rather than rendering blank. An unrecognized shape name falls back to a rectangle rather than failing the diagram.
