// @vitest-environment jsdom
/**
 * Dedicated render coverage for `demo/components/cli-panel.tsx`'s
 * `CliPanel`, split out of `index-app.tsx` (zombie-mermaid#932).
 */
import { createElement } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FORK_URL } from '../../demo/components/site-chrome.tsx'
import { CliPanel } from '../../demo/components/cli-panel.tsx'

describe('CliPanel', () => {
  it('renders the real CLI transcript and the flag-reference link', () => {
    render(createElement(CliPanel))

    expect(screen.getByText('zombie-mermaid mcp')).toBeInTheDocument()
    expect(screen.getByText('✓ wrote diagram.svg')).toBeInTheDocument()
    expect(
      screen.getByText('✓ MCP server listening on stdio'),
    ).toBeInTheDocument()

    const link = screen.getByRole('link', { name: /full flag reference/i })
    expect(link).toHaveAttribute('href', `${FORK_URL}#cli`)
  })
})
