# @zombie-mermaid/mcp

[Model Context Protocol](https://modelcontextprotocol.io/) server exposing [`zombie-mermaid`](https://www.npmjs.com/package/zombie-mermaid)'s SVG and ASCII rendering as six tools. Most people run it through the umbrella package (`npx zombie-mermaid mcp`); see the [README's MCP Server section](../../README.md#mcp-server) for client config.

```ts
import { createMcpServer } from '@zombie-mermaid/mcp'

const server = createMcpServer() // not connected; pass it any MCP Transport
```

- Tool arguments, return shapes and `outputPath` rules: [docs/mcp-tools.md](../../docs/mcp-tools.md).
- Trust model (the caller and the diagram text are untrusted; file writes are confined to the working directory): [SECURITY.md](../../SECURITY.md).

**Internal package.** Published and version-locked with the rest, but the supported entry point is `zombie-mermaid mcp` / `zombie-mermaid/mcp`.

## License

MIT, see [LICENSE](LICENSE).
