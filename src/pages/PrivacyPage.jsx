import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { DEFAULT_PRIVACY } from '../constants/privacy'
import PrivacyContent from '../components/PrivacyContent'

export default function PrivacyPage() {
  const [policy, setPolicy] = useState(null)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => { window.scrollTo(0, 0) }, [])
  useEffect(() => {
    let active = true
    async function refresh() {
      try {
        const { data, error } = await supabase.rpc('get_privacy_policy')
        if (!active) return
        // Preserve the existing page until the migration is installed.
        if (error?.code === 'PGRST202') { setPolicy(DEFAULT_PRIVACY); setError(false); return }
        if (error || !data) throw new Error('load')
        setPolicy(data); setError(false)
      } catch { if (active) setError(true) }
    }
    refresh()
    window.addEventListener('focus', refresh)
    return () => { active = false; window.removeEventListener('focus', refresh) }
  }, [retry])
  return <main className="privacy-page">
    <Link to="/">← Koleksiyonum’a dön</Link>
    <h1>{policy?.title || 'Gizlilik Politikası'}</h1>
    {error && <p role="alert">Güncel metin yüklenemedi. <button onClick={() => setRetry(n => n + 1)}>Tekrar dene</button></p>}
    {!policy && !error && <p role="status">Yükleniyor…</p>}
    {policy && <PrivacyContent body={policy.body} />}
  </main>
}
