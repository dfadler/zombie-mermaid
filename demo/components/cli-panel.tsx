/** @jsxRuntime automatic */
/**
 * The CLI panel: a real transcript using this repo's actual flags.
 *
 * Split out of `index-app.tsx` into its own file (zombie-mermaid#932).
 */
import type { ReactNode } from 'react'
import { FORK_URL } from './site-chrome.tsx'
import { FONT_SIZE, SPACE, colorVar } from './tokens.tsx'

/** One line of the CLI transcript. */
function TermLine({ children }: { children: ReactNode }) {
  return <div>{children}</div>
}

export function CliPanel() {
  return (
    <div
      style={{
        flex: '1 1 0',
        display: 'flex',
        flexDirection: 'column',
        gap: `${SPACE.xl}px`,
      }}
    >
      <div
        className="code-panel-cli"
        style={{
          background: colorVar('--bg'),
          border: `1px solid ${colorVar('--border')}`,
          borderRadius: '14px',
          padding: '22px 26px 26px 26px',
          flex: '1 1 auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: `${SPACE.xs}px`,
            marginBottom: `${SPACE.xl}px`,
          }}
        >
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#ff6767',
              display: 'inline-block',
            }}
          />
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#ffc85c',
              display: 'inline-block',
            }}
          />
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#5ee08a',
              display: 'inline-block',
            }}
          />
          <span
            className="mono"
            style={{
              fontSize: `${FONT_SIZE.caption}px`,
              color: colorVar('--text-faint'),
              marginLeft: `${SPACE.xs}px`,
            }}
          >
            terminal
          </span>
        </div>
        <div className="mono" style={{ fontSize: '13.5px', lineHeight: 1.9 }}>
          <TermLine>
            <span style={{ color: colorVar('--text-faint') }}>$</span>{' '}
            <span style={{ color: colorVar('--text') }}>
              zombie-mermaid render
            </span>{' '}
            <span style={{ color: colorVar('--amber') }}>diagram.mmd</span>{' '}
            <span style={{ color: colorVar('--violet') }}>--theme</span>{' '}
            <span style={{ color: colorVar('--amber') }}>dracula</span>
          </TermLine>
          <div style={{ color: colorVar('--green') }}>✓ wrote diagram.svg</div>
          <div style={{ marginTop: `${SPACE.sm}px` }}>
            <span style={{ color: colorVar('--text-faint') }}>$</span>{' '}
            <span style={{ color: colorVar('--text') }}>
              zombie-mermaid render
            </span>{' '}
            <span style={{ color: colorVar('--amber') }}>diagram.mmd</span>{' '}
            <span style={{ color: colorVar('--violet') }}>--ascii</span>
          </div>
          <div style={{ color: colorVar('--text-dim') }}>┌─────────┐</div>
          <div style={{ color: colorVar('--text-dim') }}>{'│  Start   │'}</div>
          <div style={{ color: colorVar('--text-dim') }}>└────┬────┘</div>
          <div style={{ color: colorVar('--cyan') }}>{'     │'}</div>
          <div style={{ marginTop: `${SPACE.sm}px` }}>
            <span style={{ color: colorVar('--text-faint') }}>$</span>{' '}
            <span style={{ color: colorVar('--text') }}>
              zombie-mermaid mcp
            </span>
          </div>
          <div style={{ color: colorVar('--green') }}>
            ✓ MCP server listening on stdio
          </div>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: `${SPACE.xxs}px`,
        }}
      >
        <h3 style={{ fontSize: '19px' }}>CLI</h3>
        <p
          style={{
            fontSize: `${FONT_SIZE.body}px`,
            color: colorVar('--text-dim'),
            lineHeight: 1.55,
          }}
        >
          Render SVG, ASCII, HTML, or PNG straight from a script or CI job —
          themes, direction overrides, and terminal hyperlinks all pass through
          as flags. <a href={`${FORK_URL}#cli`}>Full flag reference →</a>
        </p>
      </div>
    </div>
  )
}
