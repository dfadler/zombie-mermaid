// @vitest-environment jsdom
/**
 * Dedicated render coverage for `demo/components/blog-teaser.tsx`'s
 * `BlogTeaser`, split out of `index-app.tsx` (zombie-mermaid#932).
 */
import { createElement } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BlogTeaser } from '../../demo/components/blog-teaser.tsx'

describe('BlogTeaser', () => {
  it('renders the real newest post, linking to its blog page', () => {
    render(createElement(BlogTeaser))

    expect(screen.getByText('Sep 6, 2026')).toBeInTheDocument()
    const postLink = screen.getByRole('link', {
      name: /294 prs, 14 days/i,
    })
    expect(postLink).toHaveAttribute('href', 'blog/294-prs-14-days.html')

    expect(
      screen.getByRole('link', { name: /read the blog/i }),
    ).toHaveAttribute('href', 'blog/')
  })
})
