// @ts-check
/// <reference lib="dom" />
// ============================================================================
// Client script for the CLI's self-contained HTML viewer (`render --html`).
//
// Inlined verbatim into the viewer page by src/cli/html-viewer.ts (imported
// with Vite's `?raw`), so this file must stay plain browser JavaScript: no
// imports, no TypeScript syntax, no build step. It is checked by tsc via
// `// @ts-check` + JSDoc and linted like any other source file.
//
// This script ships only inside the HTML *viewer file* the CLI writes. It is
// not — and must never become — part of the library's SVG output, which
// stays script-free by decision (docs/decisions/no-script-interactivity.md).
// ============================================================================

;(() => {
  const stage = document.getElementById('stage')
  const diagram = document.getElementById('diagram')
  const svg = diagram ? diagram.querySelector('svg') : null
  const zoomLabel = document.getElementById('zoom')
  const themeButton = document.getElementById('theme')
  if (!stage || !diagram || !svg || !zoomLabel || !themeButton) return

  const MIN_SCALE = 0.05
  const MAX_SCALE = 40
  const KEY_PAN_STEP = 40
  const KEY_PAN_STEP_FAST = 160

  let scale = 1
  let tx = 0
  let ty = 0

  // -- Geometry ---------------------------------------------------------

  // Assigned as `const ... = () => {}` rather than `function` declarations
  // from here through stageCenter (and release/setMode further below):
  // these all read stage/diagram/svg/zoomLabel/themeButton, which the
  // guard above narrowed from `T | null` to `T` — a narrowing that only
  // survives for a function *expression* defined after the guard, not a
  // hoisted `function` declaration (tsc can't rule out the declaration
  // being invoked, in theory, before the guard runs).

  /** Natural (unscaled) size of the diagram, from the root's width/height or viewBox. */
  const naturalSize = () => {
    const w = Number(svg.getAttribute('width'))
    const h = Number(svg.getAttribute('height'))
    if (w > 0 && h > 0) return { w, h }
    const vb = svg.viewBox.baseVal
    if (vb && vb.width > 0 && vb.height > 0)
      return { w: vb.width, h: vb.height }
    const r = diagram.getBoundingClientRect()
    return { w: r.width / scale || 1, h: r.height / scale || 1 }
  }

  /** @param {number} s */
  function clampScale(s) {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))
  }

  const apply = () => {
    diagram.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`
    zoomLabel.textContent = `${Math.round(scale * 100)}%`
  }

  /**
   * Zoom by `factor` keeping the stage point (cx, cy) fixed under the cursor.
   * @param {number} factor
   * @param {number} cx
   * @param {number} cy
   */
  function zoomAt(factor, cx, cy) {
    const next = clampScale(scale * factor)
    const k = next / scale
    tx = cx - (cx - tx) * k
    ty = cy - (cy - ty) * k
    scale = next
    apply()
  }

  const fit = () => {
    const r = stage.getBoundingClientRect()
    const { w, h } = naturalSize()
    scale = clampScale(Math.min(r.width / w, r.height / h) * 0.95)
    tx = (r.width - w * scale) / 2
    ty = (r.height - h * scale) / 2
    apply()
  }

  const oneToOne = () => {
    const r = stage.getBoundingClientRect()
    const { w, h } = naturalSize()
    scale = 1
    tx = Math.max(0, (r.width - w) / 2)
    ty = Math.max(0, (r.height - h) / 2)
    apply()
  }

  const stageCenter = () => {
    const r = stage.getBoundingClientRect()
    return { x: r.width / 2, y: r.height / 2 }
  }

  // -- Wheel: plain scroll pans; ctrl/cmd + wheel (which is also what a
  //    trackpad pinch produces) zooms around the cursor. -------------------

  stage.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      const r = stage.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) {
        zoomAt(
          Math.exp(-e.deltaY * 0.01),
          e.clientX - r.left,
          e.clientY - r.top,
        )
      } else {
        tx -= e.deltaX
        ty -= e.deltaY
        apply()
      }
    },
    { passive: false },
  )

  // -- Pointers: one pointer drags, two pinch-zoom around their midpoint. --

  /** @type {Map<number, {x: number, y: number}>} */
  const pointers = new Map()
  /** @type {{dist: number, mid: {x: number, y: number}} | null} */
  let lastPinch = null

  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    stage.setPointerCapture(e.pointerId)
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    stage.classList.add('dragging')
  })

  stage.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId)
    if (!prev) return
    const current = { x: e.clientX, y: e.clientY }
    pointers.set(e.pointerId, current)
    if (pointers.size === 1) {
      tx += current.x - prev.x
      ty += current.y - prev.y
      apply()
      return
    }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      if (!a || !b) return
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      if (lastPinch && lastPinch.dist > 0) {
        const r = stage.getBoundingClientRect()
        zoomAt(dist / lastPinch.dist, mid.x - r.left, mid.y - r.top)
        tx += mid.x - lastPinch.mid.x
        ty += mid.y - lastPinch.mid.y
        apply()
      }
      lastPinch = { dist, mid }
    }
  })

  /** @param {PointerEvent} e */
  const release = (e) => {
    pointers.delete(e.pointerId)
    if (pointers.size < 2) lastPinch = null
    if (pointers.size === 0) stage.classList.remove('dragging')
  }
  stage.addEventListener('pointerup', release)
  stage.addEventListener('pointercancel', release)

  stage.addEventListener('dblclick', (e) => {
    const r = stage.getBoundingClientRect()
    zoomAt(scale < 1 ? 1 / scale : 2, e.clientX - r.left, e.clientY - r.top)
  })

  // -- Theme: follows prefers-color-scheme until the user toggles, unless
  //    the page was generated with an explicit --theme (data-theme preset). --

  const root = document.documentElement
  const darkMedia = matchMedia('(prefers-color-scheme: dark)')
  let userChose = root.dataset.themeSource === 'theme'

  function currentMode() {
    const preset = root.dataset.theme
    if (preset === 'dark' || preset === 'light') return preset
    return darkMedia.matches ? 'dark' : 'light'
  }

  /** @param {'light' | 'dark'} mode */
  const setMode = (mode) => {
    root.dataset.theme = mode
    themeButton.textContent = mode === 'dark' ? 'Light' : 'Dark'
    themeButton.setAttribute('aria-pressed', String(mode === 'dark'))
    themeButton.setAttribute(
      'aria-label',
      `Switch to ${mode === 'dark' ? 'light' : 'dark'} mode (T)`,
    )
  }

  function toggleMode() {
    userChose = true
    setMode(currentMode() === 'dark' ? 'light' : 'dark')
  }

  darkMedia.addEventListener('change', () => {
    if (!userChose) {
      delete root.dataset.theme
      setMode(currentMode())
      delete root.dataset.theme
    }
  })
  // Reflect the initial mode on the button without pinning it: leave
  // data-theme unset for system mode so a later OS change still applies.
  themeButton.textContent = currentMode() === 'dark' ? 'Light' : 'Dark'
  themeButton.setAttribute('aria-pressed', String(currentMode() === 'dark'))

  // -- Buttons -------------------------------------------------------------

  /**
   * @param {string} id
   * @param {() => void} handler
   */
  function onClick(id, handler) {
    const el = document.getElementById(id)
    if (el) el.addEventListener('click', handler)
  }
  onClick('zoom-in', () => {
    const c = stageCenter()
    zoomAt(1.25, c.x, c.y)
  })
  onClick('zoom-out', () => {
    const c = stageCenter()
    zoomAt(0.8, c.x, c.y)
  })
  onClick('fit', fit)
  onClick('one', oneToOne)
  onClick('theme', toggleMode)

  // -- Keyboard (stage must be focused; it has tabindex=0) -----------------

  stage.addEventListener('keydown', (e) => {
    const c = stageCenter()
    const step = e.shiftKey ? KEY_PAN_STEP_FAST : KEY_PAN_STEP
    switch (e.key) {
      case '+':
      case '=':
        zoomAt(1.25, c.x, c.y)
        break
      case '-':
      case '_':
        zoomAt(0.8, c.x, c.y)
        break
      case '0':
        fit()
        break
      case '1':
        oneToOne()
        break
      case 'ArrowLeft':
        tx += step
        apply()
        break
      case 'ArrowRight':
        tx -= step
        apply()
        break
      case 'ArrowUp':
        ty += step
        apply()
        break
      case 'ArrowDown':
        ty -= step
        apply()
        break
      case 't':
      case 'T':
        toggleMode()
        break
      default:
        return
    }
    e.preventDefault()
  })

  fit()
  stage.focus({ preventScroll: true })
})()
