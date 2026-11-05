import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useFriends } from '../context/FriendsContext'
import { supabase } from '../lib/supabaseClient'

export function useCommentCounts(itemIds) {
  const { user } = useAuth()
  const { friendIds } = useFriends()
  const idsKey = JSON.stringify([...new Set(itemIds)].sort((a,b) => a-b))
  const scope = `${user?.id}:${JSON.stringify(friendIds)}:${idsKey}`
  const [state, setState] = useState({ scope: '', data: {} })
  useEffect(() => {
    let active = true
    let revision = 0
    async function refresh() {
      if (!user?.id) return
      const request = ++revision
      const ids = JSON.parse(idsKey)
      const rows = []
      try {
        for (let n = 0; n < ids.length; n += 250) {
          const { data, error } = await supabase.rpc('get_item_comment_counts', { item_ids: ids.slice(n,n+250) })
          if (error) throw error
          rows.push(...data)
        }
        if (active && request === revision) setState({ scope, data: Object.fromEntries(rows.map(row => [row.item_id,row.comment_count])) })
      } catch {
        if (active && request === revision) setState({ scope, data: {} })
      }
    }
    refresh()
    const timer = setInterval(() => { if (!document.hidden) refresh() },30000)
    window.addEventListener('focus',refresh)
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus',refresh) }
  }, [scope,idsKey,user?.id])
  return state.scope === scope ? state.data : {}
}
