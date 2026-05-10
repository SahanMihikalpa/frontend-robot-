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
    <div className="grid-two" style={{ alignItems: 'start' }}>
      <section className="card stack">
        <div className="section-title">
          <div>
            <h2>Voice Pipeline</h2>
            <p className="meta">WebSocket STT → LLM → TTS. Streams PCM16 audio frames.</p>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <span className={`status-dot ${connected ? 'online' : 'offline'}`} />
            <span className="meta">{connected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>

        <div className="row">
          <button type="button" className="btn" onClick={connect} disabled={connected}>
            Connect WS
          </button>
          <button type="button" className="btn secondary" onClick={disconnect} disabled={!connected}>
            Disconnect
          </button>
        </div>

        <div className="row">
          <button type="button" className="btn" onClick={startStreaming} disabled={!connected || streaming}>
            Start microphone
          </button>
          <button type="button" className="btn secondary" onClick={stopStreaming} disabled={!streaming}>
            Stop microphone
          </button>
        </div>

        {streaming && (
          <p className="feedback info">Streaming PCM16 audio to server…</p>
        )}

        <div className="stack">
          <h4 style={{ margin: 0 }}>Live transcript</h4>
          <div className="list-item" style={{ minHeight: 48 }}>
            {transcript ? (
              <p style={{ margin: 0 }}>{transcript}</p>
            ) : (
              <p className="meta" style={{ margin: 0 }}>Waiting for speech…</p>
            )}
          </div>
        </div>

        {finalTranscripts.length > 0 && (
          <div className="stack">
            <h4 style={{ margin: 0 }}>Previous transcripts</h4>
            <div className="logs">
              {finalTranscripts.map((t, i) => (
                <div key={i} className="log-item">{t}</div>
              ))}
            </div>
          </div>
        )}
      </section>

      <aside className="card stack">
        <div className="section-title">
          <h3>Event log</h3>
          {logs.length > 0 && (
            <button type="button" className="btn ghost small" onClick={() => setLogs([])}>Clear</button>
          )}
        </div>

        <div className="logs">
          {logs.length === 0 ? (
            <p className="meta">Events will appear here after connecting.</p>
          ) : (
            logs.map((l, i) => <div key={i} className="log-item">{l}</div>)
          )}
        </div>

        <div className="stack" style={{ marginTop: 8 }}>
          <h4 style={{ margin: 0 }}>How it works</h4>
          <div className="list-item" style={{ padding: '10px 14px' }}>
            <ol className="meta" style={{ margin: 0, paddingLeft: 16, lineHeight: 1.8 }}>
              <li>Click <strong>Connect WS</strong> to open a WebSocket to the backend voice endpoint.</li>
              <li>Click <strong>Start microphone</strong> to capture audio from your browser mic.</li>
              <li>Audio is converted to PCM16 and streamed frame-by-frame over WebSocket.</li>
              <li>The server performs STT, passes through the LLM, and streams TTS audio back.</li>
            </ol>
          </div>
          {userId > 0 && (
            <p className="meta">Session bound to user ID: <strong>{userId}</strong></p>
          )}
        </div>
      </aside>
    </div>
  )
}
