import { supabase } from './supabaseClient'
export async function musicApi(params = {}, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Lütfen tekrar giriş yap.')
  const response = await fetch('/api/music?' + new URLSearchParams(params), {
    ...options, headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
  })
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Müzik servisine ulaşılamadı. Yerel sunucuyu yeniden başlat.')
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'İşlem tamamlanamadı.')
  return data
}
