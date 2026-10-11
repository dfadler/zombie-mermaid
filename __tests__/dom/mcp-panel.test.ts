// @vitest-environment jsdom
/**
 * Dedicated render coverage for `demo/components/mcp-panel.tsx`'s
 * `McpPanel`, split out of `index-app.tsx` (zombie-mermaid#932).
 */
import { createElement } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FORK_URL } from '../../demo/components/site-chrome.tsx'
import { McpPanel } from '../../demo/components/mcp-panel.tsx'

describe('McpPanel', () => {
  it('renders the tool-call illustration, the Experimental badge, and the docs link', () => {
    render(createElement(McpPanel))

    expect(
      screen.getByRole('heading', { level: 3, name: 'MCP server' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('MCP server').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Experimental')).toBeInTheDocument()
    expect(
      screen.getByText('render_mermaid_svg({ diagram })'),
    ).toBeInTheDocument()

    const link = screen.getByRole('link', { name: /read the mcp docs/i })
    expect(link).toHaveAttribute('href', `${FORK_URL}#mcp-server`)
  })
})
