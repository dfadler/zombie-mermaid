/** @jsxRuntime automatic */
/**
 * CLI + MCP: not just a browser library. Composes `CliPanel`
 * (`cli-panel.tsx`) and `McpPanel` (`mcp-panel.tsx`) side by side.
 *
 * Split out of `index-app.tsx` into its own file (zombie-mermaid#932).
 */
import { CliPanel } from './cli-panel.tsx'
import { McpPanel } from './mcp-panel.tsx'
import { SectionEyebrow } from './primitives.tsx'
import {
  FONT_SIZE,
  LAYOUT,
  LETTER_SPACING,
  SECTION_SPACE,
  SPACE,
  colorVar,
} from './tokens.tsx'

export function CliMcpSection() {
  return (
    <div
      className="section-px"
      style={{
        padding: `${SECTION_SPACE.loose}px ${LAYOUT.gutter.desktop}px`,
        background: colorVar('--bg-soft'),
        borderTop: `1px solid ${colorVar('--border')}`,
        borderBottom: `1px solid ${colorVar('--border')}`,
      }}
    >
      <div
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: `0 auto ${SPACE['6xl']}px auto`,
          display: 'flex',
          flexDirection: 'column',
          gap: `${SPACE.xl}px`,
        }}
      >
        <SectionEyebrow>Not just a browser library</SectionEyebrow>
        <h2 style={{ fontSize: '38px', letterSpacing: LETTER_SPACING.heading }}>
          A real CLI. A real MCP server.
        </h2>
        <p
          style={{
            fontSize: `${FONT_SIZE.lead}px`,
            color: colorVar('--text-dim'),
            maxWidth: `${LAYOUT.proseMaxWidth}px`,
          }}
        >
          Render from a terminal, a CI pipeline, or hand it straight to your
          coding agent as a tool call — this isn't a browser-only diagram
          widget.
        </p>
      </div>

      <div
        className="cli-mcp-row"
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'stretch',
          gap: `${SPACE['5xl']}px`,
        }}
      >
        <CliPanel />
        <McpPanel />
      </div>
    </div>
  )
}
