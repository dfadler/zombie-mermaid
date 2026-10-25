# @zombie-mermaid/cli

The [`zombie-mermaid`](https://www.npmjs.com/package/zombie-mermaid) command-line tool as its own package, so you can run it without installing the library's other entry points:

```bash
npx @zombie-mermaid/cli render diagram.mmd --ascii
npx @zombie-mermaid/cli --help
```

It is the same CLI that ships as the `zombie-mermaid` bin in the umbrella package (one source, `src/cli.ts`), version-locked with the rest. Usage, flags and the `mcp` subcommand: see the [README](../../README.md#cli).

## License

MIT, see [LICENSE](LICENSE).
