// @vitest-environment jsdom
/**
 * Dedicated render coverage for `demo/components/hero-install.tsx`'s
 * `HeroInstall`, split out of `index-app.tsx` (zombie-mermaid#932). The
 * package-manager-switch/copy behavior this wraps
 * (`nav.tsx`'s `usePackageManagerInstall`) is already exhaustively covered
 * against `IndexHeroApp` by `__tests__/dom/index-hydration.test.ts`'s
 * "HeroInstall package-manager selector (#902)" suite and against
 * `NavInstall` by `nav-hydration.test.ts`; this only proves the component
 * renders its own default state correctly in isolation.
 */
import { createElement } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HeroInstall } from '../../demo/components/hero-install.tsx'

describe('HeroInstall', () => {
  it('defaults to npm and shows the copy button', () => {
    render(createElement(HeroInstall))

    expect(
      screen.getByRole('button', { name: 'Choose package manager' }),
    ).toHaveTextContent('npm')
    expect(
      screen.getByRole('button', { name: 'Copy install command' }),
    ).toHaveTextContent('npm install zombie-mermaid')
  })
})
