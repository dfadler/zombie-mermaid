// @vitest-environment jsdom
/**
 * Dedicated render coverage for `demo/components/proof-section.tsx`'s
 * `ProofSection`, split out of `index-app.tsx` (zombie-mermaid#932). The
 * slot-reel scroll-in animation is already exhaustively covered via
 * `IndexMainApp` in `__tests__/dom/index-proof-stats.test.ts`; this proves
 * the section's static content — both repos' real snapshot numbers and the
 * fixes-teaser link — renders correctly in isolation.
 */
import { createElement } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProofSection } from '../../demo/components/proof-section.tsx'

describe('ProofSection', () => {
  it('renders both repos’ labels and the real snapshot numbers as accessible text', () => {
    render(createElement(ProofSection))

    expect(screen.getByText('zombie-mermaid (this fork)')).toBeInTheDocument()
    expect(screen.getByText('beautiful-mermaid (upstream)')).toBeInTheDocument()

    // Fork stats: 0 days, 334 merged PRs, 1 open PR.
    expect(screen.getByText('334')).toBeInTheDocument()
    // Upstream stats: 124 days, 13 merged PRs, 37 open PRs.
    expect(screen.getByText('124')).toBeInTheDocument()
    expect(screen.getByText('13')).toBeInTheDocument()
    expect(screen.getByText('37')).toBeInTheDocument()
  })

  it('renders the fixes-teaser card linking to fork-fixes.html', () => {
    render(createElement(ProofSection))

    expect(screen.getByText(/27 documented bugs/i)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /see the evidence/i }),
    ).toHaveAttribute('href', 'fork-fixes.html')
    expect(
      screen.getByRole('link', { name: /live dashboard/i }),
    ).toHaveAttribute('href', 'dashboard.html')
  })
})
