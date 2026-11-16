---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': minor
---

Output change, ASCII: in a left-to-right or right-to-left flow, a Z-shaped edge that has a gap to itself (or only strokes that share its end cell) now bends on the column ELK bends it on, measured from the start face to the end face, instead of the gap's middle column, as mermaid@12.3.0 draws it. Without a layout provider the output is unchanged. Changes under a provider in LR and RL: LR Bypass Edge In A Chain, Parallel Links (&), linkStyle: Color-Coded Edges, Text-Embedded Labels and the other gallery flowcharts whose Z bent mid-gap.
