import { renderMermaidASCII } from './packages/ascii-renderer/src/index.ts'
for (const src of ['graph LR\n A --> B\n A -.-> C\n A ==> D\n A --> E', 'graph LR\n A --> B\n A -.-> C\n C --> A\n B --> A']) console.log(renderMermaidASCII(src.replace(/\\n/g,'\n'),{colorMode:'none'}))
