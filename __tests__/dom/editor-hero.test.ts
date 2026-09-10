// @vitest-environment jsdom
/**
 * Dedicated render test for `EditorHero`, split out of `editor-page.tsx`
 * into its own file by zombie-mermaid#935's audit (see that file's header
 * comment). `editor-page.test.ts`/`site-equivalence.test.ts` already cover
 * `<EditorPage>` as a whole; this file pins the hero's own markup in
 * isolation so a future change to it doesn't have to be traced back through
 * the full page.
 */
import { createElement } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  EditorHero,
  HERO_H1_SIZE,
  HERO_H1_SIZE_MOBILE,
} from '../../demo/components/editor-hero.tsx'

describe('EditorHero', () => {
  it('renders a breadcrumb linking home, followed by the current page', () => {
    render(createElement(EditorHero, { homeHref: '/zombie-mermaid/' }))
    const homeLink = screen.getByRole('link', { name: 'Home' })
    expect(homeLink).toHaveAttribute('href', '/zombie-mermaid/')
    expect(screen.getByText('Editor')).toBeInTheDocument()
  })

  it('uses the given homeHref verbatim', () => {
    render(createElement(EditorHero, { homeHref: '../index.html' }))
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute(
      'href',
      '../index.html',
    )
  })

  it('renders the page heading at the desktop hero size', () => {
    render(createElement(EditorHero, { homeHref: '/' }))
    const heading = screen.getByRole('heading', {
      level: 1,
      name: 'Write Mermaid, watch it render as you type.',
    })
    expect(heading.className).toBe('page-h1')
    expect(heading.style.fontSize).toBe(`${HERO_H1_SIZE}px`)
  })

  it('exports distinct desktop and mobile hero sizes', () => {
    // Pinned as a regression guard: editor-page.tsx's editorPageCss() media
    // queries key off these two exported constants for `.page-h1` -- if
    // they ever collapsed to the same value, the mobile breakpoint would
    // silently stop doing anything.
    expect(HERO_H1_SIZE).not.toBe(HERO_H1_SIZE_MOBILE)
    expect(HERO_H1_SIZE_MOBILE).toBeLessThan(HERO_H1_SIZE)
  })

  it('renders the descriptive lead paragraph', () => {
    render(createElement(EditorHero, { homeHref: '/' }))
    expect(
      screen.getByText(/Write Mermaid, watch it render as you type\./),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/A live SVG preview, 15 switchable themes/),
    ).toBeInTheDocument()
  })
})
