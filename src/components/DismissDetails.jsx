import { useEffect } from 'react'

// Native disclosure panels share the same dismissal behaviour as custom menus.
export default function DismissDetails() {
  useEffect(() => {
    function outside(event) {
      document.querySelectorAll('details[open]').forEach(panel => {
        if (!panel.contains(event.target)) panel.open = false
      })
    }
    function escape(event) {
      if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return
      const panels = [...document.querySelectorAll('details[open]')]
      const focused = panels.findLast(panel => panel.contains(document.activeElement))
      panels.forEach(panel => { panel.open = false })
      focused?.querySelector('summary')?.focus({ preventScroll: true })
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [])
  return null
}
