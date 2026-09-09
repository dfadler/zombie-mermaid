import { refreshAllColorUIs } from './config-panel.ts'
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
      refreshAllColorUIs()
    }
  })
})
