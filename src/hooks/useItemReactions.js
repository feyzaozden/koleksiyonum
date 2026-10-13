import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export function useItemReactions(itemIds) {
  const { user } = useAuth()
  const idsKey = JSON.stringify([...new Set(itemIds)].sort((a, b) => a - b))
  const scope = `${user?.id || ''}:${idsKey}`
  const currentScope = useRef(scope)
  currentScope.current = scope
  const revision = useRef(0)
  const pending = useRef(new Set())
  const [state, setState] = useState({ scope: '', data: {}, error: false })
  const [busy, setBusy] = useState({})

  const refresh = useCallback(async () => {
    if (!user?.id || pending.current.size) return
    const request = ++revision.current
    const ids = JSON.parse(idsKey)
    try {
      const rows = []
      for (let offset = 0; offset < ids.length; offset += 250) {
        const { data, error } = await supabase.rpc('get_item_reactions', { item_ids: ids.slice(offset, offset + 250) })
        if (error) throw error
        rows.push(...(data || []))
      }
      if (request !== revision.current || currentScope.current !== scope) return
      setState({ scope, data: Object.fromEntries(rows.map((row) => [row.item_id, row])), error: false })
    } catch {
      if (request !== revision.current || currentScope.current !== scope) return
      setState((previous) => ({ scope, data: previous.scope === scope ? previous.data : {}, error: true }))
    }
  }, [idsKey, scope, user?.id])

  useEffect(() => {
    const counter = revision
    refresh()
    const onFocus = () => refresh()
    const timer = setInterval(() => { if (document.visibilityState === 'visible') refresh() }, 30000)
    window.addEventListener('focus', onFocus)
    return () => { counter.current++; clearInterval(timer); window.removeEventListener('focus', onFocus) }
  }, [refresh])

  async function react(itemId, value) {
    const pendingKey = `${scope}:${itemId}`
    if (pending.current.has(pendingKey)) return
    pending.current.add(pendingKey)
    revision.current++
    setBusy((previous) => ({ ...previous, [pendingKey]: true }))
    try {
      const { data, error } = await supabase.rpc('set_item_reaction', { target_item_id: itemId, reaction_value: value })
      if (error) throw error
      const row = data?.[0]
      if (!row) throw new Error('Oy kaydedilemedi.')
      if (currentScope.current === scope) {
        setState((previous) => ({ scope, error: previous.scope === scope && previous.error,
          data: { ...(previous.scope === scope ? previous.data : {}), [itemId]: row } }))
      }
    } catch {
      throw new Error('Oy kaydedilemedi. Arkadaşlığını ve bağlantını kontrol edip tekrar dene.')
    } finally {
      pending.current.delete(pendingKey)
      setBusy((previous) => { const next = { ...previous }; delete next[pendingKey]; return next })
    }
  }

  return {
    data: state.scope === scope ? state.data : {},
    error: state.scope === scope && state.error,
    isBusy: (id) => Boolean(busy[`${scope}:${id}`]),
    react, refresh,
  }
}
