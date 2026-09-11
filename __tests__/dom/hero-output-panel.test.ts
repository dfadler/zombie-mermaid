// @vitest-environment jsdom
/**
 * Dedicated render coverage for `demo/components/hero-output-panel.tsx`'s
 * `HeroCodePanel`/`HeroOutputPanel` — the components that replaced
 * `HeroVisual` as the homepage hero's own visual (see `index-app.tsx`'s
 * header comment). `HeroOutputPanel`'s hydration as part of the real hero
 * is already covered by `__tests__/dom/index-hydration.test.ts`, against a
 * fixture `asciiHtml`; this file proves the component's own behavior in
 * isolation — the toggle actually switches content, and (the drift guard)
 * that `HERO_MERMAID_SOURCE`'s real rendered output still matches what
 * `HeroCodePanel`'s hand-colored display claims it will.
 */
import { createElement } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { asciiToHtml } from '../../ascii-html.ts'
import {
  HERO_MERMAID_SOURCE,
  HeroCodePanel,
  HeroOutputPanel,
} from '../../demo/components/hero-output-panel.tsx'

describe('HeroCodePanel', () => {
  it('renders the fake Mermaid source, including the animate:true metadata', () => {
    // Each line is several sibling text nodes/spans (for per-token color),
    // so there's no single element whose own text equals a token like
    // "Deploy?}" -- assert against the panel's combined text instead of
    // querying for an element that doesn't exist.
    const { container } = render(createElement(HeroCodePanel))
    const text = container.textContent ?? ''

    expect(text).toContain('graph TD')
    expect(text).toContain('Start e1@--> Deploy{Deploy?}')
    expect(text).toContain('Deploy e2@-->|yes| Ship[Ship it]')
    expect(text).toContain('Deploy e3@-->|no| Iterate[Iterate]')
    expect(text).toContain('e1@{ animate: true }')
  })
})

describe('HeroOutputPanel', () => {
  it('defaults to the SVG diagram, and switching to ASCII shows the real render', async () => {
    const asciiHtml = asciiToHtml(
      renderMermaidASCII(HERO_MERMAID_SOURCE, { colorMode: 'none' }).replace(
        /[ \t]+$/gm,
        '',
      ),
    )
    render(createElement(HeroOutputPanel, { asciiHtml }))

    expect(
      screen.getByRole('img', {
        name: /start leads to a deploy decision/i,
      }),
    ).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'ASCII' }))

    expect(
      screen.queryByRole('img', {
        name: /start leads to a deploy decision/i,
      }),
    ).not.toBeInTheDocument()
    // Drift guard: proves the real renderMermaidASCII(HERO_MERMAID_SOURCE)
    // output actually contains the same node labels HeroCodePanel's
    // hand-colored source claims, not just that *some* ASCII text appears.
    expect(screen.getByText(/Ship it/)).toBeInTheDocument()
    expect(screen.getByText(/Iterate/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'SVG' }))
    expect(
      screen.getByRole('img', {
        name: /start leads to a deploy decision/i,
      }),
    ).toBeInTheDocument()
  })
})
