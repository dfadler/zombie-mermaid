# MCP directory listings (#1958)

Status: **draft for maintainer review. Nothing has been submitted.** No account, form, PR
or login on any third-party site. Verified 2026-10-29 by reading each directory's own pages
(fetched text treated as data). Rules: [`outreach-rules.md`](outreach-rules.md) (listings are
submissions, not thread comments, but the same go-ahead rule applies: the maintainer submits).

Facts to reuse: seven tools ([`../mcp-tools.md`](../mcp-tools.md)), MIT, stdio via
`npx -y zombie-mermaid mcp`, npm `zombie-mermaid` (latest 5.11.2 on 2026-10-29), marked
experimental in the README. Dependencies #1539 (docs) and #1565 (outputPath review) are closed.

## State since the 2026-10-22 prep

- `mcpName` (`io.github.dfadler/zombie-mermaid`) is in `package.json` **and in the published
  5.11.2** (`npm view zombie-mermaid mcpName`), so the Official Registry step is no longer
  blocked on a release.
- `glama.json` is already at the repo root (from #2277).
- Registry search `…/v0.1/servers?search=zombie-mermaid` returns no servers; Glama
  `glama.ai/mcp/servers/dfadler/zombie-mermaid` is 404. Not listed anywhere checked.

## Verified routes

| Directory             | Route (verified)                                                                                                                                                                                                                                                                                 | Needs                                                                                                                   | Status                                                                                                                                                                                             | Source                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Official MCP Registry | `mcp-publisher login github`, then `publish`; free; preview, may reset                                                                                                                                                                                                                           | npm package with `mcpName` equal to `server.json` `name`; GitHub auth forces `io.github.dfadler/` prefix; `server.json` | **Ready.** Owner runs it (device-flow login)                                                                                                                                                       | [quickstart](https://modelcontextprotocol.io/registry/quickstart), [package types](https://modelcontextprotocol.io/registry/package-types.md) |
| PulseMCP              | **Submissions and changes paused** (page dated 2026-09-03); page says publish to the Official Registry first, and registry servers are picked up automatically after reopening                                                                                                                   | Registry entry                                                                                                          | **Blocked**; do not email or chase                                                                                                                                                                 | [pulsemcp.com/submit](https://www.pulsemcp.com/submit)                                                                                        |
| Glama                 | Listing is not automatic; claim ownership via `glama.json` (`$schema`, `maintainers`) plus the Claim flow. Personal-account repos can claim by GitHub login instead                                                                                                                              | `glama.json` (present)                                                                                                  | **Ready, logged-in owner step.** I could not read Glama's add/score/Docker docs (`/mcp/servers` is JS-shell only); check the dialog                                                                | [glama.json blog](https://glama.ai/blog/2025-07-08-what-is-glamajson)                                                                         |
| Smithery              | Hosted: public HTTPS Streamable-HTTP URL (web `smithery.ai/new` or `smithery mcp publish <url> -n @org/name`). Local stdio: a `.mcpb` bundle (`smithery mcp publish ./server.mcpb -n org/name`). No `smithery.yaml` on the current page (legacy). No fees stated                                 | A `.mcpb` bundle and a Smithery account                                                                                 | **Blocked** on [#2453](https://github.com/dfadler/zombie-mermaid/issues/2453) (build and ship a `.mcpb`, a new release artifact). Hosting an HTTP endpoint is out of scope for a stdio-only server | [docs](https://smithery.ai/docs/build/publish)                                                                                                |
| mcpservers.org        | Web form `mcpservers.org/submit`. Fields: server name, category (dropdown incl. Design, Development), short description, repo/website/docs link, optional Official Registry name, remote checkbox, contact email. Free ($0, ~2 weeks) or Premium ($39 one-time, ~24h, badge, priority, dofollow) | Owner's email, a submit click                                                                                           | **Ready**, Free plan. Do not pay for Premium without a decision                                                                                                                                    | [submit](https://mcpservers.org/submit)                                                                                                       |

## Repo files: what to add

- **`glama.json`**: already present, standard, no change.
- **`mcpName`**: already present and published.
- **`server.json`: not added.** It is version-pinned (`version` and `packages[].version` must
  match the npm release), so a committed copy goes stale every release unless the release flow
  rewrites it, and `mcp-publisher` only needs it at publish time. Recommend the owner generates
  it with `mcp-publisher init` in a scratch directory (or we automate via the registry's
  [GitHub Actions guide](https://modelcontextprotocol.io/registry/github-actions.md) as a
  separate decision). Draft below; replace `X.Y.Z` with the released version.
- **`smithery.yaml`**: not added (not in current docs).

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "io.github.dfadler/zombie-mermaid",
  "description": "Render Mermaid diagrams to SVG or ASCII art, validate syntax, and fix sequence activations.",
  "repository": {
    "url": "https://github.com/dfadler/zombie-mermaid",
    "source": "github"
  },
  "version": "X.Y.Z",
  "packages": [
    {
      "registryType": "npm",
      "identifier": "zombie-mermaid",
      "version": "X.Y.Z",
      "transport": { "type": "stdio" },
      "packageArguments": [{ "type": "positional", "value": "mcp" }]
    }
  ]
}
```

Unverified: the docs pages I read do not show `packageArguments` (it is from the schema as I
remember it). Without it the entry would launch `zombie-mermaid` with no `mcp` argument, so
validate against the `$schema` and check `mcp-publisher publish` output before relying on it.

## Paste-ready text

Official Registry description (<= one sentence):

> Render Mermaid diagrams to SVG or ASCII art, validate syntax, and fix sequence activations.

mcpservers.org form:

- Server Name: `zombie-mermaid`
- Category: Design (Development is the alternative)
- Short Description: `Render Mermaid diagrams to SVG or ASCII/Unicode art without a browser: seven tools for rendering, validating and fixing diagrams. MIT, stdio, experimental.`
- Link: `https://github.com/dfadler/zombie-mermaid`
- Official MCP Registry Name: `io.github.dfadler/zombie-mermaid` (fill in only after the registry publish)
- Remote connections: unchecked (stdio only)
- Plan: Free

Claims to avoid: "official", "verified", "production ready" (README says experimental),
popularity numbers, "matches mermaid.js" without a named version, file-write safety beyond what
[`SECURITY.md`](../../SECURITY.md) states.

## Order

1. Owner: `mcp-publisher init`, edit per the draft, `login github`, `publish`; verify with
   `curl 'https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.dfadler/zombie-mermaid'`.
2. Owner: Glama claim by GitHub login (or `glama.json`).
3. Owner: mcpservers.org Free form, with the registry name from step 1.
4. PulseMCP: nothing to do; it ingests from the registry after it reopens.
5. Smithery: wait for the packaging decision in [#2453](https://github.com/dfadler/zombie-mermaid/issues/2453) (`.mcpb` bundle, hosted HTTPS, or skip).
