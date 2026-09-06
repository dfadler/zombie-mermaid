# Research: direct niche rivals — agentic-mermaid and Pretty-mermaid-skills

Status: **research, not a decision.** Written for [#542](https://github.com/dfadler/zombie-mermaid/issues/542),
split from the broader competitive-landscape pass in [#536](https://github.com/dfadler/zombie-mermaid/issues/536).
Everything below was compiled directly from each project's live repo/docs/license
files and zombie-mermaid's own current source (`src/mcp/`, `README.md`,
`package.json`) as of 2026-09-06 — not copied from the issue body or #536's report.

## TL;DR

- **agentic-mermaid is the closest rival that exists today**, and its `verify`
  /`describe`/`mutate` MCP tools are not merely adjacent to
  [#539](https://github.com/dfadler/zombie-mermaid/issues/539) — they are a
  shipped, public implementation of the exact same problem #539 proposes to
  prototype. #539 should evaluate agentic-mermaid's typed
  parse→mutate→verify→serialize loop before writing new code, not build blind.
- **License risk is a non-issue.** beautiful-mermaid, agentic-mermaid, and
  obsidian-beautiful-mermaid are all plain MIT with no copyleft/share-alike
  clause. Convergent independent implementation triggers zero obligation;
  zombie-mermaid's existing README Attribution section already discharges the
  only obligation MIT actually imposes (preserve the copyright/permission
  notice on code actually copied).
- **skills.sh: worth a thin, low-cost presence — not a parallel product.**
  Pretty-mermaid-skills' traction (1,186 stars, 3.8K skills.sh installs) is
  real signal that a skill-marketplace audience exists that zombie-mermaid
  currently doesn't reach at all, but it's a small slice even of that
  channel's own leaderboard. The cheap move is a thin `SKILL.md` wrapper
  around the already-published `zombie-mermaid` npm CLI/MCP server — not
  bundling a second copy of the renderer the way Pretty-mermaid-skills does.

---

## 1. Feature/architecture comparison vs agentic-mermaid

### What agentic-mermaid actually is

[`adewale/agentic-mermaid`](https://github.com/adewale/agentic-mermaid) is a
GitHub-recorded **fork of `lukilabs/beautiful-mermaid`** (confirmed via
`gh api repos/adewale/agentic-mermaid` → `"fork":true,"parent":"lukilabs/beautiful-mermaid"`),
50 stars, last pushed 2026-08-31, published to npm as `agentic-mermaid`. Per
its own README and `docs/comparison.md` (fetched directly), it layers three
things on top of what it inherited from beautiful-mermaid:

1. **A typed edit loop**: `parseRegisteredMermaid` → family narrower
   (`asFlowchart`, `asSequenceDiagram`, …) → `mutate({kind: ...})` →
   `verifyMermaid` (structured warnings, 3 tiers, plus perceptual quality
   metrics) → `serializeMermaid` (lossless round-trip: unmodeled syntax is
   preserved verbatim rather than dropped). Output is asserted
   byte-identical across runs, CI-gated.
2. **More output formats**: SVG, PNG (offline via resvg, no browser), ASCII/
   Unicode (via a bundled/extended [`mermaid-ascii`](https://github.com/AlexanderGrooff/mermaid-ascii)
   engine, credited in its Attribution section), and JSON positioned layout.
3. **A Style + Palette system**: composable named "looks" (`watercolor`,
   `blueprint`, `hand-drawn`, `publication-figure`, plus sketch/accessibility/
   print/operational/physical-media/architecture/editorial variants) stacked
   over a palette, alongside the two-color/Shiki-compatible theming it
   inherited from beautiful-mermaid.

Distribution: a CLI (`am`, with `capabilities --json` self-discovery, JSONL
batch, exit codes, `preview --open`), a self-hosted stdio MCP server
(`agentic-mermaid-mcp`, tools: `execute` — a Code Mode sandbox — plus
`describe_sdk`, `render_png`, `describe`), an optional HTTP/SSE transport, and
a **hosted, unauthenticated MCP endpoint** at `agentic-mermaid.dev/mcp`
exposing `execute`, `describe_sdk`, `render_svg`, `render_ascii`, `render_png`,
`verify`, `describe`, `mutate`, `build` (64 KB input cap, PNG returned as
base64 only). Requires Node ≥ 22, ESM-only (no CJS build).

### What zombie-mermaid actually ships today

Read directly from `src/mcp/server.ts` and `src/mcp/tools/*.ts` in this repo:
the MCP server (`zombie-mermaid mcp`) registers exactly **two tools**,
`render_mermaid_svg` and `render_mermaid_ascii` — thin adapters around the
library's own `renderMermaidSVG`/`renderMermaidASCII`, nothing else. The
README (`README.md:156-160`) labels this **"Experimental — shipped to gauge
interest, not a finished or best-effort implementation."** There is no PNG
tool, no `verify`, no `describe`, no `mutate`, no `build`, no sandboxed
`execute`, and no typed parse/mutate/serialize API of any kind — MCP callers
and library callers alike only get a render-in, string-out call.

Elsewhere, zombie-mermaid's actual current feature set (from `README.md`):
6 diagram types (flowchart, state, sequence, class, ER, XY charts), SVG +
ASCII/Unicode dual output, fully synchronous rendering (`renderMermaidSVG`/
`renderMermaidASCII`, no async required), 15 built-in themes, Shiki/VS Code
theme compatibility, live CSS-variable theme switching, a 2-color "mono
mode," zero DOM dependencies, and a CLI (`zombie-mermaid render` with
`--svg`/`--ascii`/`--html`, `--theme`, `--direction`, `--hyperlinks`,
`--resolve-colors`). `package.json` declares `"type": "module"` with a CJS
`main` (`dist/index.cjs`) plus an `exports` map — i.e. zombie-mermaid ships
**both** ESM and CJS, unlike agentic-mermaid's ESM-only build.

### Side-by-side

| | zombie-mermaid (actual, today) | agentic-mermaid (actual, today) |
|---|---|---|
| Relationship to beautiful-mermaid | Fork ("the fork that won't stay buried") | Fork, same upstream |
| Diagram types | 6: flowchart, state, sequence, class, ER, XY chart | "Registry-backed subset" per its own capabilities command — not confirmed to be a superset or subset of the same 6; explicitly does **not** cover mindmap/gitgraph (inherited `mermaid-ascii` limitation) |
| Output formats | SVG, ASCII/Unicode | SVG, PNG (offline resvg), ASCII/Unicode, JSON layout |
| Rendering model | Synchronous, zero-DOM | Synchronous, zero-DOM (same lineage) |
| Theming | 15 built-in themes, 2-color foundation, Shiki-compatible, mono mode, live CSS-var switching | Same 2-color/Shiki foundation, **plus** a Style+Palette layer of named "looks" (watercolor, blueprint, hand-drawn, etc.) stacked over palettes |
| Typed edit/mutation API | **None** — render-only | **Yes** — `parseRegisteredMermaid`/narrowers/`mutate`/`verifyMermaid`/`serializeMermaid`, lossless round-trip, CI-gated byte-identical determinism |
| MCP tool surface | 2 tools: `render_mermaid_svg`, `render_mermaid_ascii` (explicitly labeled experimental/first-cut in the README) | Self-hosted: `execute` (sandboxed Code Mode), `describe_sdk`, `render_png`, `describe`. Hosted endpoint adds `render_svg`, `render_ascii`, `verify`, `mutate`, `build` |
| CLI | `zombie-mermaid render/themes` | `am` with `capabilities --json`, JSONL batch, `mutate --op`, `preview --open` |
| Module format | ESM + CJS (`"type":"module"`, CJS `main`, `exports` map) | ESM-only, Node ≥ 22 |
| Attribution/license | MIT, credits beautiful-mermaid + ASCII-engine origins | MIT, credits beautiful-mermaid + `mermaid-ascii` (Alexander Grooff) |

### The #539 overlap — confirmed, not speculative

[#539](https://github.com/dfadler/zombie-mermaid/issues/539) proposes
prototyping "an MCP tool call that checks a Mermaid diagram for semantic
issues beyond syntax … and optionally proposes a fix." agentic-mermaid's
`verify` tool (structural warnings across 3 tiers plus perceptual quality
metrics, spanning all registered families) and its `mutate`/`describe` tools
are a **shipped implementation of exactly this**, sitting behind a typed
`parseRegisteredMermaid` → narrower → `mutate` → `verifyMermaid` →
`serializeMermaid` pipeline that guarantees the fix never silently drops
unmodeled syntax. #539's own issue body already flags this
("Important — check before building: agentic-mermaid already ships adjacent
MCP tools in this exact space"); this research confirms the flag is accurate
and the overlap is direct, not superficial. Recommendation for whoever picks
up #539: benchmark against agentic-mermaid's `verify`/`mutate` behavior on a
shared set of diagrams before designing zombie-mermaid's own tool, and decide
explicitly whether the differentiator is a different verification strategy
(e.g. the LLM/VLM-judged approach #539 also cites) or genuinely overlapping
scope not worth duplicating.

---

## 2. License terms — beautiful-mermaid, agentic-mermaid, obsidian-beautiful-mermaid

Fetched each repository's actual `LICENSE` file via `gh api …/contents/LICENSE`
(not inferred from a badge or README claim):

| Repo | License | Copyright holder | Copyleft/share-alike? |
|---|---|---|---|
| `lukilabs/beautiful-mermaid` | MIT | Craft Docs, 2026 | None |
| `adewale/agentic-mermaid` | MIT | Craft Docs, 2026 (unchanged from upstream — the fork did not add its own copyright line) | None |
| `timk75/obsidian-beautiful-mermaid` | MIT | Tim Kaiser, 2026 (independent copyright, not a GitHub-recorded fork) | None |

All three are the standard MIT template: permission to use/copy/modify/merge/
publish/distribute/sublicense/sell, conditioned only on preserving "the above
copyright notice and this permission notice" in copies or substantial
portions of the software, with the usual "AS IS" warranty disclaimer. None
carry a copyleft, share-alike, NOTICE-file, or patent-grant clause of any
kind.

**Implication for convergence risk:** if zombie-mermaid's own rendering
techniques independently arrive at something similar to what agentic-mermaid
or beautiful-mermaid does, that convergence carries **zero license
obligation** — MIT restricts only the redistribution of the licensed code
itself, not independent reimplementation of the same idea. The only
obligation MIT actually imposes — preserving the copyright/permission notice
on code that *is* copied — is already discharged for the code zombie-mermaid
already inherited: its README's existing "Attribution" section credits both
`beautiful-mermaid` and the ASCII rendering engine's origins, and its own
`LICENSE` is MIT. No new action is needed unless a future change literally
copies source from `agentic-mermaid` or `obsidian-beautiful-mermaid` — in
which case the copied file(s) need the same notice-preservation treatment
already given to the original beautiful-mermaid attribution.

---

## 3. skills.sh distribution channel — recommendation

### What Pretty-mermaid-skills actually has

[`imxv/Pretty-mermaid-skills`](https://github.com/imxv/Pretty-mermaid-skills):
1,186 GitHub stars, 62 forks, MIT, built directly on beautiful-mermaid (per
its own README "Acknowledgments"). It bundles its own Node.js CLI scripts
(`scripts/render.mjs`, `scripts/batch.mjs`, `scripts/themes.mjs`) wrapping
beautiful-mermaid, distributed as an installable skill via
`npx skills add imxv/pretty-mermaid-skills@pretty-mermaid -g -y` — no MCP
server, no typed edit API; it competes purely as a packaged skill, not a
protocol server. Its own listing page on skills.sh (fetched directly) shows:
**3.8K installs**, first seen 2026-01-30, and per-scanner security-audit
badges of "Gen Agent Trust Hub: Pass, Socket: Warn, Snyk: Warn" — i.e. the
platform surfaces automated-scanner warnings publicly on the listing itself.

### What skills.sh is, mechanically

skills.sh (fetched directly) is an open-source marketplace/registry for
agent skills: `npx skills add <owner/repo>` installs a skill for supported
agents (Claude Code, Cursor, GitHub Copilot, etc.); a public leaderboard
ranks skills by install count and 8-week activity (All Time / Trending /
Hot). For scale context, the platform's own top entries ("find-skills" at
3.3M installs, "grill-me" at 1.1M) are roughly three orders of magnitude
above Pretty-mermaid-skills' 3.8K.

### Cost/benefit for zombie-mermaid

**Benefit side:** Pretty-mermaid-skills' 1,186 stars is the single highest
traction figure surfaced across both the #536 research pass and this one —
notably higher than zombie-mermaid's own current reach (722 npm downloads/
month over the last measured 30-day window, no existing skills.sh listing at
all, confirmed via `curl https://api.npmjs.org/downloads/point/last-month/zombie-mermaid`
and a repo-wide `find … -iname SKILL.md` turning up only the internal
`verify-ascii-terminal` dev skill, not a distributable one). That's real
evidence a meaningfully-sized audience discovers mermaid-rendering tooling
through the skill-marketplace channel specifically, separate from anyone
already using MCP or npm.

**Cost side, and why it should stay bounded:** Pretty-mermaid-skills'
approach — bundling its own copy of the rendering pipeline inside the skill
package — is the expensive version: a second entry point to keep in sync
with the library, a second place bugs get filed, and (per its own listing)
public Socket/Snyk "Warn" flags that a project takes on by shipping code
through a scanner-audited channel. zombie-mermaid does not need to repeat
that shape: it already publishes a working CLI (`zombie-mermaid render`) and
an MCP server via npm, so a skill wrapper can be a thin `SKILL.md` plus a
couple of example invocations of the *existing* published binary/MCP server,
not a parallel bundled implementation. That keeps the marginal engineering
cost low (no new rendering code, no second maintenance surface) while still
buying presence in a channel zombie-mermaid currently has zero visibility
in — and even 3.8K installs would be a ~5x increase over current npm
download volume if any meaningful fraction transferred.

Against that: skills.sh's own leaderboard shows 3.8K installs is a small
slice even within that one channel (roughly 0.1% of the top listing's
install count), and zombie-mermaid's MCP server is explicitly still
"experimental — shipped to gauge interest" per its own README — spreading a
thin maintainer's attention across a third public distribution surface
(npm, MCP, now skills.sh) before the second one has matured is a real
opportunity cost, not a free option.

**Recommendation: yes, but scoped and low-priority.** Publish a minimal
`SKILL.md`-based wrapper around the already-published `zombie-mermaid` npm
CLI/MCP tools (not a bundled reimplementation) as a backlog item, not urgent
work — treat it as a low-cost additional front door, revisit priority once
the MCP server itself graduates past "experimental," and do not attempt to
match Pretty-mermaid-skills' theme-gallery/batch-CLI feature surface
one-for-one inside the skill package itself; that duplication is exactly the
cost this recommendation is trying to avoid.

---

## Sources

- https://github.com/adewale/agentic-mermaid (README, `docs/comparison.md`, `LICENSE` — fetched via `gh api`)
- https://github.com/lukilabs/beautiful-mermaid (`LICENSE`, repo metadata — fetched via `gh api`)
- https://github.com/timk75/obsidian-beautiful-mermaid (`LICENSE`, repo metadata — fetched via `gh api`)
- https://github.com/imxv/Pretty-mermaid-skills (README, repo metadata — fetched via `gh api`)
- https://www.skills.sh/imxv/pretty-mermaid-skills/pretty-mermaid (install count, security-audit badges)
- https://skills.sh (platform mechanics, leaderboard)
- `src/mcp/server.ts`, `src/mcp/tools/render-svg.ts`, `src/mcp/tools/render-ascii.ts`, `README.md`, `package.json` (this repo, read directly)
- https://github.com/dfadler/zombie-mermaid/issues/539
- https://github.com/dfadler/zombie-mermaid/issues/536
