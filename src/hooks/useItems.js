import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useItems() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('items').select('*').order('added_at', { ascending: false })
    if (error) setError(error)
    else { setItems(data ?? []); setError(null) }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
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

  return { items, loading, error, refresh, addItem, updateItem, deleteItem }
}
