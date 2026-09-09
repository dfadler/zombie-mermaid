import { configView, editorView } from './elements.ts'

const sourceToolbar = document.getElementById('source-toolbar')
document.querySelectorAll<HTMLElement>('.tab').forEach(function (tab) {
  tab.addEventListener('click', function () {
    const panel = tab.dataset.panel
    document.querySelectorAll<HTMLElement>('.tab').forEach(function (t) {
      t.classList.remove('active')
    })
    tab.classList.add('active')
    if (panel === 'code') {
      editorView.style.display = 'flex'
      configView.classList.remove('visible')
      if (sourceToolbar) sourceToolbar.style.display = ''
    } else {
      editorView.style.display = 'none'
      configView.classList.add('visible')
      if (sourceToolbar) sourceToolbar.style.display = 'none'
      // zombie-mermaid#808: no more refreshAllColorUIs() call here -- the
      // config view's color fields are now a live React component
      // (demo/components/editor-config.tsx's ConfigPanel) that always
      // reflects current state, whether its CSS class currently hides it
      // or not.
    }
  })
})
