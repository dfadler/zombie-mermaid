import { renderMermaidASCII } from './packages/ascii-renderer/src/index.ts'
console.log(renderMermaidASCII(`flowchart LR
  A --> B
  A -->|first| C
  B -->|second| C
  A -->|third| D
  C -->|fourth| D
  B -->|fifth| D
  B -->|sixth| D
  A -->|seventh| D`, {colorMode:'none'}))
