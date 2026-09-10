// @vitest-environment jsdom
/**
 * Dedicated render coverage for `demo/components/why-fork-section.tsx`'s
 * `WhyForkExistsSection`, split out of `index-app.tsx` (zombie-mermaid#932).
 */
import { createElement } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WhyForkExistsSection } from '../../demo/components/why-fork-section.tsx'

describe('WhyForkExistsSection', () => {
  it('renders the three fork-only callouts and the fork-fixes link', () => {
    render(createElement(WhyForkExistsSection))

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /what zombie-mermaid adds on top/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: 'A real CLI binary' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: 'mergeEdges' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: 'Real bugs, actually fixed',
      }),
    ).toBeInTheDocument()

    const link = screen.getByRole('link', {
      name: /see every fix, before and after/i,
    })
    expect(link).toHaveAttribute('href', 'fork-fixes.html')
  })
})
