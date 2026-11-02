import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { startActivityPresence } from '../utils/activityPresence'

export default function ActivityTracker() {
  const { user } = useAuth()
  const userId = user?.id
  useEffect(() => {
    if (!userId) return
    return startActivityPresence({ send: () => supabase.rpc('record_activity_presence') })
  }, [userId])
  return null
}
