import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useProfiles() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('display_name')
    if (!error) setProfiles(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const byId = Object.fromEntries(profiles.map((p) => [p.id, p]))

  return { profiles, byId, loading, refresh }
}
