// No input contents, route URLs or keystrokes are collected.
export function startActivityPresence({ send, doc = document, win = window, now = Date.now }) {
  let active = true
  let dirty = !doc.hidden
  let inFlight = false
  let lastSent = -Infinity
  async function flush() {
    if (!active || doc.hidden || !dirty || inFlight || now() - lastSent < 60000) return
    dirty = false
    inFlight = true
    lastSent = now()
    try {
      const result = await send()
      if (result?.error) dirty = true
    } catch { dirty = true }
    finally { inFlight = false }
  }
  function interacted(event) {
    if (event.isTrusted && !doc.hidden) dirty = true
  }
  function visible() {
    if (!doc.hidden) { dirty = true; flush() }
  }
  for (const event of ['pointerdown', 'keydown', 'scroll']) doc.addEventListener(event, interacted, { passive: true })
  doc.addEventListener('visibilitychange', visible)
  win.addEventListener('focus', visible)
  const timer = win.setInterval(flush, 60000)
  flush()
  return () => {
    active = false
    win.clearInterval(timer)
    for (const event of ['pointerdown', 'keydown', 'scroll']) doc.removeEventListener(event, interacted)
    doc.removeEventListener('visibilitychange', visible)
    win.removeEventListener('focus', visible)
  }
}
