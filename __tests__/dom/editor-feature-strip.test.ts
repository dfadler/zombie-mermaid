// @vitest-environment jsdom
/**
 * Dedicated render test for `EditorFeatureStrip`, split out of
 * `editor-page.tsx` into its own file by zombie-mermaid#935's audit (see
 * that file's header comment). `editor-page.test.ts`/
 * `site-equivalence.test.ts` already cover `<EditorPage>` as a whole; this
 * file pins the feature strip's own markup in isolation.
 */
import { createElement } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EditorFeatureStrip } from '../../demo/components/editor-feature-strip.tsx'

const FEATURE_TITLES = [
  'Live, debounced rendering',
  'Shareable via URL',
  '15 built-in themes',
  'One-click SVG export',
]

describe('EditorFeatureStrip', () => {
  it('renders the eyebrow and section heading', () => {
    render(createElement(EditorFeatureStrip))
    expect(
      screen.getByText('Everything a mermaid.live user expects'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Built to be the fast, shareable way to draft a diagram.',
      }),
    ).toBeInTheDocument()
  })

  it('renders all four canvas features, in canvas order', () => {
    const { container } = render(createElement(EditorFeatureStrip))
    const headings = container.querySelectorAll('.editor-features-grid h3')
    expect(Array.from(headings).map((h) => h.textContent)).toEqual(
      FEATURE_TITLES,
    )
  })

  it('renders exactly one card per feature, each with an icon and description', () => {
    const { container } = render(createElement(EditorFeatureStrip))
    const grid = container.querySelector('.editor-features-grid')
    expect(grid?.children).toHaveLength(FEATURE_TITLES.length)
    // Every card renders an <svg> icon ahead of its heading/description.
    expect(
      container.querySelectorAll('.editor-features-grid svg'),
    ).toHaveLength(FEATURE_TITLES.length)
  })

  it('describes the live-rendering feature', () => {
    render(createElement(EditorFeatureStrip))
    expect(
      screen.getByText(/no explicit "run" button, no full page reload\./),
    ).toBeInTheDocument()
  })
})
