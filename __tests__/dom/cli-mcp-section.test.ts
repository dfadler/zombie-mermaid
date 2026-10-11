// @vitest-environment jsdom
/**
 * Dedicated render coverage for `demo/components/cli-mcp-section.tsx`'s
 * `CliMcpSection`, split out of `index-app.tsx` (zombie-mermaid#932). Proves
 * it composes `CliPanel` and `McpPanel` (each already covered on their own
 * in `cli-panel.test.ts`/`mcp-panel.test.ts`) side by side under one
 * heading.
 */
import { createElement } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CliMcpSection } from '../../demo/components/cli-mcp-section.tsx'

describe('CliMcpSection', () => {
  it('renders the section heading plus both the CLI and MCP panels', () => {
    render(createElement(CliMcpSection))

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /a real cli\. a real mcp server\./i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: 'CLI' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: 'MCP server' }),
    ).toBeInTheDocument()
  })
})
