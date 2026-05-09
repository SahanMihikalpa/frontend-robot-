import { useEffect, useRef, useState } from 'react'
import { analyzeVisualEngagement, getEngagementSummary, getCurrentUser } from '../lib/api'

export default function EngagementPage() {
  const [user, setUser] = useState<any>(null)
  const [summary, setSummary] = useState<any>(null)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [capturing, setCapturing] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const u = await getCurrentUser()
        setUser(u)
        if (u?.id) {
          const s = await getEngagementSummary(u.id)
          setSummary(s)
        }
      } catch {
        // ignore
      }
    }
    load()

    return () => stopCapture()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function startCapture() {
    setError('')
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera not available')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCapturing(true)
      captureLoop()
    } catch (err: any) {
      setError(err?.message || 'Failed to start camera')
    }
  }

  function stopCapture() {
    setCapturing(false)
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }

  async function captureLoop() {
    if (!capturing) return
    if (!videoRef.current) {
      rafRef.current = requestAnimationFrame(captureLoop)
      return
    }

    const video = videoRef.current
    const w = video.videoWidth || 640
    const h = video.videoHeight || 480
    if (!canvasRef.current) {
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      canvasRef.current = c
    }
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(video, 0, 0, w, h)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
      const b64 = dataUrl.replace(/^data:image\/(png|jpeg);base64,/, '')
      // send but don't await to keep loop smooth
      analyzeVisualEngagement({ user_id: user?.id || 0, session_id: `session-${Date.now()}`, frame_data: b64 })
        .then((res) => setResult(res))
        .catch(() => {})
    }

    rafRef.current = requestAnimationFrame(captureLoop)
  }

  return (
    <div className="grid-two">
      <section className="card stack">
        <div className="section-title">
          <h2>Engagement</h2>
          <span className="badge">Visual (live)</span>
        </div>
        <p className="meta">Start your webcam to send periodic frames for visual engagement analysis.</p>

        <div className="video-wrap">
          <video ref={videoRef} playsInline muted style={{ width: '100%', borderRadius: 6, background: '#000' }} />
        </div>

        <div className="row">
          <button className="btn" onClick={startCapture} disabled={capturing}>Start Camera</button>
          <button className="btn" onClick={stopCapture} disabled={!capturing}>Stop Camera</button>
        </div>

        {error && <p style={{ color: '#fca5a5' }}>{error}</p>}
      </section>

      <aside className="card stack">
        <h3>Latest Result</h3>
        <p className="meta">Recent engagement analysis from last sent frame</p>
        <pre style={{ maxHeight: 480, overflow: 'auto' }}>{JSON.stringify(summary || result || {}, null, 2)}</pre>
      </aside>
    </div>
  )
}
