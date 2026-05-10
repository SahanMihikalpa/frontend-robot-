import { useEffect, useRef, useState } from 'react'
import { analyzeVisualEngagement, getEngagementSummary, getCurrentUser } from '../lib/api'

type EngagementMetrics = {
  eye_contact_ratio?: number
  head_pose_score?: number
  engagement_score?: number
  engagement_level?: string
  attention_score?: number
  face_detected?: boolean
  smile_detected?: boolean
  confidence?: number
}

function MetricBar({ label, value }: { label: string; value: number | undefined }) {
  if (value == null) return null
  const pct = Math.min(Math.round(value * 100), 100)
  return (
    <div className="list-item" style={{ padding: '10px 12px' }}>
      <div className="row" style={{ marginBottom: 6 }}>
        <p className="meta">{label}</p>
        <strong style={{ fontSize: 13 }}>{pct}%</strong>
      </div>
      <div className="progress">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function EngagementPage() {
  const [user, setUser] = useState<any>(null)
  const [summary, setSummary] = useState<any>(null)
  const [result, setResult] = useState<EngagementMetrics | null>(null)
  const [error, setError] = useState('')
  const [capturing, setCapturing] = useState(false)
  const [framesSent, setFramesSent] = useState(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const capturingRef = useRef(false)
  const userRef = useRef<any>(null)

  useEffect(() => {
    async function load() {
      try {
        const u = await getCurrentUser()
        setUser(u)
        userRef.current = u
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
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera not available in this browser')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      capturingRef.current = true
      setCapturing(true)
      captureLoop()
    } catch (err: any) {
      setError(err?.message || 'Failed to start camera')
    }
  }

  function stopCapture() {
    capturingRef.current = false
    setCapturing(false)
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.srcObject = null }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null }
  }

  let frameCount = 0
  function captureLoop() {
    if (!capturingRef.current) return
    if (!videoRef.current) { rafRef.current = requestAnimationFrame(captureLoop); return }

    frameCount++
    if (frameCount % 30 === 0) {
      const video = videoRef.current
      const w = video.videoWidth || 640
      const h = video.videoHeight || 480
      if (!canvasRef.current) {
        const c = document.createElement('canvas')
        c.width = w; c.height = h
        canvasRef.current = c
      }
      const ctx = canvasRef.current.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0, w, h)
        const b64 = canvasRef.current.toDataURL('image/jpeg', 0.7).replace(/^data:image\/(png|jpeg);base64,/, '')
        const uid = userRef.current?.id || 0
        analyzeVisualEngagement({ user_id: uid, session_id: `session-${Date.now()}`, frame_data: b64 })
          .then((res) => { setResult(res); setFramesSent((n) => n + 1) })
          .catch(() => {})
      }
    }
    rafRef.current = requestAnimationFrame(captureLoop)
  }

  const engagementLevel = result?.engagement_level || summary?.avg_engagement_level

  return (
    <div className="grid-two" style={{ alignItems: 'start' }}>
      <section className="card stack">
        <div className="section-title">
          <div>
            <h2>Engagement</h2>
            <p className="meta">Real-time visual engagement via webcam.</p>
          </div>
          {capturing && (
            <div className="row">
              <span className="badge success">Live</span>
              <span className="badge neutral">{framesSent} frames</span>
            </div>
          )}
        </div>

        <div className="video-wrap">
          <video ref={videoRef} playsInline muted style={{ width: '100%', borderRadius: 6, background: '#000' }} />
        </div>

        <div className="row">
          <button className="btn" onClick={startCapture} disabled={capturing}>Start camera</button>
          <button className="btn secondary" onClick={stopCapture} disabled={!capturing}>Stop camera</button>
        </div>

        {error && <p className="feedback error">{error}</p>}
        <p className="meta">Frames are sent for face detection and engagement scoring. The feed never leaves your browser.</p>
      </section>

      <aside className="card stack">
        <div className="section-title">
          <h3>Engagement metrics</h3>
          {engagementLevel && (
            <span className={`badge ${engagementLevel === 'high' ? 'success' : engagementLevel === 'low' ? 'danger' : ''}`}>
              {engagementLevel}
            </span>
          )}
        </div>

        {result ? (
          <div className="stack">
            <div className="list">
              <MetricBar label="Eye contact" value={result.eye_contact_ratio} />
              <MetricBar label="Head pose" value={result.head_pose_score} />
              <MetricBar label="Engagement" value={result.engagement_score ?? result.attention_score} />
              {result.confidence != null && <MetricBar label="Detection confidence" value={result.confidence} />}
            </div>
            <div className="list">
              {result.face_detected != null && (
                <div className="list-item" style={{ padding: '10px 12px' }}>
                  <div className="row">
                    <p className="meta">Face detected</p>
                    <span className={`badge ${result.face_detected ? 'success' : 'neutral'}`}>{result.face_detected ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : summary ? (
          <div className="stack">
            <h4>Session summary</h4>
            <div className="list">
              <MetricBar label="Avg eye contact" value={summary.avg_eye_contact_ratio} />
              <MetricBar label="Avg engagement" value={summary.avg_engagement_score} />
              {summary.total_sessions != null && (
                <div className="list-item" style={{ padding: '10px 12px' }}>
                  <p className="meta">Sessions: <strong>{summary.total_sessions}</strong></p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="empty-state" style={{ padding: '20px 0' }}>
            <p>No data yet.</p>
            <p className="meta">Start the camera to begin real-time analysis.</p>
          </div>
        )}
      </aside>
    </div>
  )
}
