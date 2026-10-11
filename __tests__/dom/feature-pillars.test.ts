// @vitest-environment jsdom
/**
 * Dedicated render coverage for `demo/components/feature-pillars.tsx`'s
 * `FeaturePillars`, split out of `index-app.tsx` (zombie-mermaid#932).
 */
import { createElement } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FeaturePillars } from '../../demo/components/feature-pillars.tsx'

describe('FeaturePillars', () => {
  it('renders all three pillar groups with two facts each', () => {
    render(createElement(FeaturePillars))

    expect(
      screen.getByRole('heading', { level: 3, name: 'Output flexibility' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: 'Drop-in architecture' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: 'Proven at scale' }),
    ).toBeInTheDocument()

    // One representative fact per group, proving FEATURE_ICONS/FEATURE_COPY
    // paired up correctly by index.
    expect(
      screen.getByText(/mermaid\.js itself has no real terminal story/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/renders 100\+ diagrams in under 500ms/i),
    ).toBeInTheDocument()
  })
})
