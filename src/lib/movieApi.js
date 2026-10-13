import { supabase } from './supabaseClient'

export async function getMovies(params, signal) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Film aramak için tekrar giriş yapmalısın.')
  const response = await fetch(`/api/movies?${new URLSearchParams(params)}`, {
    headers: { Authorization: `Bearer ${session.access_token}` }, signal,
  })
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Film araması şu anda kullanılamıyor. Bilgileri elle ekleyebilirsin.')
  }
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Film araması tamamlanamadı.')
  return data
}
