// @vitest-environment jsdom
/**
 * Direct unit coverage for use-package-manager-install.ts's
 * `usePackageManagerInstall` — split out of nav.tsx's own inline hook
 * (zombie-mermaid#933), whose acceptance criteria specifically calls this
 * out as needing its own tests since it's pure state/DOM-event logic with
 * no JSX.
 *
 * Uses `@testing-library/react`'s `renderHook`, not the
 * render-a-throwaway-component pattern `__tests__/dom/rtl-example.test.ts`
 * documents — that pattern exists for testing a component's rendered
 * behavior; this hook has no markup of its own; `NavInstall`/`HeroInstall`
 * hydration already gets exercised end-to-end by
 * `__tests__/dom/nav-hydration.test.ts` and `__tests__/dom/
 * index-hydration.test.ts`.
 *
 * The clipboard dependency is injected via `env` (see
 * `PackageManagerInstallEnv`'s doc comment) rather than stubbed on
 * `navigator.clipboard` globally — this is exactly what that parameter was
 * added for: testing this hook without touching global `navigator`/jsdom.
 */
import { createElement } from 'react'
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PACKAGE_MANAGERS,
  installCommandFor,
  packageNameFromCommand,
  usePackageManagerInstall,
  type PackageManagerInstallEnv,
} from '../../demo/components/use-package-manager-install.ts'

/** Minimal host wiring `handleCopyKeyDown` to a real DOM element, so a
 * keyboard-activation test can dispatch a genuine `KeyboardEvent` via
 * `fireEvent` instead of hand-assembling a fake one that would need a type
 * assertion to satisfy React's `KeyboardEvent<HTMLSpanElement>` shape. */
function CopyKeyDownHost({ env }: { env?: PackageManagerInstallEnv }) {
  const install = usePackageManagerInstall('npm install zombie-mermaid', env)
  return createElement('span', {
    role: 'button',
    tabIndex: 0,
    onKeyDown: install.handleCopyKeyDown,
  })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('packageNameFromCommand', () => {
  it('strips the npm install prefix', () => {
    expect(packageNameFromCommand('npm install zombie-mermaid')).toBe(
      'zombie-mermaid',
    )
  })

  it('returns a non-npm-phrased command unchanged', () => {
    expect(packageNameFromCommand('yarn add zombie-mermaid')).toBe(
      'yarn add zombie-mermaid',
    )
  })
})

describe('installCommandFor', () => {
  it('uses the install verb for npm', () => {
    expect(installCommandFor('npm', 'zombie-mermaid')).toBe(
      'npm install zombie-mermaid',
    )
  })

  it.each(['pnpm', 'yarn', 'bun'] as const)(
    'uses the add verb for %s',
    (manager) => {
      expect(installCommandFor(manager, 'zombie-mermaid')).toBe(
        `${manager} add zombie-mermaid`,
      )
    },
  )
})

describe('usePackageManagerInstall', () => {
  const COMMAND = 'npm install zombie-mermaid'

  it('defaults to npm, a closed popover, and the given command', () => {
    const { result } = renderHook(() => usePackageManagerInstall(COMMAND))

    expect(result.current.selectedManager).toBe('npm')
    expect(result.current.popoverOpen).toBe(false)
    expect(result.current.copied).toBe(false)
    expect(result.current.displayedCommand).toBe(COMMAND)
  })

  it('always reports the npm form as widestCommand, regardless of selection', () => {
    const { result } = renderHook(() => usePackageManagerInstall(COMMAND))

    act(() => result.current.selectManager('pnpm'))

    expect(result.current.widestCommand).toBe(COMMAND)
    expect(result.current.displayedCommand).toBe('pnpm add zombie-mermaid')
  })

  it('togglePopover opens and closes it', () => {
    const { result } = renderHook(() => usePackageManagerInstall(COMMAND))

    act(() => result.current.togglePopover())
    expect(result.current.popoverOpen).toBe(true)

    act(() => result.current.togglePopover())
    expect(result.current.popoverOpen).toBe(false)
  })

  it('closePopover closes an open popover', () => {
    const { result } = renderHook(() => usePackageManagerInstall(COMMAND))

    act(() => result.current.togglePopover())
    expect(result.current.popoverOpen).toBe(true)

    act(() => result.current.closePopover())
    expect(result.current.popoverOpen).toBe(false)
  })

  it('selectManager updates the selection, closes the popover, and refocuses the trigger', () => {
    const { result } = renderHook(() => usePackageManagerInstall(COMMAND))

    const trigger = document.createElement('span')
    document.body.appendChild(trigger)
    result.current.triggerRef.current = trigger
    const focusSpy = vi.spyOn(trigger, 'focus')

    act(() => result.current.togglePopover())
    expect(result.current.popoverOpen).toBe(true)

    act(() => result.current.selectManager('yarn'))

    expect(result.current.selectedManager).toBe('yarn')
    expect(result.current.popoverOpen).toBe(false)
    expect(focusSpy).toHaveBeenCalled()

    document.body.removeChild(trigger)
  })

  it('covers every PACKAGE_MANAGERS entry via selectManager', () => {
    const { result } = renderHook(() => usePackageManagerInstall(COMMAND))

    for (const manager of PACKAGE_MANAGERS) {
      act(() => result.current.selectManager(manager))
      expect(result.current.selectedManager).toBe(manager)
    }
  })

  it('copyCommand writes the displayed command via an injected clipboard and flashes copied', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      usePackageManagerInstall(COMMAND, { clipboard: { writeText } }),
    )

    await act(async () => {
      result.current.copyCommand()
      await Promise.resolve()
    })

    expect(writeText).toHaveBeenCalledWith(COMMAND)
    expect(result.current.copied).toBe(true)

    act(() => vi.advanceTimersByTime(1200))
    expect(result.current.copied).toBe(false)
  })

  it('copyCommand does nothing when the injected environment has no clipboard', async () => {
    const { result } = renderHook(() =>
      usePackageManagerInstall(COMMAND, { clipboard: undefined }),
    )

    await act(async () => {
      result.current.copyCommand()
    })

    expect(result.current.copied).toBe(false)
  })

  it('handleCopyKeyDown activates copyCommand on Enter and Space, not other keys', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    render(
      createElement(CopyKeyDownHost, { env: { clipboard: { writeText } } }),
    )
    const button = screen.getByRole('button')

    fireEvent.keyDown(button, { key: 'Tab' })
    expect(writeText).not.toHaveBeenCalled()

    await act(async () => {
      fireEvent.keyDown(button, { key: 'Enter' })
    })
    expect(writeText).toHaveBeenCalledTimes(1)

    await act(async () => {
      fireEvent.keyDown(button, { key: ' ' })
    })
    expect(writeText).toHaveBeenCalledTimes(2)
  })
})
