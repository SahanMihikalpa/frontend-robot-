import { useState } from 'react'

// Keyword search uses the YouTube Data API (needs a key). Pasting a link/ID always
// works without one. Set NEXT_PUBLIC_YOUTUBE_API_KEY in the frontend env to enable search.
const API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY

type Video = { id: string; title: string; thumb?: string }

// Handy starting points (also work as examples). Swappable.
const QUICK_PICKS: Video[] = [
  { id: 'jfKfPfyJRdk', title: '🎧 Lofi beats' },
  { id: 'inpok4MKVLM', title: '🧘 5-min meditation' },
  { id: 'Rzcwmg7NfMw', title: '🤸 Desk stretch' },
]

function parseYouTubeId(input: string): string | null {
  const s = input.trim()
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s
  const m = s.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

function decodeEntities(s: string): string {
  if (typeof document === 'undefined') return s
  const el = document.createElement('textarea')
  el.innerHTML = s
  return el.value
}

/** Watch a rest video — search YouTube for anything (songs, lofi, stretches…),
 *  paste a link, or tap a quick pick. */
export default function RestVideo() {
  const [playing, setPlaying] = useState<Video>(QUICK_PICKS[0])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Video[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setError('')

    // Paste-a-link path — always works, no API key needed.
    const pasted = parseYouTubeId(q)
    if (pasted) { setPlaying({ id: pasted, title: 'Your video' }); setResults([]); return }

    if (!API_KEY) {
      setError('Keyword search needs a YouTube API key — paste a YouTube link here instead to play it.')
      return
    }
    setSearching(true)
    try {
      const url = 'https://www.googleapis.com/youtube/v3/search'
        + '?part=snippet&type=video&videoEmbeddable=true&safeSearch=moderate&maxResults=9'
        + `&q=${encodeURIComponent(q)}&key=${API_KEY}`
      const res = await fetch(url)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message || 'Search failed')
      const items: Video[] = (data.items || [])
        .map((it: any) => ({ id: it.id?.videoId, title: decodeEntities(it.snippet?.title || 'Untitled'), thumb: it.snippet?.thumbnails?.medium?.url }))
        .filter((v: Video) => v.id)
      setResults(items)
      if (items.length === 0) setError('No results — try different words.')
    } catch (err: any) {
      setError(err?.message || 'Search failed — check the API key.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="break-video">
      <div className="break-video-frame">
        <iframe
          key={playing.id}
          src={`https://www.youtube.com/embed/${playing.id}?rel=0&modestbranding=1`}
          title={playing.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>

      <form className="break-video-search" onSubmit={onSubmit}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search YouTube, or paste a video link…"
          aria-label="Search YouTube or paste a link"
        />
        <button type="submit" className="btn" disabled={searching || !query.trim()}>
          {searching ? '…' : 'Search'}
        </button>
      </form>

      {error && <p className="meta break-video-hint">{error}</p>}

      {results.length > 0 ? (
        <div className="break-video-results">
          {results.map((v) => (
            <button key={v.id} className="break-video-result" onClick={() => setPlaying(v)} title={v.title}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {v.thumb && <img src={v.thumb} alt="" />}
              <span>{v.title}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="break-video-list">
          {QUICK_PICKS.map((v) => (
            <button
              key={v.id}
              className={`btn ghost small ${v.id === playing.id ? 'active' : ''}`}
              onClick={() => setPlaying(v)}
            >
              {v.title}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
