import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { createVoiceSocket, getCurrentUser } from '../lib/api'

export default function VoicePage() {
  const [userId, setUserId] = useState<number>(0)
  const [connected, setConnected] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [transcript, setTranscript] = useState('')
  const [finalTranscripts, setFinalTranscripts] = useState<string[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const procRef = useRef<ScriptProcessorNode | null>(null)
  const mediaRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    getCurrentUser()
      .then((u) => { if (u?.id) setUserId(u.id) })
      .catch(() => {})
    return () => {
      stopStreaming()
      wsRef.current?.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function log(msg: string) {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 100))
  }

  function connect() {
    const sessionId = userId ? `user-${userId}` : `session-${Date.now()}`
    const ws = createVoiceSocket(sessionId, {
      onOpen: () => { setConnected(true); log('WebSocket connected') },
      onMessage: (data) => {
        try {
          const parsed = JSON.parse(data)
          if (parsed.partial) { setTranscript(parsed.partial); log(`partial: ${parsed.partial}`); return }
          if (parsed.transcript) {
            setTranscript(parsed.transcript)
            setFinalTranscripts((prev) => [parsed.transcript, ...prev].slice(0, 50))
            log(`transcript: ${parsed.transcript}`)
            return
          }
          log(`recv: ${JSON.stringify(parsed)}`)
        } catch {
          log(`recv: ${data}`)
        }
      },
      onError: () => { log('WebSocket error') },
    }) as WebSocket | null

    if (!ws) { log('WebSocket creation failed'); return }
    ws.onclose = () => { setConnected(false); log('WebSocket closed') }
    wsRef.current = ws
  }

  function disconnect() {
    stopStreaming()
    wsRef.current?.close()
    wsRef.current = null
  }

  async function startStreaming() {
    if (!connected) { log('Connect first'); return }
    if (!navigator.mediaDevices?.getUserMedia) { log('Microphone not available'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRef.current = stream
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioCtxRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      sourceRef.current = source
      const proc = audioCtx.createScriptProcessor(4096, 1, 1)
      procRef.current = proc
      proc.onaudioprocess = (e: AudioProcessingEvent) => {
        const pcm = floatTo16BitPCM(e.inputBuffer.getChannelData(0))
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          try { wsRef.current.send(pcm) } catch { /* ignore */ }
        }
      }
      source.connect(proc)
      proc.connect(audioCtx.destination)
      setStreaming(true)
      log('Microphone streaming started')
    } catch (err: any) {
      log(`Microphone error: ${err?.message || err}`)
    }
  }

  function stopStreaming() {
    setStreaming(false)
    try { procRef.current?.disconnect(); if (procRef.current) procRef.current.onaudioprocess = null } catch { /* */ }
    try { sourceRef.current?.disconnect() } catch { /* */ }
    try { audioCtxRef.current?.close() } catch { /* */ }
    mediaRef.current?.getTracks().forEach((t) => t.stop())
    procRef.current = null; sourceRef.current = null; audioCtxRef.current = null; mediaRef.current = null
    log('Microphone streaming stopped')
  }

  function floatTo16BitPCM(float32: Float32Array): ArrayBuffer {
    const buf = new ArrayBuffer(float32.length * 2)
    const view = new DataView(buf)
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]))
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    }
    return buf
  }

  return (
    <div className="teacher-dashboard student-dash">
      <section className="teacher-hero">
        <div>
          <p className="teacher-eyebrow">Realtime Audio</p>
          <h2 className="editorial-title">Voice Pipeline</h2>
          <p>WebSocket STT → LLM → TTS. Streams PCM16 audio frames.</p>
        </div>
        <div className="teacher-hero-note">
          <span>Connection</span>
          <strong style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 22 }}>
            <span style={{
              width: 9, height: 9, borderRadius: '50%',
              background: connected ? 'var(--success)' : 'var(--danger)', display: 'inline-block',
            }} />
            {connected ? 'Connected' : 'Disconnected'}
          </strong>
          {userId > 0 && <p>User ID: {userId}</p>}
        </div>
      </section>

      <div className="teacher-roster-nav">
        <Link href="/dashboard/admin" className="teacher-action primary">
          <span>01</span>
          Admin Dashboard
        </Link>
        <Link href="/hardware" className="teacher-action">
          <span>02</span>
          Hardware
        </Link>
      </div>

      <section className="teacher-kpi-grid">
        <div className="teacher-kpi-card">
          <p>Connection</p>
          <strong style={{ color: connected ? 'var(--success)' : 'var(--danger)' }}>
            {connected ? 'Connected' : 'Disconnected'}
          </strong>
        </div>
        <div className="teacher-kpi-card">
          <p>Microphone</p>
          <strong style={{ color: streaming ? 'var(--success)' : 'var(--muted)' }}>
            {streaming ? 'Streaming' : 'Idle'}
          </strong>
        </div>
        <div className="teacher-kpi-card">
          <p>Transcripts</p>
          <strong>{finalTranscripts.length}</strong>
        </div>
        <div className="teacher-kpi-card">
          <p>Events logged</p>
          <strong>{logs.length}</strong>
        </div>
      </section>

      <div className="teacher-layout">
        <section className="teacher-main">
          <section className="teacher-panel">
            <div className="teacher-panel-header">
              <div>
                <p className="teacher-eyebrow">Controls</p>
                <h3 className="editorial-title">Connection &amp; mic</h3>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <button type="button" className="skills-action primary" onClick={connect} disabled={connected}>
                Connect WS
              </button>
              <button type="button" className="skills-action secondary" onClick={disconnect} disabled={!connected}>
                Disconnect
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="skills-action primary" onClick={startStreaming} disabled={!connected || streaming}>
                Start microphone
              </button>
              <button type="button" className="skills-action secondary" onClick={stopStreaming} disabled={!streaming}>
                Stop microphone
              </button>
            </div>

            {streaming && (
              <p style={{
                marginTop: 16, marginBottom: 0, fontSize: 14, fontWeight: 600,
                color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                🎙️ Streaming PCM16 audio to server…
              </p>
            )}
          </section>

          <section className="teacher-panel">
            <div className="teacher-panel-header">
              <div>
                <p className="teacher-eyebrow">Live</p>
                <h3 className="editorial-title">Live transcript</h3>
              </div>
            </div>
            <div style={{
              padding: '14px 18px', borderRadius: 14, minHeight: 48,
              background: 'var(--bg)', border: '1px solid var(--border)',
            }}>
              {transcript ? (
                <p style={{ margin: 0, color: 'var(--text)', fontSize: 16, lineHeight: 1.6 }}>{transcript}</p>
              ) : (
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: 15 }}>Waiting for speech…</p>
              )}
            </div>
          </section>

          {finalTranscripts.length > 0 && (
            <section className="teacher-panel">
              <div className="teacher-panel-header">
                <div>
                  <p className="teacher-eyebrow">History</p>
                  <h3 className="editorial-title">Previous transcripts</h3>
                </div>
              </div>
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 8,
                maxHeight: 260, overflowY: 'auto',
              }}>
                {finalTranscripts.map((t, i) => (
                  <div key={i} style={{
                    padding: '10px 14px', borderRadius: 14,
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    fontSize: 14, color: 'var(--text)', lineHeight: 1.5,
                  }}>
                    {t}
                  </div>
                ))}
              </div>
            </section>
          )}
        </section>

        <aside className="teacher-actions">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p className="teacher-eyebrow" style={{ margin: 0 }}>Diagnostics</p>
              <h3 className="editorial-title" style={{ margin: 0 }}>Event log</h3>
            </div>
            {logs.length > 0 && (
              <button type="button" className="skills-mini-action" onClick={() => setLogs([])}>
                Clear
              </button>
            )}
          </div>

          <div style={{
            marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6,
            maxHeight: 280, overflowY: 'auto',
          }}>
            {logs.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>
                Events will appear here after connecting.
              </p>
            ) : (
              logs.map((l, i) => (
                <div key={i} style={{
                  padding: '8px 12px', borderRadius: 10,
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  fontSize: 13, color: 'var(--muted)', fontFamily: 'monospace', lineHeight: 1.5,
                }}>
                  {l}
                </div>
              ))
            )}
          </div>

          <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
            <p
              style={{
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                fontSize: 12,
                color: 'var(--muted)',
                margin: '0 0 10px'
              }}
            >How it works</p>
            <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8, fontSize: 14, color: 'var(--muted)' }}>
              <li>Click <strong style={{ color: 'var(--text)' }}>Connect WS</strong> to open a WebSocket to the backend voice endpoint.</li>
              <li>Click <strong style={{ color: 'var(--text)' }}>Start microphone</strong> to capture audio from your browser mic.</li>
              <li>Audio is converted to PCM16 and streamed frame-by-frame over WebSocket.</li>
              <li>The server performs STT, passes through the LLM, and streams TTS audio back.</li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  )
}
