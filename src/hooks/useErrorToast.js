import { useCallback, useRef, useState } from 'react'

export function useErrorToast() {
  const [message, setMessage] = useState(null)
  const timeoutRef = useRef(null)

  const showError = useCallback((msg) => {
    setMessage(msg)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setMessage(null), 3500)
  }, [])

  return [message, showError]
}
