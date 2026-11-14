import { useEffect, useRef, useState } from 'react'
import { getMovies } from '../lib/movieApi'
import { MusicCover } from './MusicSearch'

const cache = new Map()
const queue = []
let active = 0
function drain() {
  while (active < 3 && queue.length) {
    active++
    const job = queue.shift()
    job().finally(() => { active--; drain() })
  }
}
function legacyPoster(category, id) {
  const key = `${category}:${id}`
  if (!cache.has(key)) {
    const promise = new Promise(resolve => {
      queue.push(async () => {
        try {
          const data = await getMovies({ id }, undefined, category)
          const media = category === 'dizi' ? data.series : data.movie
          // Existing local API processes may still return only the full poster URL.
          const oldPath = /^https:\/\/image\.tmdb\.org\/t\/p\/w185(\/[a-zA-Z0-9_-]+\.(?:jpg|png|webp))$/.exec(media?.poster || '')?.[1]
          resolve(media?.poster_path || oldPath || null)
        } catch { cache.delete(key); resolve(null) }
      })
    })
    if (cache.size >= 500) cache.delete(cache.keys().next().value)
    cache.set(key, promise)
    drain()
  }
  return cache.get(key)
}

export default function ItemCover({ item }) {
  const root = useRef(null)
  const [legacy, setLegacy] = useState(null)
  const [failed, setFailed] = useState(null)
  const identity = `${item.category}:${item.source_id}`
  const media = item.category === 'film' || item.category === 'dizi'
  const path = item.poster_path || (legacy?.identity === identity ? legacy.path : null)
  const url = media && /^\/[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(path || '') ? `https://image.tmdb.org/t/p/w185${path}` : null
  useEffect(() => {
    if (!media || item.poster_path || item.source !== 'tmdb' || !item.source_id) return
    let cancelled = false
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return
      observer.disconnect()
      legacyPoster(item.category, item.source_id).then(value => {
        if (!cancelled) setLegacy({ identity, path: value })
      })
    }, { rootMargin: '200px' })
    observer.observe(root.current)
    return () => { cancelled = true; observer.disconnect() }
  }, [identity, media, item.category, item.source, item.source_id, item.poster_path])
  if (item.category === 'muzik') return <MusicCover releaseId={item.music_release_id} youtubeId={item.youtube_source_id} />
  return <div ref={root} className={media ? 'item-cover' : 'item-emoji'}>
    {url && failed !== url ? <img src={url} alt={`${item.title} afişi`} width="72" height="108" loading="lazy" decoding="async" onError={() => setFailed(url)} /> : <span aria-hidden="true">{item.emoji}</span>}
  </div>
}
