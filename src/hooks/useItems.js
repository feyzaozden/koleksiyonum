import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useFriends } from '../context/FriendsContext'
import { validateItemDates, itemYearError } from '../utils/itemDates'
import { itemWriteMessage } from '../utils/itemIdentity'

export function useItems(scope = 'circle', ownerId = null) {
  const { user } = useAuth()
  const friends = useFriends()
  const allowedIds = scope === 'mine' ? [user?.id].filter(Boolean)
    : friends.loading || friends.error ? [] : [user?.id, ...friends.friendIds].filter(Boolean)
  // Profile views rely on database RLS; the circle/IMDb feed remains friends-only.
  const selectedIds = scope === 'profile' ? (user && ownerId ? [ownerId] : []) : ownerId ? allowedIds.filter((id) => id === ownerId) : allowedIds
  const idsKey = JSON.stringify(selectedIds)
  const accessKey = scope === 'profile' ? JSON.stringify(friends.friendIds) : ''
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
    const onFocus = () => refresh()
    const timer = scope === 'profile' ? setInterval(() => { if (!document.hidden) refresh() }, 30000) : null
    if (scope === 'profile') window.addEventListener('focus', onFocus)
    const counter = version
    return () => { counter.current++; clearInterval(timer); window.removeEventListener('focus', onFocus) }
  }, [refresh, scope, accessKey])

  async function addItem(payload) {
    const yearError = itemYearError(payload.year)
    if (yearError) throw new Error(yearError)
    validateItemDates(payload)
    let data
    if (payload.source_id != null) {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Lütfen tekrar giriş yap.')
      const response = await fetch('/api/items', {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Kayıt servisine ulaşılamadı.')
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'İçerik eklenemedi.')
      data = body.item
    } else {
      const { source_id: unusedSourceId, ...manual } = payload
      void unusedSourceId
      const result = await supabase.from('items').insert(manual).select().single()
      if (result.error) throw new Error(itemWriteMessage(result.error))
      data = result.data
    }
    setItems((prev) => [data, ...prev])
    return data
  }

  async function updateItem(id, patch) {
    const yearError = itemYearError(patch.year)
    if (yearError) throw new Error(yearError)
    if ('start_date' in patch || 'end_date' in patch) {
      validateItemDates({ ...items.find((item) => item.id === id), ...patch })
    }
    const { data, error } = await supabase.from('items').update(patch).eq('id', id).select().single()
    if (error) throw new Error(itemWriteMessage(error))
    setItems((prev) => prev.map((i) => (i.id === id ? data : i)))
    return data
  }

  async function deleteItem(id) {
    const { error } = await supabase.from('items').delete().eq('id', id)
    if (error) throw error
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  async function importItems(entries) {
    const { data, error } = await supabase.rpc('import_collection_items', { entries })
    if (error) throw new Error('Liste eklenemedi. Bağlantını ve toplu ekleme kurulumunu kontrol et.')
    await refresh()
    return data || []
  }

  return { items: items.filter((item) => selectedIds.includes(item.user_id)), loading, error, refresh, addItem, updateItem, deleteItem, importItems }
}
