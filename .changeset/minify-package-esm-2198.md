---
'@zombie-mermaid/core': patch
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/ascii-renderer': patch
'@zombie-mermaid/mcp': patch
---

Package ESM output (`dist/index.js`) is now minified: tabs, newlines and comments are removed, and `@zombie-mermaid/mcp` gets identifier mangling too. About 20.7 KB less gzip across the five packages. Behavior and exports are unchanged; stack traces from the ESM build are harder to read, and the `/* @__PURE__ */` annotations are no longer in the shipped ESM (a one-export consumer bundle was the same size). Refs [#2198](https://github.com/dfadler/zombie-mermaid/issues/2198).
