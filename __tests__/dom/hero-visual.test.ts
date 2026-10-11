// @vitest-environment jsdom
/**
 * Dedicated render coverage for `demo/components/hero-visual.tsx`'s
 * `HeroVisual`, split out of `index-app.tsx` (zombie-mermaid#932).
 * `IndexHeroApp` no longer renders this component — the homepage hero uses
 * `hero-output-panel.tsx`'s `HeroCodePanel`/`HeroOutputPanel` instead (see
 * `index-app.tsx`'s header comment) — but `HeroVisual` stays, and stays
 * tested, because `scripts/generate-hero.ts` still reads
 * `public/hero-visual.svg` directly as the README's own hero.svg source of
 * truth, and a static `<img>` is the right choice there (GitHub can't run
 * a click-to-toggle). This just proves the component itself still renders
 * that static hero image with its accessible alt text.
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
