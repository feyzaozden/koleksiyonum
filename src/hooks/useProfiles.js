import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { usernameSearch } from '../utils/username'

export function useProfiles({ search = '', ids = null, page = 0 } = {}) {
  const idsKey = ids === null ? null : JSON.stringify(ids)
  const [state, setState] = useState({ profiles: [], loading: true, error: null, hasMore: false })
  const version = useRef(0)
  const refresh = useCallback(async () => {
    const request = ++version.current
    setState({ profiles: [], loading: true, error: null, hasMore: false })
    let query = supabase.from('profiles').select('id, display_name, username, avatar_emoji, avatar_path, bio').order('username').order('id')
    if (idsKey !== null) {
      const selected = JSON.parse(idsKey)
      if (!selected.length) { setState({ profiles: [], loading: false, error: null, hasMore: false }); return }
      query = query.in('id', selected)
    } else {
      const term = usernameSearch(search).replace(/[\\%_]/g, '\\$&')
      if (term) query = query.ilike('username', `%${term}%`)
      query = query.range(page * 24, page * 24 + 24)
    }
    const { data, error } = await query
    if (request !== version.current) return
    setState({ profiles: error ? [] : (idsKey === null ? data.slice(0, 24) : data), loading: false, error, hasMore: idsKey === null && data?.length > 24 })
  }, [search, idsKey, page])
  useEffect(() => {
    refresh()
    const counter = version
    return () => { counter.current++ }
  }, [refresh])
  const byId = Object.fromEntries(state.profiles.map((p) => [p.id, p]))
  return { ...state, byId, refresh }
}
