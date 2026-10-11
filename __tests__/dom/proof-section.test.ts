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
import dashboardData from '../../demo/dashboard-data.json' with { type: 'json' }
import { daysSince } from '../../demo/dashboard-model.ts'
import { ProofSection } from '../../demo/components/proof-section.tsx'

describe('ProofSection', () => {
  it('renders both repos’ labels and the real snapshot numbers as accessible text', () => {
    render(createElement(ProofSection))

    expect(screen.getByText('zombie-mermaid (this fork)')).toBeInTheDocument()
    expect(screen.getByText('beautiful-mermaid (upstream)')).toBeInTheDocument()

    const { fork, upstream, generatedAt } = dashboardData
    expect(screen.getByText(String(fork.mergedPRs))).toBeInTheDocument()
    expect(
      screen.getByText(String(daysSince(upstream.lastPushedAt, generatedAt))),
    ).toBeInTheDocument()
    expect(screen.getByText(String(upstream.mergedPRs))).toBeInTheDocument()
    expect(screen.getByText(String(upstream.openPRs))).toBeInTheDocument()
  })

  it('renders the fixes-teaser card linking to fork-fixes.html', () => {
    render(createElement(ProofSection))

    expect(
      screen.getAllByText(
        new RegExp(`${dashboardData.rescued.totalFixes} documented bugs`, 'i'),
      ).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getByRole('link', { name: /see the evidence/i }),
    ).toHaveAttribute('href', 'fork-fixes.html')
    expect(
      screen.getByRole('link', { name: /live dashboard/i }),
    ).toHaveAttribute('href', 'dashboard.html')
  })
})
