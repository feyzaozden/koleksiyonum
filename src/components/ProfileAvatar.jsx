import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { PHOTO_BUCKET } from '../utils/profilePhoto'

export default function ProfileAvatar({ profile, compact = false }) {
  const path = profile?.avatar_path
  const [photo, setPhoto] = useState(null)
  useEffect(() => {
    let active = true
    let url
    setPhoto(null)
    if (path) supabase.storage.from(PHOTO_BUCKET).download(path).then(({ data, error }) => {
      if (!active || error) return
      url = URL.createObjectURL(data)
      setPhoto({ path, url })
    }).catch(() => {})
    return () => { active = false; if (url) URL.revokeObjectURL(url) }
  }, [path])
  return <span className={'profile-avatar' + (compact ? ' profile-avatar-compact' : '')} aria-hidden="true">
    {photo?.path === path && photo ? <img src={photo.url} alt="" onError={() => setPhoto(null)} /> : profile?.avatar_emoji || '📚'}
  </span>
}
