import { supabase } from './supabaseClient'

export async function getMovies(params, signal, category = 'film') {
  const label = category === 'dizi' ? 'Dizi' : 'Film'
  const endpoint = category === 'dizi' ? 'series' : 'movies'
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error(`${label} aramak için tekrar giriş yapmalısın.`)
  const response = await fetch(`/api/${endpoint}?${new URLSearchParams(params)}`, {
    headers: { Authorization: `Bearer ${session.access_token}` }, signal,
  })
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error(`${label} araması şu anda kullanılamıyor. Bilgileri elle ekleyebilirsin.`)
  }
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || `${label} araması tamamlanamadı.`)
  return data
}
