/** @jsxRuntime automatic */
/**
 * The MCP panel: an agent tool-call illustration, marked experimental per
 * the README.
 *
 * Split out of `index-app.tsx` into its own file (zombie-mermaid#932).
 */
import type { ReactNode } from 'react'
import { LockIcon, LogoMark, TerminalIcon } from './icons.tsx'
import { Card, Pill } from './primitives.tsx'
import { FORK_URL } from './site-chrome.tsx'
import { FONT_SIZE, FONT_WEIGHT, SPACE, colorVar } from './tokens.tsx'

/** One row of the MCP transcript: an avatar circle beside a message bubble. */
function McpRow({
  avatar,
  bubbleBorder,
  children,
}: {
  avatar: ReactNode
  bubbleBorder: string
  children: ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: `${SPACE.md}px`,
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: '30px',
          height: '30px',
          borderRadius: '50%',
          background: colorVar('--panel-2'),
          border: `1px solid ${colorVar('--border')}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {avatar}
      </div>
      <div
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          background: colorVar('--panel-2'),
          border: `1px solid ${bubbleBorder}`,
          borderRadius: '12px',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: `${SPACE.xs}px`,
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function McpPanel() {
  return (
    <div
      style={{
        flex: '1 1 0',
        display: 'flex',
        flexDirection: 'column',
        gap: `${SPACE.xl}px`,
      }}
    >
      <Card
        accent="violet"
        padding={24}
        style={{
          flex: '1 1 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: `${SPACE.xl}px`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: `${SPACE.md}px`,
          }}
        >
          <Pill
            mono
            fontSize={12.5}
            style={{
              background: colorVar('--panel-2'),
              border: `1px solid ${colorVar('--border')}`,
              color: colorVar('--text-dim'),
              padding: '6px 14px',
            }}
          >
            <LockIcon size={12} strokeWidth={2.2} />
            MCP server
          </Pill>
          <Pill
            accent="amber"
            variant="tint"
            mono
            fontSize={11}
            style={{
              padding: '5px 12px',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Experimental
          </Pill>
        </div>

        <McpRow
          avatar={<TerminalIcon size={16} />}
          bubbleBorder="var(--border)"
        >
          <p
            style={{
              fontSize: `${FONT_SIZE.label}px`,
              color: colorVar('--text-faint'),
            }}
          >
            Your coding agent calls a tool —
          </p>
          <p
            className="mono"
            style={{
              fontSize: `${FONT_SIZE.label}px`,
              color: colorVar('--violet'),
              fontWeight: FONT_WEIGHT.bold,
            }}
          >
            render_mermaid_svg({'{ diagram }'})
          </p>
        </McpRow>

        <McpRow avatar={<LogoMark size={16} />} bubbleBorder="var(--green)">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: `${SPACE.md}px`,
            }}
          >
            <svg
              viewBox="0 0 60 40"
              width="52"
              height="36"
              style={{ flexShrink: 0 }}
            >
              <rect
                x="4"
                y="4"
                width="20"
                height="12"
                rx="4"
                fill="none"
                stroke={colorVar('--blue')}
                strokeWidth="2"
              />
              <path
                d="M14 16 V24 H46 V24"
                stroke={colorVar('--green')}
                strokeWidth="2"
                fill="none"
                className="edge-anim"
              />
              <rect
                x="36"
                y="24"
                width="20"
                height="12"
                rx="4"
                fill="none"
                stroke={colorVar('--green')}
                strokeWidth="2"
              />
            </svg>
            <p style={{ fontSize: '12.5px', color: colorVar('--text-dim') }}>
              …and gets back a rendered SVG, no browser involved.
            </p>
          </div>
        </McpRow>
      </Card>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: `${SPACE.xxs}px`,
        }}
      >
        <h3 style={{ fontSize: '19px' }}>MCP server</h3>
        <p
          style={{
            fontSize: `${FONT_SIZE.body}px`,
            color: colorVar('--text-dim'),
            lineHeight: 1.55,
          }}
        >
          <span className="mono">render_mermaid_svg</span>,{' '}
          <span className="mono">render_mermaid_ascii</span>, and a
          sequence-activation checker, exposed over stdio — embed it, or run{' '}
          <span className="mono">zombie-mermaid mcp</span> directly. Shipped to
          gauge interest, not a finished implementation — the tool surface may
          still change.{' '}
          <a href={`${FORK_URL}#mcp-server`}>Read the MCP docs →</a>
        </p>
      </div>
    </div>
  )
}
