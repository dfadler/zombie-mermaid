# @zombie-mermaid/core

Shared types, theme registry (`THEMES`, `DEFAULTS`), color math, diagram-type detection (`detectDiagramType`, `DIAGRAM_TYPES`), and text/statement utilities used by every [`zombie-mermaid`](https://www.npmjs.com/package/zombie-mermaid) renderer.

**Internal package.** It is published so the scope can't be squatted and is version-locked with the rest, but it carries no standalone support commitment and its API may change with any `zombie-mermaid` release. Depend on [`zombie-mermaid`](../../README.md) unless you are building a renderer on the same internals. It has no module-level side effects.

For the public function and options reference see [docs/api-reference.md](../../docs/api-reference.md).

## License

MIT, see [LICENSE](LICENSE).
