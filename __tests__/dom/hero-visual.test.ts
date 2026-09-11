// @vitest-environment jsdom
/**
 * Dedicated render coverage for `demo/components/hero-visual.tsx`'s
 * `HeroVisual`, split out of `index-app.tsx` (zombie-mermaid#932). Its
 * hydration/visual behavior as part of the real hero is already covered by
 * `__tests__/dom/index-hydration.test.ts`; this just proves the component
 * itself renders the static hero image with its accessible alt text.
 */
import { createElement } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HeroVisual } from '../../demo/components/hero-visual.tsx'

describe('HeroVisual', () => {
  it('renders the hero image pointing at hero-visual.svg', () => {
    render(createElement(HeroVisual))

    const img = screen.getByRole('img', {
      name: /raw mermaid source rendering into a themed, animated diagram/i,
    })
    expect(img).toHaveAttribute('src', 'hero-visual.svg')
  })
})
