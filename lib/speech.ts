import { useCallback, useEffect, useRef, useState } from 'react'
import { apiClient } from './api'

/**
 * Read-aloud for tutor messages.
 *
 * Primary: the browser's built-in speechSynthesis — on-device, offline, instant,
 * free, and works over plain HTTP (unlike the mic, which needs HTTPS).
 * Fallback: POST /api/v1/voice/tts, used only when the browser reports no
 * English voices (typically Chrome/Firefox on Linux, which ship none).
 */

const MD_NOISE = /[*_#`>|~]+/g
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}\u{FE0F}\u{2B00}-\u{2BFF}]/gu

/** Strip markdown decoration + emoji so the voice reads clean prose. */
export function speakable(text: string): string {
  return (text || '')
    .replace(EMOJI, ' ')
    .replace(MD_NOISE, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function englishVoices(): SpeechSynthesisVoice[] {
  try {
    return window.speechSynthesis.getVoices().filter((v) => (v.lang || '').toLowerCase().startsWith('en'))
  } catch {
    return []
  }
}

function pickVoice(): SpeechSynthesisVoice | null {
  const vs = englishVoices()
  if (!vs.length) return null
  // Prefer the natural-sounding OS voices where available.
  const preferred = ['Google US English', 'Microsoft Aria', 'Microsoft Zira', 'Samantha', 'Microsoft David']
  for (const p of preferred) {
    const hit = vs.find((v) => v.name.includes(p))
    if (hit) return hit
  }
  return vs.find((v) => v.default) || vs[0]
}

/** Chrome cuts off long utterances (~15s), so speak sentence-sized chunks. */
function chunkText(text: string, max = 180): string[] {
  const parts = text.match(/[^.!?]+[.!?]*\s*/g) || [text]
  const out: string[] = []
  let cur = ''
  for (const p of parts) {
    if (cur && (cur + p).length > max) { out.push(cur.trim()); cur = p }
    else cur += p
  }
  if (cur.trim()) out.push(cur.trim())
  return out.filter(Boolean)
}

export function useSpeech(rate = 1.05) {
  const [supported, setSupported] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null)
  const hasVoicesRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const tokenRef = useRef(0)

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    setSupported(true)
    const load = () => {
      voiceRef.current = pickVoice()
      hasVoicesRef.current = englishVoices().length > 0
    }
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load)
      try { window.speechSynthesis.cancel() } catch { /* ignore */ }
    }
  }, [])

  // Chrome pauses the queue on long runs — a periodic resume keeps it alive.
  useEffect(() => {
    if (!speaking) return
    const iv = setInterval(() => {
      try { if (window.speechSynthesis.speaking) window.speechSynthesis.resume() } catch { /* ignore */ }
    }, 8000)
    return () => clearInterval(iv)
  }, [speaking])

  const stop = useCallback(() => {
    tokenRef.current++
    try { window.speechSynthesis?.cancel() } catch { /* ignore */ }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setSpeaking(false)
  }, [])

  /** Server-side fallback for clients with no installed voices. */
  const speakViaServer = useCallback(async (text: string, token: number) => {
    try {
      const { data } = await apiClient.post('/api/v1/voice/tts', { text: text.slice(0, 2000) },
        { responseType: 'blob' })
      if (token !== tokenRef.current) return
      const url = URL.createObjectURL(data)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => { URL.revokeObjectURL(url); setSpeaking(false) }
      audio.onerror = () => { URL.revokeObjectURL(url); setSpeaking(false) }
      await audio.play()
    } catch {
      setSpeaking(false)
    }
  }, [])

  const speak = useCallback((raw: string) => {
    const text = speakable(raw)
    if (!text || typeof window === 'undefined') return
    stop()
    const token = ++tokenRef.current
    setSpeaking(true)

    if (!('speechSynthesis' in window) || !hasVoicesRef.current) {
      // No on-device voices (e.g. Chrome on Linux) → ask the server to speak it.
      void speakViaServer(text, token)
      return
    }

    const chunks = chunkText(text)
    chunks.forEach((c, i) => {
      const u = new SpeechSynthesisUtterance(c)
      if (voiceRef.current) u.voice = voiceRef.current
      u.lang = voiceRef.current?.lang || 'en-US'
      u.rate = rate
      u.pitch = 1
      if (i === chunks.length - 1) {
        u.onend = () => { if (token === tokenRef.current) setSpeaking(false) }
        u.onerror = () => { if (token === tokenRef.current) setSpeaking(false) }
      }
      try { window.speechSynthesis.speak(u) } catch { /* ignore */ }
    })
  }, [rate, stop, speakViaServer])

  return { supported, speaking, speak, stop }
}
