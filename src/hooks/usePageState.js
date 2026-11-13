import { useCallback, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function usePageState(name, initial) {
  const location = useLocation()
  const { user } = useAuth()
  const key = `page-state:${user?.id}:${location.state?.restoreKey || location.key}:${location.pathname}:${name}`
  const [value, setValue] = useState(() => {
    try { const saved = sessionStorage.getItem(key); return saved === null ? initial : JSON.parse(saved) } catch { return initial }
  })
  const update = useCallback((next) => {
    setValue(previous => {
      const result = typeof next === 'function' ? next(previous) : next
      try { sessionStorage.setItem(key, JSON.stringify(result)) } catch { /* Storage can be unavailable. */ }
      return result
    })
  }, [key])
  return [value, update]
}
