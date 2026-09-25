import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthContext'

const FriendsContext = createContext(null)

export function FriendsProvider({ children }) {
  const { user } = useAuth()
  const userId = user?.id
  const [state, setState] = useState({ rows: [], loading: true, error: null })
  const generation = useRef(0)
  const refresh = useCallback(async () => {
    const current = ++generation.current
    if (!userId) { setState({ rows: [], loading: false, error: null }); return }
    const { data, error } = await supabase.from('friendships').select('*')
      .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`).order('created_at', { ascending: false })
    if (current !== generation.current) return
    setState({ rows: error ? [] : data ?? [], loading: false, error })
  }, [userId])

  useEffect(() => {
    setState({ rows: [], loading: true, error: null })
    refresh()
    const onFocus = () => refresh()
    const timer = setInterval(() => { if (!document.hidden) refresh() }, 30000)
    window.addEventListener('focus', onFocus)
    return () => { generation.current++; clearInterval(timer); window.removeEventListener('focus', onFocus) }
  }, [refresh])

  async function act(name, args) {
    const { error } = await supabase.rpc(name, args)
    await refresh()
    if (error) throw error
  }
  const friendIds = state.rows.filter((row) => row.status === 'accepted')
    .map((row) => row.requester_id === userId ? row.recipient_id : row.requester_id).sort()
  const value = {
    ...state, friendIds, refresh,
    incoming: state.rows.filter((row) => row.status === 'pending' && row.recipient_id === userId),
    relationship: (id) => state.rows.find((row) => row.requester_id === id || row.recipient_id === id),
    send: (id) => act('send_friend_request', { target_id: id }),
    accept: (id) => act('accept_friend_request', { request_id: id }),
    remove: (id) => act('remove_friendship', { request_id: id }),
  }
  return <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>
}

export function useFriends() { return useContext(FriendsContext) }
