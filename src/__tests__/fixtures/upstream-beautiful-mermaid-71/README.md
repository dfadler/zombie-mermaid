# Fixtures ported from lukilabs/beautiful-mermaid#71

`archimate-layered.svg` and `archimate-full-stack.svg` are the example outputs
committed by [lukilabs/beautiful-mermaid#71](https://github.com/lukilabs/beautiful-mermaid/pull/71)
(Victor Palma, `devx`; the ArchiMate implementation they illustrate is from
[#34](https://github.com/lukilabs/beautiful-mermaid/pull/34) by
kristjanakkermann), MIT-licensed. They come from upstream's bespoke ArchiMate
renderer, so they are not compared pixel-for-pixel. The tests read the text
labels out of them (`archimate-upstream-integration.test.ts`) and check that
this fork's flowchart-lowered rendering of the same diagram shows every one.
