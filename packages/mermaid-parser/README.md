# @zombie-mermaid/mermaid-parser

Per-type Mermaid parsers (class, ER, sequence, XY chart, pie, C4, architecture) plus the flowchart/state parser, and the sequence-diagram activation check (`checkActivationBalance`) and fixer (`fixActivationBalance`) behind the MCP server's [`check_`/`fix_mermaid_sequence_activations`](../../docs/mcp-tools.md) tools. Both the SVG and ASCII renderers import these parse functions directly.

**Internal package.** Published and version-locked with the rest, but with no standalone support commitment; its API may change with any `zombie-mermaid` release. Depend on [`zombie-mermaid`](../../README.md) unless you are building on the same internals. Depends only on `@zombie-mermaid/core`.

## License

MIT, see [LICENSE](LICENSE).
