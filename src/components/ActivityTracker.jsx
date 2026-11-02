import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { startActivityPresence } from '../utils/activityPresence'
import { createSiteOpenReporter } from '../utils/siteOpen'

export default function ActivityTracker() {
  const { user } = useAuth()
  const userId = user?.id
  useEffect(() => {
    if (!userId) return
    const reportOpen = createSiteOpenReporter(supabase)
    return startActivityPresence({ send: async () => {
      const results = await Promise.allSettled([reportOpen(), supabase.rpc('record_activity_presence')])
      return { error: results.some(result => result.status === 'rejected' || result.value?.error) }
    } })
  }, [userId])
  return null
}
