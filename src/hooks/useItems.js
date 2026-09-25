import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useFriends } from '../context/FriendsContext'

export function useItems(scope = 'circle', ownerId = null) {
  const { user } = useAuth()
  const friends = useFriends()
  const allowedIds = scope === 'mine' ? [user?.id].filter(Boolean)
    : friends.loading || friends.error ? [] : [user?.id, ...friends.friendIds].filter(Boolean)
  const selectedIds = ownerId ? allowedIds.filter((id) => id === ownerId) : allowedIds
  const idsKey = JSON.stringify(selectedIds)
  const version = useRef(0)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    const request = ++version.current
    setLoading(true)
    const ids = JSON.parse(idsKey)
    if (!ids.length) { setItems([]); setLoading(false); setError(null); return }
    const { data, error } = await supabase.from('items').select('*').in('user_id', ids).order('added_at', { ascending: false })
    if (request !== version.current) return
    if (error) { setItems([]); setError(error) }
    else { setItems(data ?? []); setError(null) }
    setLoading(false)
  }, [idsKey])

  useEffect(() => {
    refresh()
    const counter = version
    return () => { counter.current++ }
  }, [refresh])

  async function addItem(payload) {
    const { data, error } = await supabase.from('items').insert(payload).select().single()
    if (error) throw error
    setItems((prev) => [data, ...prev])
    return data
  }

  async function updateItem(id, patch) {
    const { data, error } = await supabase.from('items').update(patch).eq('id', id).select().single()
    if (error) throw error
    setItems((prev) => prev.map((i) => (i.id === id ? data : i)))
    return data
  }

  async function deleteItem(id) {
    const { error } = await supabase.from('items').delete().eq('id', id)
    if (error) throw error
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  return { items: items.filter((item) => selectedIds.includes(item.user_id)), loading, error, refresh, addItem, updateItem, deleteItem }
}
